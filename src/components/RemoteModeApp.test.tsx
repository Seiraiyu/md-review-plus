import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RemoteModeApp } from './RemoteModeApp';
import { encryptFromString, importKey } from '../crypto/sessionCrypto';

vi.mock('../hooks/useFileWatch', () => ({
  useFileWatch: () => {},
}));

function rawKeyToBase64Url(rawKey: Uint8Array): string {
  return btoa(String.fromCharCode(...rawKey))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function mockRelay(plaintext: string, filename: string): Promise<string> {
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const key = await importKey(rawKey);
  const env = await encryptFromString(key, plaintext);
  global.fetch = vi.fn(async () => {
    return new Response(
      JSON.stringify({
        iv: env.iv,
        ct: env.ct,
        filename,
        expiresAt: Date.now() + 60_000,
      }),
      { headers: { 'content-type': 'application/json' } },
    );
  }) as never;
  return rawKeyToBase64Url(rawKey);
}

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

describe('RemoteModeApp envelope dispatch', () => {
  it('renders ArtifactModeApp with sandboxed iframe for html envelope', async () => {
    const keyB64 = await mockRelay(
      JSON.stringify({ kind: 'html', content: '<p>remote-html</p>' }),
      'demo.html',
    );
    render(<RemoteModeApp id="abc" keyBase64Url={keyB64} />);

    const frame = (await waitFor(() =>
      screen.getByTestId('artifact-iframe'),
    )) as HTMLIFrameElement;
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
    expect(frame.srcdoc).toContain('<p>remote-html</p>');
    expect(frame.srcdoc).toContain('Content-Security-Policy');
  });

  it('falls back to ReviewView for markdown envelope', async () => {
    const keyB64 = await mockRelay(
      JSON.stringify({ kind: 'markdown', content: '# remote-md\n\n## Section A\n\nbody\n' }),
      'spec.md',
    );
    render(<RemoteModeApp id="abc" keyBase64Url={keyB64} />);

    // ReviewView renders the review topbar with the filename.
    expect(await screen.findByText('spec.md')).toBeInTheDocument();
    expect(screen.getByText('Submit Review')).toBeInTheDocument();
    expect(screen.queryByTestId('artifact-iframe')).not.toBeInTheDocument();
  });

  it('legacy plaintext payload also lands on ReviewView', async () => {
    const keyB64 = await mockRelay('# legacy\n\n## SectionLegacy\n\nworld', 'legacy.md');
    render(<RemoteModeApp id="abc" keyBase64Url={keyB64} />);

    expect(await screen.findByText('legacy.md')).toBeInTheDocument();
    expect(screen.getByText('Submit Review')).toBeInTheDocument();
    expect(screen.queryByTestId('artifact-iframe')).not.toBeInTheDocument();
  });
});
