// server/index.ts
import { Hono } from 'hono';
import type { Context } from 'hono';
import { serve } from '@hono/node-server';
import type { ServerType } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { readFile, readdir } from 'fs/promises';
import { basename, join, relative, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { watch } from 'chokidar';
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

// Port validation function
function validatePort(value: string | number): number {
  const port = parseInt(String(value), 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${value}`);
  }
  return port;
}

// Try to start server on port, incrementing if busy
async function startServer(app: Hono, port: number, maxRetries: number = 10): Promise<number> {
  for (let i = 0; i < maxRetries; i++) {
    const tryPort = port + i;
    try {
      await new Promise<ServerType>((resolve, reject) => {
        const server = serve({
          fetch: app.fetch,
          port: tryPort,
        });
        server.once('listening', () => resolve(server));
        server.once('error', reject);
      });
      return tryPort;
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
        console.log(`Port ${tryPort} is in use, trying ${tryPort + 1}...`);
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Could not find an available port after ${maxRetries} attempts`);
}

const app = new Hono();
const PORT = validatePort(process.env.API_PORT || '3030');
const MARKDOWN_FILE_PATH: string | undefined = process.env.MARKDOWN_FILE_PATH;
const BASE_DIR: string = process.env.BASE_DIR || process.cwd();

// Store SSE clients
const sseClients = new Set<SSEClient>();

// Check if file has markdown extension
function isMarkdownFile(filename: string): boolean {
  return filename.endsWith('.md') || filename.endsWith('.markdown');
}

// Helper function to scan markdown files recursively
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

// SSE endpoint for file change notifications
app.get('/api/watch', (c: Context) => {
  const stream = new ReadableStream({
    start(controller: ReadableStreamDefaultController) {
      // Send initial connection message
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode('data: {"type":"connected"}\n\n'));

      // Store client
      const client: SSEClient = { controller, encoder };
      sseClients.add(client);

      // Cleanup on disconnect
      c.req.raw.signal.addEventListener('abort', () => {
        sseClients.delete(client);
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

// Health check
app.get('/api/health', (c: Context) => {
  return c.json({ status: 'ok' });
});

// Get list of all markdown files
app.get('/api/files', async (c: Context) => {
  if (MARKDOWN_FILE_PATH) {
    const name = basename(MARKDOWN_FILE_PATH);
    return c.json({
      files: [{ name, path: name, dir: '.' }],
      baseDir: dirname(MARKDOWN_FILE_PATH),
      selectedFile: name,
    });
  }

  try {
    const files = await scanMarkdownFiles(BASE_DIR);
    return c.json({ files, baseDir: BASE_DIR });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error scanning markdown files:', message);
    return c.json(
      {
        error: 'Failed to scan markdown files',
      },
      500,
    );
  }
});

// Get markdown file API (CLI mode)
app.get('/api/markdown', async (c: Context) => {
  if (!MARKDOWN_FILE_PATH) {
    return c.json(
      {
        error: 'Markdown file path not specified',
      },
      500,
    );
  }

  try {
    const data = await readFile(MARKDOWN_FILE_PATH, 'utf-8');
    const filename = basename(MARKDOWN_FILE_PATH);
    return c.json({ content: data, filename });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error reading markdown:', message);
    return c.json(
      {
        error: 'Failed to read markdown file',
      },
      500,
    );
  }
});

// Get specific markdown file by path (Dev mode)
app.get('/api/markdown/:path{.+}', async (c: Context) => {
  const requestedPath = c.req.param('path');

  try {
    // Security check: prevent path traversal
    const baseDir = MARKDOWN_FILE_PATH ? dirname(MARKDOWN_FILE_PATH) : BASE_DIR;
    const fullPath = resolve(baseDir, requestedPath);
    if (!fullPath.startsWith(resolve(baseDir))) {
      return c.json(
        {
          error: 'Invalid file path',
        },
        403,
      );
    }

    const data = await readFile(fullPath, 'utf-8');
    const filename = basename(fullPath);
    return c.json({ content: data, filename, path: requestedPath });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error reading markdown:', message);
    return c.json(
      {
        error: 'Failed to read markdown file',
      },
      500,
    );
  }
});

// Serve static files from dist directory (for production/CLI mode)
app.use('/*', serveStatic({ root: relative(process.cwd(), distDir) || '.' }));

// Fallback to index.html for SPA routing
app.get('*', async (c: Context) => {
  try {
    const indexPath = resolve(distDir, 'index.html');
    const html = await readFile(indexPath, 'utf-8');
    return c.html(html);
  } catch {
    return c.text('Not found', 404);
  }
});

const SERVER_READY_MESSAGE = 'md-review-plus server started';

// Setup file watcher
const watchTarget: string = MARKDOWN_FILE_PATH || BASE_DIR;
const watchBase: string = MARKDOWN_FILE_PATH ? dirname(MARKDOWN_FILE_PATH) : BASE_DIR;
const watcher = watch(watchTarget, {
  ignored: MARKDOWN_FILE_PATH ? undefined : /(^|[/\\])\..|(node_modules|dist)/,
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 100,
    pollInterval: 100,
  },
});

watcher.on('change', (path: string) => {
  // Only notify for markdown files
  if (isMarkdownFile(path)) {
    const relativePath = relative(watchBase, path);
    console.log(`File changed: ${relativePath}`);

    // Broadcast to all SSE clients
    const message = JSON.stringify({
      type: 'file-changed',
      path: relativePath,
    });

    sseClients.forEach((client: SSEClient) => {
      try {
        client.controller.enqueue(client.encoder.encode(`data: ${message}\n\n`));
      } catch {
        // Client disconnected, remove it
        sseClients.delete(client);
      }
    });
  }
});

watcher.on('add', (path: string) => {
  if (isMarkdownFile(path)) {
    const relativePath = relative(watchBase, path);
    console.log(`File added: ${relativePath}`);

    const message = JSON.stringify({
      type: 'file-added',
      path: relativePath,
    });

    sseClients.forEach((client: SSEClient) => {
      try {
        client.controller.enqueue(client.encoder.encode(`data: ${message}\n\n`));
      } catch {
        sseClients.delete(client);
      }
    });
  }
});

startServer(app, PORT)
  .then((actualPort: number) => {
    console.log(`API Server running on http://localhost:${actualPort}`);
    console.log(`Watching for file changes in: ${watchTarget}`);
    console.log(SERVER_READY_MESSAGE);
  })
  .catch((err: Error) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
