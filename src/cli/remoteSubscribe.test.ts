import { describe, it, expect } from 'vitest';
import { subscribeFeedback } from './remoteSubscribe';

function sseResponse(messages: string[], delayMs = 0): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const m of messages) {
        if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
        controller.enqueue(enc.encode(m));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { 'content-type': 'text/event-stream' },
  });
}

describe('subscribeFeedback', () => {
  it('parses an SSE data frame and resolves with the JSON', async () => {
    const fakeFetch: typeof fetch = async () =>
      sseResponse([': connected\n\n', 'data: {"iv":"I","ct":"C"}\n\n']);
    const out = await subscribeFeedback({
      relay: 'https://r',
      id: 'abc',
      fetchFn: fakeFetch,
    });
    expect(out).toEqual({ iv: 'I', ct: 'C' });
  });

  it('throws on 404', async () => {
    const fakeFetch: typeof fetch = async () => new Response('', { status: 404 });
    await expect(
      subscribeFeedback({ relay: 'https://r', id: 'abc', fetchFn: fakeFetch }),
    ).rejects.toThrow(/404/);
  });

  it('throws when stream closes with no data', async () => {
    const fakeFetch: typeof fetch = async () => sseResponse([': connected\n\n']);
    await expect(
      subscribeFeedback({ relay: 'https://r', id: 'abc', fetchFn: fakeFetch }),
    ).rejects.toThrow(/closed|no feedback/i);
  });
});
