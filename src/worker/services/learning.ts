import type { Language } from '../../shared/languages';
import { promptSets } from './prompts';
import type { Expression, Learning, Turn } from '../../shared/conversation';
import { generateText, ServiceError, type GeminiEnv } from './gemini';

const string = { type: 'string' };
const expressionSchema = {
	type: 'object',
	properties: { text: string, translation: string, explanation: string },
	required: ['text', 'translation', 'explanation'],
	additionalProperties: false,
};
const schema = {
	type: 'object',
	properties: {
		translation: string,
		explanation: string,
		suggestions: {
			type: 'array',
			minItems: 3,
			maxItems: 3,
			items: {
				...expressionSchema,
				properties: { ...expressionSchema.properties, label: string },
				required: [...expressionSchema.required, 'label'],
			},
		},
		feedback: {
			type: 'object',
			properties: { improved: { anyOf: [expressionSchema, { type: 'null' }] }, explanation: string },
			required: ['improved', 'explanation'],
			additionalProperties: false,
		},
	},
	required: ['translation', 'explanation', 'suggestions', 'feedback'],
	additionalProperties: false,
};

function object(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new ServiceError('학습 자료 형식을 확인하지 못했어요. 다시 시도해 주세요.');
	return value as Record<string, unknown>;
}

function sentence(value: unknown) {
	if (typeof value !== 'string' || !value.trim() || value.length > 1000)
		throw new ServiceError('학습 자료가 올바르지 않아요. 다시 시도해 주세요.');
	return value.trim();
}

function expression(value: unknown, id: string): Expression {
	const data = object(value);
	return { id, text: sentence(data.text), translation: sentence(data.translation), explanation: sentence(data.explanation) };
}

export function parseLearning(value: unknown, turnId: string): { translation: string; explanation: string; learning: Learning } {
	const data = object(value);
	if (!Array.isArray(data.suggestions) || data.suggestions.length !== 3)
		throw new ServiceError('추천 답변 3개를 만들지 못했어요. 다시 시도해 주세요.');
	const feedback = object(data.feedback);
	return {
		translation: sentence(data.translation),
		explanation: sentence(data.explanation),
		learning: {
			status: 'ready',
			suggestions: data.suggestions.map((item, index) => ({
				...expression(item, `${turnId}-suggestion-${index}`),
				label: sentence(object(item).label),
			})),
			feedback: {
				improved: feedback.improved === null ? null : expression(feedback.improved, `${turnId}-improved`),
				explanation: sentence(feedback.explanation),
			},
		},
	};
}

export async function createLearning(env: GeminiEnv, turn: Turn, language: Language = 'en') {
	const text = await generateText(
		env,
		promptSets[language].learning,
		[{ role: 'user', parts: [{ text: JSON.stringify({ user: turn.userText, assistant: turn.assistant!.text }) }] }],
		{ task: 'learning', schema },
	);
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		throw new ServiceError('학습 자료를 읽지 못했어요. 다시 시도해 주세요.');
	}
	return parseLearning(data, turn.id);
}
