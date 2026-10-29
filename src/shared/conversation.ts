import type { Language } from './languages';

export type Expression = {
	id: string;
	text: string;
	translation: string;
	pronunciation?: string;
	explanation: string;
};

export type Suggestion = Expression & { label: string };

export type Learning = {
	status: 'pending' | 'ready' | 'error';
	suggestions: Suggestion[];
	feedback: { improved: Expression | null; explanation: string } | null;
	error?: string;
};

export type Turn = {
	id: string;
	source: 'opening' | 'audio';
	userText: string | null;
	recording?: { key: string; mimeType: string };
	assistant: Expression | null;
	learning: Learning;
	error?: string;
};

export type ConversationState = {
	language: Language;
	revision: number;
	phase: 'idle' | 'transcribing' | 'thinking';
	activeTurnId: string | null;
	turns: Turn[];
};

export const initialConversation: ConversationState = {
	language: 'en',
	revision: 0,
	phase: 'idle',
	activeTurnId: null,
	turns: [],
};

export const MAX_AUDIO_BYTES = 1024 * 1024;
export const MAX_RECORDING_SECONDS = 60;
export const MAX_TURNS = 40;
export const pendingLearning = (): Learning => ({ status: 'pending', suggestions: [], feedback: null });
