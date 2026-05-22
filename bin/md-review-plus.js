#!/usr/bin/env node

import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { existsSync, readFileSync, statSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import mri from 'mri';
import { validateHost } from './host-validate.js';
import { detectArtifactKind } from './artifact-kind.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = resolve(__dirname, '..');

const pkg = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf-8'));

const SERVER_READY_MESSAGE = 'md-review-plus server started';

// Port validation function
function validatePort(value, name) {
  const port = parseInt(value, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`Error: Invalid ${name}: ${value}. Must be between 1 and 65535`);
    process.exit(1);
  }
  return port;
}

// Parse arguments
const args = mri(process.argv.slice(2), {
  alias: {
    p: 'port',
    h: 'help',
    v: 'version',
  },
  default: {
    port: '3030',
    open: true,
    host: '127.0.0.1',
  },
  boolean: ['help', 'version', 'open', 'review', 'skills', 'global', 'remote', 'force'],
  string: ['relay', 'host'],
});

// Install skills subcommand
if (args._[0] === 'install' && args.skills) {
  await installSkills(args.global, args.force);
  process.exit(0);
}

async function installSkills(global, force) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const os = await import('node:os');

  const skillSource = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'skills',
    'md-review-plus.md',
  );

  const baseDir = global
    ? path.join(os.homedir(), '.claude', 'skills', 'md-review-plus')
    : path.join(process.cwd(), '.claude', 'skills', 'md-review-plus');

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  const dest = path.join(baseDir, 'SKILL.md');
  if (fs.existsSync(dest) && !force) {
    console.log(`Skill already installed at ${dest}`);
    console.log('Use --force to overwrite.');
    return;
  }
  fs.copyFileSync(skillSource, dest);
  console.log(`Installed skill to ${dest}`);

  const templateSrcDir = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'templates',
  );
  if (fs.existsSync(templateSrcDir)) {
    const templateDestDir = path.join(baseDir, 'templates');
    fs.mkdirSync(templateDestDir, { recursive: true });
    const entries = fs.readdirSync(templateSrcDir);
    let copied = 0;
    for (const f of entries) {
      if (f.endsWith('.html') || f === 'README.md') {
        fs.copyFileSync(path.join(templateSrcDir, f), path.join(templateDestDir, f));
        if (f.endsWith('.html')) copied++;
      }
    }
    console.log(`Installed ${copied} HTML templates to ${templateDestDir}`);
  }
}

// Help message
if (args.help) {
  console.log(`
md-review-plus - Review markdown and HTML artifacts with comments

Usage:
  md-review-plus [options]              Start in dev mode (browse all markdown files)
  md-review-plus <file> [options]       Preview a file (.md, .markdown, or .html)
  md-review-plus <directory> [options]  Browse markdown files in a specific directory
  md-review-plus <file> --review        Review mode (blocks, outputs feedback)
  md-review-plus install --skills       Install Claude Code skill (project-local)
  md-review-plus install --skills --global  Install Claude Code skill (global)

HTML artifacts go through the same review loop with structured stdout output.

Options:
  -p, --port <port>      Server port (default: 3030)
  --host <addr>          Bind address (default: 127.0.0.1).
                         Use 0.0.0.0 for LAN access; prefer --remote for cross-machine review.
  --review               Enable review mode (blocks until submit)
  --remote               Use remote relay for review (works over SSH, mobile, cloud CC)
  --relay <url>          Override relay URL (env: MDRP_RELAY)
  --no-open              Do not open browser automatically
  --global               Install skills globally (~/.claude/skills/)
  --force                Overwrite existing skill file (use with install --skills)
  -h, --help             Show this help message
  -v, --version          Show version number

Examples:
  md-review-plus                        Start dev mode in current directory
  md-review-plus docs                   Browse markdown files in docs directory
  md-review-plus README.md              Preview README.md
  md-review-plus docs/guide.md --port 8080
  md-review-plus spec.md --review       Review and get structured feedback
`);
  process.exit(0);
}

