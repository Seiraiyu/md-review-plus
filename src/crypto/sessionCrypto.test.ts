import { describe, it, expect } from 'vitest';
import { webcrypto } from 'node:crypto';
import { importKey, decryptToString, encryptFromString } from './sessionCrypto';

const cryptoApi = (
  globalThis.crypto?.subtle ? globalThis.crypto : webcrypto
) as Crypto;

describe('sessionCrypto', () => {
  it('roundtrips a string', async () => {
    const raw = cryptoApi.getRandomValues(new Uint8Array(32));
    const key = await importKey(raw, cryptoApi);
    const env = await encryptFromString(key, 'hello world', cryptoApi);
    const out = await decryptToString(key, env, cryptoApi);
    expect(out).toBe('hello world');
  });
});
