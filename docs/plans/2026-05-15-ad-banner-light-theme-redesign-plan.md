# Ad Banner, Light Theme, Analytics & Bug-Fix Redesign — Implementation Plan

**Goal:** Ship the unified redesign defined in `docs/plans/2026-05-15-ad-banner-light-theme-redesign.md`: light theme, sticky sponsor banner with house-ad fallback, SQLite analytics with IP-hash dedup, /advertise page, nginx security headers, mobile review fixes, friendly error page, and CLI SSE reconnect.

**Architecture:** Pure additive on the relay side — new SQLite-backed analytics module, new sponsors config + banner renderer, new endpoints, three new static pages, plus a banner-injection hook into the existing `/r/:id` route. SPA gets a palette swap (drop dark, light only), mobile-CSS fixes, and a friendly decrypt-error UI. CLI gets a silent-reconnect wrapper around the existing SSE subscriber. Nginx gets one additional config snippet for security headers.

**Tech Stack:** Bun + Hono (relay), `bun:sqlite` (native, no new dep), React 19 + Vite (SPA, tested via Vitest+jsdom), TDD via `bun test` (relay) and Vitest (SPA + CLI), nginx 1.24 (ingress).

## Status

| Task | Description | Status | Tested | Pushed |
|------|-------------|--------|--------|--------|
| 1 | Add `MDRP_ADMIN_TOKEN` + `MDRP_IP_HASH_SALT` + `MDRP_DATA_DIR` to relay config | pending | no | no |
| 2 | Write analytics test: record + retrieve impression | pending | no | no |
| 3 | Create `relay/src/analytics.ts` with `Analytics` class (SQLite, schemas) | pending | no | no |
| 4 | Write analytics test: dedup by ip_hash same day | pending | no | no |
| 5 | Implement dedup in `recordImpression` | pending | no | no |
| 6 | Write analytics test: click counting + getStats rollups (7d/30d/allTime) | pending | no | no |
| 7 | Implement `recordClick` and `getStats` | pending | no | no |
| 8 | Write analytics test: sweepDedup removes only stale days | pending | no | no |
| 9 | Implement `sweepDedup` | pending | no | no |
| 10 | Commit: analytics module | pending | no | no |
| 11 | Create `relay/sponsors.json` with kisenon, subaya, house | pending | no | no |
| 12 | Write sponsors test: loads campaigns, exposes active + house fallback | pending | no | no |
| 13 | Create `relay/src/sponsors.ts` with `Sponsors` loader | pending | no | no |
| 14 | Write banner renderer test: emits HTML with campaign fields + beacon | pending | no | no |
| 15 | Create `relay/src/banner.ts` with `renderBanner()` | pending | no | no |
| 16 | Commit: sponsors + banner renderer | pending | no | no |
| 17 | Write app test: `/api/sponsors/current` returns active campaign metadata | pending | no | no |
| 18 | Wire `/api/sponsors/current` in `app.ts` | pending | no | no |
| 19 | Write app test: `/api/sponsors/impression` records, returns 204 | pending | no | no |
| 20 | Wire `/api/sponsors/impression` in `app.ts` | pending | no | no |
| 21 | Write app test: `/go/:campaignId` 302s + records click; unknown → 302 to / | pending | no | no |
| 22 | Wire `/go/:campaignId` in `app.ts` | pending | no | no |
| 23 | Write app test: `/api/admin/stats` 401 without token, 200 with token | pending | no | no |
| 24 | Wire `/api/admin/stats` in `app.ts` (bearer auth, constant-time compare) | pending | no | no |
| 25 | Commit: new endpoints | pending | no | no |
| 26 | Create `relay/static/landing.html` (light-themed, banner marker) | pending | no | no |
| 27 | Create `relay/static/advertise.html` (light-themed, banner marker) | pending | no | no |
| 28 | Create `relay/static/error.html` (light-themed, banner marker, friendly copy) | pending | no | no |
| 29 | Write app test: `GET /` injects banner snippet into landing.html | pending | no | no |
| 30 | Wire `GET /` and `GET /advertise` in `app.ts` (template substitution) | pending | no | no |
| 31 | Write app test: `GET /r/:id` for missing session returns `error.html` with banner | pending | no | no |
| 32 | Update existing `/r/:id` route: 404 → error.html, found → inject banner into SPA index.html | pending | no | no |
| 33 | Commit: static pages + route wiring | pending | no | no |
| 34 | Update `relay/src/index.ts`: open SQLite, schedule daily dedup sweep, wire Analytics + Sponsors into createApp | pending | no | no |
| 35 | Commit: relay startup wiring | pending | no | no |
| 36 | Generate prod tokens, update systemd unit on OVH (admin token, salt, data dir, ReadWritePaths) | pending | no | no |
| 37 | Update production nginx config: add 6 security headers | pending | no | no |
| 38 | Smoke-test production: headers present, `/`, `/advertise`, `/api/sponsors/current`, `/go/kisenon-launch`, `/api/admin/stats` (401 + 200) | pending | no | no |
| 39 | Commit: deploy notes (Caddyfile.sample, DEPLOY.md, nginx config copy in repo) | pending | no | no |
| 40 | SPA palette: rewrite `src/index.css` `:root` to light tokens, delete `.dark-mode` block, remove ThemeToggle component refs | pending | no | no |
| 41 | Write SectionReview test: at 720px viewport, heading is full width and buttons are below content | pending | no | no |
| 42 | Update `src/styles/section-review.css` with mobile breakpoint (stacked layout) | pending | no | no |
| 43 | Write SectionNav test: at 720px viewport, top bar is two compact rows | pending | no | no |
| 44 | Update `src/styles/section-nav.css` + `src/styles/review-layout.css` with mobile breakpoint | pending | no | no |
| 45 | Add `scroll-margin-top` rule to `.section-review` for sticky offset | pending | no | no |
| 46 | Write RemoteModeApp test: error state renders friendly copy + CLI command, never raw crypto error | pending | no | no |
| 47 | Update `src/components/RemoteModeApp.tsx` error branch with redesigned UI | pending | no | no |
| 48 | Commit: SPA light theme + mobile fixes + error UI | pending | no | no |
| 49 | Write remoteSubscribe test: reconnects with backoff after transient drop, succeeds | pending | no | no |
| 50 | Write remoteSubscribe test: 404 from relay → throws `SESSION_GONE`, no reconnect | pending | no | no |
| 51 | Implement reconnect wrapper in `src/cli/remoteSubscribe.ts` | pending | no | no |
| 52 | Update `bin/md-review-plus.js` error handling to distinguish SESSION_GONE vs other failures | pending | no | no |
| 53 | Commit: CLI reconnect with backoff | pending | no | no |
| 54 | Build SPA, scp to OVH, restart relay; verify SPA index.html banner injection works | pending | no | no |
| 55 | E2E via agent-browser: banner present + clickable + dismissible, mobile layout fixed, error page styled, full review loop still passes | pending | no | no |
| 56 | Update phase tracking in design doc, commit | pending | no | no |

---

## Conventions

- All paths are absolute from the repo root unless noted.
- Bun test for relay (`bun:test` import), Vitest for SPA and CLI.
- After every `git commit`, run `git log --oneline -3` to confirm.
- When a task says "Write test, run, see FAIL" — that's a real step. Don't combine it with implementation. The FAIL output proves the test wires up correctly.
- When a task lists `Modify: path:lineA-lineB`, the line range is a hint of where the change goes; the exact line may shift as earlier tasks land.

---

## Task 1: Extend relay config

**Files:**
- Modify: `relay/src/config.ts`

**Step 1:** Add three string-typed env reads.

**Step 2:** Replace the `relay/src/config.ts` file with:

```typescript
export interface RelayConfig {
  port: number;
  ttlMs: number;
  maxSessions: number;
  rateLimitPerHour: number;
  maxBodyBytes: number;
  maxFeedbackBytes: number;
  adminToken: string | null;
  ipHashSalt: string;
  dataDir: string;
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`invalid ${name}: ${raw}`);
  return n;
}

function str(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export function loadConfig(): RelayConfig {
  return {
    port: num('MDRP_PORT', 8080),
    ttlMs: num('MDRP_TTL_MS', 24 * 60 * 60 * 1000),
    maxSessions: num('MDRP_MAX_SESSIONS', 1000),
    rateLimitPerHour: num('MDRP_RATE_LIMIT_PER_HOUR', 30),
    maxBodyBytes: num('MDRP_MAX_BODY_BYTES', 1_048_576),
    maxFeedbackBytes: num('MDRP_MAX_FEEDBACK_BYTES', 262_144),
    adminToken: process.env.MDRP_ADMIN_TOKEN ?? null,
    ipHashSalt: str('MDRP_IP_HASH_SALT', 'dev-salt-do-not-use-in-prod'),
    dataDir: str('MDRP_DATA_DIR', './data'),
  };
}
```

**Step 3:** `cd relay && bun run typecheck`. Expected: no errors.

---

## Task 2: Write analytics impression test (red)

