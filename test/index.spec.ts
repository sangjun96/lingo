import { exports } from 'cloudflare:workers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import app from '../src/index';

const bindings: Env = {
  GEMINI_MODEL: 'gemini-3.8-flash',
  GEMINI_API_KEY: 'test-gemini-key',
};

function generate(body: unknown, env = bindings) {
  return app.request('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, env);
}

afterEach(() => vi.restoreAllMocks());

describe('Hono Worker API', () => {
  it('serves health checks in the Workers runtime', async () => {
    const response = await exports.default.fetch('https://example.com/api/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('calls the Gemini API directly with the API key', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { role: 'model', parts: [{ text: '안녕하세요!' }] } }],
    }), { headers: { 'Content-Type': 'application/json' } }));
    const response = await generate({ prompt: '안녕' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ text: '안녕하세요!' });
    expect(fetch).toHaveBeenCalledOnce();
    const [input, init] = fetch.mock.calls[0];
    const request = new Request(input, init);
    expect(request.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent');
    expect(request.headers.has('cf-aig-authorization')).toBe(false);
    expect(request.headers.get('x-goog-api-key')).toBe('test-gemini-key');
    expect(await request.json()).toMatchObject({ contents: [{ parts: [{ text: '안녕' }] }] });
  });

  it.each([{}, null, { prompt: '' }, { prompt: '  ' }, { prompt: 42 }, { prompt: 'a'.repeat(4001) }])('rejects invalid input: %j', async (body) => {
    expect((await generate(body)).status).toBe(400);
  });

  it('rejects malformed JSON', async () => {
    const response = await app.request('/api/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
    }, bindings);
    expect(response.status).toBe(400);
  });

  it('rejects oversized bodies', async () => {
    expect((await generate({ prompt: 'a'.repeat(17000) })).status).toBe(413);
  });

  it('reports missing configuration without contacting Gemini', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    expect((await generate({ prompt: 'hello' }, { ...bindings, GEMINI_API_KEY: '' })).status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not expose provider errors or credentials', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('secret upstream error', { status: 403 }));
    const response = await generate({ prompt: 'hello' });
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain('secret');
  });

  it('returns a JSON 404 for unknown API routes', async () => {
    const response = await exports.default.fetch('https://example.com/api/missing');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
  });
});
