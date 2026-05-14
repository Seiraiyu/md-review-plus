import { describe, it, expect } from 'bun:test';
import { createApp } from '../src/app';
import type { Hono } from 'hono';

async function createSession(app: Hono) {
  const r = await app.request('/api/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ v: 1, iv: 'AAA', ct: 'AQID', filename: 'spec.md' }),
  });
  return ((await r.json()) as { id: string }).id;
}

describe('POST /api/sessions/:id/feedback', () => {
  it('stores feedback and deletes session', async () => {
    const { app } = await createApp({ ttlMs: 60_000, maxSessions: 10, rateLimit: 100 });
    const id = await createSession(app);
    const res = await app.request(`/api/sessions/${id}/feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ iv: 'BBB', ct: 'ZmI=' }),
    });
    expect(res.status).toBe(200);
    // delete fires after 100ms; wait then verify
    await new Promise((r) => setTimeout(r, 150));
    const after = await app.request(`/api/sessions/${id}`);
    expect(after.status).toBe(404);
  });

  it('404s for unknown id', async () => {
    const { app } = await createApp({ ttlMs: 60_000, maxSessions: 10, rateLimit: 100 });
    const res = await app.request('/api/sessions/missing/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ iv: 'BBB', ct: 'ZmI=' }),
    });
    expect(res.status).toBe(404);
  });

  it('rejects oversized feedback', async () => {
    const { app } = await createApp({
      ttlMs: 60_000,
      maxSessions: 10,
      rateLimit: 100,
      maxFeedbackBytes: 64,
    });
    const id = await createSession(app);
    const big = 'A'.repeat(2000);
    const res = await app.request(`/api/sessions/${id}/feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ iv: 'BBB', ct: big }),
    });
    expect(res.status).toBe(413);
  });
});

describe('GET /api/sessions/:id/feedback (SSE)', () => {
  it('streams feedback when posted', async () => {
    const { app } = await createApp({ ttlMs: 60_000, maxSessions: 10, rateLimit: 100 });
    const id = await createSession(app);
    const sseReq = app.request(`/api/sessions/${id}/feedback`, {
      method: 'GET',
      headers: { accept: 'text/event-stream' },
    });

    await new Promise((r) => setTimeout(r, 50));
    await app.request(`/api/sessions/${id}/feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ iv: 'BBB', ct: 'ZmI=' }),
    });

    const res = await sseReq;
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/event-stream/);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let collected = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      collected += decoder.decode(value);
      if (collected.includes('"iv":"BBB"')) break;
    }
    expect(collected).toContain('"iv":"BBB"');
    expect(collected).toContain('"ct":"ZmI="');
  });

  it('delivers existing feedback immediately', async () => {
    const { app } = await createApp({ ttlMs: 60_000, maxSessions: 10, rateLimit: 100 });
    const id = await createSession(app);
    await app.request(`/api/sessions/${id}/feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ iv: 'C', ct: 'D' }),
    });
    // store.delete fires after 100ms — open SSE before then.
    const res = await app.request(`/api/sessions/${id}/feedback`, {
      method: 'GET',
      headers: { accept: 'text/event-stream' },
    });
    expect(res.status).toBe(200);
    const text = await new Response(res.body).text();
    expect(text).toContain('"iv":"C"');
  });

  it('404s for unknown id', async () => {
    const { app } = await createApp({ ttlMs: 60_000, maxSessions: 10, rateLimit: 100 });
    const res = await app.request('/api/sessions/none/feedback', {
      method: 'GET',
      headers: { accept: 'text/event-stream' },
    });
    expect(res.status).toBe(404);
  });
});
