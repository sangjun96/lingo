import { languages, type Language } from '../../../shared/languages';
import { History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import type { Turn } from '../../../shared/conversation';

export function ConversationHistory({ language, turns, onSelect, disabled }: { language: Language; turns: Turn[]; onSelect: (id: string) => void; disabled: boolean }) {
	return (
		<Sheet>
			<SheetTrigger asChild>
				<Button variant="ghost" className="min-h-10" disabled={disabled}>
					<History /> 대화 기록
				</Button>
			</SheetTrigger>
			<SheetContent className="w-full sm:max-w-md">
				<SheetHeader className="pt-8">
					<SheetTitle>우리의 대화</SheetTitle>
					<SheetDescription>문장을 누르면 그때의 해설과 추천 답변을 볼 수 있어요.</SheetDescription>
				</SheetHeader>
				<div className="flex-1 space-y-5 overflow-y-auto px-4 pb-8">
					{!turns.length && <p className="text-muted-foreground">아직 대화가 없어요. 편하게 시작해 보세요.</p>}
					{turns.map((turn, index) => (
						<div key={turn.id} className="space-y-2 border-b pb-5">
							<p className="text-xs text-muted-foreground">{String(index + 1).padStart(2, '0')}</p>
							{turn.userText && (
								<p lang={languages[language].tag} className="rounded-lg bg-muted p-3 text-sm leading-relaxed break-words">
									{turn.userText}
								</p>
							)}
							{turn.assistant && (
								<SheetClose asChild>
									<Button
										variant="ghost"
										className="h-auto w-full justify-start p-3 text-left whitespace-normal"
										onClick={() => onSelect(turn.id)}
									>
										<span lang={languages[language].tag} className="leading-relaxed break-words">
											{turn.assistant.text}
										</span>
									</Button>
								</SheetClose>
							)}
							{turn.error && <p className="text-sm text-destructive">{turn.error}</p>}
						</div>
					))}
				</div>
			</SheetContent>
		</Sheet>
	);
}
