import { LoaderCircle, Mic, Square, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { useRecorder } from './use-recorder';

export function ConversationComposer({
	recorder,
	disabled,
	busy,
	onRecord,
}: {
	recorder: ReturnType<typeof useRecorder>;
	disabled: boolean;
	busy: boolean;
	onRecord: () => void;
}) {
	const recording = recorder.status === 'recording';
	const requesting = recorder.status === 'requesting';
	return (
		<footer className="z-10 shrink-0 border-t bg-background px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
			<div className="mx-auto flex max-w-xl flex-col items-center gap-3">
				<div className="flex items-center gap-4">
					{recording && (
						<Button variant="ghost" size="icon-lg" className="size-11" aria-label="녹음 취소" onClick={() => recorder.stop(true)}>
							<X />
						</Button>
					)}
					<Button
						className={`size-16 rounded-full shadow-sm [&_svg]:size-6 ${recording ? 'bg-red-600 text-white hover:bg-red-700' : ''}`}
						size="icon-lg"
						disabled={disabled || requesting}
						onClick={() => (recording ? recorder.stop() : onRecord())}
						aria-label={recording ? '녹음 마치고 전송' : '눌러서 말하기'}
					>
						{busy || requesting ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : recording ? <Square /> : <Mic />}
					</Button>
					{recording && <span className="w-11 text-sm tabular-nums">{recorder.seconds}s</span>}
				</div>
				<p className="text-center text-xs text-muted-foreground" role="status">
					{recording
						? '한 번 더 누르면 전송돼요 · 최대 60초'
						: requesting
							? '마이크 사용 권한을 확인해 주세요'
							: busy
								? '답변을 준비하고 있어요'
								: '눌러서 말하기 · 생각할 시간은 충분해요'}
				</p>
			</div>
		</footer>
	);
}
