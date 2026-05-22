// server/index.ts
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import type { ServerType } from '@hono/node-server';
import { createApp } from './app';

function validatePort(value: string | number): number {
  const port = parseInt(String(value), 10);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid port: ${value}`);
  }
  return port;
}

async function startServer(
  app: Hono,
  port: number,
  host: string,
  maxRetries: number = 10,
): Promise<number> {
  for (let i = 0; i < maxRetries; i++) {
    const tryPort = port + i;
    try {
      const server = await new Promise<ServerType>((resolveServer, rejectServer) => {
        const s = serve({ fetch: app.fetch, hostname: host, port: tryPort });
        s.once('listening', () => resolveServer(s));
        s.once('error', rejectServer);
      });
      const addr = server.address();
      if (typeof addr === 'object' && addr !== null) {
        return addr.port;
      }
      return tryPort;
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        'code' in err &&
        (err as NodeJS.ErrnoException).code === 'EADDRINUSE'
      ) {
        console.log(`Port ${tryPort} is in use, trying ${tryPort + 1}...`);
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Could not find an available port after ${maxRetries} attempts`);
}

const PORT = validatePort(process.env.API_PORT || '3030');
const MARKDOWN_FILE_PATH: string | undefined = process.env.MARKDOWN_FILE_PATH;
const ARTIFACT_PATH: string | undefined = process.env.MDRP_ARTIFACT_PATH;
const BASE_DIR: string = process.env.BASE_DIR || process.cwd();
const REVIEW_MODE: boolean = process.env.REVIEW_MODE === 'true';
const HOST: string = process.env.API_HOST || '127.0.0.1';

const { app, watchTarget } = createApp({
  markdownFilePath: MARKDOWN_FILE_PATH,
  artifactPath: ARTIFACT_PATH,
  baseDir: BASE_DIR,
  reviewMode: REVIEW_MODE,
});

const SERVER_READY_MESSAGE = 'md-review-plus server started';

if (process.send) {
  process.on('message', (msg: unknown) => {
    if (
      msg &&
      typeof msg === 'object' &&
      'type' in msg &&
      (msg as { type: string }).type === 'shutdown'
    ) {
      process.exit(0);
    }
  });
}

startServer(app, PORT, HOST)
  .then((actualPort: number) => {
    console.log(`API Server running on http://localhost:${actualPort}`);
    if (HOST !== '127.0.0.1' && HOST !== 'localhost') {
      console.log(`(Bound to ${HOST})`);
    }
    console.log(`Watching for file changes in: ${watchTarget}`);
    console.log(SERVER_READY_MESSAGE);
  })
  .catch((err: Error) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
