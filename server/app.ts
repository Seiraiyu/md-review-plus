// server/app.ts
import { Hono } from 'hono';
import type { Context } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { readFile, readdir, realpath } from 'fs/promises';
import { basename, join, relative, resolve, dirname, sep } from 'path';
import { fileURLToPath } from 'url';
import { watch } from 'chokidar';
import type { FSWatcher } from 'chokidar';
import type { Dirent } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = resolve(__dirname, '..');
const distDir = resolve(packageRoot, 'dist');

interface MarkdownFileEntry {
  name: string;
  path: string;
  dir: string;
}

interface SSEClient {
  controller: ReadableStreamDefaultController;
  encoder: TextEncoder;
}

export interface SubmitBody {
  sections: Array<{
    heading: string;
    status: 'approved' | 'rejected' | 'pending';
    comment: string;
  }>;
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

export interface AppEnv {
  markdownFilePath?: string;
  artifactPath?: string;
  baseDir: string;
  reviewMode: boolean;
}

export interface CreateAppResult {
  app: Hono;
  watcher: FSWatcher;
  watchTarget: string;
  sseClients: Set<SSEClient>;
}

function isMarkdownFile(filename: string): boolean {
  return filename.endsWith('.md') || filename.endsWith('.markdown');
}

function isWatchableArtifact(filename: string): boolean {
  return filename.endsWith('.md') || filename.endsWith('.markdown') || filename.endsWith('.html');
}

async function scanMarkdownFiles(dir: string, baseDir: string = dir): Promise<MarkdownFileEntry[]> {
  const files: MarkdownFileEntry[] = [];
  const entries: Dirent[] = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relativePath = relative(baseDir, fullPath);

    const skipPatterns = ['node_modules', 'dist'];
    if (skipPatterns.includes(entry.name)) {
      continue;
    }

    if (entry.isSymbolicLink()) {
      continue;
    }

    if (entry.isDirectory()) {
      const subFiles = await scanMarkdownFiles(fullPath, baseDir);
      files.push(...subFiles);
    } else if (entry.isFile() && isMarkdownFile(entry.name)) {
      files.push({
        name: entry.name,
        path: relativePath,
        dir: relative(baseDir, dir) || '.',
      });
    }
  }

  return files;
}

export function formatFeedback(body: SubmitBody): string {
  const { sections, lineComments, filename, interactiveState } = body;
  const rejected = sections.filter((s) => s.status === 'rejected');
  const approved = sections.filter((s) => s.status === 'approved');
  const hasAnyComment = sections.some((s) => s.comment && s.comment.trim() !== '');

  const isAllApproved =
    sections.length > 0 &&
    approved.length === sections.length &&
    lineComments.length === 0 &&
    !hasAnyComment &&
    interactiveState === undefined;

  if (isAllApproved) {
    return 'All sections approved. No changes needed.';
  }

  const parts: string[] = [];
  parts.push('Please update the document with the following changes:');

  if (rejected.length > 0) {
    parts.push('');
    parts.push('## Needs Changes');
    for (const section of rejected) {
      parts.push('');
      parts.push(`**${section.heading}**: Rejected`);
      if (section.comment) {
        parts.push(`  → ${section.comment}`);
      }
    }
  }

  const otherWithComments = sections.filter(
    (s) => s.status !== 'rejected' && s.comment && s.comment.trim() !== '',
  );
  if (otherWithComments.length > 0) {
    parts.push('');
    parts.push('## Section Comments');
    for (const section of otherWithComments) {
      parts.push('');
      parts.push(`**${section.heading}**`);
      parts.push(`  → ${section.comment}`);
    }
  }

  if (lineComments.length > 0) {
    parts.push('');
    parts.push('## Line Comments');
    for (const comment of lineComments) {
      parts.push('');
      const lineRef =
        comment.startLine === comment.endLine
          ? `${filename}:L${comment.startLine}`
          : `${filename}:L${comment.startLine}-L${comment.endLine}`;
      parts.push(lineRef);
      parts.push(`"${comment.selectedText}"`);
      parts.push(`→ ${comment.comment}`);
    }
  }

  if (approved.length > 0) {
    parts.push('');
    parts.push('## Approved');
    for (const section of approved) {
      parts.push(`- ${section.heading}`);
    }
  }

  if (interactiveState !== undefined) {
    parts.push('');
    parts.push('## Interactive State');
    parts.push('');
    parts.push('```json');
    parts.push(JSON.stringify(interactiveState.state, null, 2));
    parts.push('```');
    if (interactiveState.summary) {
      parts.push('');
      parts.push(`> Natural-language summary: ${interactiveState.summary}`);
    }
  }

  return parts.join('\n');
}

