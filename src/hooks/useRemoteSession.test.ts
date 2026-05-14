import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRemoteSession } from './useRemoteSession';
import { encryptFromString, importKey } from '../crypto/sessionCrypto';

describe('useRemoteSession', () => {
  it('fetches, decrypts, and exposes content', async () => {
    const rawKey = crypto.getRandomValues(new Uint8Array(32));
    const key = await importKey(rawKey);
    const env = await encryptFromString(key, '# hello\n');

    global.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            iv: env.iv,
            ct: env.ct,
            filename: 'spec.md',
            expiresAt: Date.now() + 60_000,
          }),
          { headers: { 'content-type': 'application/json' } },
        ),
    ) as never;

    const keyB64 = btoa(String.fromCharCode(...rawKey))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const { result } = renderHook(() =>
      useRemoteSession({ id: 'abc', keyBase64Url: keyB64 }),
    );

    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(result.current.content).toBe('# hello\n');
    expect(result.current.filename).toBe('spec.md');
  });
});
