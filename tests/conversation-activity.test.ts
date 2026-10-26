import { describe, expect, it } from 'vitest';
import { getActivityStage } from '../src/client/features/conversation/use-conversation-activity';
import { pendingLearning, type Turn } from '../src/shared/conversation';

const pending: Turn = { id: 'turn', source: 'audio', userText: null, assistant: null, learning: pendingLearning() };
const reply: Turn = { ...pending, assistant: { id: 'reply', text: 'Hello', translation: '', explanation: '' } };
const input = { busy: true, connected: true, phase: 'thinking' as const, partial: null, turn: pending, error: false };

describe('conversation activity interruptions and completion', () => {
	it('shows reconnecting while an interrupted reply is still running', () => {
		expect(getActivityStage({ ...input, connected: false, partial: 'Hello' })).toBe('reconnecting');
	});
	it('keeps a completed answer visible even when the connection later closes', () => {
		expect(getActivityStage({ ...input, busy: false, connected: false, phase: 'idle', turn: reply })).toBe('complete');
	});
	it('shows a failure instead of continuing to animate a partial answer', () => {
		expect(getActivityStage({ ...input, partial: 'Hello', turn: { ...pending, error: 'Failed' } })).toBe('error');
		expect(getActivityStage({ ...input, error: true, connected: false })).toBe('error');
	});
	it('does not mistake a stale partial for the new transcription', () => {
		expect(getActivityStage({ ...input, phase: 'transcribing', partial: 'Old answer' })).toBe('transcribing');
	});
	it('completes as soon as the final answer arrives, even with a partial still present', () => {
		expect(getActivityStage({ ...input, busy: false, phase: 'idle', partial: 'Hello', turn: reply })).toBe('complete');
	});
});
