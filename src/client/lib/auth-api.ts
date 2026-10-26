export type AuthSession = {
	user: { id: string; name: string; email: string };
};

async function responseError(response: Response) {
	const data = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
	return new Error(data.message || data.error || '요청을 처리하지 못했어요.');
}

export async function getAuthSession(): Promise<AuthSession | null> {
	const response = await fetch('/api/auth/get-session', { credentials: 'same-origin' });
	if (!response.ok) throw await responseError(response);
	return response.json() as Promise<AuthSession | null>;
}

export async function signIn(email: string, password: string) {
	const response = await fetch('/api/auth/sign-in/email', {
		method: 'POST',
		credentials: 'same-origin',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password }),
	});
	if (!response.ok) throw await responseError(response);
}

export async function signOut() {
	const response = await fetch('/api/auth/sign-out', {
		method: 'POST',
		credentials: 'same-origin',
	});
	if (!response.ok) throw await responseError(response);
}
