import { Hono } from 'hono';
import { SessionStore } from './sessionStore';
import { RateLimiter } from './rateLimiter';
import { b64ToBytes } from './encoding';

export interface AppOptions {
  ttlMs: number;
  maxSessions: number;
  rateLimit: number;
  maxBodyBytes?: number;
  maxFeedbackBytes?: number;
  staticHtml?: string;
  staticAssetsRoot?: string;
  now?: () => number;
}

export interface AppHandle {
  app: Hono;
  store: SessionStore;
}

const DEFAULT_MAX_BODY = 1_048_576;
const DEFAULT_MAX_FEEDBACK = 262_144;
const FILENAME_MAX = 256;

export async function createApp(opts: AppOptions): Promise<AppHandle> {
  const store = new SessionStore({
    ttlMs: opts.ttlMs,
    maxSessions: opts.maxSessions,
    now: opts.now,
  });
  const createLimiter = new RateLimiter({
    limit: opts.rateLimit,
    windowMs: 60 * 60 * 1000,
    now: opts.now,
  });
  const maxBody = opts.maxBodyBytes ?? DEFAULT_MAX_BODY;
  const maxFeedback = opts.maxFeedbackBytes ?? DEFAULT_MAX_FEEDBACK;

  const app = new Hono();

  app.use('*', async (c, next) => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Headers', 'content-type');
    c.header('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    if (c.req.method === 'OPTIONS') return c.body(null, 204);
    return next();
  });

  app.get('/api/health', (c) => c.json({ status: 'ok', sessions: store.size() }));

  app.post('/api/sessions', async (c) => {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
    if (!createLimiter.allow(ip)) {
      return c.json({ error: 'rate_limited' }, 429);
    }

    const lenHeader = c.req.header('content-length');
    if (lenHeader && parseInt(lenHeader, 10) > maxBody) {
      return c.json({ error: 'payload_too_large' }, 413);
    }

    let body: unknown;
    try {
      const text = await c.req.text();
      if (text.length > maxBody) {
        return c.json({ error: 'payload_too_large' }, 413);
      }
      body = JSON.parse(text);
    } catch {
      return c.json({ error: 'invalid_json' }, 400);
    }

    if (typeof body !== 'object' || body === null || (body as { v?: unknown }).v !== 1) {
      return c.json({ error: 'unsupported_version' }, 400);
    }
    const { iv, ct, filename } = body as {
      iv?: unknown;
      ct?: unknown;
      filename?: unknown;
    };
    if (typeof iv !== 'string' || typeof ct !== 'string' || typeof filename !== 'string') {
      return c.json({ error: 'invalid_payload' }, 400);
    }
    if (filename.length === 0 || filename.length > FILENAME_MAX) {
      return c.json({ error: 'invalid_filename' }, 400);
    }

    let ctBytes: Uint8Array;
    try {
      ctBytes = b64ToBytes(ct);
    } catch {
      return c.json({ error: 'invalid_ciphertext' }, 400);
    }

    try {
      const { id, expiresAt } = store.create({ iv, ct: ctBytes, filename });
      return c.json({ id, expiresAt });
    } catch (e) {
      if (e instanceof Error && /capacity/i.test(e.message)) {
        return c.json({ error: 'at_capacity' }, 503);
      }
      throw e;
    }
  });

  app.get('/api/sessions/:id', (c) => {
    const id = c.req.param('id');
    const s = store.get(id);
    if (!s) return c.json({ error: 'not_found' }, 404);
    return c.json({
      iv: s.iv,
      ct: Buffer.from(s.ct).toString('base64'),
      filename: s.filename,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    });
  });

  // GET must precede POST so method routing picks the right one for the same path.
  app.get('/api/sessions/:id/feedback', (c) => {
    const id = c.req.param('id');
    const s = store.get(id);
    if (!s) return c.json({ error: 'not_found' }, 404);

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const enc = new TextEncoder();
        let closed = false;
        const safeClose = () => {
          if (closed) return;
          closed = true;
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        };

        controller.enqueue(enc.encode(': connected\n\n'));

        const hb = setInterval(() => {
          if (closed) return;
          try {
            controller.enqueue(enc.encode(': keepalive\n\n'));
          } catch {
            clearInterval(hb);
          }
        }, 25_000);

        const send = (fb: { iv: string; ct: string }) => {
          if (closed) return;
          try {
            controller.enqueue(enc.encode(`data: ${JSON.stringify(fb)}\n\n`));
          } catch {
            /* stream might be torn down */
          }
          clearInterval(hb);
          safeClose();
        };

        const unsubscribe = store.subscribe(id, send);
        if (!unsubscribe) {
          clearInterval(hb);
          safeClose();
          return;
        }

        c.req.raw.signal.addEventListener('abort', () => {
          clearInterval(hb);
          unsubscribe();
          safeClose();
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  });

  app.post('/api/sessions/:id/feedback', async (c) => {
    const id = c.req.param('id');
    const s = store.get(id);
    if (!s) return c.json({ error: 'not_found' }, 404);

    const lenHeader = c.req.header('content-length');
    if (lenHeader && parseInt(lenHeader, 10) > maxFeedback) {
      return c.json({ error: 'payload_too_large' }, 413);
    }
    let body: unknown;
    try {
      const text = await c.req.text();
      if (text.length > maxFeedback) {
        return c.json({ error: 'payload_too_large' }, 413);
      }
      body = JSON.parse(text);
    } catch {
      return c.json({ error: 'invalid_json' }, 400);
    }
    const { iv, ct } = body as { iv?: unknown; ct?: unknown };
    if (typeof iv !== 'string' || typeof ct !== 'string') {
      return c.json({ error: 'invalid_payload' }, 400);
    }

    store.setFeedback(id, { iv, ct });
    // Defer delete so any in-flight SSE listeners get the event first.
    setTimeout(() => store.delete(id), 100);
    return c.json({ ok: true });
  });

  app.delete('/api/sessions/:id', (c) => {
    store.delete(c.req.param('id'));
    return c.body(null, 204);
  });

  if (opts.staticAssetsRoot) {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const root = path.resolve(opts.staticAssetsRoot);
    app.get('/assets/*', async (c) => {
      const requested = c.req.path.replace(/^\/assets\//, '');
      const fullPath = path.resolve(root, 'assets', requested);
      if (!fullPath.startsWith(root)) return c.body(null, 403);
      try {
        const data = await fs.readFile(fullPath);
        const ext = path.extname(fullPath).toLowerCase();
        const ct =
          ext === '.js'
            ? 'application/javascript'
            : ext === '.css'
              ? 'text/css'
              : ext === '.svg'
                ? 'image/svg+xml'
                : 'application/octet-stream';
        return c.body(new Uint8Array(data), 200, { 'Content-Type': ct });
      } catch {
        return c.body(null, 404);
      }
    });
  }

  app.get('/r/:id', async (c) => {
    if (opts.staticHtml) {
      return c.html(opts.staticHtml);
    }
    if (opts.staticAssetsRoot) {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const html = await fs.readFile(path.join(opts.staticAssetsRoot, 'index.html'), 'utf8');
      return c.html(html);
    }
    return c.text('relay running; no static html configured', 200);
  });

  return { app, store };
}
