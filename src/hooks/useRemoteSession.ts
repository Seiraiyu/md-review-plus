import { useEffect, useState } from 'react';
import { decryptToString, encryptFromString, keyFromBase64Url } from '../crypto/sessionCrypto';

export interface UseRemoteSessionArgs {
  id: string;
  keyBase64Url: string;
}

export type RemoteSessionState = 'loading' | 'ready' | 'error';

export type RemoteArtifactKind = 'markdown' | 'html';

export interface UseRemoteSessionResult {
  state: RemoteSessionState;
  kind: RemoteArtifactKind | null;
  content: string | null;
  filename: string | null;
  error: string | null;
  submit: (feedbackJson: string) => Promise<void>;
}

function parseEnvelope(text: string): { kind: RemoteArtifactKind; content: string } {
  try {
    const parsed = JSON.parse(text);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.content === 'string' &&
      (parsed.kind === 'html' || parsed.kind === 'markdown')
    ) {
      return { kind: parsed.kind, content: parsed.content };
    }
  } catch {
    /* fall through to legacy */
  }
  return { kind: 'markdown', content: text };
}

export function useRemoteSession(args: UseRemoteSessionArgs): UseRemoteSessionResult {
  const [state, setState] = useState<RemoteSessionState>('loading');
  const [kind, setKind] = useState<RemoteArtifactKind | null>(null);
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
        const envelope = parseEnvelope(text);
        setKey(k);
        setKind(envelope.kind);
        setContent(envelope.content);
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

  return { state, kind, content, filename, error, submit };
}
