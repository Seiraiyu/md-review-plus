import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Analytics } from '../src/analytics';
import { rmSync } from 'node:fs';

let a: Analytics;
const TMP = '/tmp/mdrp-analytics-test.db';

beforeEach(() => {
  try {
    rmSync(TMP);
  } catch {
    /* ignore */
  }
  a = new Analytics({ dbPath: TMP, salt: 'test-salt' });
});

afterEach(() => {
  a.close();
});

describe('Analytics.recordImpression', () => {
  it("increments today's count for a new (campaign, ip) pair", () => {
    a.recordImpression('kisenon-launch', '1.2.3.4');
    const stats = a.getStats('kisenon-launch');
    expect(stats.allTime.impressions).toBe(1);
    expect(stats.last7d.impressions).toBe(1);
  });

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
});

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

describe('Analytics.sweepDedup', () => {
  it('removes only stale dedup rows; today and yesterday are kept', () => {
    let t = Date.parse('2026-05-15T12:00:00Z');
    const a2 = new Analytics({ dbPath: ':memory:', salt: 's', now: () => t });
    a2.recordImpression('camp', '1.1.1.1'); // day = 2026-05-15
    t = Date.parse('2026-05-14T12:00:00Z');
    a2.recordImpression('camp', '2.2.2.2'); // day = 2026-05-14
    t = Date.parse('2026-05-10T12:00:00Z');
    a2.recordImpression('camp', '3.3.3.3'); // day = 2026-05-10
    t = Date.parse('2026-05-15T12:00:00Z');
    const removed = a2.sweepDedup(); // keep days >= 2026-05-14
    expect(removed).toBe(1);
    a2.close();
  });
});
