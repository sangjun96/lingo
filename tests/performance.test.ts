import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pcmSamples, pcmToWav, readPcm } from '../src/shared/audio';

const sdk = vi.hoisted(() => ({ text: vi.fn(), stream: vi.fn(), speech: vi.fn() }));
vi.mock('@google/genai', () => ({
	ThinkingLevel: { LOW: 'LOW' },
	GoogleGenAI: class {
		models = { generateContent: sdk.text, generateContentStream: sdk.stream };
		interactions = { create: sdk.speech };
	},
}));
import { errorMessage, generateText, textSettings } from '../src/worker/services/gemini';
import { languages, type Language } from '../src/shared/languages';
import { promptSets } from '../src/worker/services/prompts';
import { streamSpeech } from '../src/worker/services/speech';

async function* events(items: unknown[]) { yield* items; }
const env = { GEMINI_API_KEY: 'test' };
beforeEach(() => vi.clearAllMocks());

describe('low-latency generation', () => {
	it('separates task models, budgets and thinking without changing unknown model defaults', () => {
		expect(textSettings(env, 'reply')).toMatchObject({ model: 'gemini-3.8-flash', thinkingConfig: { thinkingLevel: 'LOW' }, maxOutputTokens: 512 });
		expect(textSettings(env, 'transcribe').thinkingConfig.thinkingLevel).toBe('LOW');
		expect(textSettings(env, 'learning').thinkingConfig.thinkingLevel).toBe('LOW');
		expect(textSettings({ ...env, GEMINI_MODEL: 'custom', GEMINI_TRANSCRIBE_MODEL: 'stt' }, 'transcribe').model).toBe('stt');
		expect(textSettings({ ...env, GEMINI_MODEL: 'custom' }, 'reply').thinkingConfig.thinkingLevel).toBe('LOW');
		expect(() => textSettings({ ...env, GEMINI_REPLY_THINKING: 'invalid' }, 'reply')).toThrow();
		expect(() => textSettings({ ...env, GEMINI_REPLY_THINKING: 'MINIMAL' }, 'reply')).toThrow();
	});
	it('identifies an invalid API key without exposing the provider error', () => {
		const error = Object.assign(new Error('{"error":{"details":[{"reason":"API_KEY_INVALID"}]}}'), { status: 400 });
		expect(errorMessage(error)).toContain('Gemini API 키가 유효하지 않아요');
		expect(errorMessage(Object.assign(new Error('other bad request'), { status: 400 }))).toContain('AI 요청을 처리하지 못했어요');
	});
	it('publishes partial text before the final answer', async () => {
		sdk.stream.mockResolvedValue(events([{ text: 'Hello' }, { text: ' there!', candidates: [{ finishReason: 'STOP' }] }]));
		const partial = vi.fn();
		expect(await generateText(env, 'system', [], { task: 'reply', onPartial: partial })).toBe('Hello there!');
		expect(partial.mock.calls).toEqual([['Hello'], ['Hello there!']]);
	});
	it('rejects truncated output instead of persisting it', async () => {
		sdk.stream.mockResolvedValue(events([{ text: 'partial' }, { candidates: [{ finishReason: 'MAX_TOKENS' }] }]));
		await expect(generateText(env, '', [], { task: 'reply', onPartial: () => {} })).rejects.toThrow();
	});
});

describe('streamed audio', () => {
	it('converts signed little-endian PCM and constructs a reusable WAV', () => {
		const pcm = new Uint8Array([0, 128, 0, 0, 255, 127]);
		expect([...pcmSamples(pcm)]).toEqual([-1, 0, 32767 / 32768]);
		const wav = pcmToWav([pcm]);
		expect(new TextDecoder().decode(wav.subarray(0, 4))).toBe('RIFF');
		expect(new DataView(wav.buffer).getUint32(24, true)).toBe(24000);
		expect(wav.subarray(44)).toEqual(pcm);
	});
	it('handles transport chunks split in the middle of a sample', async () => {
		const stream = new ReadableStream<Uint8Array>({ start(c) {
			c.enqueue(new Uint8Array([0])); c.enqueue(new Uint8Array([128, 255])); c.enqueue(new Uint8Array([127])); c.close();
		} });
		const samples: number[] = [];
		for await (const chunk of readPcm(stream)) samples.push(...chunk);
		expect(samples).toEqual([-1, 32767 / 32768]);
	});
	it('rejects incomplete audio', async () => {
		const stream = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array([0])); c.close(); } });
		await expect(async () => { for await (const _ of readPcm(stream)) { /* consume */ } }).rejects.toThrow();
	});
	it('streams PCM while producing a WAV only on successful completion', async () => {
		sdk.speech.mockResolvedValue(events([
			{ event_type: 'step.delta', delta: { type: 'audio', data: 'AIAAAP9/', mime_type: 'audio/l16' } },
			{ event_type: 'interaction.completed', interaction: { status: 'completed' } },
		]));
		const speech = streamSpeech(env, 'Hello');
		const pcm = new Uint8Array(await new Response(speech.stream).arrayBuffer());
		expect((await speech.complete).subarray(44)).toEqual(pcm);
	});
	it.each(Object.keys(languages) as Language[])('injects %s pronunciation instructions into speech generation', async (language) => {
		sdk.speech.mockResolvedValue(events([
			{ event_type: 'step.delta', delta: { type: 'audio', data: 'AAA=' } },
			{ event_type: 'interaction.completed', interaction: { status: 'completed' } },
		]));
		const speech = streamSpeech(env, 'example', language);
		await Promise.all([speech.complete, new Response(speech.stream).arrayBuffer()]);
		expect(sdk.speech.mock.calls[0][0].input[0].content[0].annotations[0].style).toBe(promptSets[language].speech);
	});
	it('does not cache a failed/truncated provider stream', async () => {
		sdk.speech.mockResolvedValue(events([{ event_type: 'step.delta', delta: { type: 'audio', data: 'AAA=' } }]));
		const speech = streamSpeech(env, 'Hello');
		await Promise.all([
			expect(speech.complete).rejects.toThrow(),
			expect(new Response(speech.stream).arrayBuffer()).rejects.toThrow(),
		]);
	});
});
