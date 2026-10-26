import { DEFAULT_LANGUAGE, isLanguage, languages, type Language } from '../../../shared/languages';
import { useEffect, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MAX_TURNS } from '../../../shared/conversation';
import { useConversation } from './use-conversation';
import { useAudioPlayer } from './use-audio-player';
import { useRecorder } from './use-recorder';
import { ConversationHeader } from './conversation-header';
import { ConversationNotices } from './conversation-notices';
import { WelcomeState } from './welcome-state';
import { ConversationComposer } from './conversation-composer';
import { LearningPanel } from './learning-panel';
import { ConversationActivity } from './conversation-activity';
import { useConversationActivity } from './use-conversation-activity';

export function ConversationPage({ sessionId, onNew, onSignOut }: { sessionId: string; onNew: () => void; onSignOut: () => void }) {
	const conversation = useConversation(sessionId);
	const { state, connected, loaded, submitting } = conversation;
	const [selectedLanguage, setSelectedLanguage] = useState<Language>(() => {
		try {
			const saved = localStorage.getItem('lingo-language');
			return isLanguage(saved) ? saved : DEFAULT_LANGUAGE;
		} catch { return DEFAULT_LANGUAGE; }
	});
	const language = state.turns.length ? state.language : selectedLanguage;
	const languageInfo = languages[language];
	const player = useAudioPlayer(conversation.base);
	const [viewedId, setViewedId] = useState<string | null>(null);
	const autoplay = useRef<string | null>(null);
	const content = useRef<HTMLElement | null>(null);
	const latency = useRef<{ id: string; started: number; text: boolean; reply: boolean; audio: boolean } | null>(null);
	const send = async (input: Blob | null) => {
		player.stop();
		void player.unlock().catch(() => {});
		const id = crypto.randomUUID();
		latency.current = { id, started: performance.now(), text: false, reply: false, audio: false };
		autoplay.current = id;
		setViewedId(null);
		const accepted = await conversation.send(input, id, language);
		if (!accepted) autoplay.current = null;
		return !!accepted;
	};
	const recorder = useRecorder((blob) => {
		void send(blob);
	});
	const recording = recorder.status !== 'idle';
	const busy = submitting || state.phase !== 'idle';
	const activity = useConversationActivity({ busy, submitting, connected, state, partial: conversation.partial, error: !!conversation.error });
	const latest = state.turns.at(-1);
	const latestReply = state.turns.findLast((turn) => turn.assistant);
	const viewed = state.turns.find((turn) => turn.id === viewedId) || latestReply;
	const error = conversation.error || recorder.error || player.error;
	const exhausted = state.turns.length >= MAX_TURNS;
	const disabled = !loaded || !connected || busy || exhausted;

	useEffect(() => {
		setViewedId(null);
	}, [latestReply?.id]);

	useEffect(() => {
		if (latest?.assistant && autoplay.current === latest.id) {
			autoplay.current = null;
			void player.play(latest.assistant.id);
		}
	}, [latest?.id, latest?.assistant?.id, player.play]);

	useEffect(() => {
		const current = latency.current;
		if (!current || latest?.id !== current.id) return;
		const mark = (key: 'text' | 'reply' | 'audio', stage: string, ready: boolean) => {
			if (!ready || current[key]) return;
			current[key] = true;
			console.info(JSON.stringify({ event: 'latency', stage, turnId: current.id, ms: Math.round(performance.now() - current.started) }));
		};
		mark('text', 'turn_first_text', !!conversation.partial || !!latest.assistant);
		mark('reply', 'turn_reply_complete', !!latest.assistant);
		mark('audio', 'turn_first_audio', player.playingId === `${current.id}-assistant` && !player.loading);
	}, [conversation.partial, latest, player.playingId, player.loading]);

	let status = connected ? '편하게 이야기해요' : '다시 연결하고 있어요';
	if (player.playingId) status = player.loading ? '음성 준비 중' : 'AI 음성 재생 중';
	if (busy) status = 'AI가 생각하는 중';
	if (state.phase === 'transcribing') status = '말씀을 확인하고 있어요';
	if (recording) status = '내가 말하는 중';

	return (
		<div className="flex h-dvh flex-col overflow-hidden bg-background">
			<ConversationHeader
				turns={state.turns}
				language={language}
				recording={recording}
				busy={busy}
				onNew={onNew}
				onSignOut={onSignOut}
				onSelect={(id) => {
					player.stop();
					setViewedId(id);
				}}
			/>
			<main ref={content} className="mx-auto min-h-0 w-full max-w-xl flex-1 space-y-6 overflow-y-auto px-4 py-8 sm:px-6 sm:py-10">
				<div className="flex items-center justify-between gap-3">
					<Badge variant="secondary" className="gap-2 py-1.5" role="status">
						<span className={`size-1.5 rounded-full ${recording ? 'bg-red-500' : 'bg-emerald-600'}`} />
						{status}
					</Badge>
					<span className="text-xs text-muted-foreground">{languageInfo.badge} ↔ 한국어</span>
				</div>
				<div className="space-y-2">
					<label htmlFor="learning-language" className="text-sm font-medium">학습 언어</label>
					<select
						id="learning-language"
						value={language}
						disabled={!loaded || !connected || busy || recording || state.turns.length > 0 || conversation.canRetrySend}
						onChange={(event) => {
							if (!isLanguage(event.target.value)) return;
							setSelectedLanguage(event.target.value);
							try { localStorage.setItem('lingo-language', event.target.value); } catch { /* The selection still works in this tab. */ }
						}}
						className="min-h-11 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-60"
					>
						{Object.entries(languages).map(([code, item]) => <option key={code} value={code}>{item.label}</option>)}
					</select>
					{state.turns.length > 0 && <p className="text-xs text-muted-foreground">언어를 바꾸려면 새 대화를 시작해 주세요.</p>}
				</div>
				<ConversationNotices
					error={error}
					turn={latest}
					disabled={submitting || recording || busy || !connected}
					canRetrySend={!!conversation.error && conversation.canRetrySend}
					onRetrySend={() => void conversation.retrySend()}
					onRetryTurn={() => latest && void conversation.retry('turn', latest.id)}
					onDismiss={() => {
						conversation.clearError();
						recorder.clearError();
						player.clearError();
					}}
				/>
				{!latestReply && !busy && !latest?.error && <WelcomeState language={language} disabled={disabled || recording} onStart={() => void send(null)} />}
				{(busy || latest?.error || (conversation.error && activity.elapsed !== null) || (latest && viewed?.id === latest.id)) && (
					<ConversationActivity
						key={state.activeTurnId ?? latest?.id ?? 'sending'}
						stage={activity.stage}
						elapsed={activity.elapsed}
						turn={activity.turn}
						busy={busy}
						player={player}
						userLanguage={languageInfo.tag}
					/>
				)}
				{(conversation.partial || (!busy && viewed?.assistant)) && (
					<>
						{!busy && viewed?.id !== latestReply?.id && (
							<Button variant="secondary" className="min-h-11 w-full" onClick={() => setViewedId(null)}>
								<ArrowDown /> 새 대화 보기
							</Button>
						)}
						<div className="space-y-2">
							<p className="text-xs text-muted-foreground">
								{busy ? '지금 작성하고 있는 이야기' : viewed?.id !== latestReply?.id ? '이전 대화를 살펴보고 있어요' : '지금 이어갈 이야기'}
							</p>
							<p lang={languageInfo.tag} aria-busy={busy} className="text-xl leading-relaxed font-medium break-words sm:text-2xl">
								{conversation.partial || viewed?.assistant?.text}
								{busy && <span aria-hidden="true" className="activity-cursor ml-1 inline-block h-5 w-0.5 translate-y-0.5 bg-foreground/60" />}
							</p>
						</div>
						{!busy && viewed && <LearningPanel
							language={language}
							turn={viewed}
							player={player}
							recording={recording}
							scrollContainer={content}
							onRetry={() => void conversation.retry('learning', viewed.id)}
						/>}
					</>
				)}
				{exhausted && (
					<p role="status" className="rounded-xl bg-muted p-4 text-sm">
						40턴을 함께 이야기했어요. 기록을 복습하거나 새 대화를 시작해 주세요.
					</p>
				)}
			</main>
			<ConversationComposer
				recorder={recorder}
				disabled={disabled}
				busy={busy}
				onRecord={() => {
					player.stop();
					void player.unlock().catch(() => {});
					void recorder.start();
				}}
			/>
		</div>
	);
}
