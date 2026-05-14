import { describe, it, expect } from 'bun:test';
import { SessionStore } from '../src/sessionStore';

describe('sweeper', () => {
  it('removes expired entries and keeps fresh ones', () => {
    let t = 1_000_000;
    const s = new SessionStore({ ttlMs: 1000, maxSessions: 100, now: () => t });
    const a = s.create({ iv: 'i', ct: new Uint8Array([1]), filename: 'a.md' });
    t = 1_002_000;
    const b = s.create({ iv: 'i', ct: new Uint8Array([1]), filename: 'b.md' });
    s.sweep();
    expect(s.get(a.id)).toBeUndefined();
    expect(s.get(b.id)).toBeDefined();
  });
});