// Version
if (args.version) {
  console.log(pkg.version);
  process.exit(0);
}

const file = args._[0];
let port = validatePort(args.port, 'port');
const hostError = validateHost(args.host);
if (hostError) {
  console.error(`Error: ${hostError}`);
  process.exit(1);
}
process.env.API_HOST = args.host;
const shouldOpen = args.open;
const reviewMode = args.review;

// If file is specified, validate it
if (file) {
  const filePath = resolve(file);

  if (!existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  const stats = statSync(filePath);

  if (stats.isDirectory()) {
    // Dev mode with specified directory
    process.env.BASE_DIR = filePath;
    console.log(`Directory: ${filePath}`);
  } else {
    // File mode
    const kind = detectArtifactKind(filePath);
    if (!kind) {
      console.error(`Error: File must be .md, .markdown, or .html: ${filePath}`);
      process.exit(1);
    }

    if (kind === 'markdown') {
      process.env.MARKDOWN_FILE_PATH = filePath;
    } else {
      process.env.MDRP_ARTIFACT_PATH = filePath;
    }
    if (!reviewMode) {
      console.log(`File: ${filePath}`);
    }
  }
} else {
  // Dev mode - browse all markdown files
  if (reviewMode) {
    console.error('Error: --review requires a file path');
    process.exit(1);
  }
  process.env.BASE_DIR = process.cwd();
  console.log(`Directory: ${process.cwd()}`);
}

// Review mode setup
if (reviewMode) {
  if (!process.env.MARKDOWN_FILE_PATH && !process.env.MDRP_ARTIFACT_PATH) {
    console.error('Error: --review requires a file, not a directory');
    process.exit(1);
  }
  process.env.REVIEW_MODE = 'true';
  // Use port 0 (random available port) unless user explicitly specified a port
  const userSpecifiedPort = process.argv.includes('--port') || process.argv.includes('-p');
  if (!userSpecifiedPort) {
    port = 0;
  }
}

// Remote review mode: encrypt + upload + block on relay SSE. Bypasses local server.
if (args.remote) {
  if (!reviewMode) {
    console.error('Error: --remote requires --review');
    process.exit(1);
  }
  const filePath = process.env.MARKDOWN_FILE_PATH || process.env.MDRP_ARTIFACT_PATH;
  if (!filePath) {
    console.error('Error: --remote requires a file');
    process.exit(1);
  }
  const kind = detectArtifactKind(filePath);
  const filename = filePath.split(/[\\/]/).pop();
  const relay = args.relay || process.env.MDRP_RELAY || 'https://md-review-plus.ai';

  if (
    !/^https:/i.test(relay) &&
    !/^http:\/\/(localhost|127\.0\.0\.1)/i.test(relay) &&
    process.env.MDRP_INSECURE !== '1'
  ) {
    console.error(`Error: relay must be HTTPS (got ${relay}). Set MDRP_INSECURE=1 to override.`);
    process.exit(1);
  }

  const distCli = resolve(packageRoot, 'dist', 'cli.js');
  if (!existsSync(distCli)) {
    console.error('Error: dist/cli.js not found. Run "bun run build" first.');
    process.exit(1);
  }
  const cli = await import(pathToFileURL(distCli).href);

  const content = readFileSync(filePath, 'utf-8');
  const MAX = 1_048_576;
  if (Buffer.byteLength(content, 'utf-8') > MAX) {
    console.error(`Error: file exceeds ${MAX} bytes`);
    process.exit(1);
  }

  const key = cli.generateKey();
  const { iv, ct } = cli.encryptDocument(key, kind, content);

  let upload;
  try {
    upload = await cli.uploadSession({ relay, filename, iv, ct });
  } catch (e) {
    console.error(`Error: upload failed: ${e.message}`);
    process.exit(1);
  }

  const keyB64 = cli.keyToBase64Url(key);
  const reviewUrl = `${relay.replace(/\/$/, '')}/r/${upload.id}#${keyB64}`;
  console.log('');
  console.log('  ─────────────────────────────────────────────────────────────────');
  console.log(`  Review URL: ${reviewUrl}`);
  console.log('  ─────────────────────────────────────────────────────────────────');
  console.log('');
  console.log('  Open this URL on any device with a browser.');
  console.log('  End-to-end encrypted — only you and the reviewer can see the document.');
  console.log('  Waiting for review submission (Ctrl-C to cancel)...');
  console.log('');

  if (shouldOpen) {
    try {
      const openModule = await import('open');
      openModule.default(reviewUrl).catch(() => {
        /* best-effort */
      });
      if (process.env.MDRP_DEBUG === '1') {
        console.log('[MDRP_DEBUG] open attempted');
      }
    } catch {
      /* open may fail in headless envs; URL is already printed prominently */
    }
  }

  const ac = new AbortController();
  const onSigint = async () => {
    try {
      await fetch(`${relay.replace(/\/$/, '')}/api/sessions/${upload.id}`, {
        method: 'DELETE',
      });
    } catch {
      /* ignore */
    }
    ac.abort();
    process.exit(130);
  };
  process.on('SIGINT', onSigint);
  process.on('SIGTERM', onSigint);

  let envelope;
  try {
    envelope = await cli.subscribeFeedback({
      relay,
      id: upload.id,
      signal: ac.signal,
    });
  } catch (e) {
    if (e?.name === 'SessionGoneError' || /SESSION_GONE/.test(e?.message || '')) {
      console.error('Error: review session expired without submit.');
    } else {
      console.error(`Error: review session ended without feedback: ${e.message}`);
    }
    process.exit(1);
  }

  let feedback;
  try {
    feedback = cli.decryptFeedback(key, envelope);
  } catch (e) {
    console.error(`Error: failed to decrypt feedback: ${e.message}`);
    process.exit(1);
  }

  process.stdout.write(feedback);
  if (!feedback.endsWith('\n')) process.stdout.write('\n');
  process.exit(0);
}

// Set environment variables (after review mode may override port)
process.env.API_PORT = String(port);

if (!reviewMode) {
  console.log('Starting md-review-plus...');
  console.log(`   Port: ${port}`);
}

// Start server
const serverScript = resolve(packageRoot, 'dist', 'server.js');

if (!existsSync(serverScript)) {
  console.error('Error: dist/server.js not found. Run "bun run build" first.');
  process.exit(1);
}

const serverProcess = spawn('node', [serverScript], {
  cwd: packageRoot,
  stdio: ['inherit', 'pipe', 'inherit', 'ipc'],
  env: process.env,
});

let serverReady = false;
let actualPort = port;

// Wait for server to be ready before opening browser
serverProcess.stdout.on('data', async (data) => {
  const output = data.toString();

  // Extract actual port from "API Server running on http://localhost:XXXX"
  const portMatch = output.match(/API Server running on http:\/\/localhost:(\d+)/);
  if (portMatch) {
    actualPort = parseInt(portMatch[1], 10);
  }

  if (!reviewMode) {
    // In normal mode, forward all server output
    process.stdout.write(data);
  } else if (serverReady) {
    // In review mode after startup, forward output (feedback from /api/submit)
    process.stdout.write(data);
  }

  if (!serverReady && output.includes(SERVER_READY_MESSAGE)) {
    serverReady = true;

    if (shouldOpen) {
      const openModule = await import('open');
      openModule.default(`http://localhost:${actualPort}`);
    }
  }
});

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

// Handle server exit
serverProcess.on('exit', (code) => {
  if (!reviewMode && code !== 0 && code !== null) {
    console.error(`Server exited with code ${code}`);
  }
  process.exit(code ?? 0);
});

serverProcess.on('error', (err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
