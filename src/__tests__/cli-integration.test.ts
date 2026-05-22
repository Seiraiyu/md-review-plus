import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import { resolve } from 'path';
import { existsSync, mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, it, expect, afterEach } from 'vitest';

const SERVER_SCRIPT = resolve(__dirname, '../../dist/server.js');
const STARTUP_TIMEOUT = 15_000;

function spawnServer(env: Record<string, string> = {}): ChildProcess {
  return spawn('node', [SERVER_SCRIPT], {
    stdio: ['inherit', 'pipe', 'inherit', 'ipc'],
    env: { ...process.env, API_PORT: '0', BASE_DIR: process.cwd(), ...env },
  });
}

function waitForReady(proc: ChildProcess): Promise<number> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server startup timeout')), STARTUP_TIMEOUT);

    proc.stdout!.on('data', (data: Buffer) => {
      const output = data.toString();
      const match = output.match(/API Server running on http:\/\/localhost:(\d+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(parseInt(match[1], 10));
      }
    });

    proc.on('error', (err: Error) => {
      clearTimeout(timeout);
      reject(err);
    });

    proc.on('exit', (code: number | null) => {
      clearTimeout(timeout);
      reject(new Error(`Server exited early with code ${code}`));
    });
  });
}

function shutdownAndWait(proc: ChildProcess): Promise<number> {
  return new Promise((resolve) => {
    proc.on('exit', (code: number | null) => resolve(code ?? 0));
    if (proc.connected) {
      proc.send({ type: 'shutdown' });
    } else {
      proc.kill();
    }
  });
}

describe('CLI integration', () => {
  let serverProc: ChildProcess | null = null;

  afterEach(async () => {
    if (serverProc && serverProc.exitCode === null && !serverProc.killed) {
      serverProc.kill();
      await new Promise<void>((r) => serverProc!.on('exit', () => r()));
    }
    serverProc = null;
  });

  it('dist/server.js exists (requires bun run build)', () => {
    expect(existsSync(SERVER_SCRIPT)).toBe(true);
  });

  it(
    'starts server, responds to health check, and shuts down via IPC',
    async () => {
      serverProc = spawnServer();
      const port = await waitForReady(serverProc);

      // Health check
      const res = await fetch(`http://localhost:${port}/api/health`);
      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body).toEqual({ status: 'ok' });

      // Shutdown via IPC
      const exitCode = await shutdownAndWait(serverProc);
      expect(exitCode).toBe(0);
    },
    STARTUP_TIMEOUT + 5_000,
  );

  it(
    'serves review-mode endpoint',
    async () => {
      serverProc = spawnServer();
      const port = await waitForReady(serverProc);

      const res = await fetch(`http://localhost:${port}/api/review-mode`);
      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body).toEqual({ reviewMode: false });

      await shutdownAndWait(serverProc);
    },
    STARTUP_TIMEOUT + 5_000,
  );

  describe('html artifact routing', () => {
    let tmp: string | null = null;

    afterEach(() => {
      if (tmp) {
        rmSync(tmp, { recursive: true, force: true });
        tmp = null;
      }
    });

    it(
      'routes .html via MDRP_ARTIFACT_PATH and serves /api/artifact',
      async () => {
        tmp = mkdtempSync(join(tmpdir(), 'mdrp-cli-'));
        const htmlPath = join(tmp, 'demo.html');
        writeFileSync(htmlPath, '<h1>hi</h1>');

        serverProc = spawnServer({ MDRP_ARTIFACT_PATH: htmlPath });
        const port = await waitForReady(serverProc);

        const artifactRes = await fetch(`http://localhost:${port}/api/artifact`);
        expect(artifactRes.ok).toBe(true);
        const artifactBody = await artifactRes.json();
        expect(artifactBody.kind).toBe('html');
        expect(artifactBody.content).toBe('<h1>hi</h1>');
        expect(artifactBody.filename).toBe('demo.html');

        const filesRes = await fetch(`http://localhost:${port}/api/files`);
        const filesBody = await filesRes.json();
        expect(filesBody.mode).toBe('cli');
        expect(filesBody.kind).toBe('html');

        // /api/markdown should fail because MARKDOWN_FILE_PATH is unset
        const mdRes = await fetch(`http://localhost:${port}/api/markdown`);
        expect(mdRes.status).toBe(500);

        await shutdownAndWait(serverProc);
      },
      STARTUP_TIMEOUT + 5_000,
    );
  });
});
