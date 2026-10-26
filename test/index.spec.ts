import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

describe('Cloudflare Agents', () => {
  it('routes requests to the LingoAgent Durable Object', async () => {
    const response = await exports.default.fetch('https://example.com/agents/lingo-agent/test/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('returns a JSON 404 for unknown agent paths', async () => {
    const response = await exports.default.fetch('https://example.com/agents/lingo-agent/test/missing');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
  });
});

describe('Removed API routes', () => {
  it.each([
    ['GET', '/api/health'],
    ['POST', '/api/generate'],
  ])('returns 404 for %s %s', async (method, path) => {
    const response = await exports.default.fetch(`https://example.com${path}`, { method });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
  });
});
