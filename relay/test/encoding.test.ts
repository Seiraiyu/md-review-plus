import { describe, it, expect } from 'bun:test';
import { b64ToBytes, bytesToB64 } from '../src/encoding';

describe('encoding', () => {
  it('roundtrips bytes through base64', () => {
    const input = new Uint8Array([0, 1, 2, 250, 255]);
    const b64 = bytesToB64(input);
    const out = b64ToBytes(b64);
    expect(out).toEqual(input);
  });

  it('rejects invalid base64', () => {
    expect(() => b64ToBytes('@@@not base64@@@')).toThrow();
  });
});