**Files:**
- Create: `relay/test/analytics.test.ts`

**Step 1:** Write the file:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Analytics } from '../src/analytics';
import { rmSync } from 'node:fs';

let a: Analytics;
const TMP = '/tmp/mdrp-analytics-test.db';

beforeEach(() => {
  try { rmSync(TMP); } catch {}
  a = new Analytics({ dbPath: TMP, salt: 'test-salt' });
});

afterEach(() => {
  a.close();
});

describe('Analytics.recordImpression', () => {
  it('increments today\'s count for a new (campaign, ip) pair', () => {
    a.recordImpression('kisenon-launch', '1.2.3.4');
    const stats = a.getStats('kisenon-launch');
    expect(stats.allTime.impressions).toBe(1);
    expect(stats.last7d.impressions).toBe(1);
  });
});
```

**Step 2:** Run `cd relay && bun test analytics.test.ts`.
Expected: FAIL — `Cannot find module '../src/analytics'`.

---

## Task 3: Create Analytics module

**Files:**
- Create: `relay/src/analytics.ts`

**Step 1:** Write the file:

```typescript
import { Database } from 'bun:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export interface AnalyticsOptions {
  dbPath: string;
  salt: string;
  now?: () => number;
}

export interface CampaignStats {
  impressions: number;
  clicks: number;
  ctr: number;
}

export interface CampaignStatsRollup {
  last7d: CampaignStats;
  last30d: CampaignStats;
  allTime: CampaignStats;
}

const SCHEMA = `
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
`;

function todayUtc(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function daysAgoUtc(now: number, days: number): string {
  return new Date(now - days * 86_400_000).toISOString().slice(0, 10);
}

export class Analytics {
  private db: Database;
  private salt: string;
  private now: () => number;

  constructor(opts: AnalyticsOptions) {
    if (opts.dbPath !== ':memory:') {
      const dir = dirname(opts.dbPath);
      if (dir && dir !== '.') {
        try { mkdirSync(dir, { recursive: true }); } catch {}
      }
    }
    this.db = new Database(opts.dbPath);
    this.db.exec(SCHEMA);
    this.salt = opts.salt;
    this.now = opts.now ?? Date.now;
  }

  ipHash(ip: string, day: string): string {
    return createHash('sha256')
      .update(`${ip}:${day}:${this.salt}`)
      .digest('hex')
      .slice(0, 32);
  }

  recordImpression(campaignId: string, ip: string): void {
    const day = todayUtc(this.now());
    const hash = this.ipHash(ip, day);
    const inserted = this.db.run(
      'INSERT OR IGNORE INTO impression_dedup (campaign_id, ip_hash, day) VALUES (?, ?, ?)',
      [campaignId, hash, day],
    );
    if (inserted.changes > 0) {
      this.db.run(
        `INSERT INTO impressions (campaign_id, day, count) VALUES (?, ?, 1)
         ON CONFLICT (campaign_id, day) DO UPDATE SET count = count + 1`,
        [campaignId, day],
      );
    }
  }

  recordClick(campaignId: string): void {
    const day = todayUtc(this.now());
    this.db.run(
      `INSERT INTO clicks (campaign_id, day, count) VALUES (?, ?, 1)
       ON CONFLICT (campaign_id, day) DO UPDATE SET count = count + 1`,
      [campaignId, day],
    );
  }

  private sumWhere(table: 'impressions' | 'clicks', campaignId: string, sinceDay?: string): number {
    const where = sinceDay
      ? 'campaign_id = ? AND day >= ?'
      : 'campaign_id = ?';
    const params: string[] = sinceDay ? [campaignId, sinceDay] : [campaignId];
    const row = this.db.query(`SELECT COALESCE(SUM(count),0) AS n FROM ${table} WHERE ${where}`).get(...params) as { n: number };
    return row?.n ?? 0;
  }

  getStats(campaignId: string): CampaignStatsRollup {
    const now = this.now();
    const d7 = daysAgoUtc(now, 6);  // inclusive 7-day window
    const d30 = daysAgoUtc(now, 29);
    const mk = (imps: number, clk: number): CampaignStats => ({
      impressions: imps,
      clicks: clk,
      ctr: imps > 0 ? Math.round((clk / imps) * 10_000) / 10_000 : 0,
    });
    return {
      last7d: mk(this.sumWhere('impressions', campaignId, d7), this.sumWhere('clicks', campaignId, d7)),
      last30d: mk(this.sumWhere('impressions', campaignId, d30), this.sumWhere('clicks', campaignId, d30)),
      allTime: mk(this.sumWhere('impressions', campaignId), this.sumWhere('clicks', campaignId)),
    };
  }

  getAllStats(): Record<string, CampaignStatsRollup> {
    const rows = this.db.query('SELECT DISTINCT campaign_id FROM impressions UNION SELECT DISTINCT campaign_id FROM clicks').all() as { campaign_id: string }[];
    const out: Record<string, CampaignStatsRollup> = {};
    for (const r of rows) out[r.campaign_id] = this.getStats(r.campaign_id);
    return out;
  }

  sweepDedup(): number {
    const cutoff = daysAgoUtc(this.now(), 1);
    const r = this.db.run('DELETE FROM impression_dedup WHERE day < ?', [cutoff]);
    return r.changes;
  }

  close(): void {
    this.db.close();
  }
}
```

**Step 2:** Run `cd relay && bun test analytics.test.ts`.
Expected: PASS — 1 test.

---

## Task 4: Write dedup test (red)

**Files:**
- Modify: `relay/test/analytics.test.ts`

**Step 1:** Append inside `describe('Analytics.recordImpression', ...)`:

```typescript
  it('dedups same ip + same campaign + same day', () => {
    a.recordImpression('kisenon-launch', '1.2.3.4');
    a.recordImpression('kisenon-launch', '1.2.3.4');
    a.recordImpression('kisenon-launch', '1.2.3.4');
    expect(a.getStats('kisenon-launch').allTime.impressions).toBe(1);
  });

  it('counts distinct ips as separate impressions', () => {
    a.recordImpression('kisenon-launch', '1.2.3.4');
    a.recordImpression('kisenon-launch', '5.6.7.8');
    expect(a.getStats('kisenon-launch').allTime.impressions).toBe(2);
  });
```

**Step 2:** Run `cd relay && bun test analytics.test.ts`.
Expected: PASS — 3 tests. (Dedup is already implemented in Task 3 since IT WAS WRITTEN AT THE SAME TIME — this task is the test side that proves it; if it fails we have a regression.)

---

## Task 5: Skipped — dedup already implemented in Task 3

(Tasks 4 and 5 collapsed; the implementation in Task 3 is complete. Move to Task 6.)

---

## Task 6: Write click + getStats test

**Files:**
- Modify: `relay/test/analytics.test.ts`

**Step 1:** Append a new describe block to the file:

```typescript
describe('Analytics.recordClick + getStats', () => {
  it('counts clicks and computes ctr', () => {
    a.recordImpression('kisenon-launch', '1.2.3.4');
    a.recordImpression('kisenon-launch', '5.6.7.8');
    a.recordClick('kisenon-launch');
    const s = a.getStats('kisenon-launch').allTime;
    expect(s.impressions).toBe(2);
    expect(s.clicks).toBe(1);
    expect(s.ctr).toBe(0.5);
  });

  it('returns zero ctr when no impressions', () => {
    expect(a.getStats('nobody').allTime.ctr).toBe(0);
  });
});
```

**Step 2:** Run `cd relay && bun test analytics.test.ts`.
Expected: PASS — 5 tests.

---

## Task 7: Write sweep test

**Files:**
- Modify: `relay/test/analytics.test.ts`

**Step 1:** Append:

```typescript
describe('Analytics.sweepDedup', () => {
  it('removes only stale dedup rows; today and yesterday are kept', () => {
    let t = Date.parse('2026-05-15T12:00:00Z');
    const a2 = new Analytics({ dbPath: ':memory:', salt: 's', now: () => t });
    a2.recordImpression('camp', '1.1.1.1');                // day = 2026-05-15
    t = Date.parse('2026-05-14T12:00:00Z');
    a2.recordImpression('camp', '2.2.2.2');                // day = 2026-05-14
    t = Date.parse('2026-05-10T12:00:00Z');
    a2.recordImpression('camp', '3.3.3.3');                // day = 2026-05-10
    t = Date.parse('2026-05-15T12:00:00Z');
    const removed = a2.sweepDedup();                       // keep days >= 2026-05-14
    expect(removed).toBe(1);
    a2.close();
  });
});
```

**Step 2:** Run `cd relay && bun test analytics.test.ts`.
Expected: PASS — 6 tests.

---

## Task 8: Commit analytics module

**Files:** all of the above.

```bash
git add relay/src/analytics.ts relay/src/config.ts relay/test/analytics.test.ts
git commit -m "$(cat <<'EOF'
feat(relay): SQLite-backed analytics module with IP-hash dedup

Aggregate-only impression and click counts. Day-bucketed dedup using
sha256(ip + day + salt) — IP is hashed and discarded, never stored.
Dedup table swept daily.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -3
```

---

## Task 9: Create sponsors.json

**Files:**
- Create: `relay/sponsors.json`

**Step 1:** Write the file:

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
      "tagline": "Subaya — pending tagline",
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

---

## Task 10: Write sponsors loader test

**Files:**
- Create: `relay/test/sponsors.test.ts`

**Step 1:**

```typescript
import { describe, it, expect } from 'bun:test';
import { Sponsors } from '../src/sponsors';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function tmpJson(obj: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), 'mdrp-sponsors-'));
  const path = join(dir, 'sponsors.json');
  writeFileSync(path, JSON.stringify(obj));
  return path;
}

