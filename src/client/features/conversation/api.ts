import type { ConversationState } from '../../../shared/conversation';

export async function readResponse<T>(response: Response): Promise<T> {
	if (!response.ok) {
		const data = (await response.json().catch(() => ({}))) as { error?: string };
		throw new Error(data.error || '연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
	}
	return response.json() as Promise<T>;
}

export async function submitTurn(base: string, id: string, replyTo: string | null, input: Blob | null) {
	const headers: Record<string, string> = { 'X-Request-Id': id };
	if (replyTo) headers['X-Reply-To'] = replyTo;
	headers['Content-Type'] = input instanceof Blob ? input.type : 'application/json';
	return readResponse<ConversationState>(
		await fetch(`${base}/turns`, {
			method: 'POST',
			headers,
			body: input instanceof Blob ? input : JSON.stringify({ text: null }),
		}),
	);
}

export function loadSessionId() {
	try {
		const id = localStorage.getItem('lingo-session');
		if (id && /^[a-f0-9-]{36}$/.test(id)) return id;
	} catch {
		/* Storage can be unavailable in private browsing. */
	}
	return newSessionId();
}

export function newSessionId() {
	const id = crypto.randomUUID();
	try {
		localStorage.setItem('lingo-session', id);
	} catch {
		/* The session still works in this tab. */
	}
	return id;
}
