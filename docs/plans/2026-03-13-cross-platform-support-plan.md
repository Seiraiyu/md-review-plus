# Cross-Platform Support Implementation Plan

**Goal:** Make md-review-plus work on Windows PowerShell (5.1+), macOS, and Linux. Eliminate the Bun runtime requirement for end users. Add CI verification on all three platforms.

**Architecture:** Pre-compile server TypeScript to JS at build time. CLI spawns `node dist/server.js` instead of `bun run server/index.ts`. Use IPC messages for cross-platform graceful shutdown. Expand CI matrix to three OSes.

**Tech Stack:** Node.js (end-user runtime), Bun (dev/build tool), Vitest (testing), GitHub Actions (CI)

## Task Tracking

| Task | Description | Status | Tested | Pushed |
|------|-------------|--------|--------|--------|
| 1 | Fix installSkills() path bug | pending | no | no |
| 2 | Add server build step | pending | no | no |
| 3 | Switch CLI from Bun to Node spawn | pending | no | no |
| 4 | Add IPC shutdown to server | pending | no | no |
| 5 | Wire IPC shutdown in CLI | pending | no | no |
| 6 | Add CLI integration test | pending | no | no |
| 7 | Expand CI matrix | pending | no | no |
| 8 | Manual smoke test on Windows | pending | no | no |

---

### Task 1: Fix installSkills() Path Bug

**Files:**
- Modify: `bin/md-review-plus.js:57-62`

**Step 1: Implement fix**

In `bin/md-review-plus.js`, replace lines 57-62:

```javascript
  const skillSource = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    '..',
    'skills',
    'md-review-plus.md',
  );
```

With:

```javascript
  const skillSource = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'skills',
    'md-review-plus.md',
  );
```

Note: `fileURLToPath` is already imported at line 6. No new imports needed.

**Step 2: Verify**

```bash
node bin/md-review-plus.js install --skills
```

