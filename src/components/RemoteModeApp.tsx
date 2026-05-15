import { useEffect, useMemo, useState } from 'react';
import { useRemoteSession } from '../hooks/useRemoteSession';
import { ReviewView, SubmitPayload } from './ReviewView';

interface RemoteModeAppProps {
  id: string;
  keyBase64Url: string;
}

export function RemoteModeApp({ id, keyBase64Url }: RemoteModeAppProps) {
  const session = useRemoteSession({ id, keyBase64Url });
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    // Strip the fragment so the key doesn't sit in the address bar.
    if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  const submit = useMemo(
    () => async (payload: SubmitPayload) => {
      try {
        await session.submit(JSON.stringify(payload));
        setSubmitted(true);
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : 'submit failed');
      }
    },
    [session],
  );

  if (session.state === 'loading') {
    return <div style={{ padding: '2rem' }}>Loading review…</div>;
  }
  if (session.state === 'error' || !session.content || !session.filename) {
    if (session.error) {
      // Never expose raw crypto/IO errors in the UI.
      console.error('decrypt error:', session.error);
    }
    return (
      <main style={{ maxWidth: 520, margin: '0 auto', padding: '64px 24px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, margin: '0 0 16px', letterSpacing: '-0.01em' }}>
          Review link expired or invalid
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          This link is one-time-use and expires after 24 hours. Ask the agent to generate a new
          one:
        </p>
        <pre
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            padding: '14px 18px',
            borderRadius: 6,
            textAlign: 'left',
            overflowX: 'auto',
            fontSize: 14,
          }}
        >
          <code>md-review-plus FILE --review --remote</code>
        </pre>
        <div
          style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'center',
            marginTop: 24,
            flexWrap: 'wrap',
          }}
        >
          <a
            href="/"
            style={{
              padding: '10px 18px',
              borderRadius: 6,
              background: 'var(--link-color)',
              color: '#fff',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            &larr; Home
          </a>
          <a
            href="/#privacy"
            style={{
              padding: '10px 18px',
              borderRadius: 6,
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              textDecoration: 'none',
              fontWeight: 600,
              border: '1px solid var(--border-primary)',
            }}
          >
            Learn more
          </a>
        </div>
      </main>
    );
  }
  if (submitted) {
    return (
      <div style={{ padding: '2rem' }}>
        <h2>Review submitted</h2>
        <p>You can close this tab.</p>
      </div>
    );
  }
  return (
    <>
      {submitError && (
        <div style={{ padding: '0.75rem 1rem', background: '#fee', color: '#900' }}>
          Submit failed: {submitError}
        </div>
      )}
      <ReviewView
        content={session.content}
        filename={session.filename}
        reviewMode={true}
        onSubmit={submit}
      />
    </>
  );
}
