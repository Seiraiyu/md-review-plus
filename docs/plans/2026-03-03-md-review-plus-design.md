# md-review-plus Design

Fork of [ryo-manba/md-review](https://github.com/ryo-manba/md-review) (MIT licensed) with section-level review workflow, structured feedback output, and Claude Code skill integration.

**Repo:** `github.com/seiraiyu/md-review-plus`
**Package:** `md-review-plus` on npm
**Runtime:** Bun (compatible with Node via npm/npx)

## Problem

AI agents generate markdown plans, specs, and documents that need human review. Currently there's no standardized way for an agent to request structured feedback on a markdown file. The agent either gets unstructured chat responses or has to generate custom HTML review interfaces each time.

## Solution

A CLI tool that opens a markdown file in the browser with a pre-built review UI. The human reviews section by section (approve/reject + comments), adds line-level annotations, and submits. The CLI blocks until submission, then prints structured feedback to stdout so the agent can read it directly.

## Usage

```bash
# Install
npm install -g md-review-plus

# Agent review mode (blocks, returns feedback to stdout)
md-review-plus ./plan.md --review

# Browse mode (non-blocking, manual use)
md-review-plus ./plan.md
md-review-plus ./docs/

# Install Claude Code skills
md-review-plus install --skills
```

## What We Keep From md-review

- Hono server + Vite/React frontend (TypeScript)
- Markdown rendering (react-markdown, GFM, syntax highlighting, mermaid)
- Text selection → comment popover with line tracking
- Comment sidebar (copy, edit, delete, copy-all)
- Dark mode, resizable panels, hot reload on file changes
- Dev mode (file tree browser) + CLI mode (single file)

## What We Add

### 1. Section Review System

Each `##` heading defines a reviewable section. The content under a `##` (until the next `##` or end of file) is one review unit.

**Per-section controls:**

- Approve button (green)
- Reject button (red)
- Optional comment textarea (always visible, collapsible)
- Visual status indicator (pending = neutral, approved = green border, rejected = red border)

Content before the first `##` (title, intro) is shown but not a reviewable section.

### 2. Section Navigation

Left sidebar TOC generated from `##` headings:

- Click to scroll to section
- Shows approve/reject status badge per section
- Shows count summary at top (e.g., "3/5 reviewed")

### 3. Structured Feedback Output

Bottom panel generates a prompt following the playground document-critique pattern:

```
Please update the document with the following changes:

## Needs Changes

**Error Handling** (Section 3): Rejected
  → Add retry logic for API failures

**Testing** (Section 5): Rejected
  → Missing edge case coverage

## Line Comments

plan.md:L17
"the cache invalidation strategy"
→ This won't work with distributed systems, need a different approach

plan.md:L42-L45
"retry after 5 seconds"
→ Use exponential backoff instead

## Approved
- Architecture (Section 1)
- Data Flow (Section 2)
- Deployment (Section 4)
```

In review mode, a "Submit Review" button replaces the copy button. In browse mode, both copy and submit are available.

### 4. Blocking CLI Mode (`--review`)

When `--review` flag is passed:

1. Server starts on a random available port
2. Browser opens to `localhost:PORT`
3. CLI process blocks (no stdout until submission)
4. User reviews in browser, clicks "Submit Review"
5. Browser POSTs feedback to `POST /api/submit`
6. Server prints structured feedback to stdout
7. Server shuts down, process exits with code 0

If all sections are approved and no comments exist, stdout is:

```
All sections approved. No changes needed.
```

If the user closes the browser without submitting, the CLI detects the disconnect (via SSE heartbeat loss or a configurable timeout) and exits with code 1 and a stderr message.

### 5. Skill Installation (`install --skills`)

Following the [Playwright CLI pattern](https://github.com/microsoft/playwright-cli):

```bash
md-review-plus install --skills
```

Installs a skill definition file that Claude Code discovers. The skill instructs agents to:

- Use single-file mode: `md-review-plus ./path/to/file.md --review`
- Parse the stdout feedback
- Act on rejected sections and line comments

The `--help` output also serves as agent-discoverable documentation.

### 6. Port to Bun

- Replace pnpm with Bun for package management and scripts
- Keep Vite for frontend builds (Bun-compatible)
- Keep Hono for server (Bun-native)
- Ensure `npx md-review-plus` still works for Node users

## Architecture

```
md-review-plus/
├── bin/
│   └── md-review-plus.js          # CLI entry point
├── server/
│   └── index.ts                   # Hono server (file serving, API, SSE, submit endpoint)
├── src/
│   ├── App.tsx                    # Mode detection (dev/cli)
│   ├── components/
│   │   ├── CliModeApp.tsx         # Single file review
│   │   ├── DevModeApp.tsx         # File browser
│   │   ├── MarkdownPreview.tsx    # Markdown rendering + comments
│   │   ├── SectionReview.tsx      # NEW: Section approve/reject controls
│   │   ├── SectionNav.tsx         # NEW: Section TOC sidebar
│   │   ├── FeedbackOutput.tsx     # NEW: Structured feedback panel
│   │   ├── CommentList.tsx        # Existing: line-level comments
│   │   ├── SelectionPopover.tsx   # Existing: text selection → comment
│   │   └── ...
│   ├── hooks/
│   │   ├── useSections.ts         # NEW: Parse ## headings, manage section state
│   │   ├── useFeedback.ts         # NEW: Generate feedback prompt from state
│   │   └── ...
│   └── styles/
│       └── ...
├── skills/
│   └── md-review-plus.md          # Claude Code skill definition
├── package.json
├── vite.config.ts
├── tsconfig.json
└── bunfig.toml
```

## Server API Additions

### `POST /api/submit`

Receives the complete review state and shuts down the server.

```typescript
// Request body
{
  sections: [
    { heading: "Architecture", status: "approved", comment: "" },
    { heading: "Error Handling", status: "rejected", comment: "Add retry logic" }
  ],
  lineComments: [
    { file: "plan.md", startLine: 17, endLine: 17, selectedText: "...", comment: "..." }
  ]
}
```

The server formats this into the structured feedback prompt, prints to stdout, and exits.

### `GET /api/review-mode`

Returns `{ reviewMode: true/false }` so the frontend knows whether to show the submit button or copy button.

## Section State

```typescript
interface Section {
  id: string;
  heading: string; // The ## heading text
  startLine: number;
  endLine: number;
  status: "pending" | "approved" | "rejected";
  comment: string;
}
```

Sections are parsed on load by splitting content at `##` boundaries. The `useSections` hook manages this state.

## Open Questions

None — all decisions made during brainstorming.

## Implementation Notes

- Fork from md-review v1.3.2 as starting point
- Convert pnpm → Bun incrementally (package.json scripts, lock file)
- Add section review components alongside existing comment system
- The two systems (section review + line comments) are independent but both contribute to the feedback output
- Publish to npm under `md-review-plus` package name
- GitHub repo at `seiraiyu/md-review-plus`
