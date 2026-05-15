export function SubmittedScreen() {
  return (
    <main
      style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: '64px 24px',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: 28, margin: '0 0 16px', letterSpacing: '-0.01em' }}>
        Review submitted
      </h1>
      <p style={{ color: 'var(--text-secondary)' }}>
        You can close this tab. The CLI has received your feedback.
      </p>
    </main>
  );
}
