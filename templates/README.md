# md-review-plus templates

Single-file HTML artifacts that Claude can fill in and pass to `md-review-plus
artifact.html --review`. Each runs inside a sandboxed iframe with the
`window.mdrp` shim (see `src/artifact/shim.ts`); none of them can make network
requests at runtime.

After `md-review-plus install --skills [--global]`, these templates are copied
to `~/.claude/skills/md-review-plus/templates/` (or `.claude/skills/md-review-plus/templates/`
for project-local install).

## Templates

| Template            | Chrome | What it's for                                                      |
| ------------------- | ------ | ------------------------------------------------------------------ |
| `review-doc.html`   | host   | Section-card markdown-style review with approve/reject + comments  |
| `diff-review.html`  | host   | Inline diff review; per-hunk approve/reject and per-line comments  |
| `design-tuner.html` | none   | Two-pane playground: controls left, live preview right             |
| `config-editor.html`| none   | Structured form rendered from a small schema                       |
| `concept-map.html`  | host   | SVG concept map; each node is a section, click to add a note       |

## Filling a template

Every template starts with an `mdrp:template` HTML comment listing the
`fillins` Claude should replace. In practice, Claude replaces the
`TEMPLATE_DATA` constant near the top of the inline `<script>` and ships the
modified file. Don't rename the constant — the runtime doesn't read it, but
keeping it stable makes hand-debugging easier.

## Conventions

- All templates call `window.mdrp.ready({ title, chrome, sections, schema? })`
  exactly once, after the DOM is built.
- `host` chrome means the React host renders the top bar + Submit button.
  `none` chrome means the artifact is full-bleed and either renders its own
  Submit button (or relies on the floating Submit the host overlays in review
  mode).
- Section state lives on the host: artifacts call `mdrp.setSectionStatus(id, status)`.
- Comments go through `mdrp.addComment({ sectionId?, anchor?, text })`.
- For `chrome:'none'` workflows that produce structured output, call
  `mdrp.submit({ state, summary })`. `summary` is a short natural-language
  description that lands in the `## Interactive State` block of stdout.

## Security model

Templates run with `<iframe sandbox="allow-scripts">` + CSP
`default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'`.
That means:

- No `<script src=...>` from a remote origin.
- No `fetch`, no `XMLHttpRequest`, no WebSocket — they're all blocked.
- No top-level navigation, no `<form action="...">` exfil.
- Data exits the iframe **only** via `postMessage` from `window.mdrp`.

Keep templates self-contained: inline CSS, inline JS, data URIs for assets.
