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
