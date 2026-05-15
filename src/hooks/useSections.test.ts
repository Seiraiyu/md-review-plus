import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSections } from './useSections';

const SAMPLE_MARKDOWN = `# Title

Intro paragraph.

## Architecture

Architecture content here.
More architecture details.

## Error Handling

Error handling content.

## Testing

Testing content.
`;

describe('useSections', () => {
  it('parses ## headings into sections', () => {
    const { result } = renderHook(() => useSections(SAMPLE_MARKDOWN));

    expect(result.current.sections).toHaveLength(3);
    expect(result.current.sections[0].heading).toBe('Architecture');
    expect(result.current.sections[1].heading).toBe('Error Handling');
    expect(result.current.sections[2].heading).toBe('Testing');
  });

  it('assigns correct line ranges', () => {
    const { result } = renderHook(() => useSections(SAMPLE_MARKDOWN));

    // "## Architecture" is on line 5 (1-based, index 4)
    expect(result.current.sections[0].startLine).toBe(5);
    // Last non-empty line in Architecture section is line 8 ("More architecture details.")
    // The implementation trims trailing empty lines when computing endLine
    expect(result.current.sections[0].endLine).toBe(8);

    // "## Error Handling" is on line 10, last content line is 12
    expect(result.current.sections[1].startLine).toBe(10);
    expect(result.current.sections[1].endLine).toBe(12);

    // "## Testing" is on line 14, last content line is 16
    expect(result.current.sections[2].startLine).toBe(14);
    expect(result.current.sections[2].endLine).toBe(16);
  });

  it('extracts intro content before first ##', () => {
    const { result } = renderHook(() => useSections(SAMPLE_MARKDOWN));

    expect(result.current.intro).toContain('# Title');
    expect(result.current.intro).toContain('Intro paragraph.');
    expect(result.current.intro).not.toContain('## Architecture');
  });

  it('extracts section content (including heading)', () => {
    const { result } = renderHook(() => useSections(SAMPLE_MARKDOWN));

    expect(result.current.sections[0].content).toContain('## Architecture');
    expect(result.current.sections[0].content).toContain('Architecture content here.');
  });

  it('initializes all sections as pending', () => {
    const { result } = renderHook(() => useSections(SAMPLE_MARKDOWN));

    for (const section of result.current.sections) {
      expect(section.status).toBe('pending');
      expect(section.comment).toBe('');
    }
  });

  it('approves a section', () => {
    const { result } = renderHook(() => useSections(SAMPLE_MARKDOWN));

    act(() => {
      result.current.approve(result.current.sections[0].id);
    });

    expect(result.current.sections[0].status).toBe('approved');
  });

  it('rejects a section', () => {
    const { result } = renderHook(() => useSections(SAMPLE_MARKDOWN));

    act(() => {
      result.current.reject(result.current.sections[1].id);
    });

    expect(result.current.sections[1].status).toBe('rejected');
  });

  it('sets a comment on a section', () => {
    const { result } = renderHook(() => useSections(SAMPLE_MARKDOWN));

    act(() => {
      result.current.setComment(result.current.sections[0].id, 'Looks good');
    });

    expect(result.current.sections[0].comment).toBe('Looks good');
  });

  it('toggles approved → pending when clicking approve again', () => {
    const { result } = renderHook(() => useSections(SAMPLE_MARKDOWN));

    act(() => {
      result.current.approve(result.current.sections[0].id);
    });
    expect(result.current.sections[0].status).toBe('approved');

    act(() => {
      result.current.approve(result.current.sections[0].id);
    });
    expect(result.current.sections[0].status).toBe('pending');
  });

  it('toggles rejected → pending when clicking reject again', () => {
    const { result } = renderHook(() => useSections(SAMPLE_MARKDOWN));

    act(() => {
      result.current.reject(result.current.sections[1].id);
    });
    expect(result.current.sections[1].status).toBe('rejected');

    act(() => {
      result.current.reject(result.current.sections[1].id);
    });
    expect(result.current.sections[1].status).toBe('pending');
  });

  it('returns empty sections for content with no ## headings', () => {
    const { result } = renderHook(() => useSections('# Just a title\n\nSome text.'));

    expect(result.current.sections).toHaveLength(0);
    expect(result.current.intro).toContain('# Just a title');
  });

  it('handles empty content', () => {
    const { result } = renderHook(() => useSections(''));

    expect(result.current.sections).toHaveLength(0);
    expect(result.current.intro).toBe('');
  });

  it('preserves section state when headings are reordered', () => {
    const before = `# Title\n\n## Alpha\n\nA body.\n\n## Beta\n\nB body.\n`;
    const after = `# Title\n\n## Beta\n\nB body.\n\n## Alpha\n\nA body.\n`;
    const { result, rerender } = renderHook(({ content }) => useSections(content), {
      initialProps: { content: before },
    });
    act(() => result.current.approve(result.current.sections[0].id));
    expect(result.current.sections[0].status).toBe('approved');

    rerender({ content: after });
    const alpha = result.current.sections.find((s) => s.heading === 'Alpha');
    expect(alpha?.status).toBe('approved');
  });

  it('preserves section state when a new heading is inserted above an in-progress section', () => {
    const before = `# Title\n\n## Architecture\n\nbody\n`;
    const after = `# Title\n\n## Goals\n\nnew section\n\n## Architecture\n\nbody\n`;
    const { result, rerender } = renderHook(({ content }) => useSections(content), {
      initialProps: { content: before },
    });
    act(() => result.current.approve(result.current.sections[0].id));
    expect(result.current.sections[0].status).toBe('approved');

    rerender({ content: after });
    const arch = result.current.sections.find((s) => s.heading === 'Architecture');
    expect(arch?.status).toBe('approved');
  });

  it('assigns distinct deterministic IDs to duplicate headings', () => {
    const content = `# Title\n\n## Notes\n\nfirst\n\n## Notes\n\nsecond\n`;
    const { result } = renderHook(() => useSections(content));
    expect(result.current.sections).toHaveLength(2);
    expect(result.current.sections[0].id).not.toBe(result.current.sections[1].id);

    act(() => result.current.approve(result.current.sections[0].id));
    expect(result.current.sections[0].status).toBe('approved');
    expect(result.current.sections[1].status).toBe('pending');
  });
});
