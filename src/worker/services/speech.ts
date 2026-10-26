import { decodeBase64 } from './encoding';
import { createGeminiClient, ServiceError, type GeminiEnv } from './gemini';

export async function synthesize(env: GeminiEnv, text: string) {
	const data = await createGeminiClient(env).interactions.create({
		model: env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-lite-tts',
		store: false,
		input: [
			{
				type: 'user_input',
				content: [
					{
						type: 'text',
						text,
						annotations: [{ type: 'speech_metadata', style: 'Warm, clear English at a relaxed conversational pace.' }],
					},
				],
			},
		],
		response_format: { type: 'audio' },
		generation_config: { speech_config: [{ voice: 'Kore' }] },
	});
	const audio = data.output_audio;
	if (!audio?.data || audio.data.length > 2_500_000 || (audio.mime_type && audio.mime_type !== 'audio/wav')) {
		throw new ServiceError('재생할 음성을 만들지 못했어요. 다시 시도해 주세요.');
	}
	const bytes = decodeBase64(audio.data);
	const decoder = new TextDecoder();
	if (decoder.decode(bytes.subarray(0, 4)) !== 'RIFF' || decoder.decode(bytes.subarray(8, 12)) !== 'WAVE') {
		throw new ServiceError('음성 형식을 확인하지 못했어요. 다시 시도해 주세요.');
	}
	return bytes;
}
