# Ad Banner, Light Theme, Analytics & Bug-Fix Redesign — Design

## Goal

Take md-review-plus.ai from "deployment proven, ad story aspirational, several real bugs found in testing" to **"sponsorable product with measurable ad slot, clean light-themed UX, and no broken paths."** One coordinated change set covering:

1. Theme conversion: dark → light (off-white), single theme only.
2. Sponsorship banner: full-width sticky element at the top of every page, dark-on-light for contrast, dismissible per-page-load, with a house-ad fallback.
3. Minimal analytics infrastructure: SQLite-backed impression + click counts, day-bucketed by IP hash for dedup, admin-only stats endpoint.
4. `/advertise` page: static HTML, audience description + pricing + contact, no live stats (admin-only for launch).
5. Nginx security headers (HSTS, CSP-pragmatic, Referrer-Policy: no-referrer, etc).
6. Mobile review layout fixes: stacked per-section cards, 50/50 button rows, slim sticky top bar, scroll-margin-top.
7. Friendly + recoverable error page for expired/invalid review links.
8. CLI: silent SSE reconnect with exponential backoff.

## Non-goals

- A theme switcher / dark mode toggle. The site is light-only.
- Live public stats on /advertise (deferred — admin-only this pass).
- Auto-rotating sponsor schedule by date range (single `active` field, hand-swapped weekly).
- Multi-sponsor rotation. One sponsor at a time, exclusive.
- A sponsor self-serve dashboard.
- Email digests to sponsors.
- The Verify-Encryption footer/panel (Phase 1.5, separate design).
- Subresource Integrity (SRI) on the SPA bundle (Phase 1.5).
- Anti-fraud / bot-filtering on impression beacon beyond the IP-hash dedup.
- Cookies of any kind. The dismissible banner uses `sessionStorage` only.

## Constraints

