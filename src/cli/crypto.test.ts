import { describe, it, expect } from 'vitest';
import {
  generateKey,
  encryptDocument,
  decryptFeedback,
  keyToBase64Url,
  keyFromBase64Url,
} from './crypto';
import { webcrypto } from 'node:crypto';

describe('CLI crypto', () => {
  it('generates a 32-byte key', () => {
    const k = generateKey();
    expect(k.length).toBe(32);
  });

  it('roundtrips key through base64url', () => {
    const k = generateKey();
    const b = keyToBase64Url(k);
    expect(b).toMatch(/^[A-Za-z0-9_-]+$/);
    const back = keyFromBase64Url(b);
    expect(back).toEqual(k);
  });

  it('encrypts a document so WebCrypto can decrypt it', async () => {
    const k = generateKey();
    const { iv, ct } = encryptDocument(k, '# hello\n');

    const cryptoKey = await webcrypto.subtle.importKey(
      'raw',
      k,
      { name: 'AES-GCM' },
      false,
      ['decrypt'],
    );
    const plain = await webcrypto.subtle.decrypt(
      { name: 'AES-GCM', iv: Buffer.from(iv, 'base64') },
      cryptoKey,
      Buffer.from(ct, 'base64'),
    );
    expect(new TextDecoder().decode(plain)).toBe('# hello\n');
  });

  it('decrypts feedback that was encrypted with WebCrypto', async () => {
    const k = generateKey();
    const cryptoKey = await webcrypto.subtle.importKey(
      'raw',
      k,
      { name: 'AES-GCM' },
      false,
      ['encrypt'],
    );
    const iv = webcrypto.getRandomValues(new Uint8Array(12));
    const payload = JSON.stringify({ feedback: 'ok' });
    const ct = new Uint8Array(
      await webcrypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        new TextEncoder().encode(payload),
      ),
    );
    const decoded = decryptFeedback(k, {
      iv: Buffer.from(iv).toString('base64'),
      ct: Buffer.from(ct).toString('base64'),
    });
    expect(JSON.parse(decoded)).toEqual({ feedback: 'ok' });
  });
});