Expected: `Installed skill to /path/to/.claude/skills/md-review-plus/SKILL.md` (no `C:\C:\` double-drive on Windows)

**Step 3: Commit**

```bash
git add bin/md-review-plus.js
git commit -m "fix: use fileURLToPath in installSkills for Windows path compatibility"
```

---

### Task 2: Add Server Build Step

**Files:**
- Modify: `package.json` (scripts section)

**Step 1: Add build:server script and update build script**

In `package.json`, replace:

```json
"build": "tsc && vite build",
```

With:

```json
"build:server": "bun build server/index.ts --outfile dist/server.js --target node --format esm",
"build": "tsc && vite build && bun run build:server",
```

**Step 2: Verify build produces dist/server.js**

```bash
bun run build
ls -la dist/server.js
```

Expected: `dist/server.js` exists (~125KB)

**Step 3: Verify bundled server starts with Node**

```bash
API_PORT=0 BASE_DIR=. timeout 5 node dist/server.js 2>&1 || true
```

Expected output includes:
```
API Server running on http://localhost:XXXXX
md-review-plus server started
```

**Step 4: Add dist/server.js to .gitignore if not already ignored**

Check if `dist/` is in `.gitignore`. If so, `dist/server.js` is already ignored (it's a build artifact, published via npm `files` field). No action needed.

**Step 5: Commit**

```bash
git add package.json
git commit -m "feat: add server build step to compile TypeScript to JS for Node runtime"
```

---

### Task 3: Switch CLI from Bun to Node Spawn

**Files:**
- Modify: `bin/md-review-plus.js:178-183`

**Step 1: Implement**

In `bin/md-review-plus.js`, replace lines 178-183:

```javascript
// Start server
const serverProcess = spawn('bun', ['run', 'server/index.ts'], {
  cwd: packageRoot,
  stdio: ['inherit', 'pipe', 'inherit'],
  env: process.env,
});
```

With:

```javascript
// Start server
const isWindows = process.platform === 'win32';
const serverScript = resolve(packageRoot, 'dist', 'server.js');

if (!existsSync(serverScript)) {
  console.error('Error: dist/server.js not found. Run "bun run build" first.');
  process.exit(1);
}

const serverProcess = spawn('node', [serverScript], {
  cwd: packageRoot,
  stdio: ['inherit', 'pipe', 'inherit', 'ipc'],
  env: process.env,
  ...(isWindows && { shell: true }),
});
```

Note: `existsSync` and `resolve` are already imported. No new imports needed.

**Step 2: Verify**

```bash
bun run build && node bin/md-review-plus.js --help
```

Expected: Help text prints (this doesn't start the server, but verifies the script loads)

```bash
bun run build && node bin/md-review-plus.js README.md --no-open &
sleep 2 && curl -s http://localhost:3030/api/health && kill %1
```

Expected: `{"status":"ok"}`

**Step 3: Commit**

```bash
git add bin/md-review-plus.js
git commit -m "feat: spawn Node instead of Bun for cross-platform server execution"
```

---

### Task 4: Add IPC Shutdown Handler to Server

**Files:**
- Modify: `server/index.ts` (add before the `startServer` call at end of file)

**Step 1: Implement**

In `server/index.ts`, add this block just before the `startServer(app, PORT)` call (before line 448):

```typescript
// Listen for IPC shutdown message from parent CLI process
if (process.send) {
  process.on('message', (msg: unknown) => {
    if (msg && typeof msg === 'object' && 'type' in msg && (msg as { type: string }).type === 'shutdown') {
      process.exit(0);
    }
  });
}
```

The `if (process.send)` guard ensures this only activates when spawned with an IPC channel (i.e., from the CLI). When the server runs standalone via `bun run server`, there's no IPC channel and this code is inert.

**Step 2: Verify**

```bash
bun run build
node -e "
import { spawn } from 'child_process';
import { resolve } from 'path';
const p = spawn('node', [resolve('dist/server.js')], {
  stdio: ['inherit', 'pipe', 'inherit', 'ipc'],
  env: { ...process.env, API_PORT: '0', BASE_DIR: '.' },
});
p.stdout.on('data', d => {
  const s = d.toString();
  process.stdout.write(s);
  if (s.includes('server started')) {
    console.log('Sending shutdown...');
    p.send({ type: 'shutdown' });
  }
});
p.on('exit', code => {
  console.log('Exit code:', code);
  process.exit(code);
});
"
```

Expected:
```
API Server running on http://localhost:XXXXX
...
md-review-plus server started
Sending shutdown...
Exit code: 0
```

**Step 3: Commit**

```bash
git add server/index.ts
git commit -m "feat: add IPC shutdown handler for cross-platform graceful exit"
```

---

### Task 5: Wire IPC Shutdown in CLI

**Files:**
- Modify: `bin/md-review-plus.js:216-224`

**Step 1: Implement**

In `bin/md-review-plus.js`, replace lines 216-224:

```javascript
// Handle graceful shutdown
const shutdown = () => {
  console.log('\nShutting down...');
  serverProcess.kill('SIGINT');
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
```

With:

```javascript
// Handle graceful shutdown via IPC (works on Windows, macOS, Linux)
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

Key changes:
- Removed `console.log('\nShutting down...')` — the server exit triggers the `serverProcess.on('exit')` handler which already calls `process.exit()`
- Replaced `serverProcess.kill('SIGINT')` with IPC `send({ type: 'shutdown' })`
- Removed `process.exit(0)` from shutdown — let the server's exit event drive the parent exit (already handled at line 227-232)
- Fallback to `serverProcess.kill()` (no signal arg = SIGTERM on Unix, terminate on Windows) if IPC disconnected

**Step 2: Verify end-to-end**

```bash
bun run build && node bin/md-review-plus.js README.md --no-open &
sleep 2 && curl -s http://localhost:3030/api/health
# Send SIGINT to the parent CLI process
kill -INT %1
# Wait and check it exited cleanly
wait %1 2>/dev/null; echo "Exit code: $?"
```

Expected: `{"status":"ok"}` then clean exit with code 0.

**Step 3: Commit**

```bash
git add bin/md-review-plus.js
git commit -m "feat: use IPC for graceful shutdown instead of SIGINT signal"
```

---

### Task 6: Add CLI Integration Test

**Files:**
- Create: `src/__tests__/cli-integration.test.ts`

**Step 1: Write the test**

Create `src/__tests__/cli-integration.test.ts`:

```typescript
import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { describe, it, expect, afterEach } from 'vitest';

const SERVER_SCRIPT = resolve(__dirname, '../../dist/server.js');
const STARTUP_TIMEOUT = 15_000;

function spawnServer(env: Record<string, string> = {}): ChildProcess {
  const isWindows = process.platform === 'win32';
  return spawn('node', [SERVER_SCRIPT], {
    stdio: ['inherit', 'pipe', 'inherit', 'ipc'],
    env: { ...process.env, API_PORT: '0', BASE_DIR: process.cwd(), ...env },
    ...(isWindows && { shell: true }),
  });
}

function waitForReady(proc: ChildProcess): Promise<number> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Server startup timeout')),
      STARTUP_TIMEOUT,
    );

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
    if (serverProc && !serverProc.killed) {
      serverProc.kill();
      await new Promise<void>((r) => serverProc!.on('exit', () => r()));
    }
    serverProc = null;
  });

  it('dist/server.js exists (requires bun run build)', () => {
    expect(existsSync(SERVER_SCRIPT)).toBe(true);
  });

  it('starts server, responds to health check, and shuts down via IPC', async () => {
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
  }, STARTUP_TIMEOUT + 5_000);

  it('serves review-mode endpoint', async () => {
    serverProc = spawnServer();
    const port = await waitForReady(serverProc);

    const res = await fetch(`http://localhost:${port}/api/review-mode`);
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body).toEqual({ reviewMode: false });

    await shutdownAndWait(serverProc);
  }, STARTUP_TIMEOUT + 5_000);
});
```

**Step 2: Run the test (requires build first)**

```bash
bun run build && bun run test -- src/__tests__/cli-integration.test.ts
```

Expected: All 3 tests PASS.

**Step 3: Run full test suite to ensure no regressions**

```bash
bun run test
```

Expected: All existing tests + 3 new tests pass.

**Step 4: Commit**

```bash
git add src/__tests__/cli-integration.test.ts
git commit -m "test: add CLI integration tests for server spawn, health check, and IPC shutdown"
```

---

### Task 7: Expand CI Matrix

**Files:**
- Modify: `.github/workflows/ci.yml`

**Step 1: Implement**

Replace the entire contents of `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches:
      - main
  pull_request:

