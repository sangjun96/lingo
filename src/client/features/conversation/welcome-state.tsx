import { ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function WelcomeState({ disabled, onStart }: { disabled: boolean; onStart: () => void }) {
	return (
		<section className="space-y-7 py-8">
			<div className="space-y-3">
				<p className="text-sm text-muted-foreground">YOUR SPACE TO SPEAK</p>
				<h1 className="text-3xl leading-tight font-medium tracking-tight sm:text-4xl">
					영어로,
					<br />
					조금씩 편하게.
				</h1>
				<p className="text-sm leading-7 text-muted-foreground">
					잘 말하려고 애쓰지 않아도 괜찮아요.
					<br />
					듣고, 표현을 살펴보고, 내 속도로 답해 보세요.
				</p>
			</div>
			<Card className="bg-muted/30 shadow-none">
				<CardContent className="space-y-4">
					<p className="font-medium">오늘은 어떤 이야기를 해볼까요?</p>
					<p className="text-sm leading-relaxed text-muted-foreground">
						AI가 먼저 가벼운 질문을 건넬게요. 직접 말하거나 글로 시작해도 좋아요.
					</p>
					<Button className="min-h-11" disabled={disabled} onClick={onStart}>
						대화 시작하기 <ArrowUpRight />
					</Button>
				</CardContent>
			</Card>
			<p className="text-xs leading-6 text-muted-foreground">
				AI 문장 · 답변 추천 3개 · 내 표현 피드백
				<br />
				필요할 때 자유롭게 오가며 볼 수 있어요.
			</p>
		</section>
	);
}
