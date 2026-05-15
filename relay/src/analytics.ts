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
        try {
          mkdirSync(dir, { recursive: true });
        } catch {
          /* ignore */
        }
      }
    }
    this.db = new Database(opts.dbPath);
    this.db.exec(SCHEMA);
    this.salt = opts.salt;
    this.now = opts.now ?? Date.now;
  }

  ipHash(ip: string, day: string): string {
    return createHash('sha256').update(`${ip}:${day}:${this.salt}`).digest('hex').slice(0, 32);
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
    const where = sinceDay ? 'campaign_id = ? AND day >= ?' : 'campaign_id = ?';
    const params: string[] = sinceDay ? [campaignId, sinceDay] : [campaignId];
    const row = this.db
      .query(`SELECT COALESCE(SUM(count),0) AS n FROM ${table} WHERE ${where}`)
      .get(...params) as { n: number } | null;
    return row?.n ?? 0;
  }

  getStats(campaignId: string): CampaignStatsRollup {
    const now = this.now();
    const d7 = daysAgoUtc(now, 6);
    const d30 = daysAgoUtc(now, 29);
    const mk = (imps: number, clk: number): CampaignStats => ({
      impressions: imps,
      clicks: clk,
      ctr: imps > 0 ? Math.round((clk / imps) * 10_000) / 10_000 : 0,
    });
    return {
      last7d: mk(
        this.sumWhere('impressions', campaignId, d7),
        this.sumWhere('clicks', campaignId, d7),
      ),
      last30d: mk(
        this.sumWhere('impressions', campaignId, d30),
        this.sumWhere('clicks', campaignId, d30),
      ),
      allTime: mk(this.sumWhere('impressions', campaignId), this.sumWhere('clicks', campaignId)),
    };
  }

  getAllStats(): Record<string, CampaignStatsRollup> {
    const rows = this.db
      .query(
        'SELECT DISTINCT campaign_id FROM impressions UNION SELECT DISTINCT campaign_id FROM clicks',
      )
      .all() as { campaign_id: string }[];
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
