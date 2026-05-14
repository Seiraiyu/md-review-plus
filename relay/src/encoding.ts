export function bytesToB64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

export function b64ToBytes(s: string): Uint8Array {
  if (!/^[A-Za-z0-9+/=_-]*$/.test(s)) {
    throw new Error('invalid base64');
  }
  return new Uint8Array(Buffer.from(s, 'base64'));
}
