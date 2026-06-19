---
name: md-review-plus
description: Get human review of any work — markdown docs, code diffs, design choices, prioritization — through rich visual artifacts with structured feedback (approve/reject, comments, suggested edits, reactions, questions). Bidirectional: the reviewer can ask you questions back, which you must answer in the next iteration.
allowed-tools: Bash(md-review-plus:*)
---

# md-review-plus

This is the rich-collab gate between you and the human. Use it whenever
a decision benefits from a human looking at the actual rendered thing
and giving you structured feedback you can act on.

It is **not just for markdown**. The richest payoff comes from HTML
artifacts that let the reviewer compare options, drag items, click
elements, leave reactions, and ask you questions — all in one pass.

## Always use `--remote` (the default review mode)

Run every review with `--remote`. It ships the artifact over an
end-to-end-encrypted relay and gives you a clickable URL that works no
matter where the user is — another machine, a phone, a cloud Claude
Code session with no local browser. Plain `--review` only works when
the user is sitting at the same machine that's running the CLI, which
you usually can't assume. Drop `--remote` only if the user explicitly
says they're local and wants the in-browser flow.

## CRITICAL: Display the Review URL on its own line as the first content of your response

`--remote` makes the CLI print a Review URL and then **block** waiting
for the submission. Blocking alone is useless to the user — they can't
review what they can't see. The moment you have the URL, surface it
**before any other prose**:

```
USER: please review this
ASSISTANT response (exact opening):

🔗 **Review URL:** https://md-review-plus.ai/r/abc#xyz

Open this URL on your phone or laptop to review.
The link is end-to-end encrypted; only your browser can decrypt it.

[rest of response continues...]
```

The CLI also tries to auto-open the URL on the local machine, but that
is best-effort and silently no-ops in headless/remote environments —
**never rely on it**. Surfacing the URL in your reply is the only thing
guaranteed to reach the user.

### Checklist before responding (must pass)

- [ ] First non-empty line contains the literal Review URL
- [ ] URL is on its own line (so the user can click / long-press it)
- [ ] One sentence telling the user what to do with it
- [ ] You did NOT wrap the URL in code fences that hide the `#<key>` fragment

## When to use HTML mode vs markdown

| Task                                                      | Use                              |
| --------------------------------------------------------- | -------------------------------- |
| Prose, spec, plan, single-linear narrative                | **markdown** (`*.md`)            |
| Code / patch / diff review with per-line feedback         | **HTML** — `pr-review.html`      |
| "Which of these do you prefer?" (variants, copy, layouts) | **HTML** — `design-grid.html`    |
| Prioritization / ranking / what-ships-first               | **HTML** — `priority-board.html` |
| Tuning sliders/knobs against a live preview               | **HTML** — `design-tuner.html`   |
| Structured config / form-style input                      | **HTML** — `config-editor.html`  |

Default to HTML whenever the review involves **choosing among
options**, **anchoring feedback to a specific line/element**, or
**producing structured state** (rankings, configs, tuned values).
Default to markdown only when the work is genuinely a single linear
document being read top-to-bottom.

## Templates

Templates live at `~/.claude/skills/md-review-plus/templates/` after
`md-review-plus install --skills`. Each begins with an
`mdrp:template` HTML comment listing its fillins.

### `design-grid.html` — compare N variants

- Side-by-side rendered variants with tradeoff captions
- Per-variant: 👍 👎 🤔 ❤️ 🎉 reactions, comment textarea, ask-question textarea
- Click any element inside a variant's preview to pin a location-anchored note
- Pick-the-winner radio (sets section status: winner = approved, others = rejected)
- Bottom: overall summary + global Q&A panel

### `pr-review.html` — diff with rich annotations

- Multi-file unified diff, line-numbered, +/- coloured
- Per-hunk: approve/reject, severity tag (nit / suggestion / blocker), emoji reactions
- Per-line click → popover with two tabs:
  - **Comment** — free-text anchored to `line:hunkId:N`
  - **Suggest change** — replacement text, anchored as `suggest:hunkId:N`, stdout text prefixed `SUGGEST: …`
- Bottom panels for cross-cutting reviewer notes and global agent Q&A

### `priority-board.html` — drag-rank into Now/Next/Later/Cut

- HTML5 drag-and-drop cards between four columns
- Per-card: inline-editable title, effort chips (S/M/L), impact chips (low/med/high), expandable comment, expandable ask-question
- Column placement drives section status: Now → approved, Cut → rejected, Next/Later → pending
- Bottom: global rationale textarea + Q&A panel

### `design-tuner.html` — controls + live preview

- Two-pane: sliders/colors/toggles on the left, live preview on the right
- `mdrp.update(state)` fires on every control change so the host catches the latest state on Submit

### `config-editor.html` — schema-driven form

- Renders typed fields (string / number / bool / enum) with inline validation
- Submit blocks if validation fails

(`review-doc.html` and `concept-map.html` also ship for simpler cases — prefer the richer templates above when applicable.)

## How to fill a template

1. Copy the template you want next to the file you're reviewing (or anywhere):
   ```sh
   cp ~/.claude/skills/md-review-plus/templates/design-grid.html ./review-X.html
   ```
2. Open it and find `const TEMPLATE_DATA = { ... }` near the top of the inline `<script>`.
3. Replace its fields per the `mdrp:template` header comment at the top of the file. Don't rename `TEMPLATE_DATA` — keeping the constant stable helps debugging.
4. Run:
   ```sh
   md-review-plus ./review-X.html --review --remote   # default — clickable URL, works anywhere
   md-review-plus ./review-X.html --review            # only if the user is local and wants the in-browser flow
   ```

## What the reviewer can give you (the structured stdout)

The CLI's stdout is structured markdown with these blocks (each one
appears only when there's something to report):

- `## Needs Changes` — rejected sections + their comments
- `## Section Comments` — comments on approved/pending sections
- `## Line Comments` — per-line anchored notes; `SUGGEST: …` blocks are inline edit suggestions you should apply
- `## Approved` — list of approved sections
- `## Open Questions` — questions the reviewer wants **you** to answer
- `## Reactions` — per-target emoji counts (`**v2**: 👍×3 🎉`) — read this as aggregate sentiment
- `## Interactive State` — the JSON state the artifact submitted via `mdrp.submit({state})` (rankings, tuned values, picked winners)

## Q&A loop — treat questions as blocking

Every template has "ask a question" boxes. Questions arrive in
`## Open Questions`. When you see them:

1. **Answer each question by name** in your next response
2. Apply requested changes (anything in `## Needs Changes`)
3. Apply suggested edits (`SUGGEST: …` lines in `## Line Comments`)
4. Re-run the same review with the updated artifact if the reviewer
   expects another round

Do not skip questions. Treat them as blocking review comments.

## Workflow

1. Decide markdown vs HTML (see table above)
2. Author the artifact (a `.md` file, or fill in a template `.html`)
3. Run `md-review-plus <file> --review --remote`
4. Surface the printed Review URL per the checklist above — before any other prose
5. Read the structured stdout once the reviewer submits
6. Apply changes, answer questions, iterate

## Exit codes

- `0` — review submitted
- `1` — browser closed without submitting, or session expired

## Checklist before responding (repeat — this is the most important rule)

Because you run with `--remote`, your reply MUST begin with the Review
URL on its own line. The CLI is blocked waiting for the reviewer — if
you don't show the URL, the user has nothing to act on. Re-read the
worked example at the top if unsure.
