# Remote Review Relay — Design

## Goal

Make `md-review-plus --review` work in every scenario where Claude Code runs but the user's browser cannot reach `localhost`:

- CC over SSH (server-side terminal, laptop is the review device)
- CC cloud / remote runtime (no inbound networking, no shell)
- Claude Desktop / CC mobile (phone is the only device)
- Headless CI / autonomous runs (review happens later, possibly from a different device)

The local `--review` flow stays as-is for the common case. A new `--remote` flag opts in to a relay-mediated review that requires only outbound HTTPS from the CC machine and a clickable URL on the reviewer's device.

## Non-goals

- Replacing local review. Local stays the default; it's faster, simpler, and never uploads.
- Persistent collaboration / multi-reviewer / threaded comments. One-shot review per session, same semantics as today.
- Hot reload of the document during a remote review. Each `--review --remote` invocation is an immutable snapshot.
- Real-time presence ("user is typing"). Out of scope.
- Building accounts, billing, or a dashboard. Anonymous sessions only.

## Constraints

- **Privacy:** documents may contain proprietary code, specs, customer data. The relay operator (initially the project author, self-hosting at home) must be technically unable to read plaintext. **End-to-end encryption is non-negotiable.**
- **Reachability:** the only reliable assumption is that the CC machine can make outbound HTTPS requests and the reviewer's device can load HTTPS URLs. Anything else (inbound ports, installed binaries, port-forwarding) fails in at least one target scenario.
- **Zero-config UX:** `md-review-plus spec.md --review --remote` must work out of the box. No signup, no API key, no env vars required for the default case.
- **Operator burden:** relay must run as a single small container with no external dependencies (no DB, no Redis, no email provider). In-memory state. Lift-and-shift to AWS/OVH later without code changes.
- **Cost:** has to be cheap to run on a home box behind a residential connection. E2E + ephemeral storage keeps the operator's compliance/liability surface near zero.

## Architecture

```
┌──────────────────────┐         POST /api/sessions          ┌─────────────────────┐
│ md-review-plus CLI   │ ──────── ciphertext + meta ───────► │  Relay (Hono/Bun)   │
│ (on CC machine)      │ ◄──────── { id, urls }   ───────── │  In-memory only     │
│                      │                                     │  24h TTL            │
│  1. read file        │         GET  /r/:id (HTML)          │                     │
│  2. AES-GCM encrypt  │ ◄────── React app served ────────── │                     │
│  3. POST ciphertext  │                                     │                     │
│  4. print URL        │         GET  /api/sessions/:id      │                     │
│  5. SSE → block      │ ◄────── ciphertext blob ─────────── │                     │
│                      │                                     │                     │
│                      │         GET  /api/sessions/:id/     │                     │
│                      │              feedback (SSE)         │                     │
│  CLI ◄══════════════ │ ◄────── feedback ciphertext ─────── │                     │
│                                                            │                     │
│                                  ▲                         │                     │
│                                  │ POST /api/sessions/:id/ │                     │
│                                  │ feedback (ciphertext)   │                     │
│                                  │                         │                     │
│  ┌───────────────────────────────┴──────┐                  │                     │
│  │ Browser (any device)                 │                  │                     │
│  │ URL: relay/r/:id#<base64-key>        │                  │                     │
│  │  - fragment key never sent to relay  │                  │                     │
│  │  - decrypts ciphertext client-side   │                  │                     │
│  │  - renders existing React UI         │                  │                     │
│  │  - encrypts feedback before POST     │                  │                     │
└──┴──────────────────────────────────────┘                  └─────────────────────┘
```

### Three deliverables

1. **CLI changes** (this repo, `bin/`, `server/`, new `crypto/` helpers): add `--remote` mode that encrypts, uploads, prints a URL, and blocks on SSE.
2. **Relay service** (new sibling repo `md-review-plus-relay` or `relay/` subdir): Hono+Bun server, Docker image, in-memory session store, rate limits.
3. **Web client** (this repo, `src/`): the existing React app, hardened for (a) loading content over HTTPS instead of `/api/markdown`, (b) decrypting/encrypting in-browser via `SubtleCrypto`, (c) mobile viewports.

## Components

### CLI (`bin/md-review-plus.js` + new `src/cli/remote.ts`)

