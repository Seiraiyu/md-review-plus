import { describe, it, expect } from 'bun:test';
import { createApp } from '../src/app';

function body(obj: unknown) {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(obj),
  };
}

describe('POST /api/sessions', () => {
  it('creates a session and returns id + expiresAt', async () => {
    const { app } = await createApp({ ttlMs: 60_000, maxSessions: 10, rateLimit: 100 });
    const res = await app.request(
      '/api/sessions',
      body({ v: 1, iv: 'aGVsbG8=', ct: 'd29ybGQ=', filename: 'spec.md' }),
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as {
      id?: string;
      iv?: string;
      ct?: string;
      filename?: string;
      expiresAt?: number;
    };
    expect(typeof j.id).toBe('string');
    expect(typeof j.expiresAt).toBe('number');
  });

  it('rejects oversized payload', async () => {
    const { app } = await createApp({
      ttlMs: 60_000,
      maxSessions: 10,
      rateLimit: 100,
      maxBodyBytes: 64,
    });
    const big = 'A'.repeat(2000);
    const res = await app.request(
      '/api/sessions',
      body({ v: 1, iv: 'a', ct: big, filename: 'x.md' }),
    );
    expect(res.status).toBe(413);
  });

  it('rejects unsupported version', async () => {
    const { app } = await createApp({ ttlMs: 60_000, maxSessions: 10, rateLimit: 100 });
    const res = await app.request(
      '/api/sessions',
      body({ v: 2, iv: 'a', ct: 'b', filename: 'x.md' }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects when rate-limited', async () => {
    const { app } = await createApp({ ttlMs: 60_000, maxSessions: 10, rateLimit: 1 });
    const ok = await app.request('/api/sessions', {
      ...body({ v: 1, iv: 'a', ct: 'b', filename: 'x.md' }),
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.1.1.1' },
    });
    expect(ok.status).toBe(200);
    const blocked = await app.request('/api/sessions', {
      ...body({ v: 1, iv: 'a', ct: 'b', filename: 'x.md' }),
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.1.1.1' },
    });
    expect(blocked.status).toBe(429);
  });

  it('rejects when at capacity', async () => {
    const { app } = await createApp({ ttlMs: 60_000, maxSessions: 1, rateLimit: 100 });
    await app.request('/api/sessions', body({ v: 1, iv: 'a', ct: 'b', filename: 'x.md' }));
    const res = await app.request(
      '/api/sessions',
      body({ v: 1, iv: 'a', ct: 'b', filename: 'y.md' }),
    );
    expect(res.status).toBe(503);
  });
});

describe('GET /api/sessions/:id', () => {
  it('returns ciphertext + meta for an existing session', async () => {
    const { app } = await createApp({ ttlMs: 60_000, maxSessions: 10, rateLimit: 100 });
    const create = await app.request('/api/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ v: 1, iv: 'AAA', ct: 'AQID', filename: 'spec.md' }),
    });
    const { id } = (await create.json()) as { id: string };
    const res = await app.request(`/api/sessions/${id}`);
    expect(res.status).toBe(200);
    const j = (await res.json()) as {
      id?: string;
      iv?: string;
      ct?: string;
      filename?: string;
      expiresAt?: number;
    };
    expect(j.iv).toBe('AAA');
    expect(j.ct).toBe('AQID');
    expect(j.filename).toBe('spec.md');
    expect(typeof j.expiresAt).toBe('number');
  });

  it('404s for unknown id', async () => {
    const { app } = await createApp({ ttlMs: 60_000, maxSessions: 10, rateLimit: 100 });
    const res = await app.request('/api/sessions/nope');
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/sessions/:id', () => {
  it('deletes a session', async () => {
    const { app } = await createApp({ ttlMs: 60_000, maxSessions: 10, rateLimit: 100 });
    const r = await app.request('/api/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ v: 1, iv: 'a', ct: 'b', filename: 'x.md' }),
    });
    const { id } = (await r.json()) as { id: string };
    const del = await app.request(`/api/sessions/${id}`, { method: 'DELETE' });
    expect(del.status).toBe(204);
    const get = await app.request(`/api/sessions/${id}`);
    expect(get.status).toBe(404);
  });

  it('204s even on unknown id (idempotent)', async () => {
    const { app } = await createApp({ ttlMs: 60_000, maxSessions: 10, rateLimit: 100 });
    const del = await app.request('/api/sessions/missing', { method: 'DELETE' });
    expect(del.status).toBe(204);
  });
});
