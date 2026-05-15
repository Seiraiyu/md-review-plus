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
  writeFileSync(
    path,
    JSON.stringify({
      active: 'k',
      campaigns: {
        k: { name: 'K', tagline: 't', clickUrl: 'https://k' },
        house: { name: 'H', tagline: 'h', clickUrl: '/advertise' },
      },
    }),
  );
  return path;
}

function tmpStaticRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'mdrp-static-'));
  writeFileSync(
    join(dir, 'landing.html'),
    '<html><body><!-- BANNER --><h1>Hi</h1></body></html>',
  );
  writeFileSync(join(dir, 'advertise.html'), '<html><body><!-- BANNER --></body></html>');
  writeFileSync(
    join(dir, 'error.html'),
    '<html><body><!-- BANNER --><h1>Review link expired</h1></body></html>',
  );
  writeFileSync(join(dir, 'index.html'), '<html><body><div id="root"></div></body></html>');
  return dir;
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
    const { app } = await createApp({
      ttlMs: 60_000,
      maxSessions: 10,
      rateLimit: 100,
      sponsors,
      analytics,
      adminToken: 'tk',
    });
    const r = await app.request('/api/sponsors/current');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      id: 'k',
      name: 'K',
      tagline: 't',
      clickUrl: 'https://k',
    });
  });
});

describe('POST /api/sponsors/impression', () => {
  it('returns 204 and increments count for the campaign', async () => {
    const { app } = await createApp({
      ttlMs: 60_000,
      maxSessions: 10,
      rateLimit: 100,
      sponsors,
      analytics,
      adminToken: 'tk',
    });
    const r = await app.request('/api/sponsors/impression', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
      body: JSON.stringify({ c: 'k' }),
    });
    expect(r.status).toBe(204);
    expect(analytics.getStats('k').allTime.impressions).toBe(1);
  });

  it('ignores unknown campaigns (still 204, no count)', async () => {
    const { app } = await createApp({
      ttlMs: 60_000,
      maxSessions: 10,
      rateLimit: 100,
      sponsors,
      analytics,
      adminToken: 'tk',
    });
    const r = await app.request('/api/sponsors/impression', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
      body: JSON.stringify({ c: 'unknown' }),
    });
    expect(r.status).toBe(204);
    expect(analytics.getStats('unknown').allTime.impressions).toBe(0);
  });
});

describe('GET /go/:campaignId', () => {
  it('302s to campaign clickUrl and records click', async () => {
    const { app } = await createApp({
      ttlMs: 60_000,
      maxSessions: 10,
      rateLimit: 100,
      sponsors,
      analytics,
      adminToken: 'tk',
    });
    const r = await app.request('/go/k', { method: 'GET', redirect: 'manual' });
    expect(r.status).toBe(302);
    expect(r.headers.get('location')).toBe('https://k');
    expect(analytics.getStats('k').allTime.clicks).toBe(1);
  });

  it('unknown campaign 302s to /', async () => {
    const { app } = await createApp({
      ttlMs: 60_000,
      maxSessions: 10,
      rateLimit: 100,
      sponsors,
      analytics,
      adminToken: 'tk',
    });
    const r = await app.request('/go/unknown', { method: 'GET', redirect: 'manual' });
    expect(r.status).toBe(302);
    expect(r.headers.get('location')).toBe('/');
  });
});

describe('GET /api/admin/stats', () => {
  it('401 without token', async () => {
    const { app } = await createApp({
      ttlMs: 60_000,
      maxSessions: 10,
      rateLimit: 100,
      sponsors,
      analytics,
      adminToken: 'tk',
    });
    const r = await app.request('/api/admin/stats');
    expect(r.status).toBe(401);
  });

  it('401 with wrong token', async () => {
    const { app } = await createApp({
      ttlMs: 60_000,
      maxSessions: 10,
      rateLimit: 100,
      sponsors,
      analytics,
      adminToken: 'tk',
    });
    const r = await app.request('/api/admin/stats', {
      headers: { authorization: 'Bearer wrong' },
    });
    expect(r.status).toBe(401);
  });

  it('200 with correct token, returns campaign stats', async () => {
    analytics.recordImpression('k', '1.2.3.4');
    analytics.recordClick('k');
    const { app } = await createApp({
      ttlMs: 60_000,
      maxSessions: 10,
      rateLimit: 100,
      sponsors,
      analytics,
      adminToken: 'tk',
    });
    const r = await app.request('/api/admin/stats', {
      headers: { authorization: 'Bearer tk' },
    });
    expect(r.status).toBe(200);
    const body = (await r.json()) as Record<
      string,
      { allTime: { impressions: number; clicks: number } }
    >;
    expect(body.k.allTime.impressions).toBe(1);
    expect(body.k.allTime.clicks).toBe(1);
  });
});

describe('GET / (landing)', () => {
  it('injects banner snippet into landing.html', async () => {
    const dir = tmpStaticRoot();
    const { app } = await createApp({
      ttlMs: 60_000,
      maxSessions: 10,
      rateLimit: 100,
      sponsors,
      analytics,
      adminToken: 'tk',
      staticAssetsRoot: dir,
    });
    const r = await app.request('/');
    expect(r.status).toBe(200);
    const html = await r.text();
    expect(html).toContain('mdrp-banner');
    expect(html).toContain('Hi');
    expect(html).not.toContain('<!-- BANNER -->');
  });
});

describe('GET /r/:id with missing session', () => {
  it('returns 404 with error.html (banner included)', async () => {
    const dir = tmpStaticRoot();
    const { app } = await createApp({
      ttlMs: 60_000,
      maxSessions: 10,
      rateLimit: 100,
      sponsors,
      analytics,
      adminToken: 'tk',
      staticAssetsRoot: dir,
    });
    const r = await app.request('/r/does-not-exist');
    expect(r.status).toBe(404);
    const html = await r.text();
    expect(html).toContain('Review link expired');
    expect(html).toContain('mdrp-banner');
  });
});
