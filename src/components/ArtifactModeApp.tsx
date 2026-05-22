import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildSrcdoc } from '../artifact/shim';
import { useFileWatch } from '../hooks/useFileWatch';
import { SubmittedScreen } from './SubmittedScreen';
import { SubmitErrorScreen } from './SubmitErrorScreen';

interface Artifact {
  kind: 'html';
  content: string;
  filename: string;
}

interface SectionDescriptor {
  id: string;
  heading: string;
}

type SectionStatus = 'pending' | 'approved' | 'rejected';

interface ReadyPayload {
  title: string | null;
  chrome: 'host' | 'none';
  sections: SectionDescriptor[];
  schema: { summary?: string } & Record<string, unknown>;
}

type SubmitState =
  | { state: 'idle' }
  | { state: 'submitting' }
  | { state: 'submitted' }
  | { state: 'error'; message: string };

interface SubmitPayload {
  sections: Array<{ heading: string; status: SectionStatus; comment: string }>;
  lineComments: Array<{
    file: string;
    startLine: number;
    endLine: number;
    selectedText: string;
    comment: string;
  }>;
  filename: string;
  interactiveState?: { state: unknown; summary?: string };
}

interface ArtifactModeAppProps {
  injectedArtifact?: Artifact;
  onSubmit?: (payload: SubmitPayload) => Promise<void> | void;
}

const READY_TIMEOUT_MS = 5_000;

function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

