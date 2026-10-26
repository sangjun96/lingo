import type { Language } from '../../shared/languages';
import { promptSets } from './prompts';
import type { Turn } from '../../shared/conversation';
import { generateText, ServiceError, type GeminiEnv } from './gemini';

export async function createReply(env: GeminiEnv, turns: Turn[], turn: Turn, onPartial?: (text: string) => void, language: Language = 'en') {
	const contents = turns
		.filter((item) => item.id !== turn.id && item.assistant)
		.slice(-12)
		.flatMap((item) => [
			{ role: 'user', parts: [{ text: item.userText ?? promptSets[language].opening }] },
			{ role: 'model', parts: [{ text: item.assistant!.text }] },
		]);
	contents.push({ role: 'user', parts: [{ text: turn.userText ?? promptSets[language].opening }] });
	const text = await generateText(
		env,
		promptSets[language].reply,
		contents,
		{ task: 'reply', onPartial },
	);
	if (text.length > 600) throw new ServiceError('AI 답변이 너무 길어요. 다시 시도해 주세요.');
	return { id: `${turn.id}-assistant`, text, translation: '', explanation: '' };
}

export async function transcribe(env: GeminiEnv, data: string, mimeType: string, language: Language = 'en') {
	const text = await generateText(
		env,
		promptSets[language].transcribe,
		[{ role: 'user', parts: [{ inlineData: { mimeType, data } }] }],
		{ task: 'transcribe' },
	);
	if (text === '[NO_SPEECH]' || text.length > 4000)
		throw new ServiceError('말소리를 확인하지 못했어요. 다시 녹음해 주세요.', 422);
	return text;
}
