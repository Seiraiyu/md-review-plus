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
    return (
      <div style={{ padding: '2rem' }}>
        <h2>Review link invalid or expired</h2>
        <p>{session.error ?? 'Could not load this review session.'}</p>
      </div>
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
