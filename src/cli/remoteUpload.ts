export interface UploadArgs {
  relay: string;
  filename: string;
  iv: string;
  ct: string;
  fetchFn?: typeof fetch;
}

export interface UploadResult {
  id: string;
  expiresAt: number;
}

export async function uploadSession(args: UploadArgs): Promise<UploadResult> {
  const f = args.fetchFn ?? fetch;
  const url = `${args.relay.replace(/\/$/, '')}/api/sessions`;
  const res = await f(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      v: 1,
      iv: args.iv,
      ct: args.ct,
      filename: args.filename,
    }),
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      /* ignore */
    }
    throw new Error(`relay ${res.status}${detail ? ': ' + detail : ''}`);
  }
  return (await res.json()) as UploadResult;
}
