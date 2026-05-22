import { describe, it, expect } from 'vitest';
import { detectArtifactKind } from './artifact-kind.js';

describe('detectArtifactKind', () => {
  it('returns markdown for .md', () => {
    expect(detectArtifactKind('/x/y.md')).toBe('markdown');
  });
  it('returns markdown for .markdown', () => {
    expect(detectArtifactKind('/x/y.markdown')).toBe('markdown');
  });
  it('returns html for .html', () => {
    expect(detectArtifactKind('/x/y.html')).toBe('html');
  });
  it('returns null for unknown', () => {
    expect(detectArtifactKind('/x/y.txt')).toBeNull();
  });
  it('is case-insensitive', () => {
    expect(detectArtifactKind('/x/Y.HTML')).toBe('html');
    expect(detectArtifactKind('/x/Y.MD')).toBe('markdown');
  });
});
