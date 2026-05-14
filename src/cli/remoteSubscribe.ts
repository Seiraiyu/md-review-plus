export interface SubscribeArgs {
  relay: string;
  id: string;
  fetchFn?: typeof fetch;
  signal?: AbortSignal;
}

export interface FeedbackEnvelope {
  iv: string;
  ct: string;
}

export async function subscribeFeedback(args: SubscribeArgs): Promise<FeedbackEnvelope> {
  const f = args.fetchFn ?? fetch;
  const url = `${args.relay.replace(/\/$/, '')}/api/sessions/${args.id}/feedback`;
  const res = await f(url, {
    method: 'GET',
    headers: { accept: 'text/event-stream' },
    signal: args.signal,
  });
  if (!res.ok) throw new Error(`relay ${res.status}`);
  if (!res.body) throw new Error('relay returned empty body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const evt of events) {
      const lines = evt.split('\n');
      const dataLines = lines.filter((l) => l.startsWith('data: ')).map((l) => l.slice(6));
      if (dataLines.length === 0) continue;
      const payload = dataLines.join('\n');
      try {
        return JSON.parse(payload) as FeedbackEnvelope;
      } catch {
        throw new Error('relay sent malformed feedback payload');
      }
    }
  }
  throw new Error('SSE closed without feedback');
}