export function createApp(env: AppEnv): CreateAppResult {
  const { markdownFilePath, artifactPath, baseDir, reviewMode } = env;
  const app = new Hono();

  const sseClients = new Set<SSEClient>();
  let disconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function clearDisconnectTimer(): void {
    if (disconnectTimer) {
      clearTimeout(disconnectTimer);
      disconnectTimer = null;
    }
  }

  function startDisconnectTimer(): void {
    if (!reviewMode) return;
    clearDisconnectTimer();
    disconnectTimer = setTimeout(() => {
      console.error('Browser disconnected without submitting review.');
      process.exit(1);
    }, 30_000);
  }

  // SSE endpoint for file change notifications
  app.get('/api/watch', (c: Context) => {
    const stream = new ReadableStream({
      start(controller: ReadableStreamDefaultController) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode('data: {"type":"connected"}\n\n'));

        const client: SSEClient = { controller, encoder };
        sseClients.add(client);
        clearDisconnectTimer();

        c.req.raw.signal.addEventListener('abort', () => {
          sseClients.delete(client);
          if (reviewMode && sseClients.size === 0) {
            startDisconnectTimer();
          }
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  });

  app.get('/api/health', (c: Context) => {
    return c.json({ status: 'ok' });
  });

  app.get('/api/files', async (c: Context) => {
    if (artifactPath) {
      const name = basename(artifactPath);
      return c.json({
        mode: 'cli' as const,
        kind: 'html' as const,
        files: [{ name, path: name, dir: '.' }],
        baseDir: dirname(artifactPath),
        selectedFile: name,
      });
    }
    if (markdownFilePath) {
      const name = basename(markdownFilePath);
      return c.json({
        mode: 'cli' as const,
        kind: 'markdown' as const,
        files: [{ name, path: name, dir: '.' }],
        baseDir: dirname(markdownFilePath),
        selectedFile: name,
      });
    }

    try {
      const files = await scanMarkdownFiles(baseDir);
      return c.json({ mode: 'dev' as const, kind: 'directory' as const, files, baseDir });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Error scanning markdown files:', message);
      return c.json({ error: 'Failed to scan markdown files' }, 500);
    }
  });

  app.get('/api/markdown', async (c: Context) => {
    if (!markdownFilePath) {
      return c.json({ error: 'Markdown file path not specified' }, 500);
    }
    try {
      const data = await readFile(markdownFilePath, 'utf-8');
      const filename = basename(markdownFilePath);
      return c.json({ content: data, filename });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Error reading markdown:', message);
      return c.json({ error: 'Failed to read markdown file' }, 500);
    }
  });

  app.get('/api/artifact', async (c: Context) => {
    if (!artifactPath) {
      return c.json({ error: 'Artifact path not specified' }, 500);
    }
    try {
      const data = await readFile(artifactPath, 'utf-8');
      const filename = basename(artifactPath);
      return c.json({ kind: 'html' as const, content: data, filename });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Error reading artifact:', message);
      return c.json({ error: 'Failed to read artifact file' }, 500);
    }
  });

  app.get('/api/markdown/:path{.+}', async (c: Context) => {
    const requestedPath = c.req.param('path');

    try {
      const base = markdownFilePath ? dirname(markdownFilePath) : baseDir;
      const fullPath = resolve(base, requestedPath);
      const realBase = await realpath(resolve(base));
      let realFull: string;
      try {
        realFull = await realpath(fullPath);
      } catch {
        return c.json({ error: 'Invalid file path' }, 403);
      }
      const baseWithSep = realBase.endsWith(sep) ? realBase : realBase + sep;
      if (realFull !== realBase && !realFull.startsWith(baseWithSep)) {
        return c.json({ error: 'Invalid file path' }, 403);
      }

      const data = await readFile(realFull, 'utf-8');
      const filename = basename(realFull);
      return c.json({ content: data, filename, path: requestedPath });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Error reading markdown:', message);
      return c.json({ error: 'Failed to read markdown file' }, 500);
    }
  });

  app.get('/api/review-mode', (c: Context) => {
    return c.json({ reviewMode });
  });

  app.post('/api/submit', async (c: Context) => {
    const body = await c.req.json<SubmitBody>();
    const feedback = formatFeedback(body);

    clearDisconnectTimer();
    console.log(feedback);

    const response = c.json({ ok: true });

    if (reviewMode) {
      setTimeout(() => {
        process.exit(0);
      }, 100);
    }

    return response;
  });

  app.use('/*', serveStatic({ root: relative(process.cwd(), distDir) || '.' }));

  app.get('*', async (c: Context) => {
    try {
      const indexPath = resolve(distDir, 'index.html');
      const html = await readFile(indexPath, 'utf-8');
      return c.html(html);
    } catch {
      return c.text('Not found', 404);
    }
  });

  const watchTarget: string = artifactPath || markdownFilePath || baseDir;
  const watchBase: string = artifactPath
    ? dirname(artifactPath)
    : markdownFilePath
      ? dirname(markdownFilePath)
      : baseDir;
  const isSingleFile = Boolean(artifactPath || markdownFilePath);
  const watcher = watch(watchTarget, {
    ignored: isSingleFile ? undefined : /(^|[/\\])\..|(node_modules|dist)/,
    persistent: true,
    ignoreInitial: true,
    followSymlinks: false,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 100,
    },
  });

  function broadcast(message: string): void {
    sseClients.forEach((client: SSEClient) => {
      try {
        client.controller.enqueue(client.encoder.encode(`data: ${message}\n\n`));
      } catch {
        sseClients.delete(client);
      }
    });
  }

  watcher.on('change', (path: string) => {
    if (isWatchableArtifact(path)) {
      const relativePath = relative(watchBase, path);
      console.log(`File changed: ${relativePath}`);
      broadcast(JSON.stringify({ type: 'file-changed', path: relativePath }));
    }
  });

  watcher.on('add', (path: string) => {
    if (isWatchableArtifact(path)) {
      const relativePath = relative(watchBase, path);
      console.log(`File added: ${relativePath}`);
      broadcast(JSON.stringify({ type: 'file-added', path: relativePath }));
    }
  });

  return { app, watcher, watchTarget, sseClients };
}
