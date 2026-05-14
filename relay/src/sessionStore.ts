import { randomBytes } from 'node:crypto';

export interface SessionInput {
  iv: string;
  ct: Uint8Array;
  filename: string;
}

export interface SessionFeedback {
  iv: string;
  ct: string;
}

export interface Session {
  id: string;
  iv: string;
  ct: Uint8Array;
  filename: string;
  createdAt: number;
  expiresAt: number;
  feedback?: SessionFeedback;
}

export interface SessionStoreOptions {
  ttlMs: number;
  maxSessions: number;
  now?: () => number;
}

type FeedbackListener = (fb: SessionFeedback) => void;

export class SessionStore {
  private sessions = new Map<string, Session>();
  private listeners = new Map<string, Set<FeedbackListener>>();
  private readonly ttlMs: number;
  private readonly maxSessions: number;
  private readonly nowFn: () => number;

  constructor(opts: SessionStoreOptions) {
    this.ttlMs = opts.ttlMs;
    this.maxSessions = opts.maxSessions;
    this.nowFn = opts.now ?? Date.now;
  }

  create(input: SessionInput): { id: string; expiresAt: number } {
    if (this.sessions.size >= this.maxSessions) {
      throw new Error('Relay at capacity');
    }
    const id = randomBytes(16).toString('base64url');
    const createdAt = this.nowFn();
    const expiresAt = createdAt + this.ttlMs;
    this.sessions.set(id, { id, ...input, createdAt, expiresAt });
    return { id, expiresAt };
  }

  get(id: string): Session | undefined {
    const s = this.sessions.get(id);
    if (!s) return undefined;
    if (s.expiresAt < this.nowFn()) {
      this.delete(id);
      return undefined;
    }
    return s;
  }

  delete(id: string): void {
    this.sessions.delete(id);
    this.listeners.delete(id);
  }

  setFeedback(id: string, fb: SessionFeedback): void {
    const s = this.sessions.get(id);
    if (!s) return;
    s.feedback = fb;
    const subs = this.listeners.get(id);
    if (subs) {
      for (const fn of subs) fn(fb);
    }
  }

  subscribe(id: string, fn: FeedbackListener): (() => void) | undefined {
    const s = this.get(id);
    if (!s) return undefined;
    if (s.feedback) {
      fn(s.feedback);
      return () => {};
    }
    let set = this.listeners.get(id);
    if (!set) {
      set = new Set();
      this.listeners.set(id, set);
    }
    set.add(fn);
    return () => set!.delete(fn);
  }

  sweep(): number {
    const now = this.nowFn();
    let removed = 0;
    for (const [id, s] of this.sessions) {
      if (s.expiresAt < now) {
        this.sessions.delete(id);
        this.listeners.delete(id);
        removed++;
      }
    }
    return removed;
  }

  size(): number {
    return this.sessions.size;
  }
}
