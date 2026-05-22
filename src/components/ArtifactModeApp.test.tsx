import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { ArtifactModeApp } from './ArtifactModeApp';

vi.mock('../hooks/useFileWatch', () => ({
  useFileWatch: () => {},
}));

interface FetchInit {
  method?: string;
  body?: BodyInit | null;
}

const originalFetch = global.fetch;

interface SubmitPayload {
  sections: Array<{ heading: string; status: string; comment: string }>;
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

function mockArtifactFetch(reviewMode = true) {
  global.fetch = vi.fn(async (url: RequestInfo | URL, init?: FetchInit) => {
    const u = typeof url === 'string' ? url : url.toString();
    if (u.includes('/api/artifact')) {
      return new Response(
        JSON.stringify({ kind: 'html', content: '<p>hi</p>', filename: 'a.html' }),
        { status: 200 },
      );
    }
    if (u.includes('/api/review-mode')) {
      return new Response(JSON.stringify({ reviewMode }), { status: 200 });
    }
    if (u.includes('/api/submit')) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    if (init?.method === 'POST') {
      return new Response('{}', { status: 200 });
    }
    return new Response('', { status: 404 });
  }) as typeof fetch;
}

beforeEach(() => {
  mockArtifactFetch(true);
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.useRealTimers();
});

function postFromIframe(detail: Record<string, unknown>): void {
  const iframe = screen.getByTestId('artifact-iframe') as HTMLIFrameElement;
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: detail,
        source: iframe.contentWindow as MessageEventSource,
      }),
    );
  });
}

