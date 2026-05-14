import { describe, it, expect, beforeEach } from 'bun:test';
import { SessionStore } from '../src/sessionStore';

describe('SessionStore', () => {
  let store: SessionStore;
  const now = () => 1_000_000;

  beforeEach(() => {
    store = new SessionStore({ ttlMs: 60_000, maxSessions: 10, now });
  });

  it('creates a session and returns id + expiresAt', () => {
    const s = store.create({
      iv: 'aaa',
      ct: new Uint8Array([1, 2, 3]),
      filename: 'spec.md',
    });
    expect(typeof s.id).toBe('string');
    expect(s.id.length).toBeGreaterThanOrEqual(22);
    expect(s.expiresAt).toBe(1_060_000);
  });

  it('returns a session by id', () => {
    const s = store.create({ iv: 'a', ct: new Uint8Array([1]), filename: 'a.md' });
    const got = store.get(s.id);
    expect(got?.filename).toBe('a.md');
    expect(got?.ct).toEqual(new Uint8Array([1]));
  });

  it('returns undefined for unknown id', () => {
    expect(store.get('missing')).toBeUndefined();
  });

  it('deletes a session', () => {
    const s = store.create({ iv: 'a', ct: new Uint8Array([1]), filename: 'a.md' });
    store.delete(s.id);
    expect(store.get(s.id)).toBeUndefined();
  });

  it('expires sessions past ttl on sweep', () => {
    let t = 1_000_000;
    const local = new SessionStore({ ttlMs: 60_000, maxSessions: 10, now: () => t });
    const s = local.create({ iv: 'a', ct: new Uint8Array([1]), filename: 'a.md' });
    t = 1_060_001;
    local.sweep();
    expect(local.get(s.id)).toBeUndefined();
  });

  it('refuses create when at maxSessions', () => {
    const small = new SessionStore({ ttlMs: 60_000, maxSessions: 2, now });
    small.create({ iv: 'a', ct: new Uint8Array([1]), filename: '1.md' });
    small.create({ iv: 'a', ct: new Uint8Array([1]), filename: '2.md' });
    expect(() =>
      small.create({ iv: 'a', ct: new Uint8Array([1]), filename: '3.md' }),
    ).toThrow(/capacity/i);
  });

  it('stores and reads feedback', () => {
    const s = store.create({ iv: 'a', ct: new Uint8Array([1]), filename: 'a.md' });
    store.setFeedback(s.id, { iv: 'b', ct: 'XYZ' });
    expect(store.get(s.id)?.feedback).toEqual({ iv: 'b', ct: 'XYZ' });
  });

  it('subscribe gets called when feedback arrives', () => {
    const s = store.create({ iv: 'a', ct: new Uint8Array([1]), filename: 'a.md' });
    const received: Array<{ iv: string; ct: string }> = [];
    const unsub = store.subscribe(s.id, (fb) => {
      received.push(fb);
    });
    expect(unsub).toBeDefined();
    store.setFeedback(s.id, { iv: 'b', ct: 'XYZ' });
    expect(received[0]).toEqual({ iv: 'b', ct: 'XYZ' });
  });

  it('subscribe delivers immediately if feedback already set', () => {
    const s = store.create({ iv: 'a', ct: new Uint8Array([1]), filename: 'a.md' });
    store.setFeedback(s.id, { iv: 'b', ct: 'XYZ' });
    const received: Array<{ iv: string; ct: string }> = [];
    store.subscribe(s.id, (fb) => {
      received.push(fb);
    });
    expect(received[0]).toEqual({ iv: 'b', ct: 'XYZ' });
  });
});
