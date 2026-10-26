import { RotateCcw, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { Turn } from '../../../shared/conversation';

export function ConversationNotices({
	error,
	turn,
	disabled,
	canRetrySend,
	onRetrySend,
	onRetryTurn,
	onDismiss,
}: {
	error: string | null;
	turn?: Turn;
	disabled: boolean;
	canRetrySend: boolean;
	onRetrySend: () => void;
	onRetryTurn: () => void;
	onDismiss: () => void;
}) {
	return (
		<>
			{error && (
				<Alert variant="destructive">
					<AlertDescription className="flex flex-wrap items-center justify-between gap-2">
						<span>{error}</span>
						<div className="flex gap-1">
							{canRetrySend && (
								<Button variant="outline" className="min-h-10" disabled={disabled} onClick={onRetrySend}>
									<RotateCcw /> 전송 재시도
								</Button>
							)}
							<Button variant="ghost" size="icon" aria-label="알림 닫기" onClick={onDismiss}>
								<X />
							</Button>
						</div>
					</AlertDescription>
				</Alert>
			)}
			{turn?.error && (
				<Alert variant="destructive">
					<AlertDescription className="space-y-3">
						<p>{turn.error}</p>
						{(turn.userText || turn.recording || turn.source === 'opening') && (
							<Button variant="outline" className="min-h-10" disabled={disabled} onClick={onRetryTurn}>
								<RotateCcw /> {turn.recording && !turn.userText ? '음성 다시 처리하기' : '답변 다시 요청하기'}
							</Button>
						)}
						<p>다시 말하거나 글로 입력해도 좋아요.</p>
					</AlertDescription>
				</Alert>
			)}
		</>
	);
}