describe('ArtifactModeApp', () => {
  it('mounts iframe with sandboxed srcdoc containing the artifact body', async () => {
    render(<ArtifactModeApp />);
    const frame = (await waitFor(() => screen.getByTestId('artifact-iframe'))) as HTMLIFrameElement;
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
    expect(frame.srcdoc).toContain('<p>hi</p>');
    expect(frame.srcdoc).toContain('Content-Security-Policy');
  });

  it('renders host chrome and tracks section progress from mdrp envelopes', async () => {
    render(<ArtifactModeApp />);
    await waitFor(() => screen.getByTestId('artifact-iframe'));

    postFromIframe({
      type: 'mdrp.ready',
      v: 1,
      title: 'My Doc',
      chrome: 'host',
      sections: [
        { id: 'a', heading: 'A' },
        { id: 'b', heading: 'B' },
      ],
    });

    await waitFor(() => {
      expect(screen.getByTestId('artifact-host-chrome')).toBeInTheDocument();
    });
    expect(screen.getByText('0/2 reviewed')).toBeInTheDocument();
    expect(screen.getByText('My Doc')).toBeInTheDocument();
    expect(screen.getByTestId('artifact-host-submit')).toBeInTheDocument();

    postFromIframe({ type: 'mdrp.section', v: 1, sectionId: 'a', status: 'approved' });
    await waitFor(() => {
      expect(screen.getByText('1/2 reviewed')).toBeInTheDocument();
    });
  });

  it('Approve All flips every section to approved; Clear All resets to pending', async () => {
    render(<ArtifactModeApp />);
    await waitFor(() => screen.getByTestId('artifact-iframe'));

    postFromIframe({
      type: 'mdrp.ready',
      v: 1,
      title: 't',
      chrome: 'host',
      sections: [
        { id: 'a', heading: 'A' },
        { id: 'b', heading: 'B' },
        { id: 'c', heading: 'C' },
      ],
    });
    await waitFor(() => screen.getByText('0/3 reviewed'));

    act(() => {
      (screen.getByTestId('artifact-host-approve-all') as HTMLButtonElement).click();
    });
    await waitFor(() => screen.getByText('3/3 reviewed'));

    act(() => {
      (screen.getByTestId('artifact-host-clear-all') as HTMLButtonElement).click();
    });
    await waitFor(() => screen.getByText('0/3 reviewed'));
  });

  it('Approve All payload marks every section approved on submit', async () => {
    const onSubmit = vi.fn(async (payload: SubmitPayload) => {
      void payload;
    });
    render(<ArtifactModeApp onSubmit={onSubmit} />);
    await waitFor(() => screen.getByTestId('artifact-iframe'));
    postFromIframe({
      type: 'mdrp.ready',
      v: 1,
      title: 't',
      chrome: 'host',
      sections: [
        { id: 'a', heading: 'A' },
        { id: 'b', heading: 'B' },
      ],
    });
    await waitFor(() => screen.getByTestId('artifact-host-approve-all'));
    act(() => {
      (screen.getByTestId('artifact-host-approve-all') as HTMLButtonElement).click();
    });
    await act(async () => {
      (screen.getByTestId('artifact-host-submit') as HTMLButtonElement).click();
    });
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const payload = onSubmit.mock.calls[0]?.[0] as SubmitPayload | undefined;
    expect(payload!.sections).toEqual([
      { heading: 'A', status: 'approved', comment: '' },
      { heading: 'B', status: 'approved', comment: '' },
    ]);
  });

  it('hides host chrome and shows floating submit when chrome="none"', async () => {
    render(<ArtifactModeApp />);
    await waitFor(() => screen.getByTestId('artifact-iframe'));

    postFromIframe({
      type: 'mdrp.ready',
      v: 1,
      title: 'tuner',
      chrome: 'none',
      sections: [],
    });

    await waitFor(() => {
      expect(screen.queryByTestId('artifact-host-chrome')).not.toBeInTheDocument();
      expect(screen.getByTestId('artifact-floating-submit')).toBeInTheDocument();
    });
  });

  it('shows ready timeout overlay after 5 seconds with no mdrp.ready', async () => {
    vi.useFakeTimers();
    render(<ArtifactModeApp />);
    // Drain microtasks so artifact fetch resolves
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.queryByTestId('artifact-ready-timeout')).not.toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(5_100);
    });
    expect(screen.getByTestId('artifact-ready-timeout')).toBeInTheDocument();
  });

  it('submits via host chrome with interactiveState when mdrp.update has fired', async () => {
    const onSubmit = vi.fn(async (payload: SubmitPayload) => {
      void payload;
    });
    render(<ArtifactModeApp onSubmit={onSubmit} />);
    await waitFor(() => screen.getByTestId('artifact-iframe'));

    postFromIframe({
      type: 'mdrp.ready',
      v: 1,
      title: 'x',
      chrome: 'host',
      sections: [{ id: 'a', heading: 'A' }],
      schema: { summary: 'all good' },
    });
    postFromIframe({ type: 'mdrp.section', v: 1, sectionId: 'a', status: 'approved' });
    postFromIframe({ type: 'mdrp.update', v: 1, state: { foo: 1 } });

    const submitBtn = await waitFor(() => screen.getByTestId('artifact-host-submit'));
    await act(async () => {
      submitBtn.click();
    });

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const payload = onSubmit.mock.calls[0]?.[0] as SubmitPayload | undefined;
    expect(payload).toBeDefined();
    expect(payload!.filename).toBe('a.html');
    expect(payload!.sections).toEqual([{ heading: 'A', status: 'approved', comment: '' }]);
    expect(payload!.interactiveState).toEqual({ state: { foo: 1 }, summary: 'all good' });
  });

  it('submits via mdrp.submit envelope and is idempotent for repeat envelopes', async () => {
    // Hold the submit promise open so we can fire a second envelope before the
    // SubmittedScreen unmounts the iframe.
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const onSubmit = vi.fn(async () => {
      await gate;
    });
    render(<ArtifactModeApp onSubmit={onSubmit} />);
    await waitFor(() => screen.getByTestId('artifact-iframe'));
    postFromIframe({ type: 'mdrp.ready', v: 1, chrome: 'none', sections: [] });
    postFromIframe({ type: 'mdrp.submit', v: 1, state: { x: 1 } });
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    // Second envelope arrives while first submit is still pending → must be ignored.
    postFromIframe({ type: 'mdrp.submit', v: 1, state: { x: 2 } });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    await act(async () => {
      release();
    });
  });

  it('ignores messages whose source is not the iframe', async () => {
    const onSubmit = vi.fn();
    render(<ArtifactModeApp onSubmit={onSubmit} />);
    await waitFor(() => screen.getByTestId('artifact-iframe'));
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'mdrp.submit', v: 1, state: {} },
          source: window,
        }),
      );
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
