import { describe, it, expect } from 'bun:test';
import { createApp } from '../src/app';

describe('abuse posture', () => {
  it('returns 503 when at cap with structured body', async () => {
    const { app } = await createApp({ ttlMs: 60_000, maxSessions: 1, rateLimit: 100 });
    const body = (n: string) => ({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ v: 1, iv: 'i', ct: 'c', filename: `${n}.md` }),
    });
    await app.request('/api/sessions', body('a'));
    const r = await app.request('/api/sessions', body('b'));
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ error: 'at_capacity' });
  });

  it('returns 429 with structured body when rate-limited', async () => {
    const { app } = await createApp({ ttlMs: 60_000, maxSessions: 10, rateLimit: 1 });
    const hdr = { 'content-type': 'application/json', 'x-forwarded-for': '9.9.9.9' };
    const body = JSON.stringify({ v: 1, iv: 'i', ct: 'c', filename: 'a.md' });
    await app.request('/api/sessions', { method: 'POST', headers: hdr, body });
    const r = await app.request('/api/sessions', { method: 'POST', headers: hdr, body });
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ error: 'rate_limited' });
  });
});
