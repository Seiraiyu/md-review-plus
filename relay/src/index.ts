import { createApp } from './app';
import { loadConfig } from './config';
import { Analytics } from './analytics';
import { Sponsors } from './sponsors';
import { join } from 'node:path';

const cfg = loadConfig();
const analytics = new Analytics({
  dbPath: join(cfg.dataDir, 'analytics.db'),
  salt: cfg.ipHashSalt,
});
const sponsors = new Sponsors(join(import.meta.dir, '..', 'sponsors.json'));

const { app, store } = await createApp({
  ttlMs: cfg.ttlMs,
  maxSessions: cfg.maxSessions,
  rateLimit: cfg.rateLimitPerHour,
  maxBodyBytes: cfg.maxBodyBytes,
  maxFeedbackBytes: cfg.maxFeedbackBytes,
  staticAssetsRoot: process.env.MDRP_STATIC_ROOT,
  relayStaticRoot: join(import.meta.dir, '..', 'static'),
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
