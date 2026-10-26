import { exports } from 'cloudflare:workers';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { MAX_AUDIO_BYTES } from '../src/shared/conversation';
import { readTurnInput } from '../src/worker/conversation/requests';
import { requireApiKey } from '../src/worker/services/gemini';
import { parseLearning } from '../src/worker/services/learning';
import { synthesize } from '../src/worker/services/speech';
import { learningResponse } from './fixtures';

afterEach(() => {
	vi.restoreAllMocks();
});

describe('Turn and provider validation', () => {
	it('rejects missing API keys before contacting Google', () => {
		expect(() => requireApiKey({})).toThrow('GEMINI_API_KEY');
	});
	it.each(['', 'a'.repeat(4001)])('rejects empty or oversized text', async (text) => {
		const request = new Request('https://example.com', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'X-Request-Id': crypto.randomUUID() },
			body: JSON.stringify({ text }),
		});
		await expect(readTurnInput(request)).rejects.toThrow('1~4000');
	});
	it('rejects audio over the limit even without a Content-Length header', async () => {
		const request = new Request('https://example.com', {
			method: 'POST',
			headers: { 'Content-Type': 'audio/webm', 'X-Request-Id': crypto.randomUUID() },
			body: new Uint8Array(MAX_AUDIO_BYTES + 1),
		});
		await expect(readTurnInput(request)).rejects.toThrow('너무 커요');
	});
	it('returns an actionable HTTP validation error', async () => {
		const response = await exports.default.fetch(`https://example.com/agents/lingo-agent/${crypto.randomUUID()}/turns`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: '{"text":"Hi"}',
		});
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: '요청 ID가 올바르지 않아요.' });
	});
	it('requires exactly three valid suggestions and preserves no-correction feedback', () => {
		expect(() => parseLearning({ ...learningResponse, suggestions: learningResponse.suggestions.slice(1) }, 'test')).toThrow();
		expect(() => parseLearning({ ...learningResponse, translation: '' }, 'test')).toThrow();
		const result = parseLearning({ ...learningResponse, feedback: { improved: null, explanation: '이미 자연스러운 표현이에요.' } }, 'test');
		expect(result.learning.feedback?.improved).toBeNull();
		expect(new Set(result.learning.suggestions.map((item) => item.id)).size).toBe(3);
	});
	it('rejects unsupported TTS data rather than serving unplayable audio', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			Response.json({ steps: [{ type: 'model_output', content: [{ type: 'audio', data: btoa('invalid wav') }] }] }),
		);
		await expect(synthesize({ GEMINI_API_KEY: 'test-only' }, 'Hello.')).rejects.toThrow('음성 형식');
	});
});