describe('Sponsors', () => {
  it('returns the active campaign when set', () => {
    const path = tmpJson({
      active: 'k',
      campaigns: { k: { name: 'K', tagline: 't', clickUrl: 'https://k' }, house: { name: 'H', tagline: 'h', clickUrl: '/advertise' } },
    });
    const s = new Sponsors(path);
    const c = s.getActive();
    expect(c.id).toBe('k');
    expect(c.name).toBe('K');
  });

  it('returns house campaign when active is null', () => {
    const path = tmpJson({
      active: null,
      campaigns: { house: { name: 'H', tagline: 'h', clickUrl: '/advertise' } },
    });
    const s = new Sponsors(path);
    expect(s.getActive().id).toBe('house');
  });

  it('returns campaign by id', () => {
    const path = tmpJson({
      active: 'k',
      campaigns: { k: { name: 'K', tagline: 't', clickUrl: 'https://k' }, house: { name: 'H', tagline: 'h', clickUrl: '/advertise' } },
    });
    const s = new Sponsors(path);
    expect(s.getById('k')?.name).toBe('K');
    expect(s.getById('nope')).toBeUndefined();
  });
});
```

**Step 2:** Run `cd relay && bun test sponsors.test.ts`.
Expected: FAIL — module not found.

---

## Task 11: Create Sponsors module

**Files:**
- Create: `relay/src/sponsors.ts`

**Step 1:**

```typescript
import { readFileSync, statSync } from 'node:fs';

export interface Campaign {
  id: string;
  name: string;
  tagline: string;
  clickUrl: string;
}

interface SponsorsFile {
  active: string | null;
  campaigns: Record<string, { name: string; tagline: string; clickUrl: string }>;
}

export class Sponsors {
  private path: string;
  private cache: { mtimeMs: number; data: SponsorsFile } | null = null;

  constructor(path: string) {
    this.path = path;
  }

  private load(): SponsorsFile {
    const st = statSync(this.path);
    if (!this.cache || this.cache.mtimeMs !== st.mtimeMs) {
      const raw = readFileSync(this.path, 'utf8');
      const data = JSON.parse(raw) as SponsorsFile;
      this.cache = { mtimeMs: st.mtimeMs, data };
    }
    return this.cache.data;
  }

  getActive(): Campaign {
    const f = this.load();
    const id = f.active ?? 'house';
    const c = f.campaigns[id] ?? f.campaigns.house;
    if (!c) throw new Error(`sponsors.json missing required 'house' campaign`);
    return { id: f.active ?? 'house', ...c };
  }

  getById(id: string): Campaign | undefined {
    const f = this.load();
    const c = f.campaigns[id];
    return c ? { id, ...c } : undefined;
  }
}
```

**Step 2:** `cd relay && bun test sponsors.test.ts`. Expected: PASS — 3 tests.

---

## Task 12: Write banner renderer test

**Files:**
- Create: `relay/test/banner.test.ts`

**Step 1:**

```typescript
import { describe, it, expect } from 'bun:test';
import { renderBanner } from '../src/banner';

