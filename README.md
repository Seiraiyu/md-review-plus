# md-review-plus

A CLI tool for reviewing Markdown files with inline comments in the browser.
Section-level approval, structured feedback output, and Claude Code integration.

## Features

- **Card-based section review**: Each `##` section renders as a card with Approve/Reject buttons and a comment textarea
- **Sticky top bar**: Progress indicator, Approve All, Clear All, and Submit/Copy buttons always visible
- **Visual feedback**: Approved sections turn green, rejected sections turn red
- **Structured feedback output**: Copy or submit formatted review feedback including all section and line comments
- **Review mode** (`--review`): Blocks until human submits, outputs feedback to stdout — ideal for AI agent loops
- **Claude Code skill**: Install as a skill so Claude Code can request human reviews
- **Inline line comments**: Select text to add comments to specific lines
- **Full-width layout**: Cards fill the available viewport width
- **Dark mode support**: Follows system preferences
- **Hot reload**: Live updates when markdown files change
- Select files from tree view (directory mode)

## Install

```sh
npm install -g md-review-plus
```

### Claude Code Skill

To install the Claude Code skill definition for the current project:

```sh
md-review-plus install --skills
```

To install globally:

```sh
md-review-plus install --skills --global
```

## Usage

```sh
md-review-plus [options]              # Browse all markdown files in current directory
md-review-plus <file> [options]       # Preview a specific markdown file
md-review-plus <directory> [options]  # Browse markdown files in a specific directory
md-review-plus <file> --review        # Review mode: blocks until submit, outputs feedback
```

### Options

```sh
-p, --port <port>      Server port (default: 3030)
    --review           Enable review mode (blocks until submit)
    --remote           Use remote relay (works over SSH, mobile, cloud)
    --relay <url>      Override relay URL (env: MDRP_RELAY)
    --no-open          Do not open browser automatically
    --global           Install skills globally (~/.claude/skills/)
-h, --help             Show this help message
-v, --version          Show version number
```

### Examples

```sh
md-review-plus                           # Browse markdown files in current directory
md-review-plus docs                      # Browse markdown files in docs directory
md-review-plus README.md                 # Preview README.md
md-review-plus docs/guide.md --port 8080 # Preview on custom port
md-review-plus spec.md --review          # Review mode for AI agent integration
```

## Review Mode

Run with `--review` to get structured feedback from a human reviewer:

```sh
md-review-plus ./document.md --review
```

The command blocks until the reviewer submits, then prints structured feedback to stdout:

```
Please update the document with the following changes:

## Needs Changes

**Section Name**: Rejected
  → Reviewer's comment about what to change

## Section Comments

**Another Section**
  → Comment on an approved or pending section

## Line Comments

file.md:L17
"selected text from the document"
→ Reviewer's comment about this specific text

## Approved
- Section Name 1
- Section Name 2
```

The document must have `##` headings to define reviewable sections. Exit code 0 means review submitted, exit code 1 means the browser was closed without submitting.

## Remote review

When Claude Code runs somewhere your browser cannot reach — SSH session,
cloud runtime, mobile, CI — use `--remote`:

```sh
md-review-plus ./document.md --review --remote
```

The CLI encrypts the document with a fresh AES-256-GCM key, uploads the
ciphertext to the relay, and prints a URL with the key in the URL
fragment (which browsers do not send to the server). Open the URL on any
device, review, submit. The CLI receives the encrypted feedback,
decrypts it locally, and exits with the usual structured output.

Override the relay with `MDRP_RELAY` or `--relay <url>`. To self-host the
relay, see [relay/README.md](relay/README.md) and
[relay/DEPLOY.md](relay/DEPLOY.md).

**Privacy:** AES-256-GCM end-to-end. The key never leaves the CLI or
your browser. The relay holds ciphertext for up to 24h, deletes on
submit, and does not log request bodies or URL fragments.

## Comment Management

### Adding Comments

1. Select text in the markdown preview
2. Click the "Comment" button that appears
3. Type your comment and press `Cmd/Ctrl+Enter` or click "Submit"

### Editing Comments

1. Click the edit icon on any existing comment
2. Modify the text in the textarea
3. Press `Cmd/Ctrl+Enter` or click "Save" to save changes
4. Press `Escape` or click "Cancel" to discard changes

### Keyboard Shortcuts

- `Cmd/Ctrl+Enter` — Submit/Save comment
- `Escape` — Cancel editing
- `Cmd+K` — Focus search bar (directory mode)

## License

[MIT](./LICENSE)