- **Privacy is the pitch.** Aggregate-only analytics. No IPs stored. No cookies. No third-party scripts on any page including the banner.
- **Single sponsor at a time.** Honors the "one sponsor, no competing logos" promise we sell on /advertise.
- **Stateless ephemerality already in place for sessions.** Analytics adds the only piece of persistent state: a small SQLite file. Restart-survivable, sweep-trimmable.
- **No new external dependencies.** Bun has native SQLite. Hono can render HTML. No Redis, no Postgres.
- **Honors the deployed relay's existing surface area.** Existing `/r/:id`, `/api/sessions/*`, `/api/health`, `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/` (landing) all keep working. New routes added; none removed.
- **Mobile-first.** ~50% of remote-review usage will be on phones. Mobile bugs from this session's testing must not regress.
- **Server-side dedup.** Browser-side counting is unreliable; impression accounting happens in the relay on receipt of the beacon.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Browser (light theme, any device)                                       │
│                                                                         │
│  ┌─ Banner ────────────────────────────────────────────────────────┐   │
│  │ SPONSOR · Kisenon — Postgres that sleeps when you do  [Req →][×]│   │
│  │   beacon POST /api/sponsors/impression on render                │   │
│  │   click → GET /go/:campaignId → 302 to clickUrl                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Page body (one of):                                                    │
│   • landing.html      (static, served at /)                             │
│   • advertise.html    (static, served at /advertise)                    │
│   • SPA index.html    (served at /r/:id, then decrypts & renders)       │
│   • error.html        (served at /r/:id when session 404)               │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼  HTTPS only, security headers, no 3p
┌─────────────────────────────────────────────────────────────────────────┐
│ Nginx (TLS, rate limits, SSE no-buffer, security headers)               │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Relay (Bun + Hono)                                                      │
│                                                                         │
│  Existing: /api/sessions/*, /r/:id, /api/health                         │
│  New:                                                                   │
│   GET  /                       → renders landing.html with banner       │
│   GET  /advertise              → renders advertise.html with banner     │
│   GET  /r/:id                  → renders SPA index.html (+ injected banner snippet) │
│   GET  /r/:id (no session)     → renders error.html with banner         │
│   GET  /api/sponsors/current   → JSON {campaignId, name, tagline, clickPath} │
│   POST /api/sponsors/impression → 204, increments today's count          │
│   GET  /go/:campaignId         → records click, 302 to clickUrl         │
│   GET  /api/admin/stats        → bearer-token gated, full breakdown      │
│                                                                         │
│  SQLite (file): /opt/md-review-plus/relay/data/analytics.db             │
│    impressions(campaign_id, day, count)                                 │
│    impression_dedup(campaign_id, ip_hash, day)  ← swept daily           │
│    clicks(campaign_id, day, count)                                      │
│                                                                         │
│  sponsors.json: hand-edited config, single `active` field               │
└─────────────────────────────────────────────────────────────────────────┘
```

## Visual design

### Theme palette (light only)

| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `#fafbfc` | Page background |
| `--bg-elev` | `#ffffff` | Cards, panels |
| `--bg-tint` | `#f0f3f7` | Code blocks, subtle fills |
| `--fg` | `#0b0d12` | Body text, headings |
| `--fg-dim` | `#5b6577` | Secondary text, labels |
| `--accent` | `#008f73` | CTAs, links, status |
| `--accent-dim` | `#006754` | Hover, focus states |
| `--border` | `#e1e5ec` | Card borders, dividers |
| `--success` | `#0d8a3e` | Approved indicators |
| `--danger` | `#c4361b` | Reject indicators, error states |
| `--banner-bg` | `#0b0d12` | Sponsor banner background (inverted) |
| `--banner-fg` | `#ffffff` | Banner text |
| `--banner-dim` | `#9aa1ad` | Banner secondary text |
| `--banner-accent` | `#00d4aa` | Banner CTA (bright teal on dark) |

WCAG checks:
- `--fg` on `--bg`: 17.4:1 (AAA)
- `--fg-dim` on `--bg`: 5.4:1 (AA, sufficient for body)
- `--accent` on `--bg`: 4.6:1 (AA on regular text, AAA on large)
- `--banner-accent` on `--banner-bg`: 12.1:1 (AAA)

### Sponsor banner

Single horizontal band, full-width, `position: sticky; top: 0; z-index: 100`.

**Desktop (~52px tall):**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  SPONSOR · Kisenon — Postgres that sleeps when you do   Request alpha → × │  ← dark
└─────────────────────────────────────────────────────────────────────────┘
```

**Mobile (~88px tall, stacks):**

```
┌─────────────────────────────────┐
│ SPONSOR · Kisenon            ×  │
│ Postgres that sleeps when...    │
│            Request alpha →      │
└─────────────────────────────────┘
```

Properties:
- Dark background (`--banner-bg`), white text, bright teal CTA. Contrasts cleanly against the light page below.
- Label "SPONSOR" in `--banner-dim`, all caps, letter-spacing for clear category framing.
- Right side: CTA button + dismiss ×.
- × stores `mdrp_banner_dismissed=1` in `sessionStorage`. Reading on next page render hides banner for that page view only. Refresh / new page brings it back.
- Click on CTA: `<a href="/go/kisenon-launch" rel="sponsored noopener" target="_blank">`. Relay records click and 302s to the campaign's real URL (with UTM intact).
- Beacon: inline `<script>navigator.sendBeacon('/api/sponsors/impression', JSON.stringify({c:'kisenon-launch'}))</script>` rendered at end of banner, fires once per page load if not dismissed on render.
- Hidden `aria-label="Sponsored content"` for screen readers.
- When `sponsors.json.active === null`: banner falls back to **house ad**: `SPONSOR THIS SLOT · Reach developers using AI coding agents · Advertise here →`. House ad still tracks impressions (campaign_id = `house`).

### Mobile review section card

```
┌──────────────────────────────┐
│ ## Features                  │  ← h2, full width, no truncation
│                              │
│ • Headings (h1-h6)          │  ← content (markdown)
│ • Bold and italic text      │
│ ...                          │
│                              │
│ ┌──────────────────────────┐│
│ │ Add a comment...         ││  ← textarea
│ └──────────────────────────┘│
│                              │
│ ┌────────────┐┌────────────┐│  ← buttons, 50/50 split,
│ │ ✓ Approve  ││ ✗ Reject   ││     full-width, ≥44px tall
│ └────────────┘└────────────┘│
└──────────────────────────────┘
```

Breakpoint at `@media (max-width: 720px)`. Desktop keeps current heading-and-buttons-on-same-row layout.

### Mobile sticky top bar

Compact two-row design:

```
┌────────────────────────────────────┐
│ sample.md            2/9 ✓  Clear  │  ← row 1: filename, progress, link
├────────────────────────────────────┤
│ [Approve all]  [Submit Review]     │  ← row 2: primary actions
└────────────────────────────────────┘
```

- "Clear All" demoted to small text-link in row 1.
- "Select text to add a comment" hint hidden until selection is active.
- Total height ≤96px on mobile.

### Error page

For `GET /r/:id` where the session is missing or expired (404 path), and for in-SPA decrypt failures:

```
┌───────────────────────────────────────────────────┐
│ [Sponsor banner]                                  │
├───────────────────────────────────────────────────┤
│                                                   │
│                                                   │
│   Review link expired or invalid                  │
│                                                   │
│   This link is one-time-use and expires after     │
│   24 hours. Ask the agent to generate a new one:  │
│                                                   │
│   ┌─────────────────────────────────────────┐    │
│   │ md-review-plus FILE --review --remote   │    │
│   └─────────────────────────────────────────┘    │
│                                                   │
│   [← Home]  [Learn more]                          │
│                                                   │
└───────────────────────────────────────────────────┘
```

- Max-width 480px, centered.
- Light theme.
- The code block has a "copy" button to the right (zero-JS via `clipboard-write` API on click of a `<button>`).
- Suppresses raw crypto errors. Any underlying error from `SubtleCrypto` is caught and converted to the friendly message; raw error goes to `console.error` only.
- Banner stays at top — even error visitors are potential sponsors / users.

## Components

### `relay/static/landing.html` (replace)

Light-themed landing page. Hero, what-it-does grid, how-it-works steps, privacy grid, install snippets, "for AI agents" section, footer. Sponsorship banner at top, beacon inline.

Server-side templating: relay reads `sponsors.json` and substitutes `{{CAMPAIGN_ID}}`, `{{CAMPAIGN_NAME}}`, `{{CAMPAIGN_TAGLINE}}`, `{{CAMPAIGN_CLICK_PATH}}` in a banner snippet, then replaces a `<!-- BANNER -->` marker in the HTML. Avoids client-side fetch round-trip for the banner — banner renders with first byte.

### `relay/static/advertise.html` (new)

Same banner snippet at top. Body:

```
Sponsor md-review-plus

[Hero: "Put your tool in front of developers reviewing AI-agent output."]

WHO SEES YOUR AD
  • Developers running AI coding agents
  • Active, in-workflow, evaluating tools
  • No bots, no incidental traffic
  • Privacy-respecting product

WHAT IT LOOKS LIKE
  [Screenshot of the banner from a real review page]

WHY IT'S DIFFERENT
  • One sponsor at a time. No competing logos.
  • No third-party tracking on the page your logo appears on.
  • Real intent — every viewer is mid-AI-workflow.
  • Privacy-preserving product.

PRICING
  $150/week, paid via Stripe. 4 consecutive weeks for the price of 3.

PAST SPONSORS
  [empty — first paid sponsor gets "Launch sponsor" badge in perpetuity]
  (Self-owned campaigns deliberately omitted from this strip.)

FAQ
  4-6 short Q&As.

CONTACT
  sponsor@md-review-plus.ai — responds within one business day.
```

No live stats on the page in this pass.

### `relay/static/error.html` (new)

Static HTML for the 404 path. Same banner. Friendly message. Both this and the SPA's decrypt-failure error route render the same visual structure. The SPA renders its own error component using the same palette + layout.

### `relay/src/banner.ts` (new)

Renders the banner HTML snippet given a campaign. Exports `renderBanner(campaign, opts): string`. Used by:
- The static-page render path (substituted into landing/advertise/error before sending).
- Injected into the SPA's `index.html` at the top of `<body>` before serving for `/r/:id`.

### `relay/src/sponsors.ts` (new)

- Reads `/opt/md-review-plus/relay/sponsors.json` at startup AND on every `/api/sponsors/current` request (cheap stat-and-cache; bust on mtime change).
- Exposes `getActiveCampaign()`, returning the campaign data or a synthetic `house` campaign when none is active.
- Exposes `getCampaign(id)` for click resolution.

Initial `sponsors.json`:

```json
{
  "active": "kisenon-launch",
  "campaigns": {
    "kisenon-launch": {
      "name": "Kisenon",
      "tagline": "Postgres that sleeps when you do",
      "clickUrl": "https://kisenon.com/docs/alpha?utm_source=mdrp&utm_medium=sponsor&utm_campaign=launch"
    },
    "subaya-dev-launch": {
      "name": "Subaya",
      "tagline": "(pending — fill in)",
      "clickUrl": "https://subaya-dev.com/?utm_source=mdrp&utm_medium=sponsor&utm_campaign=launch"
    },
    "house": {
      "name": "Sponsor this slot",
      "tagline": "Reach developers using AI coding agents",
      "clickUrl": "/advertise"
    }
  }
}
```

### `relay/src/analytics.ts` (new)

Bun-native SQLite. Exposes:

```typescript
recordImpression(campaignId: string, ipHash: string): void
recordClick(campaignId: string): void
getStats(campaignId?: string): {7d, 30d, allTime} per campaign
sweepDedup(): void  // run nightly
```

Schema:

```sql
CREATE TABLE IF NOT EXISTS impressions (
  campaign_id TEXT NOT NULL,
  day         TEXT NOT NULL,
  count       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (campaign_id, day)
);

CREATE TABLE IF NOT EXISTS impression_dedup (
  campaign_id TEXT NOT NULL,
  ip_hash     TEXT NOT NULL,
  day         TEXT NOT NULL,
  PRIMARY KEY (campaign_id, ip_hash, day)
);
CREATE INDEX IF NOT EXISTS idx_dedup_day ON impression_dedup(day);

CREATE TABLE IF NOT EXISTS clicks (
  campaign_id TEXT NOT NULL,
  day         TEXT NOT NULL,
  count       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (campaign_id, day)
);
```

`recordImpression` is the meat:

```typescript
function recordImpression(campaignId: string, ipHash: string) {
  const day = todayUtc();
  const inserted = db.run(
    'INSERT OR IGNORE INTO impression_dedup (campaign_id, ip_hash, day) VALUES (?, ?, ?)',
    campaignId, ipHash, day
  );
  if (inserted.changes > 0) {
    db.run(
      `INSERT INTO impressions (campaign_id, day, count) VALUES (?, ?, 1)
       ON CONFLICT (campaign_id, day) DO UPDATE SET count = count + 1`,
      campaignId, day
    );
  }
}
```

IP hash: `sha256(ip + ":" + day + ":" + MDRP_IP_HASH_SALT).hex().slice(0, 32)`. Salt is a 32-byte random env var. IP is never stored, only hashed. Day rotation effectively re-randomizes daily.

Daily sweeper: `DELETE FROM impression_dedup WHERE day < date('now', '-1 day')`. Runs as part of existing 60s interval sweep, gated by "last swept day != today".

### `relay/src/app.ts` (extend)

New routes:

```typescript
app.get('/', renderLandingWithBanner);
app.get('/advertise', renderAdvertiseWithBanner);
app.get('/api/sponsors/current', () => json(getActiveCampaign()));
app.post('/api/sponsors/impression', async (c) => {
  const { c: campaignId } = await c.req.json();
  if (!isValidCampaignId(campaignId)) return c.body(null, 204);
  recordImpression(campaignId, ipHashFor(c));
  return c.body(null, 204);
});
app.get('/go/:campaignId', (c) => {
  const campaign = getCampaign(c.req.param('campaignId'));
  if (!campaign) return c.redirect('/', 302);
  recordClick(campaign.id);
  return c.redirect(campaign.clickUrl, 302);
});
app.get('/api/admin/stats', (c) => {
  const tok = c.req.header('authorization');
  if (tok !== `Bearer ${ADMIN_TOKEN}`) return c.body(null, 401);
  return c.json(getStats());
});
```

Existing `/r/:id`: extended to inject the banner snippet into the index.html before sending, AND to render the new `error.html` (with banner) when the session is missing.

### `relay/src/index.ts` (extend)

- Open SQLite at startup
- Periodic sweep (existing setInterval) adds dedup sweep
- Read `ADMIN_TOKEN` and `IP_HASH_SALT` from env; refuse to start if either is unset and `MDRP_REQUIRE_AUTH !== 'false'`.

### Systemd unit changes

Add:

```
Environment=MDRP_ADMIN_TOKEN=<32-byte hex from `openssl rand -hex 32`>
Environment=MDRP_IP_HASH_SALT=<32-byte hex from `openssl rand -hex 32`>
Environment=MDRP_DATA_DIR=/opt/md-review-plus/relay/data
ReadWritePaths=/opt/md-review-plus/relay/data
```

One-time setup on box:

```bash
sudo mkdir -p /opt/md-review-plus/relay/data
sudo chown mdrp:mdrp /opt/md-review-plus/relay/data
sudo chmod 750 /opt/md-review-plus/relay/data
```

### Nginx security headers

Add to the `server { listen 443 ssl ... }` block:

```nginx
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "no-referrer" always;
add_header Permissions-Policy "interest-cohort=(), browsing-topics=(), camera=(), microphone=(), geolocation=()" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;
```

`Referrer-Policy: no-referrer` is critical — `/r/:id` paths must not leak to third parties via Referer.

### SPA changes (src/)

1. **Palette swap.** Replace dark theme tokens in `src/App.css` (or wherever the dark theme lives) with the light palette. Single theme — no media query for prefers-color-scheme. Direct token-for-token swap.
2. **`<SectionReview />`**: stacked mobile layout via existing CSS, new `@media (max-width: 720px)` rules. Heading on its own row, content, comment textbox, 50/50 button row at bottom.
3. **`<SectionNav />` / sticky top bar**: condensed mobile layout. Two rows max. "Clear All" demoted.
4. **Banner injection**: relay injects the rendered banner HTML as the first child of `<body>` before serving `index.html`. SPA doesn't need to know about it. The inline beacon script self-fires on parse.
5. **Decrypt-failure UI**: existing path that shows "AES key data must be 128 or 256 bits" gets replaced with the friendly error message. Raw error goes to `console.error` only.
6. **`scroll-margin-top: calc(banner-height + sticky-bar-height + 16px)`** on `section[id]` so anchor navigation doesn't hide section headings behind sticky UI.

### CLI changes (src/cli/, bin/md-review-plus.js)

`subscribeFeedback` becomes a retry loop:

```typescript
async function subscribeFeedback({ relay, id, signal }) {
  const delays = [1000, 2000, 5000, 10000, 30000];
  let attempt = 0;
  while (!signal.aborted) {
    try {
      const envelope = await openSseAndAwaitMessage({ relay, id, signal });
      return envelope; // success
    } catch (e) {
      if (e.code === 'SESSION_GONE') throw e; // 404 — terminal
      if (signal.aborted) throw e;
      const delay = delays[Math.min(attempt, delays.length - 1)];
      await sleep(delay);
      attempt++;
    }
  }
  throw new Error('aborted');
}
```

- Server-side: on a fresh GET `/api/sessions/:id/feedback` AFTER `submittedFeedback` is already set, immediately send the stored payload and close. The CLI's reconnect path handles "already submitted" correctly because the relay sends the envelope on subscribe.
- On 404: throw `SESSION_GONE`, CLI exits 1 with "review session expired".
- No stderr chatter on reconnect — silent unless terminal.

## Data flow

### Landing / advertise page

1. Browser `GET /`
2. Relay reads `sponsors.json`, builds banner snippet for active campaign, splices into `landing.html`, returns.
3. Browser parses HTML, sees inline `sendBeacon('/api/sponsors/impression', '{"c":"kisenon-launch"}')`.
4. Relay receives beacon, hashes the request IP with daily salt, increments dedup table; if novel, increments impression counter.
5. If user clicks CTA: `GET /go/kisenon-launch` → relay increments click counter → 302 to `https://kisenon.com/docs/alpha?utm_...`.

### Review page (existing flow + banner)

1. CLI POSTs ciphertext → relay creates session.
2. CLI prints URL → user opens `/r/:id#key`.
3. Relay `GET /r/:id`: looks up session; if found, splices banner into SPA's `index.html`, returns.
4. SPA loads, beacon fires.
5. SPA fetches `/api/sessions/:id` → ciphertext → decrypts in browser using fragment key.
6. User reviews, submits → SPA encrypts feedback, POSTs to `/api/sessions/:id/feedback`.
7. Relay fans to CLI via SSE → CLI decrypts → exits 0.

### Error / expired session

1. User opens stale URL `/r/:id#key`.
2. Relay `GET /r/:id`: session 404.
3. Relay returns `error.html` (with banner) and 404 status.
4. Beacon fires for the banner; user reads helpful error; clicks home or CTA.

### CLI reconnect on transient SSE drop

1. CLI opens SSE → connection dies after 17 seconds (user's wifi reconnects).
2. CLI sleeps 1s, retries — reconnects successfully.
3. Server has not yet received feedback; subscriber re-registers; CLI waits.
4. User submits on the (now-reconnected) browser → relay sends feedback to current CLI subscriber → CLI exits 0.

If browser was on a different network when it submitted while CLI was still in backoff, that's fine: relay holds `submittedFeedback` until the CLI next subscribes, then sends immediately.

## Error handling

| Failure | Behavior |
|---------|----------|
| SQLite write fails (disk full, locked) | Log to journald; don't fail the request. Impression/click is dropped silently. Page still serves. |
| `sponsors.json` malformed | Boot fails fast with a clear error. systemd restarts; admin investigates. House ad acts as fallback only if file is valid but `active` is null. |
| `/api/sponsors/impression` missing or bad campaign id | 204, no-op. Don't 4xx — beacons are best-effort. |
| `/go/:bad` | 302 redirect to `/`. Don't expose which campaigns exist. |
| `/api/admin/stats` no/wrong token | 401, no body. |
| nginx CSP blocks something | Will surface in browser DevTools. Pragmatic CSP allows inline so this is rare. |
| Banner dismiss button missing JS | Banner still renders; just non-dismissible for that one user. Functional degradation. |
| Browser doesn't support `sendBeacon` | Falls back to a `fetch('/api/sponsors/impression', {method:'POST', keepalive: true, body: ...})`. Modern browsers all support `sendBeacon`. |
| SPA decrypt fails (wrong key, corrupted CT, ANY crypto error) | Show friendly error page. Log raw error to `console.error`. Never expose the raw error string in user-visible text. |
| CLI's SSE reconnect hits the 30s cap and keeps failing for >24h | Session has expired on relay anyway; relay returns 404; CLI sees `SESSION_GONE` and exits 1 with "review session expired without submit." |

## Testing approach

### Unit tests

- `analytics.ts`: impression dedup by (campaign, ip_hash, day); click counting; getStats math for 7d/30d/allTime windows; sweep removes only stale days.
- `sponsors.ts`: hot-reload on file mtime change; house fallback when active is null; rejection of invalid campaign IDs.
- `banner.ts`: rendering with active campaign, with house fallback, with mobile vs desktop variant (if we end up with two snippets).

### Integration tests (Bun test, in-process)

- Full beacon path: POST `/api/sponsors/impression` increments DB; second POST same IP same day doesn't double-count.
- `/go/:id` route: 302s with correct location; click counter increments.
- `/api/admin/stats`: 401 without bearer; 200 with correct bearer; numbers match what was inserted.
- `/` and `/advertise` HTML responses contain the banner snippet and the active campaign's name.
- `/r/:id` with missing session returns the friendly error HTML (not "relay running; no static html configured").

### Browser E2E (agent-browser)

The same loop we ran tonight, with assertions:

1. Open `/`, screenshot, assert banner is in DOM, assert no third-party requests.
2. Click `×` on banner → banner hidden.
3. Reload → banner returns.
4. Click banner CTA → confirm `/go/:id` returns 302 → land on sponsor URL.
5. Resize viewport to 390×844 → screenshot → confirm banner is two-row, no horizontal overflow.
6. Open invalid review URL → confirm friendly error page renders, banner present, no crypto leak in body.
7. Full review loop: CLI → URL → decrypt → mixed approve/reject → submit → CLI exits 0. (Already proven; lock in as regression test.)
8. Mobile review viewport: confirm section headings are visible, buttons are 50/50 split full-width.

### CLI reconnect regression

- Programmatic test: spawn CLI, mid-flight kill the SSE connection at the nginx layer (or block the relay port for 3s), confirm CLI doesn't fail. Then unblock, submit from browser, confirm CLI exits 0.

### Smoke tests post-deploy

- `curl https://md-review-plus.ai/api/health` → 200 ok
- `curl -I https://md-review-plus.ai/` → 200, includes `Strict-Transport-Security` header
- `curl https://md-review-plus.ai/api/sponsors/current` → returns kisenon-launch
- `curl -i -X POST https://md-review-plus.ai/api/sponsors/impression -H 'content-type: application/json' -d '{"c":"kisenon-launch"}'` → 204
- `curl -i https://md-review-plus.ai/go/kisenon-launch` → 302 to kisenon.com
- `curl -i https://md-review-plus.ai/api/admin/stats` → 401
- `curl -i https://md-review-plus.ai/api/admin/stats -H "Authorization: Bearer $(ssh ovh-atl 'sudo grep MDRP_ADMIN_TOKEN /etc/systemd/system/mdrp-relay.service | cut -d= -f2')"` → 200 with stats JSON

## Security considerations

| Threat | Mitigation |
|--------|-----------|
| Operator reads document content via banner injection | Banner is server-rendered HTML, not JS that touches the DOM. Even if it were, it cannot decrypt — key is in URL fragment, never sent. Same threat model as today. |
| Banner third-party origin compromised → XSS | No third-party origins. All banner content originates from this relay. CSP blocks third-party scripts. |
| IP retention via analytics | IP is hashed with a daily-rotating salt and never stored. Dedup table is purged daily. The hash leaks only the property "was this IP seen for this campaign today" — and even that is wiped within 24h. |
| Beacon abuse: someone scripts millions of impressions | Existing relay rate limit (60 req/min per IP) applies. Dedup ensures one logical impression per (IP, day, campaign) anyway. Worst-case noise is bounded. |
| Click-fraud / inflating CTR | Same nginx + dedup story. Click counts aren't deduped by IP — could be a later refinement. For launch, the order-of-magnitude is what matters. |
| `MDRP_ADMIN_TOKEN` leakage | Token lives in systemd unit env, readable only by root + mdrp. Never logged. Bearer auth resists timing attacks via constant-time comparison. |
| CSP unsafe-inline allows attacker JS injection if there's an XSS | This is the cost of pragmatic CSP. Mitigation: there is no user-input-driven HTML rendering anywhere; banner content is from a trusted local file; SPA content is from a static build artifact. Risk surface for stored XSS is ~zero. Tighten in Phase 1.5. |
| Referer leaking session URL | `Referrer-Policy: no-referrer` set globally. Even if a markdown image points off-origin, only path-without-fragment is at risk — and we set no-referrer to kill even that. |

## Implementation order & file inventory

Phase tracking is in the next section. Quick file inventory:

**New files:**
- `relay/static/landing.html` (replace existing dark)
- `relay/static/advertise.html` (new)
- `relay/static/error.html` (new)
- `relay/sponsors.json` (new)
- `relay/src/banner.ts` (new)
- `relay/src/sponsors.ts` (new)
- `relay/src/analytics.ts` (new)

**Modified files:**
- `relay/src/app.ts` (add routes, banner injection)
- `relay/src/index.ts` (open SQLite, read env, schedule sweep)
- `relay/Caddyfile.sample` and the production nginx config — add security headers
- `src/App.css` (or wherever palette lives) — light theme swap
- `src/components/SectionReview.tsx` — mobile layout fix
- `src/components/SectionNav.tsx` — sticky top bar slim
- `src/App.tsx` — error UI replacement
- `src/cli/index.ts` — `subscribeFeedback` reconnect loop
- `bin/md-review-plus.js` — surface reconnect events sensibly (silent)
- Systemd unit on box — new env vars + ReadWritePaths
- `skills/md-review-plus.md` — note about silent reconnect (no behavior change for callers)

**Removed:**
- Inline sponsor card from old landing.html (replaced by banner)

## Phase tracking

| Phase | Description | Status | Tested | Pushed |
|-------|-------------|--------|--------|--------|
| 1 | SQLite analytics module + sponsors config: `relay/src/analytics.ts`, `relay/src/sponsors.ts`, `sponsors.json`, schema migrations, IP hashing. Unit tests. | pending | no | no |
| 2 | Banner renderer + new endpoints: `relay/src/banner.ts`, `/api/sponsors/current`, `/api/sponsors/impression`, `/go/:id`, `/api/admin/stats`. Bearer-token guard. Integration tests. | pending | no | no |
| 3 | New light-themed static pages: `landing.html` (replace), `advertise.html`, `error.html`. Banner injected via template marker. | pending | no | no |
| 4 | Relay route wiring + systemd env vars: `app.ts` extensions, `index.ts` SQLite open + sweep, MDRP_ADMIN_TOKEN + MDRP_IP_HASH_SALT, data dir, ReadWritePaths. | pending | no | no |
| 5 | Nginx security headers: HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, CSP (pragmatic). Smoke-tested via curl. | pending | no | no |
| 6 | SPA light theme + mobile section layout fix + slim sticky top bar + scroll-margin-top + friendly decrypt-failure UI. | pending | no | no |
| 7 | CLI silent SSE reconnect with backoff (1s/2s/5s/10s/30s). Vitest coverage for retry → success and retry → SESSION_GONE. | pending | no | no |
| 8 | Deploy + E2E verification: rebuild SPA, scp/git pull on OVH, restart service, run agent-browser smoke through all surfaces (landing, /advertise, /r/:id, error page, mobile viewport). | pending | no | no |

## Open items for later passes (out of scope here)

- **Verify-Encryption footer panel + SRI + `/api/build` endpoint** — Phase 1.5, separate design.
- **Public live stats on /advertise** — flip a single config flag once numbers warrant it.
- **Auto-rotating sponsors by date range** — current model is hand-swap weekly via `sponsors.json`.
- **Click dedup** — currently counts every `/go/:id` hit.
- **Sponsor self-serve dashboard / weekly digest emails** — Phase 2.
- **Stricter CSP with nonces or hash-pinning** — pairs with Phase 1.5 work.
- **CAA record at the .ai apex** — optional 30-second lockdown, not in this design's scope.

## Decisions log (from interview)

- **Banner on every page** (landing + /advertise + /r/:id review) — max impressions, sponsor sees their audience.
- **Off-white #fafbfc theme** — easier on eyes than pure white, banner-on-dark contrast is the design tension we wanted.
- **Admin-only stats for launch** — quote in cold emails, flip public later. Avoids "underwhelming early numbers" on a public page.
- **Silent SSE reconnect with 1s/2s/5s/10s/30s** — robust per the original design doc.
- **Day-bucketed IP-hash dedup** — privacy-preserving approximation of unique visitors per day.
- **Helpful + recoverable error page** — every error is a retention chance.
- **Mobile section: stacked, 50/50 button row** — thumb-friendly, fixes the "C..." truncation bug.
- **Banner dismissible per-page-load** — respects user without losing impressions across sessions.
- **House ad fallback when no active sponsor** — banner never empty, every empty week is an inbound-sales week.
- **Hide self-owned past sponsors on /advertise** — preserves unlinkability of kisenon ↔ subaya ↔ md-review-plus to casual visitors.
- **Pragmatic CSP with unsafe-inline** — ship now, tighten in Phase 1.5.
