import { describe, it, expect } from 'vitest';
import { uploadSession } from './remoteUpload';

describe('uploadSession', () => {
  it('POSTs to /api/sessions and returns id+expiresAt', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fakeFetch: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init: init! });
      return new Response(JSON.stringify({ id: 'abc123', expiresAt: 9999 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };
    const res = await uploadSession({
      relay: 'https://relay.example',
      filename: 'spec.md',
      iv: 'IV',
      ct: 'CT',
      fetchFn: fakeFetch,
    });
    expect(res).toEqual({ id: 'abc123', expiresAt: 9999 });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://relay.example/api/sessions');
    expect((calls[0].init.method ?? 'GET').toUpperCase()).toBe('POST');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      v: 1,
      iv: 'IV',
      ct: 'CT',
      filename: 'spec.md',
    });
  });

  it('throws on non-2xx response', async () => {
    const fakeFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429 });
    await expect(
      uploadSession({
        relay: 'https://r',
        filename: 'a.md',
        iv: 'i',
        ct: 'c',
        fetchFn: fakeFetch,
      }),
    ).rejects.toThrow(/rate_limited|429/);
  });
});
