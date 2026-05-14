export interface Envelope {
  iv: string;
  ct: string;
}

function b64ToBytes(s: string): Uint8Array<ArrayBuffer> {
  const binary = atob(s);
  const buf = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function importKey(
  raw: Uint8Array<ArrayBuffer>,
  c: Crypto = crypto,
): Promise<CryptoKey> {
  return c.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

export function keyFromBase64Url(s: string, c: Crypto = crypto): Promise<CryptoKey> {
  const norm =
    s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  return importKey(b64ToBytes(norm), c);
}

export async function decryptToString(
  key: CryptoKey,
  env: Envelope,
  c: Crypto = crypto,
): Promise<string> {
  const iv = b64ToBytes(env.iv);
  const ct = b64ToBytes(env.ct);
  const plain = await c.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(plain);
}

export async function encryptFromString(
  key: CryptoKey,
  plaintext: string,
  c: Crypto = crypto,
): Promise<Envelope> {
  const iv = c.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const ct = new Uint8Array(
    await c.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(plaintext),
    ),
  );
  return { iv: bytesToB64(iv), ct: bytesToB64(ct) };
}
