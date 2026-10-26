import { languages, type Language } from '../../../shared/languages';
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { BookOpen, Lightbulb, MessageCircle, RotateCcw } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import type { Turn } from '../../../shared/conversation';
import { ExpressionCard } from './expression-card';
import type { AudioPlayer } from './use-audio-player';

export function LearningPanel({
	language,
	turn,
	player,
	recording,
	scrollContainer,
	onRetry,
}: {
	language: Language;
	turn: Turn;
	player: AudioPlayer;
	recording: boolean;
	scrollContainer: RefObject<HTMLElement | null>;
	onRetry: () => void;
}) {
	const [tab, setTab] = useState('sentence');
	const positions = useRef<Record<string, number>>({});
	const previousTurn = useRef(turn.id);
	useLayoutEffect(() => {
		if (previousTurn.current !== turn.id) {
			positions.current = {};
			previousTurn.current = turn.id;
		}
		if (scrollContainer.current) scrollContainer.current.scrollTop = positions.current[tab] || 0;
	}, [tab, turn.id, scrollContainer]);
	const learning = turn.learning;
	const waiting = learning.status === 'pending';
	const notice =
		learning.status === 'error' ? (
			<div role="status" className="space-y-3 rounded-xl bg-muted p-4 text-sm">
				<p>{learning.error}</p>
				<Button variant="outline" className="min-h-10" onClick={onRetry}>
					<RotateCcw /> 학습 자료 다시 만들기
				</Button>
			</div>
		) : waiting ? (
			<div role="status" className="space-y-3 py-4">
				<p className="text-sm text-muted-foreground">대화는 계속해도 좋아요. 학습 자료를 준비하고 있어요.</p>
				<Skeleton className="h-16 w-full" />
				<Skeleton className="h-16 w-full" />
				<Skeleton className="h-16 w-full" />
			</div>
		) : null;

	return (
		<Tabs
			value={tab}
			onValueChange={(value) => {
				positions.current[tab] = scrollContainer.current?.scrollTop || 0;
				setTab(value);
			}}
			className="gap-5"
		>
			<TabsList className="h-12 w-full" aria-label="대화 학습 도구">
				<TabsTrigger className="min-h-10 data-[state=active]:bg-background data-[state=active]:shadow-sm" value="sentence">
					<MessageCircle /> AI 문장
				</TabsTrigger>
				<TabsTrigger className="min-h-10 data-[state=active]:bg-background data-[state=active]:shadow-sm" value="suggestions">
					<Lightbulb /> 답변 추천
				</TabsTrigger>
				<TabsTrigger className="min-h-10 data-[state=active]:bg-background data-[state=active]:shadow-sm" value="feedback">
					<BookOpen /> 내 표현
				</TabsTrigger>
			</TabsList>
			<div>
				<TabsContent value="sentence" forceMount hidden={tab !== 'sentence'} className="space-y-4">
					{turn.assistant && (
						<ExpressionCard
							language={language}
							key={turn.assistant.id}
							expression={turn.assistant}
							label="AI가 한 말"
							player={player}
							disabled={recording}
							translationPending={waiting}
						/>
					)}
					{learning.status === 'error' && notice}
					{waiting && (
						<p role="status" className="text-sm text-muted-foreground">
							뜻과 표현을 준비하고 있어요.
						</p>
					)}
				</TabsContent>
				<TabsContent value="suggestions" forceMount hidden={tab !== 'suggestions'} className="space-y-3">
					<p className="text-sm text-muted-foreground">정답은 없어요. 마음에 드는 표현을 골라 바꿔 말해 보세요.</p>
					{notice}
					{learning.suggestions.map((expression) => (
						<ExpressionCard language={language} key={expression.id} expression={expression} label={expression.label} player={player} disabled={recording} />
					))}
				</TabsContent>
				<TabsContent value="feedback" forceMount hidden={tab !== 'feedback'} className="space-y-4">
					{turn.userText ? (
						<Card className="bg-muted/40 shadow-none">
							<CardContent className="space-y-2">
								<p className="text-xs text-muted-foreground">내가 한 말{turn.source === 'audio' ? ' · 음성 인식 결과' : ''}</p>
								<p lang={languages[language].tag} className="leading-relaxed break-words">
									{turn.userText}
								</p>
							</CardContent>
						</Card>
					) : (
						<p className="py-4 text-sm text-muted-foreground">첫 대답을 해보세요. 내가 한 말의 표현을 함께 살펴볼 수 있어요.</p>
					)}
					{turn.userText && (
						<>
							{notice}
							{learning.feedback?.improved && (
								<ExpressionCard
									language={language}
									key={learning.feedback.improved.id}
									expression={learning.feedback.improved}
									label="이렇게 말해볼 수 있어요"
									player={player}
									disabled={recording}
								/>
							)}
							{learning.feedback && <p className="px-1 text-sm leading-relaxed text-muted-foreground">{learning.feedback.explanation}</p>}
						</>
					)}
				</TabsContent>
			</div>
		</Tabs>
	);
}
