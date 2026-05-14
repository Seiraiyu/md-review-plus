import { createApp } from './app';
import { loadConfig } from './config';

const cfg = loadConfig();
const { app, store } = await createApp({
  ttlMs: cfg.ttlMs,
  maxSessions: cfg.maxSessions,
  rateLimit: cfg.rateLimitPerHour,
  maxBodyBytes: cfg.maxBodyBytes,
  maxFeedbackBytes: cfg.maxFeedbackBytes,
  staticAssetsRoot: process.env.MDRP_STATIC_ROOT,
});

const SWEEP_INTERVAL_MS = 60_000;
setInterval(() => {
  const removed = store.sweep();
  if (removed > 0) console.log(`swept ${removed} expired sessions`);
}, SWEEP_INTERVAL_MS);

console.log(`md-review-plus relay listening on :${cfg.port}`);

export default {
  port: cfg.port,
  fetch: app.fetch,
};
