import { env, exports } from 'cloudflare:workers';
import { runInDurableObject } from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConversationState } from '../src/shared/conversation';
import { encodeBase64 } from '../src/worker/services/encoding';
import { learningResponse, textResponse, wavBytes } from './fixtures';

afterEach(() => {
	vi.restoreAllMocks();
});

function endpoint(session: string, path: string) {
	return `https://example.com/agents/lingo-agent/${session}${path}`;
}
async function state(session: string) {
	return (await exports.default.fetch(endpoint(session, '/state'))).json<ConversationState>();
}
async function send(session: string, id: string, text: string | null, replyTo?: string) {
	const response = await exports.default.fetch(endpoint(session, '/turns'), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'X-Request-Id': id, ...(replyTo ? { 'X-Reply-To': replyTo } : {}) },
		body: JSON.stringify({ text }),
	});
	await response.arrayBuffer();
	return response;
}
function mockGoogle(onTranscribe?: () => Promise<void>) {
	return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
		const request = new Request(url, init);
		const body = await request.json<{
			generationConfig: { responseJsonSchema?: unknown };
			contents: { parts: { inlineData?: unknown }[] }[];
		}>();
		if (request.url.endsWith('/interactions'))
			return Response.json({
				steps: [{ type: 'model_output', content: [{ type: 'audio', mime_type: 'audio/wav', data: encodeBase64(wavBytes()) }] }],
			});
		if (body.generationConfig.responseJsonSchema) return textResponse(JSON.stringify(learningResponse));
		if (body.contents[0]?.parts[0]?.inlineData) {
			await onTranscribe?.();
			return textResponse('I go shopping yesterday.');
		}
		return textResponse('What do you usually do on weekends?');
	});
}
async function ready(session: string, count = 1) {
	await vi.waitFor(async () => {
		const current = await state(session);
		expect(current.phase).toBe('idle');
		expect(current.turns).toHaveLength(count);
		expect(current.turns.at(-1)?.learning.status).toBe('ready');
	});
	return state(session);
}

