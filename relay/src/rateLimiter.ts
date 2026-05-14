export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  now?: () => number;
}

interface Bucket {
  count: number;
  windowStart: number;
}

export class RateLimiter {
  private buckets = new Map<string, Bucket>();
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly nowFn: () => number;

  constructor(opts: RateLimiterOptions) {
    this.limit = opts.limit;
    this.windowMs = opts.windowMs;
    this.nowFn = opts.now ?? Date.now;
  }

  allow(key: string): boolean {
    const now = this.nowFn();
    const b = this.buckets.get(key);
    if (!b || now - b.windowStart >= this.windowMs) {
      this.buckets.set(key, { count: 1, windowStart: now });
      return true;
    }
    if (b.count >= this.limit) return false;
    b.count++;
    return true;
  }
}
