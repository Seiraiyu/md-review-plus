import { readFileSync, statSync } from 'node:fs';

export interface Campaign {
  id: string;
  name: string;
  tagline: string;
  clickUrl: string;
}

interface SponsorsFile {
  active: string | null;
  campaigns: Record<string, { name: string; tagline: string; clickUrl: string }>;
}

export class Sponsors {
  private path: string;
  private cache: { mtimeMs: number; data: SponsorsFile } | null = null;

  constructor(path: string) {
    this.path = path;
  }

  private load(): SponsorsFile {
    const st = statSync(this.path);
    if (!this.cache || this.cache.mtimeMs !== st.mtimeMs) {
      const raw = readFileSync(this.path, 'utf8');
      const data = JSON.parse(raw) as SponsorsFile;
      this.cache = { mtimeMs: st.mtimeMs, data };
    }
    return this.cache.data;
  }

  getActive(): Campaign {
    const f = this.load();
    const id = f.active ?? 'house';
    const c = f.campaigns[id] ?? f.campaigns.house;
    if (!c) throw new Error(`sponsors.json missing required 'house' campaign`);
    return { id: f.active ?? 'house', ...c };
  }

  getById(id: string): Campaign | undefined {
    const f = this.load();
    const c = f.campaigns[id];
    return c ? { id, ...c } : undefined;
  }
}
