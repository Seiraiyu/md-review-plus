import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { buildSrcdoc } from './shim';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATE_DIR = join(__dirname, '..', '..', 'templates');

const TEMPLATES = readdirSync(TEMPLATE_DIR).filter((f) => f.endsWith('.html'));

describe('HTML templates', () => {
  it('has all expected templates (original 5 + rich set)', () => {
    expect(TEMPLATES.sort()).toEqual([
      'concept-map.html',
      'config-editor.html',
      'design-grid.html',
      'design-tuner.html',
      'diff-review.html',
      'pr-review.html',
      'priority-board.html',
      'review-doc.html',
    ]);
  });
});

describe.each(TEMPLATES)('template %s', (name) => {
  const src = readFileSync(join(TEMPLATE_DIR, name), 'utf-8');

  it('contains an mdrp.ready call', () => {
    expect(src).toMatch(/window\.mdrp\.ready\s*\(/);
  });

  it('declares an mdrp:template header with name', () => {
    expect(src).toMatch(/mdrp:template name=/);
  });

  it('embeds in buildSrcdoc without throwing', () => {
    const doc = buildSrcdoc(src);
    expect(doc).toContain('Content-Security-Policy');
    expect(doc).toContain('mdrp:template name=');
  });
});
