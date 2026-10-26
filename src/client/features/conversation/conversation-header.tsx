import { AudioLines, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Turn } from '../../../shared/conversation';
import { ConversationHistory } from './conversation-history';

export function ConversationHeader({
	turns,
	recording,
	busy,
	onSelect,
	onNew,
}: {
	turns: Turn[];
	recording: boolean;
	busy: boolean;
	onSelect: (id: string) => void;
	onNew: () => void;
}) {
	return (
		<header className="shrink-0 border-b px-4 sm:px-8">
			<div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 py-4">
				<div className="flex items-center gap-2">
					<AudioLines className="size-6" />
					<span className="text-xl font-semibold tracking-tight">
						lingo<span className="text-muted-foreground">.</span>
					</span>
				</div>
				<div className="flex gap-1">
					<ConversationHistory turns={turns} disabled={recording} onSelect={onSelect} />
					<Button variant="outline" className="min-h-10" onClick={onNew} disabled={recording || busy}>
						<Plus /> 새 대화
					</Button>
				</div>
			</div>
		</header>
	);
}
