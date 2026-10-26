import { Agent, type Connection, type FiberRecoveryContext } from 'agents';
import { initialConversation, MAX_TURNS, pendingLearning, type ConversationState, type Turn } from '../../shared/conversation';
import { readTurnInput, type TurnInput } from '../conversation/requests';
import { createReply, transcribe } from '../services/conversation';
import { createLearning } from '../services/learning';
import { errorMessage, requireApiKey, ServiceError, type GeminiEnv } from '../services/gemini';
import { synthesize } from '../services/speech';
import { decodeBase64, encodeBase64 } from '../services/encoding';

type Job = { kind: 'turn'; input: TurnInput } | { kind: 'learning'; turnId: string };

export class LingoAgent extends Agent<Env & GeminiEnv, ConversationState> {
	initialState = initialConversation;
	private audioRequests = new Map<string, Promise<Uint8Array>>();
	private runningJobs = new Set<string>();

	validateStateChange(_state: ConversationState, source: Connection | 'server') {
		if (source !== 'server') throw new Error('Conversation state is server-owned.');
	}

	async onRequest(request: Request) {
		const path = new URL(request.url).pathname;
		try {
			if (request.method === 'GET' && path.endsWith('/health')) return Response.json({ status: 'ok' });
			if (request.method === 'GET' && path.endsWith('/state'))
				return Response.json(this.state, { headers: { 'Cache-Control': 'no-store' } });
			if (request.method === 'POST' && path.endsWith('/turns')) {
				requireApiKey(this.env);
				this.acceptTurn(await readTurnInput(request));
				return Response.json(this.state, { status: 202 });
			}
			const retry = path.match(/\/retry\/(turn|learning)\/([a-zA-Z0-9-]+)$/);
			if (request.method === 'POST' && retry) {
				if (retry[1] === 'turn') await this.retryTurn(retry[2]);
				else await this.retryLearning(retry[2]);
				return Response.json(this.state, { status: 202 });
			}
			const audio = path.match(/\/audio\/([a-zA-Z0-9-]+)$/);
			if (request.method === 'GET' && audio) {
				const bytes = await this.getAudio(audio[1]);
				return new Response(bytes, { headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'private, max-age=86400' } });
			}
			return Response.json({ error: 'Not found' }, { status: 404 });
		} catch (error) {
			return Response.json({ error: errorMessage(error) }, { status: error instanceof ServiceError ? error.status : 500 });
		}
	}

	private publish(patch: Partial<ConversationState>) {
		this.setState({ ...this.state, ...patch, revision: this.state.revision + 1 });
	}

	private turn(id: string) {
		const turn = this.state.turns.find((item) => item.id === id);
		if (!turn) throw new ServiceError('대화를 찾지 못했어요.', 404);
		return turn;
	}

	private updateTurn(id: string, patch: Partial<Turn>) {
		this.publish({ turns: this.state.turns.map((turn) => (turn.id === id ? { ...turn, ...patch } : turn)) });
	}

	private acceptTurn(input: TurnInput) {
		// Idempotency is checked before the busy/stale-turn guards for safe reconnects.
		if (this.state.turns.some((turn) => turn.id === input.id)) return;
		if (this.state.phase !== 'idle') throw new ServiceError('이전 답변을 준비하고 있어요.', 409);
		if (this.state.turns.length >= MAX_TURNS)
			throw new ServiceError('새 대화를 시작해 주세요. 한 대화에는 최대 40턴까지 담을 수 있어요.', 409);
		const latest = this.state.turns.at(-1);
		if ((latest?.id ?? null) !== input.replyTo) throw new ServiceError('새 답변이 도착했어요. 최신 대화를 확인해 주세요.', 409);
		if (latest && ((!latest.assistant && !latest.error) || !input.audio))
			throw new ServiceError('녹음해 주세요.', 400);
		this.publish({
			phase: input.audio ? 'transcribing' : 'thinking',
			activeTurnId: input.id,
			turns: [
				...this.state.turns,
				{
					id: input.id,
					source: input.audio ? 'audio' : input.text ? 'text' : 'opening',
					userText: input.text,
					assistant: null,
					learning: pendingLearning(),
				},
			],
		});
		this.launch({ kind: 'turn', input });
	}

	async retryTurn(id: string) {
		requireApiKey(this.env);
		const turn = this.turn(id);
		if (this.state.phase !== 'idle' || this.state.turns.at(-1)?.id !== id || !turn.error)
			throw new ServiceError('현재 턴만 다시 시도할 수 있어요.', 409);
		if (!turn.userText && !turn.recording && turn.source !== 'opening')
			throw new ServiceError('말소리를 다시 녹음해 주세요.', 422);
		this.updateTurn(id, { error: undefined });
		this.publish({ phase: turn.recording && !turn.userText ? 'transcribing' : 'thinking', activeTurnId: id });
		this.launch({ kind: 'turn', input: { id, text: turn.userText, replyTo: null } });
	}

	async retryLearning(id: string) {
		requireApiKey(this.env);
		const turn = this.turn(id);
		if (!turn.assistant || turn.learning.status !== 'error') return;
		this.updateTurn(id, { learning: pendingLearning() });
		this.launch({ kind: 'learning', turnId: id });
	}

	private launch(job: Job) {
		const key = `${job.kind}:${job.kind === 'turn' ? job.input.id : job.turnId}`;
		if (this.runningJobs.has(key)) return;
		this.runningJobs.add(key);
		return this.runFiber(job.kind, async (context) => {
			context.stash(job);
			await this.execute(job);
		})
			.catch((error: unknown) => {
				const id = job.kind === 'turn' ? job.input.id : job.turnId;
				if (job.kind === 'learning') {
					this.updateTurn(id, { learning: { ...this.turn(id).learning, status: 'error', error: errorMessage(error) } });
				} else {
					this.updateTurn(id, { error: errorMessage(error) });
					if (this.state.activeTurnId === id) this.publish({ phase: 'idle', activeTurnId: null });
				}
			})
			.finally(() => this.runningJobs.delete(key));
	}

	async onFiberRecovered(context: FiberRecoveryContext) {
		const job = context.snapshot as Job | null;
		if (job && (job.kind === 'turn' || job.kind === 'learning')) await this.launch(job);
	}

	private async execute(job: Job) {
		const id = job.kind === 'turn' ? job.input.id : job.turnId;
		let turn = this.turn(id);
		if (job.kind === 'learning') {
			if (turn.learning.status === 'ready') return;
			const result = await createLearning(this.env, turn);
			this.updateTurn(id, {
				assistant: { ...turn.assistant!, translation: result.translation, explanation: result.explanation },
				learning: result.learning,
			});
			return;
		}
		if (job.input.audio && !turn.recording) {
			const recording = { key: this.audioKey('recordings', id), mimeType: job.input.audio.mimeType };
			await this.env.AUDIO_BUCKET.put(recording.key, decodeBase64(job.input.audio.data), {
				httpMetadata: { contentType: recording.mimeType },
			});
			this.updateTurn(id, { recording });
			turn = this.turn(id);
		}
		if (turn.recording) {
			// Recovery reads the original from R2 instead of retaining audio in the checkpoint.
			this.stash({ kind: 'turn', input: { ...job.input, audio: undefined, text: turn.userText } });
		}
		if (turn.recording && !turn.userText) {
			const audio = await this.env.AUDIO_BUCKET.get(turn.recording.key);
			if (!audio) throw new ServiceError('저장된 원본 음성을 찾지 못했어요. 다시 녹음해 주세요.', 404);
			const userText = await transcribe(this.env, encodeBase64(new Uint8Array(await audio.arrayBuffer())), turn.recording.mimeType);
			this.updateTurn(id, { userText });
			this.stash({ kind: 'turn', input: { ...job.input, audio: undefined, text: userText } });
			this.publish({ phase: 'thinking' });
			turn = this.turn(id);
		}
		if (!turn.assistant) this.updateTurn(id, { assistant: await createReply(this.env, this.state.turns, turn) });
		if (this.state.activeTurnId === id) this.publish({ phase: 'idle', activeTurnId: null });
		if (this.turn(id).learning.status === 'pending') this.launch({ kind: 'learning', turnId: id });
	}

	private async getAudio(id: string): Promise<Uint8Array> {
		const expressions = this.state.turns.flatMap((turn) => [
			turn.assistant,
			...turn.learning.suggestions,
			turn.learning.feedback?.improved,
		]);
		const expression = expressions.find((item) => item?.id === id);
		if (!expression) throw new ServiceError('재생할 문장을 찾지 못했어요.', 404);
		const pending = this.audioRequests.get(id);
		if (pending) return pending;
		const request = this.loadGeneratedAudio(id, expression.text);
		this.audioRequests.set(id, request);
		try {
			return await request;
		} finally {
			this.audioRequests.delete(id);
		}
	}

	private audioKey(kind: 'recordings' | 'generated', id: string) {
		return `sessions/${this.ctx.id.toString()}/${kind}/${id}`;
	}

	private async loadGeneratedAudio(id: string, text: string): Promise<Uint8Array> {
		const key = this.audioKey('generated', id);
		const cached = await this.env.AUDIO_BUCKET.get(key);
		if (cached) return new Uint8Array(await cached.arrayBuffer());
		// Copy existing SQLite audio on first playback without regenerating or deleting it.
		const legacyTable = this.ctx.storage.sql.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'audio_cache'").toArray();
		const legacy = legacyTable.length
			? this.ctx.storage.sql.exec<{ audio: ArrayBuffer }>('SELECT audio FROM audio_cache WHERE id = ?', id).toArray()[0]
			: undefined;
		const bytes = legacy ? new Uint8Array(legacy.audio) : await synthesize(this.env, text);
		await this.env.AUDIO_BUCKET.put(key, bytes, { httpMetadata: { contentType: 'audio/wav' } });
		return bytes;
	}
}
