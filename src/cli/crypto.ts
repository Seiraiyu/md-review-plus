import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

const AES_GCM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

export function generateKey(): Uint8Array {
  return new Uint8Array(randomBytes(32));
}

export function keyToBase64Url(k: Uint8Array): string {
  return Buffer.from(k).toString('base64url');
}

export function keyFromBase64Url(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, 'base64url'));
}

export function encryptDocument(
  key: Uint8Array,
  plaintext: string,
): { iv: string; ct: string } {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(AES_GCM, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Browser SubtleCrypto expects ciphertext||tag. Concatenate.
  const ct = Buffer.concat([enc, tag]);
  return { iv: iv.toString('base64'), ct: ct.toString('base64') };
}

export function decryptFeedback(
  key: Uint8Array,
  payload: { iv: string; ct: string },
): string {
  const iv = Buffer.from(payload.iv, 'base64');
  const ctTag = Buffer.from(payload.ct, 'base64');
  if (ctTag.length < TAG_BYTES) throw new Error('ciphertext too short');
  const ct = ctTag.subarray(0, ctTag.length - TAG_BYTES);
  const tag = ctTag.subarray(ctTag.length - TAG_BYTES);
  const decipher = createDecipheriv(AES_GCM, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(ct), decipher.final()]);
  return dec.toString('utf8');
}
