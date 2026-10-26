import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

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
