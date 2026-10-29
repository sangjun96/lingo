import type { Language } from '../../../shared/languages';
import { AudioLines, LogOut, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Turn } from '../../../shared/conversation';
import { ConversationHistory } from './conversation-history';

export function ConversationHeader({
	language,
	turns,
	recording,
	busy,
	onSelect,
	onNew,
	onSignOut,
}: {
	language: Language;
	turns: Turn[];
	recording: boolean;
	busy: boolean;
	onSelect: (id: string) => void;
	onNew: () => void;
	onSignOut: () => void;
}) {
	return (
		<header className="shrink-0 border-b px-4 sm:px-8">
			<div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 py-4">
				<div className="flex items-center gap-2">
					<AudioLines className="size-6 text-violet-300" />
					<span className="text-xl font-semibold tracking-tight">
						lingo<span className="text-violet-300">.</span>
					</span>
				</div>
				<div className="flex gap-1">
					<ConversationHistory language={language} turns={turns} disabled={recording} onSelect={onSelect} />
					<Button variant="outline" className="min-h-10" onClick={onNew} disabled={recording || busy}>
						<Plus /> 새 대화
					</Button>
					<Button variant="ghost" className="min-h-10" onClick={onSignOut} aria-label="로그아웃">
						<LogOut />
					</Button>
				</div>
			</div>
		</header>
	);
}
