import { describe, expect, it } from 'vitest';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { hashPassword } from 'better-auth/crypto';

// Seed the same credential fields as scripts/create-account.ts, without touching a real account.
describe('CLI-created account compatibility', () => {
	it('accepts the same stored password under different auth secrets and rejects a wrong password', async () => {
		const email = 'account-check@example.test';
		const password = crypto.randomUUID();
		const now = new Date();
		const database = {
			user: [{ id: 'test-user', email, name: 'Test', emailVerified: false, createdAt: now, updatedAt: now }],
			account: [{ id: 'test-account', accountId: 'test-user', providerId: 'credential', userId: 'test-user', password: await hashPassword(password), createdAt: now, updatedAt: now }],
			session: [], verification: [],
		};
		for (const secret of [crypto.randomUUID(), crypto.randomUUID()]) {
			const auth = betterAuth({
				baseURL: 'https://lingo.example.test', secret,
				database: memoryAdapter(database),
				emailAndPassword: { enabled: true, disableSignUp: true },
				logger: { disabled: true },
			});
			const result = await auth.api.signInEmail({ body: { email, password } });
			expect(result.user.id).toBe('test-user');
			expect(result.token).toBeTruthy();
			await expect(auth.api.signInEmail({ body: { email, password: 'incorrect-password' } })).rejects.toMatchObject({ status: 'UNAUTHORIZED' });
		}
	});
});
