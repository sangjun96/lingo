import { useEffect, useRef, useState } from 'react';
import { ArrowDown, LoaderCircle } from 'lucide-react';
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

export function ConversationPage({ sessionId, onNew, onSignOut }: { sessionId: string; onNew: () => void; onSignOut: () => void }) {
	const conversation = useConversation(sessionId);
	const { state, connected, loaded, submitting } = conversation;
	const player = useAudioPlayer(conversation.base);
	const [viewedId, setViewedId] = useState<string | null>(null);
	const autoplay = useRef<string | null>(null);
	const content = useRef<HTMLElement | null>(null);
	const send = async (input: Blob | null) => {
		player.stop();
		const id = crypto.randomUUID();
		autoplay.current = id;
		setViewedId(null);
		const accepted = await conversation.send(input, id);
		if (!accepted) autoplay.current = null;
		return !!accepted;
	};
	const recorder = useRecorder((blob) => {
		void send(blob);
	});
	const recording = recorder.status !== 'idle';
	const busy = submitting || state.phase !== 'idle';
	const latest = state.turns.at(-1);
	const latestReply = state.turns.findLast((turn) => turn.assistant);
	const viewed = state.turns.find((turn) => turn.id === viewedId) || latestReply;
	const error = conversation.error || recorder.error || player.error;
	const exhausted = state.turns.length >= MAX_TURNS;
	const disabled = !loaded || !connected || busy || exhausted;

	useEffect(() => {
		if (latest?.assistant && autoplay.current === latest.id) {
			autoplay.current = null;
			void player.play(latest.assistant.id);
		}
	}, [latest?.id, latest?.assistant?.id, player.play]);

	let status = connected ? '편하게 이야기해요' : '다시 연결하고 있어요';
	if (player.playingId) status = player.loading ? '음성 준비 중' : 'AI 음성 재생 중';
	if (busy) status = 'AI가 생각하는 중';
	if (state.phase === 'transcribing') status = '말씀을 확인하고 있어요';
	if (recording) status = '내가 말하는 중';

	return (
		<div className="flex h-dvh flex-col overflow-hidden bg-background">
			<ConversationHeader
				turns={state.turns}
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
					<span className="text-xs text-muted-foreground">EN ↔ 한국어</span>
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
				{!latestReply && !busy && !latest?.error && <WelcomeState disabled={disabled || recording} onStart={() => void send(null)} />}
				{busy && (
					<div role="status" className="flex items-center gap-3 rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
						<LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
						{state.phase === 'transcribing' ? '방금 한 말을 확인하고 있어요.' : '다음 이야기를 준비하고 있어요.'}
					</div>
				)}
				{viewed?.assistant && (
					<>
						{viewed.id !== latestReply?.id && (
							<Button variant="secondary" className="min-h-11 w-full" onClick={() => setViewedId(null)}>
								<ArrowDown /> 새 대화 보기
							</Button>
						)}
						<div className="space-y-2">
							<p className="text-xs text-muted-foreground">
								{viewed.id !== latestReply?.id ? '이전 대화를 살펴보고 있어요' : '지금 이어갈 이야기'}
							</p>
							<p lang="en" className="text-xl leading-relaxed font-medium break-words sm:text-2xl">
								{viewed.assistant.text}
							</p>
						</div>
						<LearningPanel
							turn={viewed}
							player={player}
							recording={recording}
							scrollContainer={content}
							onInspect={() => setViewedId(viewed.id)}
							onRetry={() => void conversation.retry('learning', viewed.id)}
						/>
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
					void recorder.start();
				}}
			/>
		</div>
	);
}
