#!/usr/bin/env node

import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { existsSync, readFileSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import mri from 'mri';

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

// Check if file has markdown extension
function isMarkdownFile(filePath) {
  return filePath.endsWith('.md') || filePath.endsWith('.markdown');
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
  },
  boolean: ['help', 'version', 'open', 'review', 'skills', 'global'],
});

// Install skills subcommand
if (args._[0] === 'install' && args.skills) {
  await installSkills(args.global);
  process.exit(0);
}

async function installSkills(global) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const os = await import('node:os');

  const skillSource = path.join(
    path.dirname(new URL(import.meta.url).pathname),
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
  fs.copyFileSync(skillSource, dest);
  console.log(`Installed skill to ${dest}`);
}

// Help message
if (args.help) {
  console.log(`
md-review-plus - Review and annotate Markdown files with comments

Usage:
  md-review-plus [options]              Start in dev mode (browse all markdown files)
  md-review-plus <file> [options]       Preview a specific markdown file (.md or .markdown)
  md-review-plus <directory> [options]  Browse markdown files in a specific directory
  md-review-plus <file> --review        Review mode (blocks, outputs feedback)
  md-review-plus install --skills       Install Claude Code skill (project-local)
  md-review-plus install --skills --global  Install Claude Code skill (global)

Options:
  -p, --port <port>      Server port (default: 3030)
  --review               Enable review mode (blocks until submit)
  --no-open              Do not open browser automatically
  --global               Install skills globally (~/.claude/skills/)
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
    if (!isMarkdownFile(filePath)) {
      console.error(`Error: File must have .md or .markdown extension: ${filePath}`);
      process.exit(1);
    }

    process.env.MARKDOWN_FILE_PATH = filePath;
    if (!reviewMode) {
      console.log(`File: ${filePath}`);
    }
  }
} else {
  // Dev mode - browse all markdown files
  if (reviewMode) {
    console.error('Error: --review requires a markdown file path');
    process.exit(1);
  }
  process.env.BASE_DIR = process.cwd();
  console.log(`Directory: ${process.cwd()}`);
}

// Review mode setup
if (reviewMode) {
  if (!process.env.MARKDOWN_FILE_PATH) {
    console.error('Error: --review requires a markdown file, not a directory');
    process.exit(1);
  }
  process.env.REVIEW_MODE = 'true';
  // Use port 0 (random available port) unless user explicitly specified a port
  const userSpecifiedPort = process.argv.includes('--port') || process.argv.includes('-p');
  if (!userSpecifiedPort) {
    port = 0;
  }
}

// Set environment variables (after review mode may override port)
process.env.API_PORT = String(port);

if (!reviewMode) {
  console.log('Starting md-review-plus...');
  console.log(`   Port: ${port}`);
}

// Start server
const serverProcess = spawn('bun', ['run', 'server/index.ts'], {
  cwd: packageRoot,
  stdio: ['inherit', 'pipe', 'inherit'],
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

// Handle graceful shutdown
const shutdown = () => {
  console.log('\nShutting down...');
  serverProcess.kill('SIGINT');
  process.exit(0);
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
