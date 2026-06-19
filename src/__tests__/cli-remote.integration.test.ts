import { spawn, type ChildProcess } from 'child_process';
import { resolve } from 'path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { encryptDocument } from '../cli/crypto';

const REPO = resolve(__dirname, '../..');
const BIN = resolve(REPO, 'bin/md-review-plus.js');
const SAMPLE = resolve(REPO, 'test-samples/sample.md');
const PORT = 18079;

let relayProc: ChildProcess | null = null;

beforeAll(async () => {
  relayProc = spawn('bun', ['src/index.ts'], {
    cwd: resolve(REPO, 'relay'),
    env: { ...process.env, MDRP_PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise<void>((res, rej) => {
    const t = setTimeout(() => rej(new Error('relay start timeout')), 5000);
    relayProc!.stdout!.on('data', (d) => {
      if (String(d).includes('listening')) {
        clearTimeout(t);
        res();
      }
    });
  });
}, 20_000);

afterAll(() => {
  relayProc?.kill();
});

describe('CLI --remote end-to-end (sans browser)', () => {
  it('CLI uploads, prints URL, and decrypts simulated feedback', async () => {
    const cli = spawn(
      'node',
      [BIN, SAMPLE, '--review', '--remote', '--relay', `http://localhost:${PORT}`],
      {
        env: { ...process.env, MDRP_INSECURE: '1' },
        stdio: ['ignore', 'pipe', 'inherit'],
      },
    );

    let stdoutBuf = '';
    const stdoutChunks: string[] = [];
    cli.stdout!.on('data', (d) => {
      stdoutBuf += String(d);
      stdoutChunks.push(String(d));
    });

    const url = await new Promise<string>((res, rej) => {
      const t = setTimeout(() => rej(new Error('no URL printed')), 5000);
      cli.stdout!.on('data', () => {
        const m = stdoutBuf.match(/Review URL: (\S+)/);
        if (m) {
          clearTimeout(t);
          res(m[1]);
        }
      });
    });
    expect(url).toMatch(/\/r\/[^#]+#/);

    const match = url.match(/\/r\/([^#]+)#(.+)$/);
    expect(match).not.toBeNull();
    const id = match![1];
    const keyB64 = match![2];
    const key = new Uint8Array(Buffer.from(keyB64, 'base64url'));

    const env = encryptDocument(key, 'markdown', 'All sections approved. No changes needed.');
    const r = await fetch(`http://localhost:${PORT}/api/sessions/${id}/feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ iv: env.iv, ct: env.ct }),
    });
    expect(r.status).toBe(200);

    const exitCode = await new Promise<number>((res) => cli.on('exit', (code) => res(code ?? -1)));
    expect(exitCode).toBe(0);
    expect(stdoutChunks.join('')).toContain('All sections approved');
  }, 20_000);

  it('prints Review URL prominently (own line, after blank line)', async () => {
    const cli = spawn(
      'node',
      [BIN, SAMPLE, '--review', '--remote', '--relay', `http://localhost:${PORT}`],
      {
        env: { ...process.env, MDRP_INSECURE: '1' },
        stdio: ['ignore', 'pipe', 'inherit'],
      },
    );

    let stdoutBuf = '';
    cli.stdout!.on('data', (d) => {
      stdoutBuf += String(d);
    });

    await new Promise<void>((res, rej) => {
      const t = setTimeout(() => rej(new Error('no URL printed')), 5000);
      cli.stdout!.on('data', () => {
        if (/Review URL: \S+/.test(stdoutBuf)) {
          clearTimeout(t);
          res();
        }
      });
    });

    const lines = stdoutBuf.split('\n');
    const urlLineIdx = lines.findIndex((l) => /Review URL: \S+/.test(l));
    expect(urlLineIdx).toBeGreaterThan(-1);
    // URL line must be within 3 lines of a blank line (prominence heuristic).
    const start = Math.max(0, urlLineIdx - 3);
    expect(lines.slice(start, urlLineIdx).some((l) => l.trim() === '')).toBe(true);
    // Without MDRP_DEBUG, the auto-open attempt log stays silent.
    expect(stdoutBuf).not.toContain('[MDRP_DEBUG] open attempted');

    cli.kill();
    await new Promise((res) => cli.on('exit', res));
  }, 15_000);

  it('attempts auto-open by default (gated by MDRP_DEBUG log)', async () => {
    const cli = spawn(
      'node',
      [BIN, SAMPLE, '--review', '--remote', '--relay', `http://localhost:${PORT}`],
      {
        env: { ...process.env, MDRP_INSECURE: '1', MDRP_DEBUG: '1' },
        stdio: ['ignore', 'pipe', 'inherit'],
      },
    );

    let stdoutBuf = '';
    cli.stdout!.on('data', (d) => {
      stdoutBuf += String(d);
    });

    await new Promise<void>((res, rej) => {
      const t = setTimeout(() => rej(new Error('no debug log')), 5000);
      cli.stdout!.on('data', () => {
        if (stdoutBuf.includes('[MDRP_DEBUG] open attempted')) {
          clearTimeout(t);
          res();
        }
      });
    });

    expect(stdoutBuf).toContain('[MDRP_DEBUG] open attempted');

    cli.kill();
    await new Promise((res) => cli.on('exit', res));
  }, 15_000);
});
