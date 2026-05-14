import { describe, it, expect } from 'bun:test';
import { RateLimiter } from '../src/rateLimiter';

describe('RateLimiter', () => {
  it('allows up to limit within window', () => {
    let t = 0;
    const rl = new RateLimiter({ limit: 3, windowMs: 60_000, now: () => t });
    expect(rl.allow('1.2.3.4')).toBe(true);
    expect(rl.allow('1.2.3.4')).toBe(true);
    expect(rl.allow('1.2.3.4')).toBe(true);
    expect(rl.allow('1.2.3.4')).toBe(false);
    void t;
  });

  it('isolates per key', () => {
    let t = 0;
    const rl = new RateLimiter({ limit: 1, windowMs: 60_000, now: () => t });
    expect(rl.allow('a')).toBe(true);
    expect(rl.allow('b')).toBe(true);
    expect(rl.allow('a')).toBe(false);
    void t;
  });

  it('refills after window elapses', () => {
    let t = 0;
    const rl = new RateLimiter({ limit: 1, windowMs: 60_000, now: () => t });
    expect(rl.allow('a')).toBe(true);
    expect(rl.allow('a')).toBe(false);
    t = 60_001;
    expect(rl.allow('a')).toBe(true);
  });
});
