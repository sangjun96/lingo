import { useState } from 'react';
import { AudioLines, BookOpen, Check, Circle, CircleAlert, LoaderCircle, Sparkles } from 'lucide-react';
import { Trace, TraceCollapsible, TraceCollapsibleContent, TraceCollapsibleTrigger, TraceDescription, TraceIcon, TraceLine, TraceTitle } from '@/components/ui/trace';
import type { Turn } from '../../../shared/conversation';
import type { AudioPlayer } from './use-audio-player';
import type { ActivityStage } from './use-conversation-activity';

const titles: Record<ActivityStage, string> = {
	sending: '말씀을 보내고 있어요',
	transcribing: '방금 한 말을 확인하고 있어요',
	thinking: '이어갈 이야기를 준비하고 있어요',
	writing: '답변을 쓰고 있어요',
	complete: '답변이 도착했어요',
	error: '잠시 멈췄어요. 다시 시도해 주세요',
	reconnecting: '다시 연결하고 있어요',
};

export function ConversationActivity({ stage, elapsed, turn, busy, player }: {
	stage: ActivityStage;
	elapsed: number | null;
	turn?: Turn;
	busy: boolean;
	player: AudioPlayer;
}) {
	const [expanded, setExpanded] = useState(false);
	const complete = stage === 'complete';
	const failed = stage === 'error';
	const paused = stage === 'reconnecting';
	const speech = !!turn?.assistant && player.playingId === turn.assistant.id;
	const steps = [
		{ id: 'send', label: '말씀 전송', done: !!turn, active: stage === 'sending' },
		...(turn?.source === 'audio' ? [{ id: 'transcribe', label: '음성 인식', done: !!turn.userText, active: stage === 'transcribing' }] : []),
		{ id: 'reply', label: stage === 'writing' ? '답변 작성 중' : '답변 작성', done: !!turn?.assistant, active: stage === 'thinking' || stage === 'writing' },
	];
	return (
		<section aria-label="AI 응답 진행 상황" className={`activity-card rounded-xl border p-4 ${busy ? 'bg-muted/30' : 'bg-background'}`}>
			<p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{titles[stage]}</p>
			<Trace>
				<TraceCollapsible open={busy || expanded} onOpenChange={setExpanded}>
					<div className="flex items-center justify-between gap-2">
						<TraceCollapsibleTrigger className="min-h-10 flex-1" disabled={busy}>
							<TraceLine status={failed ? 'error' : undefined}>
								<TraceIcon>{failed ? <CircleAlert /> : complete ? <Check /> : <Sparkles className="activity-breathe" />}</TraceIcon>
								<TraceTitle className="whitespace-normal text-left leading-relaxed">{titles[stage]}</TraceTitle>
							</TraceLine>
						</TraceCollapsibleTrigger>
						{elapsed !== null && <TraceDescription className="text-xs" aria-hidden="true">{elapsed}초{complete || failed ? '' : ' 경과'}</TraceDescription>}
					</div>
					<TraceCollapsibleContent>
						<ol className="space-y-3 py-1" aria-label="처리 단계">
								{steps.map(({ id, label, done, active }) => (
								<li key={id}>
									<TraceLine status={!done && !active ? 'pending' : undefined}>
										<TraceIcon>{done ? <Check className="text-emerald-600 dark:text-emerald-400" /> : active && !failed && !paused ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : active && failed ? <CircleAlert /> : <Circle />}</TraceIcon>
										<TraceTitle className={active && !failed && !paused ? 'activity-shimmer text-foreground' : ''}>{label}{done ? ' 완료' : ''}</TraceTitle>
									</TraceLine>
								</li>
							))}
						</ol>
					</TraceCollapsibleContent>
				</TraceCollapsible>
			</Trace>
			{busy && elapsed !== null && elapsed >= 12 && !failed && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{paused ? '연결이 돌아오면 진행 상황을 확인할게요.' : '평소보다 시간이 걸리고 있어요. 답변이 도착하면 바로 보여드릴게요.'}</p>}
			{turn?.assistant && <div role="status" aria-live="polite" className="mt-2 flex flex-wrap gap-x-4 gap-y-2 border-t pt-3 text-xs text-muted-foreground">
				{speech && <span className="inline-flex items-center gap-1.5"><AudioLines className={`size-3.5 ${player.loading ? 'activity-breathe' : ''}`} />{player.loading ? '목소리를 준비하고 있어요' : 'AI 음성 재생 중'}</span>}
				<span className="inline-flex items-center gap-1.5"><BookOpen className={`size-3.5 ${turn.learning.status === 'pending' ? 'activity-breathe' : ''}`} />{turn.learning.status === 'pending' ? '뜻과 추천 표현을 정리하고 있어요' : turn.learning.status === 'error' ? '학습 자료를 준비하지 못했어요' : '학습 자료 준비 완료'}</span>
			</div>}
		</section>
	);
}