New flag: `--remote` (boolean). Implies `--review`. Mutually exclusive with `--port` (no local server is started). Requires a markdown file argument.

New env vars:
- `MDRP_RELAY` — override the relay base URL. Default: `https://relay.mdrp.dev` (placeholder; real domain TBD).
- `MDRP_RELAY` also accepts `http://` for local dev / self-hosted relays without TLS.

Flow:

```
1. validate file, read into memory
2. generate 256-bit AES-GCM key (crypto.randomBytes(32))
3. generate 96-bit IV
4. ciphertext = AES-GCM-encrypt(file_bytes, key, iv, aad="md-v1")
5. payload = { v: 1, iv: base64(iv), ct: base64(ciphertext), filename }
6. POST {relay}/api/sessions  → { id, expiresAt }
7. urlKey = base64url(key)
8. reviewUrl = `${relay}/r/${id}#${urlKey}`
9. print: "Review URL: <reviewUrl>"     (just the URL, single line)
10. open SSE: GET {relay}/api/sessions/{id}/feedback
        - on message: { iv, ct } → AES-GCM-decrypt → JSON.parse → write feedback to stdout (same format as today)
        - on close-after-message: exit 0
        - on close-without-message (24h elapsed, or relay 404'd): exit 1
        - on SIGINT: DELETE the session, exit 130
```

The CLI never starts a local HTTP server in remote mode. No port. No browser-open.

### Relay (`relay/` — new subdirectory)

Stack: Bun runtime, Hono framework (consistent with existing `server/index.ts`), zero external services. Single container.

Storage: in-memory `Map<sessionId, Session>`. Lost on restart — acceptable for ephemeral sessions; reviewer just gets a fresh session if the CLI's blocking call dies on a 404.

```ts
interface Session {
  id: string;              // 16 random bytes, base64url (128-bit unguessable)
  ciphertext: Uint8Array;  // opaque to relay
  iv: string;              // opaque to relay, just stored
  filename: string;        // for display in browser tab; not sensitive
  createdAt: number;
  expiresAt: number;       // createdAt + 24h
  feedbackSubscribers: SSEClient[];  // CLI(s) waiting for submit
  submittedFeedback?: { iv: string; ct: string };  // set on POST /feedback
}
```

A background interval sweeps expired sessions every 60s.

#### Endpoints

- `POST /api/sessions`
  - Body: `{ v: 1, iv: string, ct: string (base64), filename: string }`
  - Validates: size ≤ 1 MB (post-base64), filename ≤ 256 chars, `v === 1`.
  - Rate-limited per IP: 30 sessions/hour (token bucket, in-memory).
  - Returns: `{ id, expiresAt }`.

- `GET /r/:id` → serves `index.html` (the React app). 404 if session missing/expired.

- `GET /api/sessions/:id` → returns `{ iv, ct, filename, createdAt, expiresAt }`. 404 on miss.

- `GET /api/sessions/:id/feedback` (SSE)
  - If `submittedFeedback` already set: send it immediately, close.
  - Otherwise: subscribe, hold connection open. On submit, push `data: {"iv":"...","ct":"..."}\n\n` and close.
  - Keepalive: comment heartbeat every 25s to defeat intermediary timeouts.

- `POST /api/sessions/:id/feedback`
  - Body: `{ iv: string, ct: string }`. Size ≤ 256 KB.
  - Sets `submittedFeedback`, fans out to subscribers, then deletes the session.
  - Idempotent on the same payload within 5s (handles client retry).

- `DELETE /api/sessions/:id` — explicit cleanup for SIGINT path.

- `GET /api/health` — returns `{ status: "ok", sessions: <count> }`.

#### Limits & abuse posture

- Body size: 1 MB on session create, 256 KB on feedback submit.
- Per-IP rate limit: 30 sessions/hour for create; 60 req/min general.
- Global storage cap: refuse `POST /api/sessions` with `503` if relay holds > N sessions (N tunable; start at 1000).
- No authentication. Random 128-bit session IDs are the bearer token. URL contains the key in the fragment.
- CORS: `Access-Control-Allow-Origin: *` on session APIs (browser fetches from any device). No credentials.

#### Deployment

- Dockerfile in `relay/`. `docker run -p 8080:8080 mdrp-relay`.
- Reverse-proxied by Caddy on the host for TLS + HTTP/2.
- Configuration via env: `MDRP_PORT`, `MDRP_MAX_SESSIONS`, `MDRP_RATE_LIMIT_PER_HOUR`.
- No persistent volumes. No DB migrations. Zero ongoing ops beyond renewing TLS (Caddy automates).

### Web client (`src/`)

The existing React app already renders the section-review UI. Three changes:

1. **Routing.** Detect `/r/:id` in `App.tsx` (in addition to existing CLI / Dev mode detection). When in remote mode, fetch session via `GET /api/sessions/:id`, decrypt using the fragment key, render the same `CliModeApp` with the decrypted markdown.

2. **Crypto.** New `src/crypto/sessionCrypto.ts` using `window.crypto.subtle`:
   - `importKey(base64urlKey) → CryptoKey`
   - `decryptDocument(key, iv, ct) → string`
   - `encryptFeedback(key, feedbackJSON) → { iv, ct }`
   The fragment key is read from `window.location.hash`, then immediately blanked from history (`history.replaceState`) so it doesn't show up in copy-pasted links from the browser address bar after navigation.

3. **Submit path.** `FeedbackOutput`'s submit button currently hits `POST /api/submit`. In remote mode, build the same payload, JSON.stringify, encrypt with the session key, then `POST /api/sessions/:id/feedback` with `{ iv, ct }`. Show a "Submitted, you can close this tab" confirmation.

4. **Mobile hardening** (parallel work):
   - Sidebar (`SectionNav`) collapses to a top sheet on viewports < 768px.
   - Touch targets ≥ 44px (Approve/Reject buttons).
   - Selection-to-comment popover must work with mobile selection handles (tested on iOS Safari + Android Chrome).
   - Sticky top bar stays usable with narrow viewport.
   - Disable Mermaid diagram zoom-pinch conflicts.

## Data flow (end to end)

1. CC invokes `md-review-plus spec.md --review --remote`.
2. CLI reads `spec.md`, generates key+IV, encrypts, POSTs to relay → gets `id`.
3. CLI prints `Review URL: https://relay.mdrp.dev/r/abc123#k_eY...` to stdout.
4. CLI opens SSE to `/api/sessions/abc123/feedback` and blocks.
5. CC (or its skill) surfaces the URL to the user via whatever channel CC is using (terminal, Claude Desktop chat, etc.).
6. User taps/clicks URL on any device → browser loads `/r/abc123`.
7. Relay serves the React app HTML.
8. App reads fragment key, fetches ciphertext from `/api/sessions/abc123`, decrypts in-browser.
9. User reviews sections, approves/rejects, adds line comments.
10. User clicks Submit → app encrypts the feedback JSON, POSTs to `/api/sessions/abc123/feedback`.
11. Relay fans out via SSE to the CLI subscriber, deletes the session.
12. CLI receives the ciphertext, decrypts, parses, writes the same structured-feedback markdown to stdout that local mode produces. CLI exits 0.
13. CC parses stdout exactly as it does today.

## Error handling

| Failure | Behavior |
|---------|----------|
| Relay POST `/api/sessions` returns 4xx/5xx or network error | CLI prints error + actionable hint (check `MDRP_RELAY`, network), exits 1. |
| File > 1 MB | CLI refuses before upload, prints size + cap, exits 1. |
| SSE connection drops mid-wait | CLI reconnects with backoff (1s, 2s, 5s, 10s, 30s, capped). Session still on relay — resumable. |
| Session expires (24h) before submit | Relay 404s the SSE. CLI exits 1 with "Review session expired without submit." |
| Browser tab closed before submit | Nothing happens until 24h TTL fires or CLI is killed. No mid-stream signaling — keep it simple. |
| Decrypt fails in browser (wrong key, corrupted) | Show "This review link is invalid or corrupted." No partial render. |
| Decrypt fails in CLI (relay misbehaving) | Print raw error, exit 1. Should never happen with honest relay; if it does, treat as compromise. |
| Two browsers open the URL | Both can review. First submit wins; second's POST returns 410. |
| Relay restarts (memory wipe) | All in-flight sessions are gone. CLI's SSE 404s → exits 1. User re-runs. Acceptable for v1. |

## Testing approach

- **CLI crypto roundtrip** (Vitest): encrypt in Node, decrypt in jsdom with `subtle` polyfill, byte-equal check.
- **Relay unit tests** (Bun test): session create / get / submit / expire / rate-limit / size-cap, all in-process.
- **Relay integration** (supertest-style against a running Bun instance): full happy path, SSE delivery, idempotent submit, 404 paths.
- **End-to-end** (Playwright): spawn relay locally, spawn CLI with `MDRP_RELAY=http://localhost:8080 --remote`, drive the browser through review + submit, assert CLI stdout matches expected feedback format.
- **Mobile** (manual checklist for v1; Playwright mobile viewports for regressions): iOS Safari, Android Chrome on a real session.
- **Abuse** (manual): hit rate limit, oversized body, malformed JSON, expired session.

## Security review

- Threat: relay operator reads plaintext → mitigated by AES-256-GCM with key in URL fragment (never transmitted).
- Threat: relay operator tampers with ciphertext → AES-GCM is authenticated; tampering causes decrypt failure in CLI / browser. Surfaced as error.
- Threat: random URL guessing → 128-bit session ID, infeasible.
- Threat: TLS-stripping MITM → relay must be HTTPS-only. CLI rejects `http://` for non-localhost relays unless `MDRP_INSECURE=1`.
- Threat: fragment leaks via Referer → fragments are not sent in Referer headers (per RFC). Confirm no `<img>` / link to third-party origins is rendered before decrypt; renderer is the existing react-markdown pipeline which doesn't auto-fetch on render except for `<img src>` — markdown images would leak the URL path (not the fragment) to image hosts. Existing behavior; not worsened.
- Threat: stored XSS in markdown → existing renderer is sanitized; no new surface.
- Threat: history/clipboard exposure of fragment key → `history.replaceState` after read; not a complete mitigation (browser history may still have it), but documented and acceptable for the threat model.
- Threat: relay log retention → operator commitment to **no request body logging**, **no URL query logging** (fragment never sent anyway). Status codes + IP for rate limiting only.

## Open questions (resolved during interview)

- Privacy posture: **E2E encrypted**.
- Hosting: **self-host at home initially**; Docker image designed for portability.
- Transport: **SSE** (long-poll outbound from CLI).
- URL delivery: **just the URL** (clickable in all CC surfaces).
- TTL: **24h, auto-delete on submit**.
- Auth: **anonymous + rate limits + size cap**.
- Relay discovery: **hardcoded default + env override**.
- CLI surface: **explicit `--remote` flag** (no auto-detect).
- Web UI: **reuse existing React app, mobile-harden it**.
- Hot reload in remote mode: **no**.

## Phase tracking

| Phase | Description | Status | Tested | Pushed |
|-------|-------------|--------|--------|--------|
| 1 | Relay service: Hono+Bun skeleton, session model, all 6 endpoints, in-memory store, expiry sweeper. Dockerfile. Unit + integration tests. | pending | no | no |
| 2 | CLI: `--remote` flag, AES-GCM encrypt, POST /api/sessions, SSE subscribe with reconnect, decrypt feedback, structured stdout. Vitest crypto roundtrip. | pending | no | no |
| 3 | Web client: `/r/:id` route, fragment key handling, in-browser decrypt of document, encrypt-and-submit feedback, "submitted" confirmation. | pending | no | no |
| 4 | End-to-end Playwright test: relay + CLI + browser, full review loop produces correct stdout. | pending | no | no |
| 5 | Mobile hardening: responsive `SectionNav`, touch targets, iOS/Android selection-to-comment, sticky toolbar on narrow viewports. | pending | no | no |
| 6 | Abuse hardening: rate limits, size caps, global session cap, structured 4xx errors. | pending | no | no |
| 7 | Deployment: self-host at home behind Caddy, public domain pointed at it, smoke-test from phone / SSH / cloud-CC. Bake default relay URL into next release. | pending | no | no |
| 8 | Skill + README updates: document `--remote` in `skills/md-review-plus.md` so CC knows to use it when local browser-opening will fail; update README with privacy model. | pending | no | no |
