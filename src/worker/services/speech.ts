import type { Language } from '../../shared/languages';
import { promptSets } from './prompts';
import { MAX_GENERATED_AUDIO_BYTES, PCM_SAMPLE_RATE, pcmToWav } from '../../shared/audio';
import { decodeBase64 } from './encoding';
import { createGeminiClient, ServiceError, type GeminiEnv } from './gemini';
import { measure } from './timing';

// Send PCM immediately and produce a complete WAV for durable caching only after successful completion.
export function streamSpeech(env: GeminiEnv, text: string, language: Language = 'en') {
	let controller: ReadableStreamDefaultController<Uint8Array>;
	let cancelled = false;
	const stream = new ReadableStream<Uint8Array>({
		start(value) { controller = value; },
		cancel() { cancelled = true; },
	});
	const complete = measure('tts', async () => {
		const started = performance.now();
		const events = await createGeminiClient(env).interactions.create({
			model: env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-lite-tts',
			store: false,
			input: [{
				type: 'user_input',
				content: [{
					type: 'text', text,
					annotations: [{ type: 'speech_metadata', style: promptSets[language].speech }],
				}],
			}],
			response_format: { type: 'audio', mime_type: 'audio/l16', sample_rate: PCM_SAMPLE_RATE },
			generation_config: { speech_config: [{ voice: 'Kore' }] },
			stream: true,
		}, { signal: AbortSignal.timeout(60_000) });
		const chunks: Uint8Array[] = [];
		let size = 0;
		let completed = false;
		for await (const event of events) {
			if (event.event_type === 'error') throw new ServiceError('음성을 만들지 못했어요. 다시 시도해 주세요.');
			if (event.event_type === 'interaction.completed') completed = event.interaction.status === 'completed';
			if (event.event_type !== 'step.delta' || event.delta.type !== 'audio' || !event.delta.data) continue;
			const audio = event.delta;
			if ((audio.mime_type && audio.mime_type !== 'audio/l16') ||
				(audio.sample_rate && audio.sample_rate !== PCM_SAMPLE_RATE) || (audio.channels && audio.channels !== 1))
				throw new ServiceError('음성 형식을 확인하지 못했어요. 다시 시도해 주세요.');
			const bytes = decodeBase64(audio.data!);
			size += bytes.length;
			if (size > MAX_GENERATED_AUDIO_BYTES) throw new ServiceError('생성된 음성이 너무 길어요. 다시 시도해 주세요.');
			if (!chunks.length) console.info(JSON.stringify({ event: 'latency', stage: 'tts_first_chunk', ms: Math.round(performance.now() - started) }));
			chunks.push(bytes);
			if (!cancelled) controller!.enqueue(bytes);
		}
		if (!completed || !size || size % 2) throw new ServiceError('음성을 완성하지 못했어요. 다시 시도해 주세요.');
		const wav = pcmToWav(chunks);
		if (!cancelled) controller!.close();
		return wav;
	}).catch((error: unknown) => {
		if (!cancelled) controller!.error(error);
		throw error;
	});
	return { stream, complete };
}
