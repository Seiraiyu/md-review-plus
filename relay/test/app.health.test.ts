import { describe, it, expect } from 'bun:test';
import { createApp } from '../src/app';

describe('app /api/health', () => {
  it('returns ok + session count', async () => {
    const { app, store } = await createApp({
      ttlMs: 1000,
      maxSessions: 10,
      rateLimit: 100,
    });
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; sessions: number };
    expect(body.status).toBe('ok');
    expect(body.sessions).toBe(0);
    expect(store.size()).toBe(0);
  });
});

describe('GET /r/:id', () => {
  it('serves the SPA html when staticHtml provided', async () => {
    const { app } = await createApp({
      ttlMs: 60_000,
      maxSessions: 10,
      rateLimit: 100,
      staticHtml: '<!doctype html><title>md-review-plus relay</title>',
    });
    const res = await app.request('/r/anything');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/html/);
    const t = await res.text();
    expect(t).toContain('md-review-plus relay');
  });
});