jobs:
  ci:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@8e8c483db84b4bee98b60c0593521ed34d9990e8 # v6.0.1

      - uses: oven-sh/setup-bun@ecf28ddc73e819eb6fa29df6b34ef8921c743461 # v2.1.3
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

      - name: Run build
        run: bun run build

      - name: Run tests
        run: bun run test
```

Key changes:
- Added `strategy.matrix.os` with three OSes
- Added `fail-fast: false` so all platforms report results even if one fails
- Moved `Run build` **before** `Run tests` because the CLI integration test requires `dist/server.js` to exist

**Step 2: Verify YAML syntax**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo "Valid YAML"
```

Expected: `Valid YAML`

**Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: expand CI matrix to ubuntu, windows, and macos"
```

---

### Task 8: Manual Smoke Test on Windows

This task is manual — run on a Windows machine with PowerShell.

**Step 1: Install globally**

```powershell
npm install -g md-review-plus
```

**Step 2: Test skill installation**

```powershell
md-review-plus install --skills
md-review-plus install --skills --global
```

Expected: Both succeed without `C:\C:\` path errors.

**Step 3: Test file preview**

```powershell
echo "## Hello`n`nWorld" > test.md
md-review-plus test.md
```

Expected: Browser opens, markdown renders.

**Step 4: Test review mode**

```powershell
md-review-plus test.md --review
```

Expected: Browser opens, review UI appears, submitting exits cleanly.

**Step 5: Test Ctrl+C shutdown**

```powershell
md-review-plus test.md --no-open
# Press Ctrl+C
```

Expected: Process exits without errors.

**Step 6: Cleanup**

```powershell
Remove-Item test.md
npm uninstall -g md-review-plus
```
