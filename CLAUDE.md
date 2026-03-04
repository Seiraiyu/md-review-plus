# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (runs server + Vite concurrently)
bun dev

# Build
bun run build

# Run tests
bun test              # Run tests once
bun run test:watch    # Watch mode
bun run test:coverage # With coverage

# Linting and formatting
bun run lint          # ESLint + Stylelint
bun run lint:fix      # Auto-fix lint issues
bun run fmt           # Prettier format
bun run fmt:check     # Check formatting
```

## Architecture

CLI tool for reviewing Markdown files with inline comments in the browser. Fork of [md-review](https://github.com/ryo-manba/md-review) with section-level review workflow, structured feedback output, and Claude Code integration.

### Three Runtime Modes

1. **CLI Mode** (`md-review-plus <file>`): Single file preview with section-level review using `CliModeApp`
2. **Dev Mode** (`md-review-plus` or `md-review-plus <dir>`): File browser with tree view using `DevModeApp`
3. **Review Mode** (`md-review-plus <file> --review`): Blocking review that outputs structured feedback to stdout, then exits. Uses random port unless specified.

Mode detection in `App.tsx`: checks `/api/files` availability → Dev mode if present, CLI mode otherwise. Review mode is a flag on CLI mode, detected via `/api/review-mode` endpoint.

### Server/Client Split

- **`bin/md-review-plus.js`**: CLI entry point. Parses args with `mri`, spawns server as subprocess, waits for `SERVER_READY_MESSAGE`, opens browser. In review mode, captures `/api/submit` output to stdout.
- **`server/index.ts`**: Hono server on Bun
  - API: `/api/markdown`, `/api/markdown/:path`, `/api/files`, `/api/watch` (SSE), `/api/review-mode`, `/api/submit` (POST), `/api/health`
  - File watching via chokidar with SSE broadcast
  - `POST /api/submit` formats feedback as markdown, triggers auto-shutdown in review mode
- **`src/`**: React 19 frontend (Vite)

### Section Review System

The section review workflow is the main differentiator from the original md-review:

- `useSections` hook: Parses `##` headings into reviewable sections with `pending`/`approved`/`rejected` state
- `SectionReview`: Per-section approve/reject buttons + comment textarea
- `SectionNav`: Sidebar showing section progress (X/N reviewed)
- `FeedbackOutput`: Collapsible panel showing formatted feedback. Submit button (review mode) or Copy button (normal mode)
- `useFeedback` hook: Generates structured markdown feedback from sections + line comments

### Key Components

- `CliModeApp`: Orchestrates section review UI. Falls back to plain `MarkdownPreview` when no `##` headings exist.
- `DevModeApp`: Directory browser with resizable sidebar, `FileTree`, and `MarkdownPreview`
- `MarkdownPreview`: Renders markdown via `react-markdown` with GFM, syntax highlighting, and Mermaid diagrams. Supports `SelectionPopover` for inline comments.
- `CommentList`: Line-level comments persisted to localStorage

### Data Flow

1. CLI parses args → sets env vars (`MARKDOWN_FILE_PATH`, `BASE_DIR`, `REVIEW_MODE`, `API_PORT`)
2. Server reads files from these paths
3. SSE `/api/watch` enables hot reload on file changes
4. In review mode: user reviews sections → submits via `POST /api/submit` → server outputs formatted feedback to stdout → process exits

### Claude Code Skill

`skills/md-review-plus.md` defines a Claude Code skill. Install with `md-review-plus install --skills` (copies to `~/.claude/skills/`). Enables Claude Code to request human review of documents in a review loop.
