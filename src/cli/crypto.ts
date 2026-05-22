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

export type ArtifactKind = 'markdown' | 'html';

export function encryptDocument(
  key: Uint8Array,
  kindOrContent: ArtifactKind | string,
  maybeContent?: string,
): { iv: string; ct: string } {
  // Wire format:
  //   markdown → encrypt plaintext (backward-compat with v1.2-1.3 relay SPA)
  //   html     → encrypt {kind:'html', content} JSON envelope (requires 1.4+ SPA)
  // Backward-compat overload: (key, plaintext) → markdown plaintext.
  let payload: string;
  if (maybeContent === undefined) {
    payload = kindOrContent;
  } else if (kindOrContent === 'markdown') {
    payload = maybeContent;
  } else {
    payload = JSON.stringify({ kind: kindOrContent, content: maybeContent });
  }
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(AES_GCM, key, iv);
  const enc = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const ct = Buffer.concat([enc, tag]);
  return { iv: iv.toString('base64'), ct: ct.toString('base64') };
}

export function decryptFeedback(key: Uint8Array, payload: { iv: string; ct: string }): string {
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