describe('Conversation Agent', () => {
	it('checkpoints the transcript without retaining raw audio while the reply is generated', async () => {
		const session = crypto.randomUUID();
		const id = crypto.randomUUID();
		vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
			const body = await new Request(url, init).json<{
				generationConfig: { responseJsonSchema?: unknown };
				contents: { parts: { inlineData?: unknown }[] }[];
			}>();
			if (body.contents[0]?.parts[0]?.inlineData) return textResponse('I go shopping yesterday.');
			if (body.generationConfig.responseJsonSchema) return textResponse(JSON.stringify(learningResponse));
			await new Promise((resolve) => setTimeout(resolve, 300));
			return textResponse('What do you usually do on weekends?');
		});
		const accepted = await exports.default.fetch(endpoint(session, '/turns'), {
			method: 'POST',
			headers: { 'Content-Type': 'audio/webm', 'X-Request-Id': id },
			body: new Uint8Array([1, 2, 3]),
		});
		await accepted.arrayBuffer();
		await vi.waitFor(async () => expect((await state(session)).phase).toBe('thinking'));
		const checkpoint = await runInDurableObject(env.LingoAgent.getByName(session), (_agent, context) =>
			context.storage.sql.exec<{ snapshot: string }>("SELECT snapshot FROM cf_agents_runs WHERE name = 'turn'").one(),
		);
		expect(JSON.parse(checkpoint.snapshot)).toEqual({ kind: 'turn', input: { id, replyTo: null, text: 'I go shopping yesterday.' } });
		await ready(session);
	});

	it('creates a reply, three suggestions, feedback, and persists the session in SQLite', async () => {
		const google = mockGoogle();
		const session = crypto.randomUUID();
		const id = crypto.randomUUID();
		expect((await send(session, id, 'I go shopping yesterday.')).status).toBe(202);
		const current = await ready(session);
		expect(current.turns[0].assistant?.translation).toBe(learningResponse.translation);
		expect(current.turns[0].learning.suggestions).toHaveLength(3);
		expect(current.turns[0].learning.feedback?.improved?.text).toBe('I went shopping yesterday.');
		const calls = google.mock.calls.length;
		expect((await send(session, id, 'I go shopping yesterday.')).status).toBe(202);
		expect(google).toHaveBeenCalledTimes(calls);
		const persisted = await runInDurableObject(env.LingoAgent.getByName(session), (_agent, context) =>
			context.storage.sql
				.exec<{ state: string }>('SELECT state FROM cf_agents_state')
				.toArray()
				.map((row) => JSON.parse(row.state)),
		);
		expect(persisted).toContainEqual(current);
		expect((await state(crypto.randomUUID())).turns).toEqual([]);
	});

	it('stores the original audio in R2 before transcription and retains it afterwards', async () => {
		const session = crypto.randomUUID();
		const id = crypto.randomUUID();
		const bytes = new Uint8Array([1, 2, 3]);
		const google = mockGoogle(async () => {
			const key = `sessions/${env.LingoAgent.idFromName(session).toString()}/recordings/${id}`;
			expect(new Uint8Array(await (await env.AUDIO_BUCKET.get(key))!.arrayBuffer())).toEqual(bytes);
			const checkpoint = await runInDurableObject(env.LingoAgent.getByName(session), (_agent, context) =>
				context.storage.sql.exec<{ snapshot: string }>("SELECT snapshot FROM cf_agents_runs WHERE name = 'turn'").one(),
			);
			expect(JSON.parse(checkpoint.snapshot).input.audio).toBeUndefined();
		});
		const response = await exports.default.fetch(endpoint(session, '/turns'), {
			method: 'POST',
			headers: { 'Content-Type': 'audio/webm;codecs=opus', 'X-Request-Id': id },
			body: bytes,
		});
		expect(response.status).toBe(202);
		const current = await ready(session);
		expect(current.turns[0].userText).toBe('I go shopping yesterday.');
		expect(current.turns[0].source).toBe('audio');
		const recording = current.turns[0].recording!;
		const stored = await env.AUDIO_BUCKET.get(recording.key);
		expect(stored?.httpMetadata?.contentType).toBe('audio/webm');
		expect(new Uint8Array(await stored!.arrayBuffer())).toEqual(bytes);
		const transcriptionCall = google.mock.calls.find(([, init]) => String(init?.body).includes('inlineData'))!;
		expect(JSON.parse(String(transcriptionCall[1]?.body)).contents[0].parts[0].inlineData.data).toBe(encodeBase64(bytes));
		const calls = google.mock.calls.length;
		const duplicate = await exports.default.fetch(endpoint(session, '/turns'), {
			method: 'POST',
			headers: { 'Content-Type': 'audio/webm', 'X-Request-Id': id },
			body: new Uint8Array([9]),
		});
		expect(duplicate.status).toBe(202);
		expect(new Uint8Array(await (await env.AUDIO_BUCKET.get(recording.key))!.arrayBuffer())).toEqual(bytes);
		expect(google).toHaveBeenCalledTimes(calls);
	});

	it.each(['assistant', 'suggestion-2', 'improved'])(
		'stores %s audio in R2 and reuses it on concurrent requests and replay',
		async (expression) => {
			const google = mockGoogle();
			const session = crypto.randomUUID();
			const id = crypto.randomUUID();
			await send(session, id, null);
			await ready(session);
			const expressionId = `${id}-${expression}`;
			const audioUrl = endpoint(session, `/audio/${expressionId}`);
			const [first, concurrent] = await Promise.all([exports.default.fetch(audioUrl), exports.default.fetch(audioUrl)]);
			expect(first.status).toBe(200);
			expect(first.headers.get('Content-Type')).toBe('audio/wav');
			expect(new Uint8Array(await first.arrayBuffer())).toEqual(wavBytes());
			expect(new Uint8Array(await concurrent.arrayBuffer())).toEqual(wavBytes());
			const key = `sessions/${env.LingoAgent.idFromName(session).toString()}/generated/${expressionId}`;
			const cached = await env.AUDIO_BUCKET.get(key);
			expect(cached?.httpMetadata?.contentType).toBe('audio/wav');
			expect(new Uint8Array(await cached!.arrayBuffer())).toEqual(wavBytes());
			const tables = await runInDurableObject(env.LingoAgent.getByName(session), (_agent, context) =>
				context.storage.sql.exec("SELECT name FROM sqlite_master WHERE name = 'audio_cache'").toArray(),
			);
			expect(tables).toEqual([]);
			expect((await exports.default.fetch(audioUrl)).status).toBe(200);
			expect(google.mock.calls.filter(([url]) => (url instanceof Request ? url.url : String(url)).endsWith('/interactions'))).toHaveLength(
				1,
			);
			expect((await exports.default.fetch(endpoint(session, '/audio/missing'))).status).toBe(404);
			expect((await exports.default.fetch(endpoint(crypto.randomUUID(), `/audio/${expressionId}`))).status).toBe(404);
		},
	);

	it('copies legacy SQLite audio to R2 on playback without calling TTS', async () => {
		const google = mockGoogle();
		const session = crypto.randomUUID();
		const id = crypto.randomUUID();
		await send(session, id, null);
		await ready(session);
		const expressionId = `${id}-assistant`;
		await runInDurableObject(env.LingoAgent.getByName(session), (_agent, context) => {
			context.storage.sql.exec('CREATE TABLE audio_cache (id TEXT PRIMARY KEY, audio BLOB NOT NULL)');
			context.storage.sql.exec('INSERT INTO audio_cache (id, audio) VALUES (?, ?)', expressionId, wavBytes());
		});
		const calls = google.mock.calls.length;
		const response = await exports.default.fetch(endpoint(session, `/audio/${expressionId}`));
		expect(new Uint8Array(await response.arrayBuffer())).toEqual(wavBytes());
		const key = `sessions/${env.LingoAgent.idFromName(session).toString()}/generated/${expressionId}`;
		expect(new Uint8Array(await (await env.AUDIO_BUCKET.get(key))!.arrayBuffer())).toEqual(wavBytes());
		expect(google).toHaveBeenCalledTimes(calls);
	});

	it('rejects an overlapping turn and stale reply targets', async () => {
		const session = crypto.randomUUID();
		const google = vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async () => {
			await new Promise((resolve) => setTimeout(resolve, 100));
			return textResponse('What do you usually do on weekends?');
		});
		const first = crypto.randomUUID();
		expect((await send(session, first, 'Hello.')).status).toBe(202);
		expect((await send(session, crypto.randomUUID(), 'Another answer.', first)).status).toBe(409);
		google.mockImplementation(async () => textResponse(JSON.stringify(learningResponse)));
		await ready(session);
		expect((await send(session, crypto.randomUUID(), 'A stale answer.')).status).toBe(409);
	});

	it('keeps the reply available when learning fails and retries only the learning job', async () => {
		const session = crypto.randomUUID();
		const id = crypto.randomUUID();
		const google = vi
			.spyOn(globalThis, 'fetch')
			.mockImplementationOnce(async () => textResponse('What do you usually do on weekends?'))
			.mockImplementationOnce(async () => new Response('unavailable', { status: 503 }));
		await send(session, id, 'I go shopping yesterday.');
		await vi.waitFor(async () => expect((await state(session)).turns[0]?.learning.status).toBe('error'));
		expect((await state(session)).turns[0].assistant?.text).toBeTruthy();
		expect((await state(session)).phase).toBe('idle');
		google.mockImplementationOnce(async () => textResponse(JSON.stringify(learningResponse)));
		await env.LingoAgent.getByName(session).retryLearning(id);
		await ready(session);
		expect(google).toHaveBeenCalledTimes(3);
	});

	it('retries transcription from the R2 original without another upload', async () => {
		const session = crypto.randomUUID();
		const google = vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async () => textResponse('[NO_SPEECH]'));
		const first = crypto.randomUUID();
		await exports.default.fetch(endpoint(session, '/turns'), {
			method: 'POST',
			headers: { 'Content-Type': 'audio/webm', 'X-Request-Id': first },
			body: new Uint8Array([1]),
		});
		await vi.waitFor(async () => expect((await state(session)).turns[0]?.error).toBeTruthy());
		const recording = (await state(session)).turns[0].recording!;
		expect(await env.AUDIO_BUCKET.head(recording.key)).not.toBeNull();
		google.mockRestore();
		const retryGoogle = mockGoogle();
		await env.LingoAgent.getByName(session).retryTurn(first);
		const current = await ready(session);
		expect(current.turns[0].recording).toEqual(recording);
		expect(current.turns[0].userText).toBe('I go shopping yesterday.');
		expect(current.turns[0].error).toBeUndefined();
		expect(retryGoogle).toHaveBeenCalledTimes(3);
		expect((await send(session, crypto.randomUUID(), 'Hello.', first)).status).toBe(202);
		await ready(session, 2);
	});

	it('reports a missing R2 original without sending another transcription request', async () => {
		const session = crypto.randomUUID();
		const id = crypto.randomUUID();
		const google = vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async () => textResponse('[NO_SPEECH]'));
		await exports.default.fetch(endpoint(session, '/turns'), {
			method: 'POST',
			headers: { 'Content-Type': 'audio/webm', 'X-Request-Id': id },
			body: new Uint8Array([1, 2, 3]),
		});
		await vi.waitFor(async () => expect((await state(session)).turns[0]?.error).toBeTruthy());
		const recording = (await state(session)).turns[0].recording!;
		await env.AUDIO_BUCKET.delete(recording.key);
		await env.LingoAgent.getByName(session).retryTurn(id);
		await vi.waitFor(async () => {
			const current = await state(session);
			expect(current.phase).toBe('idle');
			expect(current.turns[0].error).toContain('원본 음성을 찾지 못했어요');
		});
		expect(google).toHaveBeenCalledTimes(1);
	});
});
