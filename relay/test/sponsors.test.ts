import { describe, it, expect } from 'bun:test';
import { Sponsors } from '../src/sponsors';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function tmpJson(obj: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), 'mdrp-sponsors-'));
  const path = join(dir, 'sponsors.json');
  writeFileSync(path, JSON.stringify(obj));
  return path;
}

describe('Sponsors', () => {
  it('returns the active campaign when set', () => {
    const path = tmpJson({
      active: 'k',
      campaigns: {
        k: { name: 'K', tagline: 't', clickUrl: 'https://k' },
        house: { name: 'H', tagline: 'h', clickUrl: '/advertise' },
      },
    });
    const s = new Sponsors(path);
    const c = s.getActive();
    expect(c.id).toBe('k');
    expect(c.name).toBe('K');
  });

  it('returns house campaign when active is null', () => {
    const path = tmpJson({
      active: null,
      campaigns: { house: { name: 'H', tagline: 'h', clickUrl: '/advertise' } },
    });
    const s = new Sponsors(path);
    expect(s.getActive().id).toBe('house');
  });

  it('returns campaign by id', () => {
    const path = tmpJson({
      active: 'k',
      campaigns: {
        k: { name: 'K', tagline: 't', clickUrl: 'https://k' },
        house: { name: 'H', tagline: 'h', clickUrl: '/advertise' },
      },
    });
    const s = new Sponsors(path);
    expect(s.getById('k')?.name).toBe('K');
    expect(s.getById('nope')).toBeUndefined();
  });
});
