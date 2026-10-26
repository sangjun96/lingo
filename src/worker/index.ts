import { routeAgentRequest } from 'agents';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { Hono, type Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { createAuth } from './db/auth';
import { conversationOwner } from './db/schema';
import { measure } from './services/timing';

export { LingoAgent } from './agents/lingo';

type AppEnv = { Bindings: Env; Variables: { userId: string } };

async function ownsConversation(env: Env, sessionId: string, userId: string) {
  const db = drizzle(env.AUTH_DB);
  const [owner] = await db.select({ userId: conversationOwner.userId }).from(conversationOwner)
    .where(eq(conversationOwner.sessionId, sessionId)).limit(1);
  if (owner) return owner.userId === userId;
  // Only claim new conversations. RETURNING also handles concurrent claims safely.
  const [created] = await db.insert(conversationOwner).values({ sessionId, userId, createdAt: new Date() })
    .onConflictDoNothing().returning({ userId: conversationOwner.userId });
  if (created) return true;
  const [claimed] = await db.select({ userId: conversationOwner.userId }).from(conversationOwner)
    .where(and(eq(conversationOwner.sessionId, sessionId), eq(conversationOwner.userId, userId))).limit(1);
  return !!claimed;
}

const app = new Hono<AppEnv>();

const requireSession = createMiddleware<AppEnv>(async (c, next) => {
  const auth = createAuth(c.env, new URL(c.req.url).origin);
  const started = performance.now();
  const session = await measure('auth', () => auth.api.getSession({ headers: c.req.raw.headers }));
  if (!session) return c.json({ error: 'Unauthorized' }, 401);
  c.set('userId', session.user.id);
  await next();
  c.header('Server-Timing', `authorized_request;dur=${Math.round(performance.now() - started)}`);
});

const handleAuth = (c: Context<AppEnv>) =>
  createAuth(c.env, new URL(c.req.url).origin).handler(c.req.raw);

app.all('/api/auth', handleAuth);
app.all('/api/auth/*', handleAuth);
app.all('/api/*', requireSession, (c) => c.json({ error: 'Not found' }, 404));
app.all('/agents/*', requireSession, async (c) => {
  const match = new URL(c.req.url).pathname.match(/^\/agents\/lingo-agent\/([a-f0-9-]{36})(?:\/|$)/i);
  if (!match || !(await measure('ownership', () => ownsConversation(c.env, match[1], c.get('userId')))))
    return c.json({ error: 'Not found' }, 404);
  return await routeAgentRequest(c.req.raw, c.env) ?? c.json({ error: 'Not found' }, 404);
});
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
