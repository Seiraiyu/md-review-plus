import { useEffect, useState } from 'react';
import { decryptToString, encryptFromString, keyFromBase64Url } from '../crypto/sessionCrypto';

export interface UseRemoteSessionArgs {
  id: string;
  keyBase64Url: string;
}

export type RemoteSessionState = 'loading' | 'ready' | 'error';

export interface UseRemoteSessionResult {
  state: RemoteSessionState;
  content: string | null;
  filename: string | null;
  error: string | null;
  submit: (feedbackJson: string) => Promise<void>;
}

export function useRemoteSession(args: UseRemoteSessionArgs): UseRemoteSessionResult {
  const [state, setState] = useState<RemoteSessionState>('loading');
  const [content, setContent] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState<CryptoKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const k = await keyFromBase64Url(args.keyBase64Url);
        const res = await fetch(`/api/sessions/${encodeURIComponent(args.id)}`);
        if (!res.ok) throw new Error(`relay ${res.status}`);
        const body = (await res.json()) as {
          iv: string;
          ct: string;
          filename: string;
        };
        const text = await decryptToString(k, { iv: body.iv, ct: body.ct });
        if (cancelled) return;
        setKey(k);
        setContent(text);
        setFilename(body.filename);
        setState('ready');
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'unknown error');
        setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [args.id, args.keyBase64Url]);

  const submit = async (feedbackJson: string) => {
    if (!key) throw new Error('no key');
    const env = await encryptFromString(key, feedbackJson);
    const res = await fetch(`/api/sessions/${encodeURIComponent(args.id)}/feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(env),
    });
    if (!res.ok) throw new Error(`submit failed: ${res.status}`);
  };

  return { state, content, filename, error, submit };
}
