import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'os';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { createApp, formatFeedback } from './app';

describe('createApp /api/artifact', () => {
  let tmp: string;
  let artifactPath: string;
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), 'mdrp-'));
    artifactPath = join(tmp, 'demo.html');
    writeFileSync(artifactPath, '<h1>hello</h1>');
    app = createApp({
      artifactPath,
      baseDir: tmp,
      reviewMode: false,
    });
  });

  afterAll(async () => {
    await app.watcher.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('returns kind=html, content, filename', async () => {
    const res = await app.app.request('/api/artifact');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kind).toBe('html');
    expect(body.content).toBe('<h1>hello</h1>');
    expect(body.filename).toBe('demo.html');
  });

  it('GET /api/files returns kind=html for artifact CLI mode', async () => {
    const res = await app.app.request('/api/files');
    const body = await res.json();
    expect(body.mode).toBe('cli');
    expect(body.kind).toBe('html');
    expect(body.selectedFile).toBe('demo.html');
  });

  it('GET /api/markdown returns 500 in artifact mode (no markdown file)', async () => {
    const res = await app.app.request('/api/markdown');
    expect(res.status).toBe(500);
  });
});

describe('createApp /api/files in markdown CLI mode', () => {
  let tmp: string;
  let mdPath: string;
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), 'mdrp-'));
    mdPath = join(tmp, 'doc.md');
    writeFileSync(mdPath, '# hello');
    app = createApp({
      markdownFilePath: mdPath,
      baseDir: tmp,
      reviewMode: false,
    });
  });

  afterAll(async () => {
    await app.watcher.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('returns kind=markdown', async () => {
    const res = await app.app.request('/api/files');
    const body = await res.json();
    expect(body.mode).toBe('cli');
    expect(body.kind).toBe('markdown');
  });

  it('serves the markdown file', async () => {
    const res = await app.app.request('/api/markdown');
    const body = await res.json();
    expect(body.content).toBe('# hello');
    expect(body.filename).toBe('doc.md');
  });
});

describe('createApp /api/files in dev (directory) mode', () => {
  let tmp: string;
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), 'mdrp-'));
    writeFileSync(join(tmp, 'a.md'), '# a');
    app = createApp({
      baseDir: tmp,
      reviewMode: false,
    });
  });

  afterAll(async () => {
    await app.watcher.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('returns mode=dev, kind=directory', async () => {
    const res = await app.app.request('/api/files');
    const body = await res.json();
    expect(body.mode).toBe('dev');
    expect(body.kind).toBe('directory');
    expect(Array.isArray(body.files)).toBe(true);
  });
});

describe('formatFeedback', () => {
  it('produces bit-identical output for markdown payloads (no interactiveState)', () => {
    const out = formatFeedback({
      sections: [
        { heading: 'A', status: 'rejected', comment: 'fix it' },
        { heading: 'B', status: 'approved', comment: '' },
      ],
      lineComments: [],
      filename: 'doc.md',
    });
    const expected = [
      'Please update the document with the following changes:',
      '',
      '## Needs Changes',
      '',
      '**A**: Rejected',
      '  → fix it',
      '',
      '## Approved',
      '- B',
    ].join('\n');
    expect(out).toBe(expected);
  });

  it('returns short message when all approved with no comments and no interactive state', () => {
    const out = formatFeedback({
      sections: [
        { heading: 'A', status: 'approved', comment: '' },
        { heading: 'B', status: 'approved', comment: '' },
      ],
      lineComments: [],
      filename: 'doc.md',
    });
    expect(out).toBe('All sections approved. No changes needed.');
  });

  it('appends ## Interactive State when present', () => {
    const out = formatFeedback({
      sections: [{ heading: 'A', status: 'approved', comment: '' }],
      lineComments: [],
      filename: 'x.html',
      interactiveState: { state: { foo: 1 }, summary: 'set foo to 1' },
    });
    expect(out).toContain('## Interactive State');
    expect(out).toContain('```json');
    expect(out).toContain('"foo": 1');
    expect(out).toContain('> Natural-language summary: set foo to 1');
  });

  it('emits ## Open Questions when questions are present', () => {
    const out = formatFeedback({
      sections: [{ heading: 'A', status: 'approved', comment: '' }],
      lineComments: [],
      filename: 'x.html',
      openQuestions: [
        { sectionId: 's1', anchor: null, text: 'why this approach?' },
        { sectionId: null, anchor: null, text: 'overall, did I get the goal right?' },
      ],
    });
    expect(out).toContain('## Open Questions');
    expect(out).toContain('- why this approach? (s1)');
    expect(out).toContain('- overall, did I get the goal right?');
  });

  it('emits ## Reactions with bucketed counts', () => {
    const out = formatFeedback({
      sections: [{ heading: 'A', status: 'approved', comment: '' }],
      lineComments: [],
      filename: 'x.html',
      reactions: [
        { targetId: 'card-1', emoji: '👍' },
        { targetId: 'card-1', emoji: '👍' },
        { targetId: 'card-1', emoji: '🎉' },
        { targetId: null, emoji: '🤔' },
      ],
    });
    expect(out).toContain('## Reactions');
    expect(out).toContain('**card-1**: 👍×2 🎉');
    expect(out).toContain('**(overall)**: 🤔');
  });

  it('does not short-circuit when interactiveState present even if all sections approved', () => {
    const out = formatFeedback({
      sections: [{ heading: 'A', status: 'approved', comment: '' }],
      lineComments: [],
      filename: 'x.html',
      interactiveState: { state: { ok: true } },
    });
    expect(out).not.toBe('All sections approved. No changes needed.');
    expect(out).toContain('## Interactive State');
  });
});
