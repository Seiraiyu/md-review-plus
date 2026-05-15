import { describe, it, expect } from 'vitest';
import { subscribeFeedback, SessionGoneError } from './remoteSubscribe';

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

  it('reconnects after a transient disconnect and resolves on the retry', async () => {
    let calls = 0;
    const fakeFetch: typeof fetch = async () => {
      calls++;
      if (calls === 1) return sseResponse([': connected\n\n']); // closes with no data
      return sseResponse([': connected\n\n', 'data: {"iv":"I","ct":"C"}\n\n']);
    };
    const out = await subscribeFeedback({
      relay: 'https://r',
      id: 'abc',
      fetchFn: fakeFetch,
      backoffMs: () => 0,
    });
    expect(calls).toBe(2);
    expect(out).toEqual({ iv: 'I', ct: 'C' });
  });

  it('throws SessionGoneError on 404, does not reconnect', async () => {
    let calls = 0;
    const fakeFetch: typeof fetch = async () => {
      calls++;
      return new Response('', { status: 404 });
    };
    await expect(
      subscribeFeedback({
        relay: 'https://r',
        id: 'abc',
        fetchFn: fakeFetch,
        backoffMs: () => 0,
      }),
    ).rejects.toBeInstanceOf(SessionGoneError);
    expect(calls).toBe(1);
  });
});
