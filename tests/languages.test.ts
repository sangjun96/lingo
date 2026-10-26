import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isLanguage, languages, type Language } from '../src/shared/languages';
import { pendingLearning, type Turn } from '../src/shared/conversation';
import { promptSets } from '../src/worker/services/prompts';
import { readTurnInput } from '../src/worker/conversation/requests';
import { submitTurn } from '../src/client/features/conversation/api';

const mocks = vi.hoisted(() => ({ generateText: vi.fn() }));
vi.mock('../src/worker/services/gemini', async (original) => ({
	...await original<typeof import('../src/worker/services/gemini')>(),
	generateText: mocks.generateText,
}));
import { createReply, transcribe } from '../src/worker/services/conversation';
import { createLearning } from '../src/worker/services/learning';

const turn: Turn = { id: 'test-turn', source: 'opening', userText: null, assistant: null, learning: pendingLearning() };
const codes = Object.keys(languages) as Language[];
beforeEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe('language selection and prompt injection', () => {
	it.each(codes)('injects the %s prompt set into reply, transcription, and learning', async (language) => {
		mocks.generateText.mockResolvedValue('Hello');
		await createReply({}, [], turn, undefined, language);
		expect(mocks.generateText.mock.calls[0][1]).toBe(promptSets[language].reply);
		expect(mocks.generateText.mock.calls[0][2][0].parts[0].text).toBe(promptSets[language].opening);
		await transcribe({}, 'AAA=', 'audio/webm', language);
		expect(mocks.generateText.mock.calls[1][1]).toBe(promptSets[language].transcribe);
		const expression = { text: 'example', translation: '번역', explanation: '해설' };
		mocks.generateText.mockResolvedValue(JSON.stringify({ translation: '번역', explanation: '해설', suggestions: [0, 1, 2].map(() => ({ ...expression, label: '추천' })), feedback: { improved: null, explanation: '좋아요' } }));
		await createLearning({}, { ...turn, assistant: { ...expression, id: 'assistant' } }, language);
		expect(mocks.generateText.mock.calls[2][1]).toBe(promptSets[language].learning);
		expect(promptSets[language].speech).toContain(languages[language].name);
	});
	it('keeps English as the service default for existing conversations', async () => {
		mocks.generateText.mockResolvedValue('Hello');
		await createReply({}, [], turn);
		expect(mocks.generateText.mock.calls[0][1]).toBe(promptSets.en.reply);
	});
	it.each(codes)('carries %s through the client request and server parser for opening and audio', async (language) => {
		const fetchMock = vi.fn(async (_url: string, options: RequestInit) => {
			const parsed = await readTurnInput(new Request('https://lingo.test/turns', options));
			expect(parsed.language).toBe(language);
			return Response.json({ language });
		});
		vi.stubGlobal('fetch', fetchMock);
		await submitTurn('/test', 'test-request', null, null, language);
		await submitTurn('/test', 'test-request', null, new Blob(['audio'], { type: 'audio/webm' }), language);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
	it('rejects unknown or prototype language keys before consuming the request', async () => {
		for (const language of ['ja', 'constructor', '__proto__', '']) {
			expect(isLanguage(language)).toBe(false);
			await expect(readTurnInput(new Request('https://lingo.test/turns', { method: 'POST', headers: { 'X-Request-Id': 'test-request', 'X-Language': language } }))).rejects.toMatchObject({ status: 400 });
		}
	});
	it('allows legacy requests without a language header to inherit the session language', async () => {
		const input = await readTurnInput(new Request('https://lingo.test/turns', { method: 'POST', headers: { 'X-Request-Id': 'test-request', 'Content-Type': 'application/json' }, body: '{"text":null}' }));
		expect(input.language).toBeUndefined();
	});
});
