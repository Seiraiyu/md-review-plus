# Cross-Platform Support: Windows PowerShell & macOS

## Goal

Make md-review-plus work reliably on Windows PowerShell (5.1+ on Windows 10/11), macOS, and Linux. Add CI verification on all three platforms. Eliminate the Bun runtime requirement for end users by pre-compiling the server to JavaScript.

## Constraints

- Windows 10+ with PowerShell 5.1+ (built-in) and PowerShell 7+ (cross-platform)
- macOS support (already partially works, needs CI verification)
- Node.js is the only required runtime for end users (Bun stays as a dev dependency)
- WSL already works — do not regress it
- No new production dependencies unless absolutely necessary

## Current Issues

### Critical

1. **`installSkills()` uses `new URL(import.meta.url).pathname` instead of `fileURLToPath()`** — On Windows, `.pathname` returns `/C:/Users/...` which `path.join()` turns into `C:\C:\Users\...`. Already confirmed broken (ENOENT error on Windows).

2. **`spawn('bun', ['run', 'server/index.ts'])` requires Bun runtime** — Windows users installing via npm won't have Bun. The server process cannot start.

3. **`serverProcess.kill('SIGINT')` doesn't work on Windows** — Windows has no POSIX signals. The graceful shutdown path is broken.

4. **CI only runs on `ubuntu-latest`** — No verification that anything works on Windows or macOS.

### Low Priority

5. **Keyboard shortcut docs say "Cmd+K"** — Should mention Ctrl+K for Windows/Linux. Not blocking; the actual code uses `metaKey` which maps correctly per platform.

## Architecture

### Phase 1: Fix installSkills() Path Bug

**File:** `bin/md-review-plus.js`

Replace:
```javascript
const skillSource = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  '..', 'skills', 'md-review-plus.md',
);
```

With:
```javascript
const skillSource = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..', 'skills', 'md-review-plus.md',
);
```

`fileURLToPath()` is already imported at line 6 via `import { fileURLToPath } from 'url'`. The function correctly handles `file:///C:/Users/...` → `C:\Users\...` on Windows and is a no-op change on Unix.

### Phase 2: Pre-Compile Server to JavaScript

**Problem:** The CLI currently runs `bun run server/index.ts`, requiring Bun as a runtime. End users installing via npm on Windows/macOS won't have Bun.

**Solution:** Compile the server TypeScript to JavaScript at build time so the CLI can spawn plain `node`.

**Changes:**

1. **Add server build step to `package.json`:**
   ```json
   {
     "scripts": {
       "build:server": "bun build server/index.ts --outfile dist/server.js --target node --format esm",
       "build": "tsc && vite build && bun run build:server"
     }
   }
   ```

2. **Update `files` in `package.json`** to ensure `dist/server.js` is published:
   - `dist/` already listed in `files`, so `dist/server.js` is automatically included.

3. **Update CLI to spawn Node instead of Bun:**
   ```javascript
   const serverProcess = spawn('node', [resolve(packageRoot, 'dist', 'server.js')], {
     cwd: packageRoot,
     stdio: ['inherit', 'pipe', 'inherit', 'ipc'],
     env: process.env,
   });
   ```

4. **Dev mode stays on Bun** — The `bun run server` script in `dev` mode continues using Bun for developers. Only the production CLI path changes.

### Phase 3: Cross-Platform Process Management

**3a. Spawn with `shell: true` on Windows:**

```javascript
const isWindows = process.platform === 'win32';
const serverProcess = spawn('node', [resolve(packageRoot, 'dist', 'server.js')], {
  cwd: packageRoot,
  stdio: ['inherit', 'pipe', 'inherit', 'ipc'],
  env: process.env,
  ...(isWindows && { shell: true }),
});
```

On Windows, `shell: true` ensures the command resolves through `cmd.exe`, which properly finds `node.exe` on PATH. On Unix, we skip `shell: true` to avoid unnecessary shell overhead.

**3b. IPC-based graceful shutdown:**

Replace signal-based shutdown with IPC messages:

**CLI side (`bin/md-review-plus.js`):**
```javascript
const shutdown = () => {
  if (serverProcess.connected) {
    serverProcess.send({ type: 'shutdown' });
  } else {
    serverProcess.kill();
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
```

**Server side (`server/index.ts`):**
```typescript
process.on('message', (msg: { type: string }) => {
  if (msg.type === 'shutdown') {
    process.exit(0);
  }
});
```

**Why IPC over signals:**
- `process.send()` works identically on Windows, macOS, and Linux
- No platform-specific signal handling code
- The IPC channel is established automatically when `stdio` includes `'ipc'`
- Fallback to `serverProcess.kill()` handles edge cases where IPC disconnects

**Ctrl+C handling:** The parent process's `SIGINT` handler still works on Windows because Node.js translates Ctrl+C into a SIGINT event on the parent process even on Windows. The issue was only with *sending* SIGINT to a child process.

### Phase 4: CI Matrix Expansion

