---
name: md-review-plus
description: Request human review of a markdown document with section-level approval and structured feedback
allowed-tools: Bash(md-review-plus:*)
---

# md-review-plus

Use this skill when you need a human to review a markdown document (plan, spec, design doc, etc.) and provide structured feedback.

## Usage

`md-review-plus` is a CLI command installed on PATH. Run it directly:

```bash
md-review-plus ./path/to/document.md --review
```

The command blocks until the human submits their review, then prints structured feedback to stdout.

## CRITICAL: Display the Review URL on its own line as the first content of your response

If you are running in an environment where the user cannot reach
`http://localhost` (CC over SSH, cloud / remote runtime, Claude Desktop
or mobile, headless CI), pass `--remote`:

```bash
md-review-plus ./document.md --review --remote
md-review-plus ./artifact.html --review --remote   # HTML artifacts work too
```

The CLI also attempts to auto-open the URL in your browser when running
locally, but this is best-effort — **always surface the URL in your
reply** because the user may be on a different device than the CLI host.

### Worked example

```
USER: review the spec doc remotely
ASSISTANT response (exact opening):

🔗 **Review URL:** https://md-review-plus.ai/r/abc#xyz

Open this URL on your phone or laptop to review the document.
The link is end-to-end encrypted; only your browser can decrypt it.

[rest of response continues...]
```

### Checklist before responding

- [ ] The first non-empty line of your reply contains the literal Review URL.
- [ ] The URL appears on its own line (so the user can click or long-press it).
- [ ] You added one short sentence telling the user what to do with it.
- [ ] You did not paraphrase the URL or wrap it in code fences that hide the
      hash fragment — the `#<key>` part is required to decrypt.

### How the CLI signals the URL

```
  ─────────────────────────────────────────────────────────────────
  Review URL: https://md-review-plus.ai/r/<id>#<key>
  ─────────────────────────────────────────────────────────────────

  Open this URL on any device with a browser.
  End-to-end encrypted — only you and the reviewer can see the document.
  Waiting for review submission (Ctrl-C to cancel)...
```

The document is end-to-end encrypted (AES-256-GCM) before upload; the
relay never sees plaintext or the key. The CLI receives the encrypted
feedback, decrypts it locally, and exits with the same stdout format
as local `--review`. Exit code 0 = submitted; 1 = expired / failed.

Override the relay with `--relay <url>` or `MDRP_RELAY`. Pass `--no-open`
to suppress the auto-open attempt.

## Handling Feedback

The stdout output follows this format:

**All approved:**

```
All sections approved. No changes needed.
```

**Changes requested:**

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

## Workflow

1. Generate or update a markdown document
2. Run `md-review-plus ./document.md --review`
3. Wait for the human to review in the browser UI
4. Parse the stdout feedback
5. Apply the requested changes to the document
6. If changes were requested, repeat from step 2

## HTML artifact mode

`md-review-plus` also reviews single-file HTML artifacts. They run in a
strict-sandboxed iframe with a `window.mdrp` shim; data exits the artifact
only via `postMessage`. Submitted state lands in stdout under a
`## Interactive State` block:

```
md-review-plus ./tuner.html --review
md-review-plus ./tuner.html --review --remote
```

Templates Claude can fill in live at
`~/.claude/skills/md-review-plus/templates/` (after `md-review-plus install
--skills`). Read `templates/README.md` there for the available templates and
the fillin convention. The same `--remote` flow applies — the Checklist above
governs both markdown and HTML.

## Important

- Markdown review requires `##` headings to define reviewable sections
- Content before the first `##` is shown but not reviewable
- HTML artifacts define their own sections via `mdrp.ready({sections})`
- Exit code 0 = review submitted, exit code 1 = browser closed without review

## Checklist before responding (repeat — this is the most important rule)

When you used `--remote`, your reply MUST begin with the Review URL on its
own line. Re-read the worked example above if unsure.
