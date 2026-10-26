import { languages, type Language } from '../../../shared/languages';
import { LoaderCircle, Square, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Expression } from '../../../shared/conversation';
import type { AudioPlayer } from './use-audio-player';

export function ExpressionCard({
	language,
	expression,
	label,
	player,
	disabled = false,
	translationPending = false,
}: {
	language: Language;
	expression: Expression;
	label?: string;
	player: AudioPlayer;
	disabled?: boolean;
	translationPending?: boolean;
}) {
	const active = player.playingId === expression.id;
	return (
		<Card className="shadow-none">
			<CardContent className="space-y-3">
				{label && <p className="text-xs font-medium text-muted-foreground">{label}</p>}
				<p lang={languages[language].tag} className="text-lg leading-relaxed font-medium break-words">
					{expression.text}
				</p>
				{expression.translation ? (
					<p className="leading-relaxed text-muted-foreground">{expression.translation}</p>
				) : translationPending ? (
					<Skeleton className="h-4 w-3/4" aria-label="뜻을 준비하고 있어요" />
				) : null}
				<div className="flex flex-wrap gap-2">
					<Button
						variant="secondary"
						className="min-h-10"
						disabled={disabled}
						onClick={() => (active ? player.stop() : void player.play(expression.id))}
						aria-label={`${label || '문장'} ${active ? '재생 멈추기' : '듣기'}`}
					>
						{active ? player.loading ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : <Square /> : <Volume2 />}
						{active ? (player.loading ? '음성 준비 중' : '멈추기') : '듣기'}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
