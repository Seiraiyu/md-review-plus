import { useEffect, useState, useRef } from 'react';
import { useMarkdown } from '../hooks/useMarkdown';
import { useFileWatch } from '../hooks/useFileWatch';
import { ErrorDisplay } from './ErrorDisplay';
import { ReviewView, SubmitPayload } from './ReviewView';
import { SubmittedScreen } from './SubmittedScreen';
import { SubmitErrorScreen } from './SubmitErrorScreen';

type SubmitState =
  | { state: 'idle' }
  | { state: 'submitting' }
  | { state: 'submitted' }
  | { state: 'error'; message: string };

export const CliModeApp = () => {
  const { content, filename, loading, error, reload } = useMarkdown();
  const [reviewMode, setReviewMode] = useState(false);
  const [submit, setSubmit] = useState<SubmitState>({ state: 'idle' });
  const lastPayload = useRef<SubmitPayload | null>(null);

  useFileWatch(() => {
    reload();
  });

  useEffect(() => {
    fetch('/api/review-mode')
      .then((r) => r.json())
      .then((data) => setReviewMode(data.reviewMode))
      .catch(() => setReviewMode(false));
  }, []);

  const doSubmit = async (payload: SubmitPayload) => {
    lastPayload.current = payload;
    setSubmit({ state: 'submitting' });
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`server returned ${res.status}`);
      setSubmit({ state: 'submitted' });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'unknown error';
      setSubmit({ state: 'error', message });
    }
  };

  const handleRetry = () => {
    if (lastPayload.current) doSubmit(lastPayload.current);
  };

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  if (!content || !filename) {
    return (
      <div style={{ padding: '2rem' }}>
        <p>No content available</p>
      </div>
    );
  }

  if (submit.state === 'submitted') return <SubmittedScreen />;
  if (submit.state === 'error') {
    return <SubmitErrorScreen message={submit.message} onRetry={handleRetry} />;
  }

  return (
    <ReviewView content={content} filename={filename} reviewMode={reviewMode} onSubmit={doSubmit} />
  );
};
