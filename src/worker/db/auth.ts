import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { drizzle } from 'drizzle-orm/d1';
import { authSchema } from './schema';

export function createAuth(env: Env, baseURL: string) {
	return betterAuth({
		baseURL,
		secret: env.BETTER_AUTH_SECRET,
		database: drizzleAdapter(drizzle(env.AUTH_DB), { provider: 'sqlite', schema: authSchema }),
		emailAndPassword: { enabled: true, disableSignUp: true },
	});
}
