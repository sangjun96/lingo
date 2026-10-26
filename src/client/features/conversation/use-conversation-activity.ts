import { useEffect, useState } from 'react';
import type { ConversationState, Turn } from '../../../shared/conversation';

export type ActivityStage = 'sending' | 'transcribing' | 'thinking' | 'writing' | 'complete' | 'error' | 'reconnecting';

export function getActivityStage({ busy, connected, phase, partial, turn, error }: {
	busy: boolean;
	connected: boolean;
	phase: ConversationState['phase'];
	partial: string | null;
	turn?: Turn;
	error: boolean;
}): ActivityStage {
	if (turn?.error || error) return 'error';
	if (busy && !connected) return 'reconnecting';
	if (turn?.assistant && phase === 'idle') return 'complete';
	if (phase === 'transcribing') return 'transcribing';
	if (partial) return 'writing';
	if (phase === 'thinking') return 'thinking';
	return 'sending';
}

export function useConversationActivity({ busy, submitting, connected, state, partial, error }: {
	busy: boolean;
	submitting: boolean;
	connected: boolean;
	state: ConversationState;
	partial: string | null;
	error: boolean;
}) {
	const turn = submitting && state.phase === 'idle' ? undefined : state.turns.at(-1);
	const stage = getActivityStage({ busy, connected, phase: state.phase, partial, turn, error });
	const running = busy && stage !== 'error';
	const [clock, setClock] = useState<{ started: number; elapsed: number } | null>(null);

	useEffect(() => {
		if (!running) return;
		// Start at submission; the server assigning a turn ID must not reset the clock.
		const started = performance.now();
		setClock({ started, elapsed: 0 });
		const timer = window.setInterval(() => setClock({ started, elapsed: Math.floor((performance.now() - started) / 1000) }), 1000);
		return () => window.clearInterval(timer);
	}, [running]);

	return { stage, elapsed: clock?.elapsed ?? null, turn };
}
