import { languages, type Language } from '../../../shared/languages';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function WelcomeState({ language, disabled, onStart }: { language: Language; disabled: boolean; onStart: () => void }) {
	return (
		<section className="space-y-7 py-8">
			<div className="space-y-3">
				<p className="text-sm text-muted-foreground">YOUR SPACE TO SPEAK</p>
				<h1 className="text-3xl leading-tight font-medium tracking-tight sm:text-4xl">
					{languages[language].label}로,
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
						AI가 먼저 가벼운 질문을 건넬게요. 편하게 대답해 보세요.
					</p>
					<Button className="min-h-11" disabled={disabled} onClick={onStart}>
						대화 시작하기 <ArrowUpRight />
					</Button>
				</CardContent>
			</Card>
			<p className="text-xs leading-6 text-muted-foreground">
				AI의 이야기를 듣고, 답변 힌트를 따라 말해 보세요.
				<br />
				힌트는 잠시 후 사라지지만 다시 볼 수 있어요.
			</p>
		</section>
	);
}
