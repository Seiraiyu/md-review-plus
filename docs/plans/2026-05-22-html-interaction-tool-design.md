---
title: md-review-plus as a Visual Interaction Runtime (HTML Artifact Mode)
date: 2026-05-22
status: draft
---

# md-review-plus as a Visual Interaction Runtime

## Goal

Evolve md-review-plus from a markdown reviewer into a general **visual interaction runtime** for Claude Code. Claude generates a self-contained HTML artifact — a richly laid out doc, an annotated diff, a slider-driven design tuner, a config editor — and md-review-plus serves it through the same closed-loop CLI users already know: blocking review with structured feedback returned to Claude on submit, hot reload, remote E2E-encrypted relay for cross-device review.

Markdown mode stays exactly as it is today. HTML mode is additive and becomes the flagship for tasks the article describes — specs with mockups, diffs, design prototypes, custom editors, reports.

The frame: "you show me, I give you feedback." HTML is the new canvas.

## Constraints

- **Backwards compatibility is absolute.** Every existing flow — `md-review-plus file.md --review`, dev mode, directory browsing, the `--remote` relay path, the structured stdout format — must continue to work bit-for-bit. The Claude Code skill stays valid for markdown.
- **Remote mode must remain end-to-end encrypted and unhackable.** HTML's JS executes in the reviewer's browser; the iframe sandbox must physically prevent the artifact from phoning home, so the relay's "we never see plaintext" guarantee survives.
- **YAGNI:** ship a small, opinionated set of templates and a tiny shim. No plugin system, no template marketplace, no live collaboration, no auth.
- **Single self-contained HTML files only.** No external CSS/JS, no CDNs, no build step for templates. Same constraint the playground skill already imposes — keeps Claude's authoring model simple.
- **One submit format.** Extended structured markdown. No template-specific schemas leaking into the CLI's contract with Claude.
- **No new runtime deps.** Implement with what's already installed (Hono, React 19, chokidar, mri). Sandbox is `<iframe srcdoc>` + CSP, no third-party sandbox library.

## Non-Goals

