# md-review-plus

A CLI tool for reviewing Markdown files with inline comments in the browser.
Section-level approval, structured feedback output, and Claude Code integration.

## Features

- Display Markdown in its original format
- **Section-level review**: Approve or reject individual `##` sections with comments
- **Structured feedback output**: Copy or submit formatted review feedback
- **Review mode** (`--review`): Blocks until human submits, outputs feedback to stdout — ideal for AI agent loops
- **Claude Code skill**: Install as a skill so Claude Code can request human reviews
- Add comments to specific lines via text selection
- Select files from tree view (directory mode)
- Dark mode support (follows system preferences)
- Hot reload when markdown files change

## Install

```sh
npm install -g md-review-plus
```

### Claude Code Skill

To install the Claude Code skill definition:

```sh
md-review-plus install --skills
```

This copies the skill to `~/.claude/skills/` so Claude Code can use it to request human reviews.

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
    --no-open          Do not open browser automatically
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

## Line Comments

file.md:L17
"selected text from the document"
→ Reviewer's comment about this specific text

## Approved
- Section Name 1
- Section Name 2
```

The document must have `##` headings to define reviewable sections. Exit code 0 means review submitted, exit code 1 means the browser was closed without submitting.

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