export function ArtifactModeApp({ injectedArtifact, onSubmit }: ArtifactModeAppProps = {}) {
  const [artifact, setArtifact] = useState<Artifact | null>(injectedArtifact ?? null);
  const [reviewMode, setReviewMode] = useState(false);
  const [ready, setReady] = useState<ReadyPayload | null>(null);
  const [sectionStatus, setSectionStatus] = useState<Record<string, SectionStatus>>({});
  const [comments, setComments] = useState<
    Array<{ sectionId: string | null; anchor: string | null; text: string }>
  >([]);
  const [lastUpdate, setLastUpdate] = useState<unknown>(null);
  const [readyTimedOut, setReadyTimedOut] = useState(false);
  const [submit, setSubmit] = useState<SubmitState>({ state: 'idle' });
  const lastPayloadRef = useRef<SubmitPayload | null>(null);
  const finalizedRef = useRef(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Fetch the artifact (unless one was injected, e.g. remote mode).
  useEffect(() => {
    if (injectedArtifact) return;
    let cancelled = false;
    fetch('/api/artifact')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data && data.kind === 'html') {
          setArtifact(data as Artifact);
        }
      })
      .catch(() => {
        /* noop — overlay will surface eventually */
      });
    return () => {
      cancelled = true;
    };
  }, [injectedArtifact]);

  useEffect(() => {
    fetch('/api/review-mode')
      .then((r) => r.json())
      .then((d) => setReviewMode(Boolean(d.reviewMode)))
      .catch(() => setReviewMode(false));
  }, []);

  // Hot reload: re-fetch on file change. We don't have injected mode hot-reload.
  const handleFileChange = useCallback(() => {
    if (injectedArtifact) return;
    fetch('/api/artifact')
      .then((r) => r.json())
      .then((data) => {
        if (data && data.kind === 'html') {
          setArtifact(data as Artifact);
          setReady(null);
          setSectionStatus({});
          setComments([]);
          setLastUpdate(null);
          setReadyTimedOut(false);
          finalizedRef.current = false;
        }
      })
      .catch(() => {});
  }, [injectedArtifact]);
  useFileWatch(handleFileChange);

  const srcdoc = useMemo(() => (artifact ? buildSrcdoc(artifact.content) : null), [artifact]);
  const iframeKey = useMemo(() => (artifact ? fnv1a(artifact.content) : 'empty'), [artifact]);

  // Ready timeout
  useEffect(() => {
    if (!artifact || ready) {
      setReadyTimedOut(false);
      return;
    }
    const t = setTimeout(() => setReadyTimedOut(true), READY_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [artifact, ready, iframeKey]);

  // postMessage listener
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
      const data = event.data;
      if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;
      switch (data.type) {
        case 'mdrp.ready': {
          setReady({
            title: data.title ?? null,
            chrome: data.chrome === 'none' ? 'none' : 'host',
            sections: Array.isArray(data.sections) ? data.sections : [],
            schema: typeof data.schema === 'object' && data.schema ? data.schema : {},
          });
          // Seed section status as pending.
          const seed: Record<string, SectionStatus> = {};
          (Array.isArray(data.sections) ? data.sections : []).forEach((s: SectionDescriptor) => {
            seed[s.id] = 'pending';
          });
          setSectionStatus(seed);
          break;
        }
        case 'mdrp.section':
          if (typeof data.sectionId === 'string') {
            setSectionStatus((prev) => ({
              ...prev,
              [data.sectionId]:
                data.status === 'approved'
                  ? 'approved'
                  : data.status === 'rejected'
                    ? 'rejected'
                    : 'pending',
            }));
          }
          break;
        case 'mdrp.comment':
          if (typeof data.text === 'string') {
            setComments((prev) => [
              ...prev,
              {
                sectionId: data.sectionId ?? null,
                anchor: data.anchor ?? null,
                text: data.text,
              },
            ]);
          }
          break;
        case 'mdrp.update':
          setLastUpdate(data.state);
          break;
        case 'mdrp.submit':
          if (finalizedRef.current) return;
          finalizedRef.current = true;
          void runSubmit(data.state);
          break;
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifact]);

  const runSubmit = useCallback(
    async (interactiveStateValue: unknown) => {
      if (!artifact) return;
      const sectionPayload =
        ready?.sections.map((s) => ({
          heading: s.heading,
          status: sectionStatus[s.id] ?? 'pending',
          comment: comments
            .filter((c) => c.sectionId === s.id)
            .map((c) => c.text)
            .join('\n'),
        })) ?? [];
      const linePayload = comments
        .filter((c) => c.anchor && c.anchor.startsWith('line:'))
        .map((c) => {
          const line = Number(c.anchor!.slice('line:'.length)) || 0;
          return {
            file: artifact.filename,
            startLine: line,
            endLine: line,
            selectedText: '',
            comment: c.text,
          };
        });
      const interactiveCandidate = interactiveStateValue ?? lastUpdate;
      const payload: SubmitPayload = {
        sections: sectionPayload,
        lineComments: linePayload,
        filename: artifact.filename,
        interactiveState:
          interactiveCandidate !== undefined && interactiveCandidate !== null
            ? {
                state: interactiveCandidate,
                summary: ready?.schema?.summary,
              }
            : undefined,
      };
      lastPayloadRef.current = payload;
      setSubmit({ state: 'submitting' });
      try {
        if (onSubmit) {
          await onSubmit(payload);
        } else {
          const res = await fetch('/api/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!res.ok) throw new Error(`server returned ${res.status}`);
        }
        setSubmit({ state: 'submitted' });
      } catch (e) {
        finalizedRef.current = false;
        const message = e instanceof Error ? e.message : 'unknown error';
        setSubmit({ state: 'error', message });
      }
    },
    [artifact, ready, sectionStatus, comments, lastUpdate, onSubmit],
  );

  const handleHostSubmit = useCallback(() => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    void runSubmit(lastUpdate);
  }, [runSubmit, lastUpdate]);

  const handleRetry = useCallback(() => {
    if (!lastPayloadRef.current) return;
    setSubmit({ state: 'submitting' });
    finalizedRef.current = true;
    const payload = lastPayloadRef.current;
    (async () => {
      try {
        if (onSubmit) {
          await onSubmit(payload);
        } else {
          const res = await fetch('/api/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!res.ok) throw new Error(`server returned ${res.status}`);
        }
        setSubmit({ state: 'submitted' });
      } catch (e) {
        finalizedRef.current = false;
        const message = e instanceof Error ? e.message : 'unknown error';
        setSubmit({ state: 'error', message });
      }
    })();
  }, [onSubmit]);

  if (submit.state === 'submitted') return <SubmittedScreen />;
  if (submit.state === 'error') {
    return <SubmitErrorScreen message={submit.message} onRetry={handleRetry} />;
  }

  if (!artifact) {
    return (
      <div data-testid="artifact-mode-root" style={{ padding: '2rem' }}>
        <p>Loading artifact…</p>
      </div>
    );
  }

  const sectionsList = ready?.sections ?? [];
  const reviewedCount = sectionsList.filter(
    (s) => (sectionStatus[s.id] ?? 'pending') !== 'pending',
  ).length;

  const showHostChrome = !ready || ready.chrome === 'host';

  return (
    <div
      data-testid="artifact-mode-root"
      style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}
    >
      {showHostChrome && (
        <div
          data-testid="artifact-host-chrome"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '12px 20px',
            borderBottom: '1px solid var(--border-color, #e0e0e0)',
            background: 'var(--bg-secondary, #fafafa)',
          }}
        >
          <strong style={{ fontSize: 14 }}>{ready?.title ?? artifact.filename}</strong>
          {sectionsList.length > 0 && (
            <span style={{ fontSize: 13, color: 'var(--text-secondary, #666)' }}>
              {reviewedCount}/{sectionsList.length} reviewed
            </span>
          )}
          <div style={{ flex: 1 }} />
          {reviewMode && (
            <button
              data-testid="artifact-host-submit"
              onClick={handleHostSubmit}
              disabled={submit.state === 'submitting'}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                background: 'var(--link-color, #2563eb)',
                color: '#fff',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              {submit.state === 'submitting' ? 'Submitting…' : 'Submit'}
            </button>
          )}
        </div>
      )}
      <iframe
        ref={iframeRef}
        key={iframeKey}
        data-testid="artifact-iframe"
        sandbox="allow-scripts"
        srcDoc={srcdoc ?? ''}
        style={{ border: 0, width: '100%', flex: 1 }}
        title={artifact.filename}
      />
      {!showHostChrome && reviewMode && (
        <button
          data-testid="artifact-floating-submit"
          onClick={handleHostSubmit}
          disabled={submit.state === 'submitting'}
          style={{
            position: 'fixed',
            right: 24,
            bottom: 24,
            zIndex: 20,
            padding: '10px 18px',
            borderRadius: 999,
            background: 'var(--link-color, #2563eb)',
            color: '#fff',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          {submit.state === 'submitting' ? 'Submitting…' : 'Submit'}
        </button>
      )}
      {readyTimedOut && !ready && (
        <div
          data-testid="artifact-ready-timeout"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 30,
          }}
        >
          <div
            style={{
              background: 'var(--bg-primary, #fff)',
              padding: 24,
              borderRadius: 8,
              maxWidth: 420,
              textAlign: 'center',
            }}
          >
            <p style={{ margin: '0 0 16px' }}>
              This artifact didn&rsquo;t initialize. Submit empty payload?
            </p>
            <button
              onClick={handleHostSubmit}
              style={{
                padding: '10px 18px',
                borderRadius: 6,
                background: 'var(--link-color, #2563eb)',
                color: '#fff',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              Submit anyway
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