- A general HTML hosting platform. The tool serves *one* artifact per invocation, blocks until submit, exits.
- Persistent state across runs (other than the reviewer's localStorage for in-progress comments, which today's tool already does).
- Editing the HTML inside the browser. The artifact is read-only; only the user's interactions are captured.
- Multiple simultaneous reviewers (today's tool is single-user; that stays).
- Replacing the playground skill. The two complement each other; playground authors freestanding HTML, md-review-plus closes the loop with a CLI.

## Architecture

### Mode dispatch

CLI argument routing is extended in `bin/md-review-plus.js`:

```
md-review-plus <path>                          # auto-detect by extension
  .md  → markdown mode (today)
  .html → html-artifact mode (new)

md-review-plus <path> --review                 # blocking, returns structured feedback
md-review-plus <path> --review --remote        # E2E relay
```

The server (`server/index.ts`) gains:

- `GET /api/artifact` — returns the HTML body (analog of `/api/markdown`) along with metadata (`{ kind: 'html'|'markdown', path, title }`)
- The existing `/api/review-mode` endpoint stays; clients still poll it to know whether to render the submit button
- `POST /api/submit` is extended to accept an additional `interactiveState` field; the formatter appends a `## Interactive State` section when present (see Output Format)

### Render path

Client (`src/App.tsx`) gains a third branch:

```
metadata.kind === 'markdown' → CliModeApp (today)
metadata.kind === 'html'      → ArtifactModeApp (new)
no metadata / /api/files      → DevModeApp (today)
```

`ArtifactModeApp` composition:

```
┌─────────────────────────────────────────────────────────────┐
│ Sticky host chrome (top bar: title, progress, Submit)       │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────┐  │
│  │ <iframe                                                │  │
│  │   sandbox="allow-scripts"                              │  │
│  │   srcdoc="<!doctype html>... <script>__MDRP_SHIM__    │  │
│  │   ...Claude's artifact HTML..."                        │  │
│  │ />                                                     │  │
│  └───────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│ Comment sidebar (host-owned; hidden in full-bleed chrome)   │
└─────────────────────────────────────────────────────────────┘
```

### Sandbox details

- `<iframe sandbox="allow-scripts">` — no `allow-same-origin`, no `allow-forms`, no `allow-top-navigation`. Scripts run but in an opaque origin; `fetch`/`XHR` to any URL is blocked by the opaque-origin same-origin policy.
- Defense-in-depth CSP injected into the srcdoc as a `<meta http-equiv="Content-Security-Policy">`:
  ```
  default-src 'none';
  script-src 'unsafe-inline';
  style-src 'unsafe-inline';
  img-src data:;
  font-src data:;
  ```
  Inline scripts/styles allowed (needed for self-contained artifacts), but no external requests, no `eval` of fetched code, no remote fonts/images. Inline SVG and `data:` images work.
- The host page enforces the same policy out-of-band: the only `postMessage` channel it listens on is `window.message` from the specific iframe element it mounted; messages from any other source are dropped.
- Because the iframe origin is opaque, `window.parent.postMessage(payload, '*')` works for the artifact to talk out; the host validates `event.source === iframeEl.contentWindow` before accepting.

This is the same security model in local and remote modes — the only thing that changes in `--remote` is *who serves the host page* (the relay) and that the artifact bytes are AES-256-GCM encrypted in transit (key in URL fragment, never on the wire to the relay). The sandbox protects the reviewer's browser regardless.

### The `window.mdrp` shim

A small, versioned JS shim is concatenated into the iframe srcdoc before Claude's HTML. It exposes:

```js
window.mdrp = {
  version: 1,

  // Called once after DOM ready. Declares the artifact's review structure
  // and chrome preference. Host uses this to render its own UI (top bar,
  // sections list, comment sidebar).
  ready({ title, chrome = 'host', sections = [], schema = {} }) { ... },

  // Optional: push the current interactive state any time. Lets the host
  // show a live "preview of what will be submitted" and enables a
  // future "share current state" feature. Last value sent wins on submit.
  update(state) { ... },

  // Optional: programmatic per-section approve/reject. Equivalent to the
  // user clicking host chrome buttons. Useful for artifacts that have
  // their own approval UI in full-bleed mode.
  setSectionStatus(sectionId, status) { ... },   // status: 'approved' | 'rejected' | 'pending'

  // Optional: programmatic comment add.
  addComment({ sectionId, anchor, text }) { ... },

  // Finalize. Host validates, formats the markdown payload, posts to
  // /api/submit, the CLI exits. Subsequent calls are no-ops.
  submit(finalState = null) { ... },
};
```

Wire format (postMessage envelopes — all `{ type, v: 1, ... }`):

| type | direction | payload |
|------|-----------|---------|
| `mdrp.ready` | iframe → host | `{ title, chrome, sections, schema }` |
| `mdrp.update` | iframe → host | `{ state }` |
| `mdrp.section` | iframe → host | `{ sectionId, status }` |
| `mdrp.comment` | iframe → host | `{ sectionId?, anchor?, text }` |
| `mdrp.submit` | iframe → host | `{ state }` |
| `mdrp.host` | host → iframe | `{ event: 'sectionToggled' \| 'submitClicked' \| 'reset', ... }` |

`chrome` values:
- `'host'` (default) — host shows top bar + progress + comment sidebar; sections list comes from `sections`. This is the today-like UX.
- `'none'` — host hides chrome except a single floating Submit button. Artifact owns the entire viewport. For design tuners, playgrounds.

Host always owns the Submit button. The artifact can call `mdrp.submit()` programmatically (e.g., from a "Save" button inside a config editor), but the user can also always submit from host chrome — guarantees the user is never trapped inside a malformed artifact.

### Templates (shipped in-tree at `templates/`)

Each template is a single self-contained HTML file that calls `window.mdrp` and is opinionated about a specific task shape. Claude reads + adapts them per task. They live in `templates/` (server-readable, not bundled into the client build), and are also copied to `~/.claude/skills/md-review-plus/templates/` by `md-review-plus install --skills` so Claude can find them at authoring time.

Initial set:

| File | Purpose | Chrome | Submit shape |
|------|---------|--------|--------------|
| `review-doc.html` | Mirror today's section-card review for converted markdown / rich docs | `host` | Section approvals + comments |
| `diff-review.html` | Annotated code diff (file headers, hunks, per-line comments, approve/reject per hunk) | `host` | Section (=hunk) approvals + line comments |
| `design-tuner.html` | Sliders/toggles + live preview pane | `none` | `Interactive State` JSON (natural-language summary + raw values) |
| `config-editor.html` | Structured form (text/number/select/checkbox) producing a config object | `none` | `Interactive State` JSON |
| `concept-map.html` | Exploratory artifact: clickable map, user marks regions, adds notes | `host` (with sections=regions) | Section comments |

Each template has a `<!-- mdrp:template -->` HTML comment at the top with: name, intended use, params Claude must fill in, suggested submit-prompt phrasing. Claude reads the file, copies it, edits the marked sections, hands the result to md-review-plus.

We start with these five. Adding a sixth template is a small in-tree PR — no plugin system needed (YAGNI).

### Data flow (HTML mode, local)

```
1. md-review-plus artifact.html --review
2. CLI spawns server with MDRP_ARTIFACT_PATH=artifact.html, REVIEW_MODE=1
3. Server detects .html → /api/artifact returns kind:'html', body, title
4. CLI opens browser to http://127.0.0.1:<port>
5. Client App.tsx routes to ArtifactModeApp
6. ArtifactModeApp builds iframe srcdoc:
     <!doctype html><meta CSP><script>__MDRP_SHIM__</script>
     ...artifact body...
7. Iframe loads, artifact JS calls mdrp.ready(...)
8. Host renders chrome from the ready payload
9. User interacts; iframe emits mdrp.update / mdrp.section / mdrp.comment as needed
10. User clicks Submit (host) or artifact calls mdrp.submit()
11. Host POSTs to /api/submit with sections, comments, interactiveState
12. Server formats structured markdown, prints to stdout, shuts down
13. CLI parent prints feedback, exits 0
```

### Data flow (HTML mode, remote)

```
1. md-review-plus artifact.html --review --remote
2. CLI generates AES-256-GCM key, encrypts {kind:'html', body, title}
3. POST ciphertext to relay → relay returns /r/<id>
4. CLI prints URL = relay/r/<id>#<key>
5. CLI attempts to open URL with `open` (unless --no-open)        ← NEW
6. CLI prominently displays URL in a fenced block in stdout       ← NEW
7. Reviewer opens URL on any device
8. Relay-hosted SPA decrypts ciphertext using key from URL fragment
9. SPA mounts ArtifactModeApp (same code path as local) with sandboxed iframe
10. User reviews/interacts; SPA encrypts feedback payload with the same key
11. POST ciphertext-feedback to relay
12. CLI's relay-subscribe SSE receives, decrypts locally
13. CLI formats + prints structured markdown, exits 0
```

The relay never sees plaintext artifact or feedback. The iframe sandbox guarantees the artifact's JS cannot make outbound network requests that would leak data to the relay (or anywhere else).

### Output format (extended)

The CLI's stdout format gains one optional section, `## Interactive State`. Everything else is identical to today.

```
Please update the document with the following changes:

## Needs Changes

**Section Name**: Rejected
  → Reviewer's comment about what to change

## Section Comments

**Another Section**
  → Comment on an approved or pending section

## Line Comments

artifact.html:#hunk-3
"selected text or anchor description"
→ Comment

## Interactive State

```json
{
  "borderRadius": 12,
  "shadowBlur": 24,
  "preset": "soft"
}
```

> Natural-language summary: Update the card to use a border-radius of 12px and a pronounced shadow.

## Approved
- Section 1
- Section 2
```

- The fenced JSON is the raw `mdrp.submit` payload.
- The natural-language summary (blockquote) is provided by the artifact via `schema.summary` in the ready payload or by `mdrp.submit({ summary: '...' })`. If absent, no summary line is printed.
- Templates without interactive state (e.g., `review-doc.html`) omit the section entirely → output is bit-identical to today.

### Skill polish (parallel, small phase)

Two recurring issues to fix at the same time:

1. **Claude inconsistently surfaces the remote URL.** Rewrite the `## Remote review` section of `skills/md-review-plus.md` to use a much stronger pattern — a literal required-format template ("You MUST reply with the URL on its own line, prefixed with '🔗 Review URL: ', as the very first content of your message") and a worked example. Strong, prescriptive language is the only thing that reliably overrides Claude's default behavior here.
2. **CLI should attempt to open the user's browser in `--remote` mode too.** Today only local mode opens. Add: if not `--no-open`, attempt `open(url)` in remote mode after printing the URL. The print-the-URL-prominently step (boxed, blank lines, ASCII frame) happens unconditionally as the source of truth — opening the browser is a best-effort convenience.

This phase ships as part of the same release but is independently shippable; it does not depend on the iframe/sandbox work.

## Error Handling

- **Iframe never calls `mdrp.ready` within 5 s** → host shows: "This HTML artifact didn't initialize. It may be missing the md-review-plus shim or there's a JS error." plus a "Submit as-is (empty payload)" escape hatch.
- **Iframe sends a malformed `mdrp.*` message** → host logs to console (visible to dev), drops the message, no UI disruption.
- **Iframe attempts a network request** → blocked silently by the sandbox/CSP. No UX impact, but documented in the security section of the README so contributors don't get confused.
- **Hot reload while user has comments in flight** → existing localStorage-per-section model still applies for `chrome: 'host'` artifacts. For `chrome: 'none'` artifacts, the host emits a `mdrp.host` `reset` event after reload; the artifact can choose to persist state by calling `mdrp.update(state)` proactively (the host caches the last `update` payload and re-posts it as a `mdrp.host` `restore` event after reload).
- **`/api/submit` fails network-side** → existing `SubmitErrorScreen` shows; reviewer can retry. State is preserved in host memory.

## Testing Approach

- **Unit tests** (vitest, jsdom): the shim module — message envelope encoding/decoding, version negotiation, ready/update/submit lifecycle, ignored cross-frame messages.
- **Component tests** (React Testing Library): `ArtifactModeApp` host chrome — renders top bar from ready payload, toggles section state, dispatches submit clicks, handles `chrome: 'none'`.
- **Integration tests** (Bun server tests): `/api/artifact` returns correct metadata for `.html` vs `.md`; `/api/submit` formats output with and without `interactiveState`.
- **Sandbox tests** (jsdom): assert that the iframe srcdoc contains the CSP meta tag, the shim script, and the sandbox attribute is `allow-scripts` only.
- **End-to-end smoke** (manual + scripted): run `md-review-plus templates/review-doc.html --review`, simulate a submit via postMessage from a test harness, assert stdout matches expected format.
- **Backwards-compat regression**: existing markdown test suite must pass unchanged. CI gate.
- **Template snapshots**: each template gets a snapshot test that renders it in a jsdom iframe and asserts `mdrp.ready` is called with the expected schema.

## Open Questions Resolved During Interview

| Question | Resolution |
|---|---|
| Scope (rich docs vs custom editors vs both)? | Both, leaned hard toward HTML. MD mode stays as a first-class secondary. |
| How does HTML declare reviewable structure? | Via `mdrp.ready({ sections, chrome, schema })` handshake. Templates establish conventions; no rigid `data-*` contract. |
| Submit format? | Extended structured markdown — one new optional `## Interactive State` section. |
| Integration with playground skill? | md-review-plus ships its own templates in-tree; does not depend on playground. They are sister skills users can pick between. |
| Sandbox model? | Strict iframe + CSP + postMessage-only exit; identical in local and remote modes. Remote E2E guarantee is preserved by construction (artifact JS cannot reach the network). |
| Host chrome ownership? | Hybrid: host chrome is default (today's section-card UX); artifacts can opt out to `chrome: 'none'` for full-bleed. Host always owns Submit. |
| Skill polish? | Folded in as a small parallel phase. |

## Phase Tracking

| Phase | Description | Status | Tested | Pushed |
|-------|-------------|--------|--------|--------|
| 1 | Server + CLI: `/api/artifact` endpoint, `.html` auto-detect, `MDRP_ARTIFACT_PATH` env, mri arg routing | pending | no | no |
| 2 | Shim module: `window.mdrp` v1 implementation, message envelope encoder/decoder, srcdoc injection helper | pending | no | no |
| 3 | `ArtifactModeApp`: iframe mount, postMessage host, top-bar chrome reused from `CliModeApp` patterns, `chrome: 'none'` full-bleed path | pending | no | no |
| 4 | Submit pipeline: extended `/api/submit` payload, `## Interactive State` formatter, natural-language summary support, CLI stdout still bit-identical for MD mode | pending | no | no |
| 5 | Templates: ship `review-doc.html`, `diff-review.html`, `design-tuner.html`, `config-editor.html`, `concept-map.html`. Add `md-review-plus install --skills` copy logic for `templates/` | pending | no | no |
| 6 | Remote relay support: relay SPA mounts `ArtifactModeApp`; encrypt/decrypt `{kind, body, title}` envelope; relay-side iframe sandbox identical to local | pending | no | no |
| 7 | Skill polish: rewrite `skills/md-review-plus.md` remote-URL section with prescriptive template + example; CLI auto-opens browser in `--remote` (unless `--no-open`); prominent boxed URL block in stdout | pending | no | no |
| 8 | Docs: README section on HTML mode, template authoring guide, security model explainer; CHANGELOG; bump to 1.4.0 | pending | no | no |
| 9 | Release: build, test, publish to npm, tag | pending | no | no |
