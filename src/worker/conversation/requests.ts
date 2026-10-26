import { encodeBase64 } from '../services/encoding';
import { MAX_AUDIO_BYTES } from '../../shared/conversation';
import { ServiceError } from '../services/gemini';

export type TurnInput = { id: string; replyTo: string | null; text: string | null; audio?: { data: string; mimeType: string } };

export async function limitedBody(request: Request, limit: number) {
	if (!request.body) throw new ServiceError('입력이 비어 있어요.', 400);
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.byteLength;
		if (size > limit) {
			await reader.cancel();
			throw new ServiceError('입력이 너무 커요. 더 짧게 말해 주세요.', 413);
		}
		chunks.push(value);
	}
	if (!size) throw new ServiceError('입력이 비어 있어요.', 400);
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
}

export async function readTurnInput(request: Request): Promise<TurnInput> {
	const id = request.headers.get('X-Request-Id');
	if (!id || !/^[a-zA-Z0-9-]{8,64}$/.test(id)) throw new ServiceError('요청 ID가 올바르지 않아요.', 400);
	const replyTo = request.headers.get('X-Reply-To') || null;
	const contentType = request.headers.get('Content-Type')?.split(';')[0] || '';
	if (contentType === 'application/json') {
		let body: unknown;
		try {
			body = JSON.parse(new TextDecoder().decode(await limitedBody(request, 16_384)));
		} catch (error) {
			if (error instanceof ServiceError) throw error;
			throw new ServiceError('입력 형식이 올바르지 않아요.', 400);
		}
		const text = body && typeof body === 'object' && 'text' in body ? body.text : undefined;
		if (text !== null && (typeof text !== 'string' || !text.trim() || text.length > 4000))
			throw new ServiceError('1~4000자의 문장을 입력해 주세요.', 400);
		return { id, replyTo, text: typeof text === 'string' ? text.trim() : null };
	}
	const mimeType = contentType === 'audio/mp4' ? 'audio/m4a' : contentType;
	if (!['audio/webm', 'audio/ogg', 'audio/wav', 'audio/m4a', 'audio/mpeg'].includes(mimeType))
		throw new ServiceError('지원하지 않는 녹음 형식이에요.', 415);
	return { id, replyTo, text: null, audio: { data: encodeBase64(await limitedBody(request, MAX_AUDIO_BYTES)), mimeType } };
}
