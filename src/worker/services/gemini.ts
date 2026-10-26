import { GoogleGenAI, type ContentListUnion } from '@google/genai';

export type GeminiEnv = {
	GEMINI_API_KEY?: string;
	GEMINI_MODEL?: string;
	GEMINI_TTS_MODEL?: string;
};

export class ServiceError extends Error {
	constructor(
		message: string,
		public status = 502,
	) {
		super(message);
	}
}

export function requireApiKey(env: GeminiEnv) {
	if (!env.GEMINI_API_KEY) throw new ServiceError('GEMINI_API_KEY를 설정한 뒤 다시 시도해 주세요.', 503);
}

export function createGeminiClient(env: GeminiEnv) {
	requireApiKey(env);
	return new GoogleGenAI({
		apiKey: env.GEMINI_API_KEY,
		httpOptions: { timeout: 60_000, retryOptions: { attempts: 1 }, fetch: (...args) => fetch(...args) },
	});
}

export async function generateText(env: GeminiEnv, system: string, contents: ContentListUnion, schema?: unknown) {
	const data = await createGeminiClient(env).models.generateContent({
		model: env.GEMINI_MODEL || 'gemini-3.8-flash',
		contents,
		config: {
			systemInstruction: system,
			...(schema ? { responseMimeType: 'application/json', responseJsonSchema: schema } : {}),
			abortSignal: AbortSignal.timeout(60_000),
		},
	});
	const text = data.text?.trim();
	if (!text || text.length > 16_000) throw new ServiceError('AI 응답을 읽지 못했어요. 다시 시도해 주세요.');
	return text;
}

export function errorMessage(error: unknown) {
	if (error instanceof ServiceError) return error.message;
	const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined;
	if (status === 429) return 'AI 사용량 한도에 도달했어요. 잠시 후 다시 시도해 주세요.';
	if (status === 401 || status === 403) return 'Gemini API 키와 모델 접근 권한을 확인해 주세요.';
	return 'AI 요청을 처리하지 못했어요. 모델 설정을 확인하거나 잠시 후 다시 시도해 주세요.';
}