**File:** `.github/workflows/ci.yml`

Expand to a platform matrix:

```yaml
jobs:
  ci:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@8e8c483db84b4bee98b60c0593521ed34d9990e8
      - uses: oven-sh/setup-bun@ecf28ddc73e819eb6fa29df6b34ef8921c743461
        with:
          bun-version: latest
      - name: Install dependencies
        run: bun install --frozen-lockfile
      - name: Run JS lint
        run: bun run lint:js
      - name: Run CSS lint
        run: bun run lint:css
      - name: Run format check
        run: bun run fmt:check
      - name: Run tests
        run: bun run test
      - name: Run build
        run: bun run build
```

**Note:** Bun is used as a dev tool in CI (for running builds/tests), not as the end-user runtime. `oven-sh/setup-bun` supports Windows and macOS runners.

### Phase 5: CLI Integration Test

**File:** `src/__tests__/cli-integration.test.ts` (or `tests/cli-integration.test.ts`)

A Vitest integration test that:

1. Spawns the full server process using the same code path as the CLI
2. Waits for `SERVER_READY_MESSAGE` on stdout
3. Sends an HTTP request to `/api/health` and asserts `{ status: 'ok' }`
4. Sends an IPC shutdown message
5. Asserts the process exits with code 0

```typescript
import { spawn } from 'child_process';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

describe('CLI integration', () => {
  it('starts server, responds to health check, and shuts down cleanly', async () => {
    const serverProcess = spawn('node', [resolve(__dirname, '../../dist/server.js')], {
      stdio: ['inherit', 'pipe', 'inherit', 'ipc'],
      env: { ...process.env, API_PORT: '0', BASE_DIR: process.cwd() },
    });

    // Wait for server ready
    const port = await new Promise<number>((resolve, reject) => {
      serverProcess.stdout!.on('data', (data) => {
        const match = data.toString().match(/localhost:(\d+)/);
        if (match) resolve(parseInt(match[1]));
      });
      setTimeout(() => reject(new Error('Server startup timeout')), 10000);
    });

    // Health check
    const res = await fetch(`http://localhost:${port}/api/health`);
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.status).toBe('ok');

    // Shutdown via IPC
    serverProcess.send({ type: 'shutdown' });
    const code = await new Promise<number>((resolve) => {
      serverProcess.on('exit', (code) => resolve(code ?? 0));
    });
    expect(code).toBe(0);
  });
});
```

This test requires `bun run build` first (to produce `dist/server.js`). The CI workflow already runs build before tests, but we may need to reorder or add a build step before the test step.

## Data Flow (Updated)

```
CLI (bin/md-review-plus.js)
  │
  ├─ spawn('node', ['dist/server.js'], { ipc })
  │     │
  │     └─ Server (dist/server.js)
  │           ├─ Hono HTTP server
  │           ├─ SSE file watching
  │           └─ process.on('message', shutdown)
  │
  ├─ stdout pipe → parse SERVER_READY_MESSAGE → open browser
  │
  └─ SIGINT/SIGTERM → serverProcess.send({ type: 'shutdown' })
```

## Error Handling

- **Server fails to start:** CLI already handles `serverProcess.on('error', ...)` and exits with code 1.
- **IPC disconnects before shutdown:** Fallback to `serverProcess.kill()` which sends SIGTERM on Unix. On Windows, `kill()` without a signal terminates the process.
- **Port in use:** Server already retries with incrementing ports (up to 10 attempts).
- **Build artifacts missing:** If `dist/server.js` doesn't exist, `spawn` will fail with a clear Node.js error. We could add an existence check with a helpful error message.

## Testing Approach

| Test | What it verifies | Platform |
|------|-----------------|----------|
| Existing unit tests | React components, hooks | All (via jsdom) |
| New CLI integration test | Server spawn, health check, IPC shutdown | All (native) |
| CI matrix | Everything passes on Linux, Windows, macOS | All |

## Decisions Log

| Decision | Choice | Why |
|----------|--------|-----|
| End-user runtime | Node.js only | Widest compatibility. Bun stays as dev tool only. |
| Server compilation | Pre-compile at build time | Zero runtime TS dependency. Fast startup. |
| Shutdown mechanism | IPC messages | Works identically on all platforms. No platform branching. |
| CI coverage | Full suite on all 3 OSes | Catches all platform-specific issues. |
| WSL handling | Don't touch it | Already works. Risk of regression. |
| Windows spawn | `shell: true` on Windows | Reliable command resolution through cmd.exe. |

## Phase Tracking

| Phase | Description | Status | Tested | Pushed |
|-------|-------------|--------|--------|--------|
| 1 | Fix installSkills() path bug | pending | no | no |
| 2 | Pre-compile server to JS | pending | no | no |
| 3 | Cross-platform process management (spawn + IPC shutdown) | pending | no | no |
| 4 | CI matrix expansion (ubuntu, windows, macos) | pending | no | no |
| 5 | CLI integration test | pending | no | no |