describe('renderBanner', () => {
  it('emits HTML containing campaign name, tagline, click path, and impression beacon', () => {
    const html = renderBanner({ id: 'kisenon-launch', name: 'Kisenon', tagline: 'Sleeps well', clickUrl: 'https://kisenon.com' });
    expect(html).toContain('Kisenon');
    expect(html).toContain('Sleeps well');
    expect(html).toContain('/go/kisenon-launch');
    expect(html).toContain('navigator.sendBeacon');
    expect(html).toContain('"c":"kisenon-launch"');
  });

  it('escapes HTML in campaign fields', () => {
    const html = renderBanner({ id: 'x', name: '<script>evil</script>', tagline: '"hi"', clickUrl: 'https://x' });
    expect(html).not.toContain('<script>evil</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
```

**Step 2:** Run `cd relay && bun test banner.test.ts`. Expected: FAIL — module not found.

---

## Task 13: Create banner renderer

**Files:**
- Create: `relay/src/banner.ts`

**Step 1:**

```typescript
import type { Campaign } from './sponsors';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderBanner(c: Campaign): string {
  const id = esc(c.id);
  const name = esc(c.name);
  const tagline = esc(c.tagline);
  // CTA label: "Visit" for house, otherwise something campaign-flavored.
  const ctaLabel = c.id === 'house' ? 'Advertise here →' : `Visit ${name} →`;
  return `
<aside class="mdrp-banner" aria-label="Sponsored content" data-campaign="${id}">
  <div class="mdrp-banner-inner">
    <span class="mdrp-banner-label">SPONSOR</span>
    <span class="mdrp-banner-name">${name}</span>
    <span class="mdrp-banner-sep">·</span>
    <span class="mdrp-banner-tagline">${tagline}</span>
    <span class="mdrp-banner-spacer"></span>
    <a class="mdrp-banner-cta" href="/go/${id}" rel="sponsored noopener" target="_blank">${ctaLabel}</a>
    <button class="mdrp-banner-dismiss" type="button" aria-label="Dismiss sponsor banner">&times;</button>
  </div>
  <script>
    (function () {
      try {
        if (sessionStorage.getItem('mdrp_banner_dismissed_${id}') === '1') {
          var b = document.currentScript && document.currentScript.closest('.mdrp-banner');
          if (b) b.style.display = 'none';
          return;
        }
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/sponsors/impression', JSON.stringify({"c":"${id}"}));
        } else {
          fetch('/api/sponsors/impression', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({"c":"${id}"}), keepalive: true });
        }
        var b = document.currentScript && document.currentScript.closest('.mdrp-banner');
        var x = b && b.querySelector('.mdrp-banner-dismiss');
        if (x) x.addEventListener('click', function () {
          sessionStorage.setItem('mdrp_banner_dismissed_${id}', '1');
          if (b) b.style.display = 'none';
        });
      } catch (e) { /* no-op */ }
    })();
  </script>
</aside>
`;
}
```

**Step 2:** `cd relay && bun test banner.test.ts`. Expected: PASS — 2 tests.

---

## Task 14: Commit sponsors + banner renderer

```bash
git add relay/sponsors.json relay/src/sponsors.ts relay/src/banner.ts relay/test/sponsors.test.ts relay/test/banner.test.ts
git commit -m "$(cat <<'EOF'
feat(relay): sponsors config + banner renderer

Single-active-campaign config in sponsors.json with hot-reload on mtime change.
Banner renderer emits server-side HTML with embedded impression beacon and
session-storage dismiss handler. Escapes user-visible fields to prevent XSS
through a misconfigured sponsors.json.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -3
```

---

## Task 15: Write `/api/sponsors/current` test

**Files:**
- Create: `relay/test/app.sponsors.test.ts`

**Step 1:**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createApp } from '../src/app';
import { Sponsors } from '../src/sponsors';
import { Analytics } from '../src/analytics';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function tmpSponsors(): string {
  const dir = mkdtempSync(join(tmpdir(), 'mdrp-sp-'));
  const path = join(dir, 'sponsors.json');
  writeFileSync(path, JSON.stringify({
    active: 'k',
    campaigns: {
      k: { name: 'K', tagline: 't', clickUrl: 'https://k' },
      house: { name: 'H', tagline: 'h', clickUrl: '/advertise' },
    },
  }));
  return path;
}

let sponsors: Sponsors;
let analytics: Analytics;

beforeEach(() => {
  sponsors = new Sponsors(tmpSponsors());
  analytics = new Analytics({ dbPath: ':memory:', salt: 's' });
});

afterEach(() => {
  analytics.close();
});

describe('GET /api/sponsors/current', () => {
  it('returns the active campaign', async () => {
    const { app } = await createApp({ ttlMs: 60_000, maxSessions: 10, rateLimit: 100, sponsors, analytics, adminToken: 'tk' });
    const r = await app.request('/api/sponsors/current');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ id: 'k', name: 'K', tagline: 't', clickUrl: 'https://k' });
  });
});
```

**Step 2:** Run `cd relay && bun test app.sponsors.test.ts`.
Expected: FAIL — `createApp` doesn't accept `sponsors`/`analytics`/`adminToken` options yet.

---

## Task 16: Extend createApp signature and wire `/api/sponsors/current`

**Files:**
- Modify: `relay/src/app.ts`

**Step 1:** Add to `AppOptions` interface (near top of file):

```typescript
import type { Sponsors } from './sponsors';
import type { Analytics } from './analytics';
```

```typescript
export interface AppOptions {
  ttlMs: number;
  maxSessions: number;
  rateLimit: number;
  maxBodyBytes?: number;
  maxFeedbackBytes?: number;
  staticHtml?: string;
  staticAssetsRoot?: string;
  sponsors?: Sponsors;
  analytics?: Analytics;
  adminToken?: string | null;
  now?: () => number;
}
```

**Step 2:** Inside `createApp` (after `app.get('/api/health', ...)` near line 50), add:

```typescript
  if (opts.sponsors) {
    app.get('/api/sponsors/current', (c) => {
      return c.json(opts.sponsors!.getActive());
    });
  }
```

**Step 3:** Run `cd relay && bun test app.sponsors.test.ts`. Expected: PASS — 1 test.

---

## Task 17: Write `/api/sponsors/impression` test

**Files:**
- Modify: `relay/test/app.sponsors.test.ts`

**Step 1:** Append:

```typescript
describe('POST /api/sponsors/impression', () => {
  it('returns 204 and increments count for the campaign', async () => {
    const { app } = await createApp({ ttlMs: 60_000, maxSessions: 10, rateLimit: 100, sponsors, analytics, adminToken: 'tk' });
    const r = await app.request('/api/sponsors/impression', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
      body: JSON.stringify({ c: 'k' }),
    });
    expect(r.status).toBe(204);
    expect(analytics.getStats('k').allTime.impressions).toBe(1);
  });

  it('ignores unknown campaigns (still 204, no count)', async () => {
    const { app } = await createApp({ ttlMs: 60_000, maxSessions: 10, rateLimit: 100, sponsors, analytics, adminToken: 'tk' });
    const r = await app.request('/api/sponsors/impression', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
      body: JSON.stringify({ c: 'unknown' }),
    });
    expect(r.status).toBe(204);
    expect(analytics.getStats('unknown').allTime.impressions).toBe(0);
  });
});
```

**Step 2:** Run. Expected: FAIL — route not wired.

---

## Task 18: Wire `/api/sponsors/impression`

**Files:**
- Modify: `relay/src/app.ts`

**Step 1:** After the `/api/sponsors/current` block:

```typescript
  if (opts.analytics && opts.sponsors) {
    app.post('/api/sponsors/impression', async (c) => {
      try {
        const body = (await c.req.json()) as { c?: string };
        const id = body.c;
        if (id && opts.sponsors!.getById(id)) {
          const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
          opts.analytics!.recordImpression(id, ip);
        }
      } catch {
        /* malformed → silent 204 */
      }
      return c.body(null, 204);
    });
  }
```

**Step 2:** Run. Expected: PASS — 3 tests in `app.sponsors.test.ts`.

---

## Task 19: Write `/go/:campaignId` test

**Files:**
- Modify: `relay/test/app.sponsors.test.ts`

**Step 1:** Append:

```typescript
describe('GET /go/:campaignId', () => {
  it('302s to campaign clickUrl and records click', async () => {
    const { app } = await createApp({ ttlMs: 60_000, maxSessions: 10, rateLimit: 100, sponsors, analytics, adminToken: 'tk' });
    const r = await app.request('/go/k', { method: 'GET', redirect: 'manual' });
    expect(r.status).toBe(302);
    expect(r.headers.get('location')).toBe('https://k');
    expect(analytics.getStats('k').allTime.clicks).toBe(1);
  });

  it('unknown campaign 302s to /', async () => {
    const { app } = await createApp({ ttlMs: 60_000, maxSessions: 10, rateLimit: 100, sponsors, analytics, adminToken: 'tk' });
    const r = await app.request('/go/unknown', { method: 'GET', redirect: 'manual' });
    expect(r.status).toBe(302);
    expect(r.headers.get('location')).toBe('/');
  });
});
```

**Step 2:** Run. Expected: FAIL.

---

## Task 20: Wire `/go/:campaignId`

**Files:**
- Modify: `relay/src/app.ts`

**Step 1:** After the `/api/sponsors/impression` block:

```typescript
  if (opts.analytics && opts.sponsors) {
    app.get('/go/:campaignId', (c) => {
      const campaign = opts.sponsors!.getById(c.req.param('campaignId'));
      if (!campaign) {
        return c.redirect('/', 302);
      }
      opts.analytics!.recordClick(campaign.id);
      return c.redirect(campaign.clickUrl, 302);
    });
  }
```

**Step 2:** Run. Expected: PASS — 5 tests.

---

## Task 21: Write `/api/admin/stats` test

**Files:**
- Modify: `relay/test/app.sponsors.test.ts`

**Step 1:** Append:

```typescript
describe('GET /api/admin/stats', () => {
  it('401 without token', async () => {
    const { app } = await createApp({ ttlMs: 60_000, maxSessions: 10, rateLimit: 100, sponsors, analytics, adminToken: 'tk' });
    const r = await app.request('/api/admin/stats');
    expect(r.status).toBe(401);
  });

  it('401 with wrong token', async () => {
    const { app } = await createApp({ ttlMs: 60_000, maxSessions: 10, rateLimit: 100, sponsors, analytics, adminToken: 'tk' });
    const r = await app.request('/api/admin/stats', { headers: { authorization: 'Bearer wrong' } });
    expect(r.status).toBe(401);
  });

  it('200 with correct token, returns campaign stats', async () => {
    analytics.recordImpression('k', '1.2.3.4');
    analytics.recordClick('k');
    const { app } = await createApp({ ttlMs: 60_000, maxSessions: 10, rateLimit: 100, sponsors, analytics, adminToken: 'tk' });
    const r = await app.request('/api/admin/stats', { headers: { authorization: 'Bearer tk' } });
    expect(r.status).toBe(200);
    const body = await r.json() as Record<string, { allTime: { impressions: number; clicks: number } }>;
    expect(body.k.allTime.impressions).toBe(1);
    expect(body.k.allTime.clicks).toBe(1);
  });
});
```

**Step 2:** Run. Expected: FAIL.

---

## Task 22: Wire `/api/admin/stats`

**Files:**
- Modify: `relay/src/app.ts`

**Step 1:** Add helper at the top of the file (just after imports):

```typescript
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
```

**Step 2:** After the `/go/:campaignId` block in `createApp`:

```typescript
  if (opts.analytics && opts.adminToken) {
    const token = opts.adminToken;
    app.get('/api/admin/stats', (c) => {
      const auth = c.req.header('authorization') ?? '';
      if (!auth.startsWith('Bearer ')) return c.body(null, 401);
      const tok = auth.slice(7);
      if (!timingSafeEqual(tok, token)) return c.body(null, 401);
      return c.json(opts.analytics!.getAllStats());
    });
  }
```

**Step 3:** Run. Expected: PASS — 8 tests in app.sponsors.test.ts.

---

## Task 23: Commit endpoints

```bash
git add relay/src/app.ts relay/test/app.sponsors.test.ts
git commit -m "$(cat <<'EOF'
feat(relay): sponsor + analytics endpoints

/api/sponsors/current returns active campaign metadata.
/api/sponsors/impression accepts a beacon and increments today's count.
/go/:id records a click and 302s to the campaign URL; unknown → /.
/api/admin/stats is bearer-token gated with constant-time comparison.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -3
```

---

## Task 24: Create landing.html (light theme + banner marker)

**Files:**
- Modify: `relay/static/landing.html`

**Step 1:** Replace the existing file. It is large (~250 lines). For brevity in this plan, the executing agent should:

1. Open the existing `landing.html`.
2. Replace the entire `<style>` block with the light-theme palette from the design doc § "Theme palette (light only)".
3. Add `<!-- BANNER -->` as the very first child of `<body>` (above existing header).
4. Remove the inline "Sponsor" card from the hero section (the `<div class="sponsor">` and its surrounding spacing).
5. Replace the dark color references throughout (`--accent: #00d4aa` → `--accent: #008f73`, etc).
6. Replace the favicon SVG `fill='%230b0d12'` with `fill='%23ffffff'`, `fill='%2300d4aa'` with `fill='%23008f73'`.
7. Add CSS for the banner (the `.mdrp-banner` selectors used in `banner.ts`):

```css
.mdrp-banner {
  position: sticky; top: 0; z-index: 100;
  background: #0b0d12; color: #fff;
  border-bottom: 1px solid #2a2f3a;
}
.mdrp-banner-inner {
  max-width: 1200px; margin: 0 auto; padding: 12px 24px;
  display: flex; align-items: center; gap: 12px;
  font-size: 14px; line-height: 1.4; flex-wrap: wrap;
}
.mdrp-banner-label {
  font-size: 11px; letter-spacing: 0.12em; color: #9aa1ad;
  font-weight: 700; text-transform: uppercase;
}
.mdrp-banner-name { font-weight: 700; color: #fff; }
.mdrp-banner-sep { color: #5b6577; }
.mdrp-banner-tagline { color: #c0c5cf; }
.mdrp-banner-spacer { flex: 1; min-width: 8px; }
.mdrp-banner-cta {
  display: inline-block; padding: 6px 14px; border-radius: 5px;
  background: #00d4aa; color: #001813; font-weight: 600; text-decoration: none;
}
.mdrp-banner-cta:hover { background: #00b894; }
.mdrp-banner-dismiss {
  background: transparent; border: 0; color: #9aa1ad; cursor: pointer;
  font-size: 20px; line-height: 1; padding: 4px 8px; margin-left: 4px;
}
.mdrp-banner-dismiss:hover { color: #fff; }
@media (max-width: 720px) {
  .mdrp-banner-inner { flex-direction: column; align-items: flex-start; gap: 6px; padding: 10px 16px; }
  .mdrp-banner-spacer { display: none; }
  .mdrp-banner-cta { align-self: stretch; text-align: center; }
}
```

**Step 2:** Confirm: `grep -c "<!-- BANNER -->" relay/static/landing.html` returns `1`.

---

## Task 25: Create advertise.html

**Files:**
- Create: `relay/static/advertise.html`

**Step 1:** Write a static HTML page matching the design doc § "advertise.html" content. Includes:
- Same `<head>` block as landing.html (meta, OG, JSON-LD with `WebPage` schema), title `Sponsor md-review-plus`
- `<!-- BANNER -->` marker
- Body sections: hero, audience, format, why-different, pricing, past-sponsors (placeholder showing nothing), FAQ, contact (`mailto:sponsor@md-review-plus.ai`)
- Use the same light theme CSS as landing.html (extract to a shared `<style>` if you want — but easiest in this phase is to inline the same block)

**Step 2:** `grep -c "<!-- BANNER -->" relay/static/advertise.html` → `1`.

---

## Task 26: Create error.html

**Files:**
- Create: `relay/static/error.html`

**Step 1:** Write:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Review link expired — md-review-plus</title>
    <meta name="robots" content="noindex" />
    <style>
      /* Same theme tokens + .mdrp-banner styles as landing.html */
      /* (full block copied from landing.html for self-containment) */
      :root { --bg: #fafbfc; --fg: #0b0d12; --fg-dim: #5b6577; --accent: #008f73; --border: #e1e5ec; --bg-elev: #fff; }
      * { box-sizing: border-box; }
      body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif; }
      .wrap { max-width: 480px; margin: 0 auto; padding: 64px 24px; text-align: center; }
      h1 { font-size: 28px; margin: 0 0 16px; }
      p { color: var(--fg-dim); }
      pre { background: var(--bg-elev); border: 1px solid var(--border); padding: 14px 18px; border-radius: 6px; text-align: left; font-family: ui-monospace,Menlo,Consolas,monospace; overflow-x: auto; }
      .ctas { display: flex; gap: 12px; justify-content: center; margin-top: 24px; flex-wrap: wrap; }
      .btn { padding: 10px 18px; border-radius: 6px; font-weight: 600; text-decoration: none; }
      .btn-primary { background: var(--accent); color: #fff; }
      .btn-ghost { background: var(--bg-elev); color: var(--fg); border: 1px solid var(--border); }
      /* Banner styles — copy from landing.html */
    </style>
  </head>
  <body>
    <!-- BANNER -->
    <main class="wrap">
      <h1>Review link expired or invalid</h1>
      <p>This link is one-time-use and expires after 24 hours. Ask the agent to generate a new one:</p>
      <pre>md-review-plus FILE --review --remote</pre>
      <div class="ctas">
        <a class="btn btn-primary" href="/">&larr; Home</a>
        <a class="btn btn-ghost" href="/#privacy">Learn more</a>
      </div>
    </main>
  </body>
</html>
```

**Step 2:** `grep -c "<!-- BANNER -->" relay/static/error.html` → `1`.

---

## Task 27: Write template-injection test for `GET /`

**Files:**
- Modify: `relay/test/app.sponsors.test.ts`

**Step 1:** Append:

```typescript
import { writeFileSync } from 'node:fs';

describe('GET / (landing)', () => {
  it('injects banner snippet into landing.html', async () => {
    // Build a fake landing.html
    const dir = mkdtempSync(join(tmpdir(), 'mdrp-static-'));
    writeFileSync(join(dir, 'landing.html'), '<html><body><!-- BANNER --><h1>Hi</h1></body></html>');
    writeFileSync(join(dir, 'advertise.html'), '<html><body><!-- BANNER --></body></html>');
    writeFileSync(join(dir, 'error.html'), '<html><body><!-- BANNER --></body></html>');
    const { app } = await createApp({
      ttlMs: 60_000, maxSessions: 10, rateLimit: 100,
      sponsors, analytics, adminToken: 'tk', staticAssetsRoot: dir,
    });
    const r = await app.request('/');
    expect(r.status).toBe(200);
    const html = await r.text();
    expect(html).toContain('mdrp-banner');
    expect(html).toContain('Hi');
    expect(html).not.toContain('<!-- BANNER -->');
  });
});
```

**Step 2:** Run. Expected: FAIL (no `/` route yet).

---

## Task 28: Wire `GET /` and `GET /advertise`

**Files:**
- Modify: `relay/src/app.ts`

**Step 1:** Add helper above `createApp`:

```typescript
async function serveStaticWithBanner(opts: AppOptions, file: 'landing.html' | 'advertise.html' | 'error.html', status = 200) {
  if (!opts.staticAssetsRoot || !opts.sponsors) {
    return new Response('relay running; no static html configured', { status: 200 });
  }
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const html = await fs.readFile(path.join(opts.staticAssetsRoot, file), 'utf8');
  const bannerHtml = (await import('./banner')).renderBanner(opts.sponsors.getActive());
  const injected = html.replace('<!-- BANNER -->', bannerHtml);
  return new Response(injected, { status, headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
}
```

**Step 2:** Inside `createApp`, replace the existing `app.get('/', ...)` block (added earlier) with:

```typescript
  if (opts.staticAssetsRoot && opts.sponsors) {
    app.get('/', async () => serveStaticWithBanner(opts, 'landing.html'));
    app.get('/advertise', async () => serveStaticWithBanner(opts, 'advertise.html'));
  }
```

**Step 3:** Run. Expected: PASS — 9 tests.

---

## Task 29: Write error-page test for missing session

**Files:**
- Modify: `relay/test/app.sponsors.test.ts`

**Step 1:** Append:

```typescript
describe('GET /r/:id with missing session', () => {
  it('returns 404 with error.html (banner included)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mdrp-static-'));
    writeFileSync(join(dir, 'landing.html'), '<html><body><!-- BANNER --></body></html>');
    writeFileSync(join(dir, 'advertise.html'), '<html><body><!-- BANNER --></body></html>');
    writeFileSync(join(dir, 'error.html'), '<html><body><!-- BANNER --><h1>Review link expired</h1></body></html>');
    const { app } = await createApp({
      ttlMs: 60_000, maxSessions: 10, rateLimit: 100,
      sponsors, analytics, adminToken: 'tk', staticAssetsRoot: dir,
    });
    const r = await app.request('/r/does-not-exist');
    expect(r.status).toBe(404);
    const html = await r.text();
    expect(html).toContain('Review link expired');
    expect(html).toContain('mdrp-banner');
  });
});
```

**Step 2:** Run. Expected: FAIL.

---

## Task 30: Update `/r/:id` to serve error.html on miss + inject banner on hit

**Files:**
- Modify: `relay/src/app.ts`

**Step 1:** Replace the existing `/r/:id` handler block with:

```typescript
  app.get('/r/:id', async (c) => {
    const id = c.req.param('id');
    const session = store.get(id);
    if (!session) {
      if (opts.staticAssetsRoot && opts.sponsors) {
        const res = await serveStaticWithBanner(opts, 'error.html', 404);
        return res;
      }
      return c.text('not found', 404);
    }
    if (opts.staticHtml) {
      return c.html(opts.staticHtml);
    }
    if (opts.staticAssetsRoot) {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      let html = await fs.readFile(path.join(opts.staticAssetsRoot, 'index.html'), 'utf8');
      if (opts.sponsors) {
        const bannerHtml = (await import('./banner')).renderBanner(opts.sponsors.getActive());
        // Inject banner as first child of <body>
        html = html.replace(/<body([^>]*)>/i, `<body$1>${bannerHtml}`);
      }
      return c.html(html);
    }
    return c.text('relay running; no static html configured', 200);
  });
```

**Step 2:** Run `cd relay && bun test`. Expected: PASS — all relay tests including the new error-page test.

---

## Task 31: Commit static pages + route wiring

```bash
git add relay/static/landing.html relay/static/advertise.html relay/static/error.html relay/src/app.ts relay/test/app.sponsors.test.ts
git commit -m "$(cat <<'EOF'
feat(relay): light-themed static pages + banner injection

Light theme conversion for landing.html. New advertise.html and error.html
served from the same template-with-banner pipeline. Missing sessions on
/r/:id now return the friendly error.html. Banner is injected into the
SPA's index.html as the first child of <body>.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -3
```

---

## Task 32: Update relay/src/index.ts startup wiring

**Files:**
- Modify: `relay/src/index.ts`

**Step 1:** Replace the file with:

```typescript
import { createApp } from './app';
import { loadConfig } from './config';
import { Analytics } from './analytics';
import { Sponsors } from './sponsors';
import { join } from 'node:path';

const cfg = loadConfig();
const analytics = new Analytics({ dbPath: join(cfg.dataDir, 'analytics.db'), salt: cfg.ipHashSalt });
const sponsors = new Sponsors(join(import.meta.dir, '..', 'sponsors.json'));

const { app, store } = await createApp({
  ttlMs: cfg.ttlMs,
  maxSessions: cfg.maxSessions,
  rateLimit: cfg.rateLimitPerHour,
  maxBodyBytes: cfg.maxBodyBytes,
  maxFeedbackBytes: cfg.maxFeedbackBytes,
  staticAssetsRoot: process.env.MDRP_STATIC_ROOT,
  sponsors,
  analytics,
  adminToken: cfg.adminToken,
});

const SWEEP_INTERVAL_MS = 60_000;
let lastSweepDay = '';
setInterval(() => {
  const removed = store.sweep();
  if (removed > 0) console.log(`swept ${removed} expired sessions`);
  const today = new Date().toISOString().slice(0, 10);
  if (today !== lastSweepDay) {
    const removedDedup = analytics.sweepDedup();
    if (removedDedup > 0) console.log(`swept ${removedDedup} stale dedup rows`);
    lastSweepDay = today;
  }
}, SWEEP_INTERVAL_MS);

console.log(`md-review-plus relay listening on :${cfg.port}`);

export default {
  port: cfg.port,
  fetch: app.fetch,
  idleTimeout: 255,
};
```

**Step 2:** `cd relay && bun run typecheck`. Expected: no errors.
**Step 3:** `cd relay && bun test`. Expected: all pass (no new tests, but startup wiring shouldn't regress existing).

---

## Task 33: Commit startup wiring

```bash
git add relay/src/index.ts
git commit -m "$(cat <<'EOF'
feat(relay): boot Analytics + Sponsors, schedule daily dedup sweep

Reads MDRP_DATA_DIR for SQLite path, MDRP_IP_HASH_SALT for hash salt,
and MDRP_ADMIN_TOKEN for admin endpoint. Daily dedup sweep runs as part
of existing 60s sweeper, gated to fire once per UTC day.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -3
```

---

## Task 34: Deploy relay changes to OVH (manual, with verification)

**Step 1:** Generate prod tokens locally:

```bash
ADMIN_TOKEN=$(openssl rand -hex 32)
IP_SALT=$(openssl rand -hex 32)
echo "ADMIN_TOKEN=$ADMIN_TOKEN"
echo "IP_SALT=$IP_SALT"
# (record these in your password manager NOW)
```

**Step 2:** Push code, pull on box, set up data dir:

```bash
git push  # current branch
ssh ubuntu@ovh-atl 'set -e
  cd /opt/md-review-plus && sudo -u ubuntu git pull
  sudo -u ubuntu bun install
  cd relay && sudo -u ubuntu bun install
  sudo mkdir -p /opt/md-review-plus/relay/data
  sudo chown mdrp:mdrp /opt/md-review-plus/relay/data
  sudo chmod 750 /opt/md-review-plus/relay/data
'
```

**Step 3:** Update systemd unit on box:

```bash
ssh ubuntu@ovh-atl "sudo tee /etc/systemd/system/mdrp-relay.service > /dev/null <<'UNIT'
[Unit]
Description=md-review-plus relay
After=network.target

[Service]
Type=simple
User=mdrp
Group=mdrp
WorkingDirectory=/opt/md-review-plus/relay
ExecStart=/usr/local/bin/bun src/index.ts
Environment=MDRP_PORT=8080
Environment=MDRP_TTL_MS=86400000
Environment=MDRP_MAX_SESSIONS=1000
Environment=MDRP_RATE_LIMIT_PER_HOUR=30
Environment=MDRP_STATIC_ROOT=/opt/md-review-plus/dist
Environment=MDRP_DATA_DIR=/opt/md-review-plus/relay/data
Environment=MDRP_ADMIN_TOKEN=$ADMIN_TOKEN
Environment=MDRP_IP_HASH_SALT=$IP_SALT
Restart=on-failure
RestartSec=5

MemoryMax=512M
TasksMax=256
LimitNOFILE=4096

NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/md-review-plus/relay /opt/md-review-plus/relay/data

[Install]
WantedBy=multi-user.target
UNIT"

ssh ubuntu@ovh-atl 'sudo systemctl daemon-reload && sudo systemctl restart mdrp-relay && sleep 2 && sudo systemctl is-active mdrp-relay'
```

**Step 4:** Smoke-test:

```bash
curl -sI https://md-review-plus.ai/api/health | head -3
curl -s https://md-review-plus.ai/api/sponsors/current
# Expected: {"id":"kisenon-launch","name":"Kisenon","tagline":"...","clickUrl":"..."}

curl -sI https://md-review-plus.ai/go/kisenon-launch | head -3
# Expected: HTTP/1.1 302 ... Location: https://kisenon.com/...

curl -sI https://md-review-plus.ai/api/admin/stats | head -3
# Expected: HTTP/1.1 401

curl -s https://md-review-plus.ai/api/admin/stats -H "Authorization: Bearer $ADMIN_TOKEN" | head
# Expected: JSON with campaign rollups
```

Expected: all four curl calls match described outputs.

---

## Task 35: Add nginx security headers

**Files:**
- Modify: `/etc/nginx/sites-available/mdrp.conf` on OVH

**Step 1:** Edit the nginx file to add inside the `server { listen 443 ssl ... }` block (NOT inside individual location blocks):

```nginx
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "no-referrer" always;
add_header Permissions-Policy "interest-cohort=(), browsing-topics=(), camera=(), microphone=(), geolocation=()" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;
```

**Step 2:**

```bash
ssh ubuntu@ovh-atl 'sudo nginx -t && sudo systemctl reload nginx'
```

Expected: `nginx: configuration test is successful`.

**Step 3:** Smoke-test:

```bash
curl -sI https://md-review-plus.ai/ | grep -iE "(strict-transport|x-content-type|x-frame|referrer-policy|permissions-policy|content-security)" | wc -l
# Expected: 6
```

---

## Task 36: Mirror nginx config and Caddyfile.sample in repo

**Files:**
- Modify: `relay/Caddyfile.sample`
- Create: `relay/nginx.conf.sample`

**Step 1:** Update `relay/Caddyfile.sample` to add `header` directives matching the nginx ones:

```
md-review-plus.ai {
  encode zstd gzip

  header {
    Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
    X-Content-Type-Options "nosniff"
    X-Frame-Options "DENY"
    Referrer-Policy "no-referrer"
    Permissions-Policy "interest-cohort=(), browsing-topics=(), camera=(), microphone=(), geolocation=()"
    Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  }

  reverse_proxy localhost:8080 {
    transport http {
      response_header_timeout 60s
      read_buffer 4096
    }
    flush_interval -1
  }
}
```

**Step 2:** Create `relay/nginx.conf.sample` containing the exact production block (copy what's on the box after Task 35).

---

## Task 37: Commit deploy notes

```bash
git add relay/Caddyfile.sample relay/nginx.conf.sample
git commit -m "$(cat <<'EOF'
docs(relay): security headers in Caddyfile.sample and nginx.conf.sample

Mirrors the headers applied in production: HSTS, X-Content-Type-Options,
X-Frame-Options, Referrer-Policy (no-referrer), Permissions-Policy, and
a pragmatic CSP that allows inline scripts/styles but blocks all
third-party origins.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -3
```

---

## Task 38: SPA light theme — palette swap

**Files:**
- Modify: `src/index.css`

**Step 1:** Replace the `:root` and `.dark-mode` blocks with a single light palette (keep the existing token names so component CSS keeps working):

```css
:root {
  --bg-primary: #fafbfc;
  --bg-secondary: #ffffff;
  --bg-tertiary: #f0f3f7;
  --text-primary: #0b0d12;
  --text-secondary: #5b6577;
  --text-tertiary: #6a737d;
  --border-primary: #e1e5ec;
  --border-secondary: #ebeef2;
  --link-color: #008f73;
  --code-bg: #f0f3f7;
  --table-bg-alt: #f6f8fa;
}
/* .dark-mode rules removed — single light theme */
```

**Step 2:** Run `bun run typecheck`. Expected: no errors.
**Step 3:** Run `bun test` (Vitest). Expected: existing tests pass (theme-toggle related ones may fail and need removal in Task 39).

---

## Task 39: Remove dark-mode references and ThemeToggle

**Files:**
- Modify: `src/App.tsx` (remove ThemeToggle import + usage)
- Delete: `src/components/ThemeToggle.tsx`
- Delete: `src/components/ThemeToggle.test.tsx`
- Delete: `src/hooks/useTheme.ts` (if exists)

**Step 1:** `grep -rn "ThemeToggle\|useTheme\|dark-mode" src/` and remove every reference, including CSS rules referring to `.dark-mode`.

**Step 2:** Run `bun test`. Expected: all pass.

---

## Task 40: Write mobile SectionReview test

**Files:**
- Modify: `src/components/SectionReview.test.tsx`

**Step 1:** Add a viewport-sensitive test using `window.matchMedia` stub:

```typescript
it('uses stacked layout at narrow viewport', () => {
  // jsdom doesn't apply CSS media queries, so verify class structure / order
  const section = { id: 's1', heading: 'Features', status: 'pending', comment: '' } as any;
  const { container } = render(
    <SectionReview section={section} onApprove={() => {}} onReject={() => {}} onComment={() => {}}>content</SectionReview>
  );
  // Check the DOM has heading BEFORE actions (action buttons can be reordered via CSS, but DOM order is heading first).
  const heading = container.querySelector('.section-review-heading')!;
  const actions = container.querySelector('.section-review-actions')!;
  expect(heading.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
```

**Step 2:** Run. If it already passes (because DOM order is already heading-first), skip Task 41 and just update CSS in Task 42. If it fails (DOM order has actions before heading), reorder in Task 41.

---

## Task 41: Update SectionReview.tsx DOM order (only if Task 40 fails)

**Files:**
- Modify: `src/components/SectionReview.tsx`

**Step 1:** Ensure JSX order is: heading → content → comment → actions. From the inspection done during planning, the current order is `header > heading + actions / content / comment`. We need to lift actions OUT of the header and put them at the bottom of the card:

```tsx
return (
  <div className={`section-review ${statusClass}`} id={section.id} data-section-id={section.id}>
    <div className="section-review-header">
      <h2 className="section-review-heading">{section.heading}</h2>
    </div>
    <div className="section-review-content">{children}</div>
    <div className="section-review-comment">
      <textarea ... />
    </div>
    <div className="section-review-actions">
      <button className="section-action-btn section-action-btn-approve" onClick={onApprove}>...</button>
      <button className="section-action-btn section-action-btn-reject" onClick={onReject}>...</button>
    </div>
  </div>
);
```

**Step 2:** Run `bun test SectionReview`. Expected: pass.

---

## Task 42: Update section-review.css for mobile layout

**Files:**
- Modify: `src/styles/section-review.css`

**Step 1:** Update existing rules and add mobile breakpoint at the end of the file:

```css
.section-review-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-primary);
}

.section-review-actions {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border-primary);
  background: var(--bg-secondary);
}
.section-review-actions .section-action-btn {
  flex: 1;
  min-height: 44px;
  justify-content: center;
}

.section-review {
  scroll-margin-top: 140px; /* sponsor banner + sticky top bar */
}

@media (max-width: 720px) {
  .section-review-header { padding: 0.6rem 0.8rem; }
  .section-review-actions { padding: 0.6rem 0.8rem; gap: 0.4rem; }
  .section-action-btn { font-size: 0.95rem; }
}
```

**Step 2:** Run `bun test`. Expected: pass.

---

## Task 43: Slim sticky top bar on mobile

**Files:**
- Modify: `src/styles/section-nav.css` AND `src/styles/review-layout.css`

**Step 1:** Find the existing top-bar selectors in both files. Add mobile rules at the end:

```css
@media (max-width: 720px) {
  /* Replace selectors below with the real top-bar class names from the codebase */
  .review-toolbar { padding: 8px 12px; }
  .review-toolbar-row { gap: 8px; }
  .review-toolbar .clear-all { font-size: 12px; font-weight: 400; }
  .review-toolbar-hint { display: none; }
}
```

**Step 2:** Verify visually in agent-browser (Task 55), not by unit test.

---

## Task 44: Write friendly-error-UI test

**Files:**
- Modify: `src/components/RemoteModeApp.test.tsx` (or create if missing)

**Step 1:** Check if test exists. If not:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { RemoteModeApp } from './RemoteModeApp';

vi.mock('../hooks/useRemoteSession', () => ({
  useRemoteSession: () => ({
    state: 'error',
    error: 'AES key data must be 128 or 256 bits',
    content: null,
    filename: null,
    submit: async () => {},
  }),
}));

describe('RemoteModeApp error state', () => {
  it('shows friendly copy + CLI command, never raw crypto error', () => {
    const { container } = render(<RemoteModeApp id="abc" keyBase64Url="bad" />);
    const text = container.textContent ?? '';
    expect(text).toContain('expired or invalid');
    expect(text).toContain('md-review-plus');
    expect(text).not.toContain('AES key data');
  });
});
```

**Step 2:** Run. Expected: FAIL — current UI exposes the error message.

---

## Task 45: Update RemoteModeApp error branch

**Files:**
- Modify: `src/components/RemoteModeApp.tsx` (lines 41-46 approximately)

**Step 1:** Replace the error branch:

```tsx
if (session.state === 'error' || !session.content || !session.filename) {
  // Log raw error to console only; never show crypto details to the user.
  if (session.error) console.error('decrypt error:', session.error);
  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '64px 24px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 28, marginBottom: 16 }}>Review link expired or invalid</h1>
      <p style={{ color: 'var(--text-secondary)' }}>
        This link is one-time-use and expires after 24 hours. Ask the agent to generate a new one:
      </p>
      <pre style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', padding: '14px 18px', borderRadius: 6, textAlign: 'left', overflowX: 'auto' }}>
        <code>md-review-plus FILE --review --remote</code>
      </pre>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
        <a href="/" style={{ padding: '10px 18px', borderRadius: 6, background: 'var(--link-color)', color: '#fff', textDecoration: 'none', fontWeight: 600 }}>← Home</a>
        <a href="/#privacy" style={{ padding: '10px 18px', borderRadius: 6, background: 'var(--bg-secondary)', color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 600, border: '1px solid var(--border-primary)' }}>Learn more</a>
      </div>
    </main>
  );
}
```

**Step 2:** Run `bun test RemoteModeApp`. Expected: PASS.

---

## Task 46: Commit SPA changes

```bash
git add src/index.css src/components/SectionReview.tsx src/components/RemoteModeApp.tsx src/components/RemoteModeApp.test.tsx src/styles/section-review.css src/styles/section-nav.css src/styles/review-layout.css
# also remove deleted files
git add -u
git commit -m "$(cat <<'EOF'
feat(web): light-theme-only, mobile review layout fix, friendly error UI

Single light palette; ThemeToggle and dark-mode CSS removed. Section
cards on mobile (<=720px) stack as heading -> content -> comment ->
50/50 button row. Decrypt-failure UI replaced with friendly message,
CLI command, and home link; raw crypto errors no longer shown.
scroll-margin-top added so section anchors clear the sticky banner.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -3
```

---

## Task 47: Write SSE reconnect test (red)

**Files:**
- Modify: `src/cli/remoteSubscribe.test.ts`

**Step 1:** Append:

```typescript
it('reconnects after a transient disconnect and resolves on the retry', async () => {
  let calls = 0;
  const fakeFetch: typeof fetch = async () => {
    calls++;
    if (calls === 1) return sseResponse([': connected\n\n'], 0); // closes with no data
    return sseResponse([': connected\n\n', 'data: {"iv":"I","ct":"C"}\n\n']);
  };
  const out = await subscribeFeedback({
    relay: 'https://r', id: 'abc', fetchFn: fakeFetch,
    backoffMs: () => 0, // immediate reconnect for the test
  });
  expect(calls).toBe(2);
  expect(out).toEqual({ iv: 'I', ct: 'C' });
});

it('throws SESSION_GONE on 404, does not reconnect', async () => {
  let calls = 0;
  const fakeFetch: typeof fetch = async () => {
    calls++;
    return new Response('', { status: 404 });
  };
  await expect(
    subscribeFeedback({ relay: 'https://r', id: 'abc', fetchFn: fakeFetch, backoffMs: () => 0 })
  ).rejects.toThrow(/SESSION_GONE|404/);
  expect(calls).toBe(1);
});
```

**Step 2:** Run `bun test remoteSubscribe`. Expected: 2 new tests FAIL.

---

## Task 48: Implement SSE reconnect wrapper

**Files:**
- Modify: `src/cli/remoteSubscribe.ts`

**Step 1:** Replace the file with:

```typescript
export interface SubscribeArgs {
  relay: string;
  id: string;
  fetchFn?: typeof fetch;
  signal?: AbortSignal;
  /** Custom backoff function — receives attempt number (0-based), returns ms. Default 1/2/5/10/30s. */
  backoffMs?: (attempt: number) => number;
}

export interface FeedbackEnvelope {
  iv: string;
  ct: string;
}

export class SessionGoneError extends Error {
  constructor() {
    super('SESSION_GONE');
    this.name = 'SessionGoneError';
  }
}

const DEFAULT_BACKOFF = [1000, 2000, 5000, 10000, 30000];

async function openOnce(args: SubscribeArgs): Promise<FeedbackEnvelope> {
  const f = args.fetchFn ?? fetch;
  const url = `${args.relay.replace(/\/$/, '')}/api/sessions/${args.id}/feedback`;
  const res = await f(url, {
    method: 'GET',
    headers: { accept: 'text/event-stream' },
    signal: args.signal,
  });
  if (res.status === 404) throw new SessionGoneError();
  if (!res.ok) throw new Error(`relay ${res.status}`);
  if (!res.body) throw new Error('relay returned empty body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const evt of events) {
      const dataLines = evt.split('\n').filter((l) => l.startsWith('data: ')).map((l) => l.slice(6));
      if (dataLines.length === 0) continue;
      const payload = dataLines.join('\n');
      return JSON.parse(payload) as FeedbackEnvelope;
    }
  }
  throw new Error('SSE closed without feedback');
}

export async function subscribeFeedback(args: SubscribeArgs): Promise<FeedbackEnvelope> {
  const backoff = args.backoffMs ?? ((a) => DEFAULT_BACKOFF[Math.min(a, DEFAULT_BACKOFF.length - 1)]);
  let attempt = 0;
  while (true) {
    if (args.signal?.aborted) throw new Error('aborted');
    try {
      return await openOnce(args);
    } catch (e) {
      if (e instanceof SessionGoneError) throw e;
      if (args.signal?.aborted) throw e;
      const wait = backoff(attempt++);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}
```

**Step 2:** Run `bun test remoteSubscribe`. Expected: PASS — all 5 tests (3 original + 2 new).

---

## Task 49: Update bin/md-review-plus.js to handle SESSION_GONE

**Files:**
- Modify: `bin/md-review-plus.js` (the `--remote` subscribe block, around lines 240-250)

**Step 1:** Where the catch block currently writes "review session ended without feedback: ${e.message}", branch on the SESSION_GONE shape:

```javascript
let envelope;
try {
  envelope = await cli.subscribeFeedback({
    relay,
    id: upload.id,
    signal: ac.signal,
  });
} catch (e) {
  if (e?.name === 'SessionGoneError' || /SESSION_GONE|404/.test(e?.message || '')) {
    console.error('Error: review session expired without submit.');
  } else {
    console.error(`Error: review session ended without feedback: ${e.message}`);
  }
  process.exit(1);
}
```

**Step 2:** Run `bun run build` to rebuild `dist/cli.js`. Expected: no errors.

**Step 3:** Smoke-test CLI with a fresh `--remote` session (do not submit) and confirm the boxed URL still prints and behavior is unchanged on the happy path.

---

## Task 50: Commit CLI reconnect

```bash
git add src/cli/remoteSubscribe.ts src/cli/remoteSubscribe.test.ts bin/md-review-plus.js dist/cli.js
git commit -m "$(cat <<'EOF'
feat(cli): silent SSE reconnect with exponential backoff

subscribeFeedback now retries 1s/2s/5s/10s/30s on transient
disconnects (network blip, laptop sleep, mid-flight reconnect).
404 from the relay throws SessionGoneError and is not retried;
the CLI prints "review session expired without submit" and exits 1.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -3
```

---

## Task 51: Build SPA and deploy to OVH

**Step 1:** Locally rebuild:

```bash
bun run build
ls -la dist/index.html
```

Expected: file exists with banner-friendly `<body>` tag.

**Step 2:** Sync dist to box (replaces the existing dist served by the relay):

```bash
scp -r dist ubuntu@ovh-atl:/tmp/mdrp-dist
ssh ubuntu@ovh-atl 'set -e
  sudo rm -rf /opt/md-review-plus/dist
  sudo mv /tmp/mdrp-dist /opt/md-review-plus/dist
  sudo chmod -R a+rX /opt/md-review-plus/dist
  sudo systemctl restart mdrp-relay
  sleep 2
  sudo systemctl is-active mdrp-relay'
```

Expected: `active`.

---

## Task 52: E2E verification via agent-browser

Run from the local machine, against production:

**Step 1: Landing page sanity**

```bash
agent-browser open https://md-review-plus.ai/ && agent-browser wait --load networkidle
agent-browser screenshot /tmp/v-landing.png --full
```

Verify the screenshot shows a light theme + dark sponsor banner at top with Kisenon. Confirm the inline sponsor card from the old landing is gone.

**Step 2: Banner dismiss**

```bash
agent-browser snapshot -i -c | head -10
# Find the dismiss button ref (×)
agent-browser click <ref-of-dismiss-button>
agent-browser screenshot /tmp/v-banner-dismissed.png
```

Verify banner is gone. Reload and verify it returns.

**Step 3: Network observability**

```bash
agent-browser network requests --clear
agent-browser reload && agent-browser wait --load networkidle
agent-browser network requests
```

Verify only same-origin requests, plus one POST to `/api/sponsors/impression`.

**Step 4: Click tracking**

```bash
curl -sI https://md-review-plus.ai/go/kisenon-launch | head -3
```

Expected: 302 to kisenon.com.

**Step 5: /advertise page**

```bash
agent-browser open https://md-review-plus.ai/advertise && agent-browser wait --load networkidle
agent-browser screenshot /tmp/v-advertise.png --full
```

Verify it renders, banner present, no broken link.

**Step 6: Expired-session error page**

```bash
agent-browser open https://md-review-plus.ai/r/totally-fake-session && agent-browser wait --load networkidle
agent-browser screenshot /tmp/v-error.png
```

Verify friendly error UI, banner present, no crypto error leak.

**Step 7: Mobile layout**

```bash
agent-browser set viewport 390 844
node bin/md-review-plus.js test-samples/sample.md --review --remote &
sleep 4
URL=$(grep -oE 'https://md-review-plus.ai/r/[A-Za-z0-9_-]+#[A-Za-z0-9_-]+' /tmp/*output | head -1)
agent-browser open "$URL"
agent-browser wait --load networkidle
agent-browser screenshot /tmp/v-mobile-review.png --full
```

Verify section headings are NOT truncated; buttons are 50/50 split full-width; sticky top bar is two compact rows.

**Step 8: Full review loop still passes (regression)**

Same flow as the manual test we did earlier:
- Click "Approve All" then "Submit Review"
- CLI exits 0 with structured JSON

**Step 9: Admin stats endpoint reflects activity**

```bash
ADMIN_TOKEN=$(ssh ubuntu@ovh-atl "sudo grep MDRP_ADMIN_TOKEN /etc/systemd/system/mdrp-relay.service | cut -d= -f2")
curl -s https://md-review-plus.ai/api/admin/stats -H "Authorization: Bearer $ADMIN_TOKEN" | jq
```

Expected: JSON with `kisenon-launch` impressions > 0 and clicks > 0 (you've now caused some).

---

## Task 53: Update design doc phase tracking, commit

**Files:**
- Modify: `docs/plans/2026-05-15-ad-banner-light-theme-redesign.md`

**Step 1:** Flip Status / Tested / Pushed columns in the Phase tracking table for phases 1-8 from `pending`/`no`/`no` to `done`/`yes`/`yes`.

**Step 2:**

```bash
git add docs/plans/2026-05-15-ad-banner-light-theme-redesign.md
git commit -m "docs: mark redesign phases 1-8 complete"
git push
```

---

## Rollback procedure

If anything goes wrong during deploy:

```bash
# Get previous deployed commit
ssh ubuntu@ovh-atl 'cd /opt/md-review-plus && git log --oneline -2'

# Roll back code
ssh ubuntu@ovh-atl 'cd /opt/md-review-plus && sudo -u ubuntu git checkout <previous-sha>'

# Rebuild
ssh ubuntu@ovh-atl 'cd /opt/md-review-plus && sudo -u ubuntu bun install && sudo -u ubuntu bun run build'
ssh ubuntu@ovh-atl 'sudo cp -r /opt/md-review-plus/dist /opt/md-review-plus/dist.bak && sudo rsync -a /opt/md-review-plus/dist/ /opt/md-review-plus/dist/'

# Revert nginx if Task 35 was applied
# (have a backup of the nginx config before that task)
```

The SQLite DB is additive and safe to leave in place across rollback.

---

## Acceptance criteria

- [x] All relay tests pass (`cd relay && bun test`)
- [x] All SPA + CLI tests pass (`bun test`)
- [x] `bun run typecheck` clean
- [x] `https://md-review-plus.ai/` renders light theme + dark banner at top
- [x] `https://md-review-plus.ai/advertise` renders (no more 404)
- [x] `https://md-review-plus.ai/r/<bad-id>` renders friendly error page
- [x] `curl -I https://md-review-plus.ai/` returns 6 security headers
- [x] `curl https://md-review-plus.ai/api/admin/stats` returns 401 without bearer, 200 with
- [x] Banner is dismissible via × and returns on reload
- [x] Mobile review (390px) shows full section headings + 50/50 buttons
- [x] Full E2E review loop (CLI → URL → submit → CLI exit 0) still works
- [x] Impression beacon fires once per page load per IP per day (verified via admin stats endpoint)
- [x] Click on banner CTA records click + 302s to sponsor URL with UTM intact
- [x] Phase table in design doc updated and committed
