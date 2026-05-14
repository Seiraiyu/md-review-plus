import { useEffect, useState } from 'react';
import { useMarkdown } from '../hooks/useMarkdown';
import { useFileWatch } from '../hooks/useFileWatch';
import { ErrorDisplay } from './ErrorDisplay';
import { ReviewView, SubmitPayload } from './ReviewView';

export const CliModeApp = () => {
  const { content, filename, loading, error, reload } = useMarkdown();
  const [reviewMode, setReviewMode] = useState(false);

  useFileWatch(() => {
    reload();
  });

  useEffect(() => {
    fetch('/api/review-mode')
      .then((r) => r.json())
      .then((data) => setReviewMode(data.reviewMode))
      .catch(() => setReviewMode(false));
  }, []);

  const handleSubmit = async (payload: SubmitPayload) => {
    await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    window.close();
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

  return (
    <ReviewView
      content={content}
      filename={filename}
      reviewMode={reviewMode}
      onSubmit={handleSubmit}
    />
  );
};
