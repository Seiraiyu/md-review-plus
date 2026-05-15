interface Props {
  message: string;
  onRetry: () => void;
}

export function SubmitErrorScreen({ message, onRetry }: Props) {
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
        Couldn&rsquo;t submit review
      </h1>
      <p style={{ color: 'var(--text-secondary)' }}>{message}</p>
      <button
        onClick={onRetry}
        style={{
          marginTop: 24,
          padding: '10px 18px',
          borderRadius: 6,
          background: 'var(--link-color)',
          color: '#fff',
          fontWeight: 600,
          border: 'none',
          cursor: 'pointer',
          fontSize: 14,
        }}
      >
        Retry
      </button>
    </main>
  );
}
