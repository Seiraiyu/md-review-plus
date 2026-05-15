import { Hono } from 'hono';
import { SessionStore } from './sessionStore';
import { RateLimiter } from './rateLimiter';
import { b64ToBytes } from './encoding';
import type { Sponsors } from './sponsors';
import type { Analytics } from './analytics';
import { renderBanner } from './banner';

export interface AppOptions {
  ttlMs: number;
  maxSessions: number;
  rateLimit: number;
  maxBodyBytes?: number;
  maxFeedbackBytes?: number;
  staticHtml?: string;
  staticAssetsRoot?: string;
  relayStaticRoot?: string;
  sponsors?: Sponsors;
  analytics?: Analytics;
  adminToken?: string | null;
  now?: () => number;
}

export interface AppHandle {
  app: Hono;
  store: SessionStore;
}

const DEFAULT_MAX_BODY = 1_048_576;
const DEFAULT_MAX_FEEDBACK = 262_144;
const FILENAME_MAX = 256;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function readStatic(
  opts: AppOptions,
  file: 'landing.html' | 'advertise.html' | 'error.html',
): Promise<string | null> {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const roots = [opts.relayStaticRoot, opts.staticAssetsRoot].filter(
    (r): r is string => !!r,
  );
  for (const root of roots) {
    try {
      return await fs.readFile(path.join(root, file), 'utf8');
    } catch {
      /* try next root */
    }
  }
  return null;
}

async function serveStaticWithBanner(
  opts: AppOptions,
  file: 'landing.html' | 'advertise.html' | 'error.html',
  status = 200,
): Promise<Response> {
  const html = await readStatic(opts, file);
  if (html == null) {
    return new Response('not configured', { status: 500 });
  }
  let injected = html;
  if (opts.sponsors) {
    const bannerHtml = renderBanner(opts.sponsors.getActive());
    injected = html.replace('<!-- BANNER -->', bannerHtml);
  }
  return new Response(injected, {
    status,
    headers: { 'Content-Type': 'text/html; charset=UTF-8' },
  });
}

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

  if (opts.sponsors) {
    app.get('/api/sponsors/current', (c) => {
      return c.json(opts.sponsors!.getActive());
    });
  }

  if (opts.analytics && opts.sponsors) {
    app.post('/api/sponsors/impression', async (c) => {
      try {
        const body = (await c.req.json()) as { c?: string };
        const id = body.c;
        if (id && opts.sponsors!.getById(id)) {
          const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
          opts.analytics!.recordImpression(id, ip);
        }
      } catch {
        /* malformed → silent 204 */
      }
      return c.body(null, 204);
    });

    app.get('/go/:campaignId', (c) => {
      const campaign = opts.sponsors!.getById(c.req.param('campaignId'));
      if (!campaign) {
        return c.redirect('/', 302);
      }
      opts.analytics!.recordClick(campaign.id);
      return c.redirect(campaign.clickUrl, 302);
    });
  }

  if (opts.analytics && opts.adminToken) {
    const token = opts.adminToken;
    app.get('/api/admin/stats', (c) => {
      const auth = c.req.header('authorization') ?? '';
      if (!auth.startsWith('Bearer ')) return c.body(null, 401);
      const tok = auth.slice(7);
      if (!timingSafeEqual(tok, token)) return c.body(null, 401);
      return c.json(opts.analytics!.getAllStats());
    });
  }

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
    const id = c.req.param('id');
    const session = store.get(id);
    if (!session) {
      if ((opts.relayStaticRoot || opts.staticAssetsRoot) && opts.sponsors) {
        return serveStaticWithBanner(opts, 'error.html', 404);
      }
      return c.text('not found', 404);
    }
    if (opts.staticHtml) {
      return c.html(opts.staticHtml);
    }
    if (opts.staticAssetsRoot) {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      let html = await fs.readFile(path.join(opts.staticAssetsRoot, 'index.html'), 'utf8');
      if (opts.sponsors) {
        const bannerHtml = renderBanner(opts.sponsors.getActive());
        html = html.replace(/<body([^>]*)>/i, `<body$1>${bannerHtml}`);
      }
      return c.html(html);
    }
    return c.text('relay running; no static html configured', 200);
  });

  if ((opts.relayStaticRoot || opts.staticAssetsRoot) && opts.sponsors) {
    app.get('/', async () => serveStaticWithBanner(opts, 'landing.html'));
    app.get('/advertise', async () => serveStaticWithBanner(opts, 'advertise.html'));
  } else {
    const landingHtmlPath = await (async () => {
      const path = await import('node:path');
      return path.resolve(import.meta.dir ?? __dirname, '..', 'static', 'landing.html');
    })();

    app.get('/', async (c) => {
      const fs = await import('node:fs/promises');
      try {
        const html = await fs.readFile(landingHtmlPath, 'utf8');
        return c.html(html);
      } catch {
        return c.text('md-review-plus relay running', 200);
      }
    });
  }

  app.get('/robots.txt', (c) => {
    return c.text(
      [
        'User-agent: *',
        'Allow: /',
        'Disallow: /api/',
        'Disallow: /r/',
        '',
        'Sitemap: https://md-review-plus.ai/sitemap.xml',
      ].join('\n'),
      200,
      { 'Content-Type': 'text/plain; charset=utf-8' },
    );
  });

  app.get('/sitemap.xml', (c) => {
    return c.body(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        '  <url><loc>https://md-review-plus.ai/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>',
        '  <url><loc>https://md-review-plus.ai/advertise</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>',
        '</urlset>',
      ].join('\n'),
      200,
      { 'Content-Type': 'application/xml; charset=utf-8' },
    );
  });

  app.get('/llms.txt', (c) => {
    return c.text(
      [
        '# md-review-plus',
        '',
        '> End-to-end encrypted markdown review tool for AI coding agents.',
        '> CLI invoked by Claude Code, Cursor, Cline, Aider, Devin and other',
        '> agents to request human review of generated documents.',
        '',
        '## How agents use it',
        '',
        '- Command: `md-review-plus <file.md> --review --remote`',
        '- The CLI encrypts the file (AES-256-GCM) locally, uploads ciphertext to this relay, prints a review URL, and blocks until the human submits.',
        '- The URL contains the decryption key in the fragment (`#...`), which browsers do not transmit to servers.',
        '- On submit, the CLI receives encrypted feedback, decrypts locally, prints structured markdown to stdout, exits 0.',
        '- Exit code 1 = expired or failed.',
        '',
        '## Privacy posture',
        '',
        '- The relay never sees plaintext, never sees the decryption key.',
        '- Sessions live in memory only, 24h TTL, deleted on submit.',
        '- No third-party scripts, no analytics, no trackers.',
        '',
        '## Resources',
        '',
        '- Source: https://github.com/Seiraiyu/md-review-plus',
        '- Skill spec: https://github.com/Seiraiyu/md-review-plus/blob/main/skills/md-review-plus.md',
        '- Design doc: https://github.com/Seiraiyu/md-review-plus/blob/main/docs/plans/2026-05-14-remote-review-design.md',
      ].join('\n'),
      200,
      { 'Content-Type': 'text/plain; charset=utf-8' },
    );
  });

  return { app, store };
}
