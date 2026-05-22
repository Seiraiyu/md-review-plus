import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRemoteSession } from './useRemoteSession';
import { encryptFromString, importKey } from '../crypto/sessionCrypto';

function rawKeyToBase64Url(rawKey: Uint8Array): string {
  return btoa(String.fromCharCode(...rawKey))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function mockSession(payload: string, filename: string): Promise<string> {
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const key = await importKey(rawKey);
  const env = await encryptFromString(key, payload);
  global.fetch = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          iv: env.iv,
          ct: env.ct,
          filename,
          expiresAt: Date.now() + 60_000,
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
  ) as never;
  return rawKeyToBase64Url(rawKey);
}

describe('useRemoteSession', () => {
  it('decrypts legacy plaintext payload as markdown', async () => {
    const keyB64 = await mockSession('# hello\n', 'spec.md');
    const { result } = renderHook(() => useRemoteSession({ id: 'abc', keyBase64Url: keyB64 }));

    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(result.current.kind).toBe('markdown');
    expect(result.current.content).toBe('# hello\n');
    expect(result.current.filename).toBe('spec.md');
  });

  it('decrypts new {kind:markdown, content} envelope', async () => {
    const keyB64 = await mockSession(
      JSON.stringify({ kind: 'markdown', content: '# new\n' }),
      'spec.md',
    );
    const { result } = renderHook(() => useRemoteSession({ id: 'abc', keyBase64Url: keyB64 }));

    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(result.current.kind).toBe('markdown');
    expect(result.current.content).toBe('# new\n');
  });

  it('decrypts {kind:html, content} envelope and exposes html kind', async () => {
    const keyB64 = await mockSession(
      JSON.stringify({ kind: 'html', content: '<p>x</p>' }),
      'demo.html',
    );
    const { result } = renderHook(() => useRemoteSession({ id: 'abc', keyBase64Url: keyB64 }));

    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(result.current.kind).toBe('html');
    expect(result.current.content).toBe('<p>x</p>');
    expect(result.current.filename).toBe('demo.html');
  });

  it('treats malformed JSON-like text as legacy markdown', async () => {
    const keyB64 = await mockSession('{"kind":"bogus"', 'doc.md');
    const { result } = renderHook(() => useRemoteSession({ id: 'abc', keyBase64Url: keyB64 }));

    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(result.current.kind).toBe('markdown');
    expect(result.current.content).toBe('{"kind":"bogus"');
  });
});
