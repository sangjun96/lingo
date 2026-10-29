import { GoogleGenAI, ThinkingLevel, type ContentListUnion } from '@google/genai';
import { measure } from './timing';

export type GeminiEnv = {
	GEMINI_API_KEY?: string;
	GEMINI_MODEL?: string;
	GEMINI_REPLY_MODEL?: string;
	GEMINI_TRANSCRIBE_MODEL?: string;
	GEMINI_LEARNING_MODEL?: string;
	GEMINI_REPLY_THINKING?: string;
	GEMINI_TRANSCRIBE_THINKING?: string;
	GEMINI_LEARNING_THINKING?: string;
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

type TextTask = 'reply' | 'transcribe' | 'learning';

function providerErrorReason(error: unknown) {
	const message = error instanceof Error ? error.message : '';
	if (/API_KEY_INVALID|API key not valid/i.test(message)) return 'invalid_api_key';
	if (/API_KEY_SERVICE_BLOCKED|API key.{0,80}(?:restrict|blocked)/i.test(message)) return 'api_key_restricted';
	if (/location.{0,80}not supported|unsupported.{0,40}(?:region|location|country)/i.test(message)) return 'unsupported_location';
	if (/(?:audio|media|mime).{0,100}(?:invalid|unsupported|decode|corrupt)|(?:invalid|unsupported|decode|corrupt).{0,100}(?:audio|media|mime)/i.test(message)) return 'invalid_audio';
	if (/model.{0,80}(?:not found|not supported|invalid)/i.test(message)) return 'invalid_model';
	return 'unknown';
}

export function textSettings(env: GeminiEnv, task: TextTask) {
	const model = (task === 'reply' ? env.GEMINI_REPLY_MODEL : task === 'transcribe' ? env.GEMINI_TRANSCRIBE_MODEL : env.GEMINI_LEARNING_MODEL)
		|| env.GEMINI_MODEL || 'gemini-3.8-flash';
	const override = task === 'reply' ? env.GEMINI_REPLY_THINKING : task === 'transcribe' ? env.GEMINI_TRANSCRIBE_THINKING : env.GEMINI_LEARNING_THINKING;
	const level = override?.toUpperCase() || 'LOW';
	if (!['LOW', 'MEDIUM', 'HIGH'].includes(level)) throw new ServiceError('Gemini thinking 설정을 확인해 주세요.', 503);
	return {
		model,
		thinkingConfig: { thinkingLevel: level as ThinkingLevel },
		maxOutputTokens: task === 'reply' ? 512 : task === 'transcribe' ? 2048 : 4096,
	};
}

export async function generateText(
	env: GeminiEnv, system: string, contents: ContentListUnion,
	options: { task: TextTask; schema?: unknown; onPartial?: (text: string) => void },
) {
	const { model, ...settings } = textSettings(env, options.task);
	return measure(options.task, async () => {
		const params = {
			model,
			contents,
			config: {
				...settings,
				systemInstruction: system,
				...(options.schema ? { responseMimeType: 'application/json', responseJsonSchema: options.schema } : {}),
				abortSignal: AbortSignal.timeout(60_000),
			},
		};
		let text = '';
		if (options.onPartial) {
			const started = performance.now();
			const stream = await createGeminiClient(env).models.generateContentStream(params);
			let first = true;
			let completed = false;
			for await (const chunk of stream) {
				if (chunk.candidates?.some((candidate) => candidate.finishReason === 'STOP')) completed = true;
				if (chunk.candidates?.some((candidate) => candidate.finishReason && candidate.finishReason !== 'STOP'))
					throw new ServiceError('AI 응답을 완성하지 못했어요. 다시 시도해 주세요.');
				const delta = chunk.text;
				if (!delta) continue;
				text += delta;
				if (text.length > 600) throw new ServiceError('AI 답변이 너무 길어요. 다시 시도해 주세요.');
				if (first) {
					console.info(JSON.stringify({ event: 'latency', stage: 'reply_first_token', ms: Math.round(performance.now() - started), model }));
					first = false;
				}
				options.onPartial(text);
			}
			if (!completed) throw new ServiceError('AI 응답을 완성하지 못했어요. 다시 시도해 주세요.');
		} else {
			const data = await createGeminiClient(env).models.generateContent(params);
			if (data.candidates?.some((candidate) => candidate.finishReason && candidate.finishReason !== 'STOP'))
				throw new ServiceError('AI 응답을 완성하지 못했어요. 다시 시도해 주세요.');
			text = data.text || '';
		}
		text = text.trim();
		if (!text || text.length > 16_000) throw new ServiceError('AI 응답을 읽지 못했어요. 다시 시도해 주세요.');
		return text;
	}, { model }).catch((error: unknown) => {
		// Provider messages may contain request data; record only a safe status and category.
		const status = error && typeof error === 'object' && 'status' in error && typeof error.status === 'number'
			? error.status : undefined;
		console.error(JSON.stringify({ event: 'gemini_request_failed', task: options.task, model, status,
			category: error instanceof ServiceError ? 'response_validation' : 'provider_or_network',
			reason: providerErrorReason(error) }));
		throw error;
	});
}

export function errorMessage(error: unknown) {
	if (error instanceof ServiceError) return error.message;
	if (providerErrorReason(error) === 'unsupported_location')
		return '현재 대화가 AI를 지원하지 않는 서버 지역에 연결됐어요. 새 대화를 시작해 다시 시도해 주세요.';
	const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined;
	const message = error instanceof Error ? error.message : '';
	if (status === 400 && /API_KEY_INVALID|API key not valid/i.test(message))
		return 'Gemini API 키가 유효하지 않아요. 서버의 GEMINI_API_KEY를 확인해 주세요.';
	if (status === 429) return 'AI 사용량 한도에 도달했어요. 잠시 후 다시 시도해 주세요.';
	if (status === 401 || status === 403) return 'Gemini API 키와 모델 접근 권한을 확인해 주세요.';
	return 'AI 요청을 처리하지 못했어요. 모델 설정을 확인하거나 잠시 후 다시 시도해 주세요.';
}
