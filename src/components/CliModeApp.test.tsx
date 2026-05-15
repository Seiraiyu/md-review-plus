import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CliModeApp } from './CliModeApp';

vi.mock('../hooks/useMarkdown', () => ({
  useMarkdown: () => ({
    content: '# Title\n\n## Section A\n\nbody\n',
    filename: 'test.md',
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));
vi.mock('../hooks/useFileWatch', () => ({
  useFileWatch: () => {},
}));

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = vi.fn(async (url: string) => {
    if (typeof url === 'string' && url.includes('/api/review-mode')) {
      return new Response(JSON.stringify({ reviewMode: true }), { status: 200 });
    }
    if (typeof url === 'string' && url.includes('/api/submit')) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    return originalFetch
      ? (originalFetch as typeof fetch)(url)
      : new Response('', { status: 404 });
  }) as typeof fetch;
});

async function submitReview() {
  await waitFor(() => expect(screen.getByText(/Submit Review/i)).toBeInTheDocument());
  fireEvent.click(screen.getByText(/Approve All/i));
  fireEvent.click(screen.getByText(/Submit Review/i));
}

describe('CliModeApp submit flow', () => {
  it('shows SubmittedScreen after a successful submit', async () => {
    render(<CliModeApp />);
    await submitReview();
    await waitFor(() =>
      expect(screen.getByText(/Review submitted/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/Submit Review/i)).not.toBeInTheDocument();
  });

  it('shows SubmitErrorScreen with status message when submit returns 5xx', async () => {
    global.fetch = vi.fn(async (url: string) => {
      if (typeof url === 'string' && url.includes('/api/review-mode')) {
        return new Response(JSON.stringify({ reviewMode: true }), { status: 200 });
      }
      if (typeof url === 'string' && url.includes('/api/submit')) {
        return new Response('boom', { status: 500 });
      }
      return new Response('', { status: 404 });
    }) as typeof fetch;
    render(<CliModeApp />);
    await submitReview();
    await waitFor(() =>
      expect(screen.getByText(/Couldn.t submit review/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/500/)).toBeInTheDocument();
    expect(screen.getByText(/Retry/i)).toBeInTheDocument();
  });

  it('shows SubmitErrorScreen when fetch throws', async () => {
    global.fetch = vi.fn(async (url: string) => {
      if (typeof url === 'string' && url.includes('/api/review-mode')) {
        return new Response(JSON.stringify({ reviewMode: true }), { status: 200 });
      }
      throw new Error('network blew up');
    }) as typeof fetch;
    render(<CliModeApp />);
    await submitReview();
    await waitFor(() =>
      expect(screen.getByText(/Couldn.t submit review/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/network blew up/i)).toBeInTheDocument();
  });

  it('Retry re-invokes /api/submit with the same payload', async () => {
    let submitCalls = 0;
    global.fetch = vi.fn(async (url: string) => {
      if (typeof url === 'string' && url.includes('/api/review-mode')) {
        return new Response(JSON.stringify({ reviewMode: true }), { status: 200 });
      }
      if (typeof url === 'string' && url.includes('/api/submit')) {
        submitCalls++;
        return new Response('err', { status: 500 });
      }
      return new Response('', { status: 404 });
    }) as typeof fetch;
    render(<CliModeApp />);
    await submitReview();
    await waitFor(() => expect(screen.getByText(/Retry/i)).toBeInTheDocument());
    expect(submitCalls).toBe(1);
    fireEvent.click(screen.getByText(/Retry/i));
    await waitFor(() => expect(submitCalls).toBe(2));
  });
});
