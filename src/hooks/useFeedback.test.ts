import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFeedback } from './useFeedback';
import type { Section } from './useSections';

function makeSection(overrides: Partial<Section> & { heading: string }): Section {
  return {
    id: `section-0-${overrides.heading.toLowerCase().replace(/\s+/g, '-')}`,
    startLine: 1,
    endLine: 10,
    content: '',
    status: 'pending',
    comment: '',
    ...overrides,
  };
}

interface LineComment {
  id: string;
  text: string;
  selectedText: string;
  startLine: number;
  endLine: number;
  createdAt: Date;
}

function makeComment(overrides: Partial<LineComment>): LineComment {
  return {
    id: 'c1',
    text: 'Fix this',
    selectedText: 'some text',
    startLine: 5,
    endLine: 5,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('useFeedback', () => {
  it('returns all-approved message when everything is approved and no comments', () => {
    const sections = [
      makeSection({ heading: 'Architecture', status: 'approved' }),
      makeSection({ heading: 'Data Flow', status: 'approved' }),
    ];

    const { result } = renderHook(() => useFeedback(sections, [], 'plan.md'));

    expect(result.current.feedback).toBe('All sections approved. No changes needed.');
  });

  it('lists rejected sections under Needs Changes', () => {
    const sections = [
      makeSection({
        heading: 'Error Handling',
        status: 'rejected',
        comment: 'Add retry logic for API failures',
      }),
      makeSection({ heading: 'Architecture', status: 'approved' }),
    ];

    const { result } = renderHook(() => useFeedback(sections, [], 'plan.md'));

    expect(result.current.feedback).toContain('## Needs Changes');
    expect(result.current.feedback).toContain('**Error Handling**');
    expect(result.current.feedback).toContain('Add retry logic for API failures');
  });

  it('lists approved sections under Approved', () => {
    const sections = [
      makeSection({ heading: 'Architecture', status: 'approved' }),
      makeSection({
        heading: 'Error Handling',
        status: 'rejected',
        comment: 'Fix it',
      }),
    ];

    const { result } = renderHook(() => useFeedback(sections, [], 'plan.md'));

    expect(result.current.feedback).toContain('## Approved');
    expect(result.current.feedback).toContain('- Architecture');
  });

  it('includes line comments', () => {
    const sections = [makeSection({ heading: 'Architecture', status: 'approved' })];
    const comments = [
      makeComment({
        startLine: 17,
        endLine: 17,
        selectedText: 'the cache invalidation strategy',
        text: "This won't work with distributed systems",
      }),
    ];

    const { result } = renderHook(() => useFeedback(sections, comments, 'plan.md'));

    expect(result.current.feedback).toContain('## Line Comments');
    expect(result.current.feedback).toContain('plan.md:L17');
    expect(result.current.feedback).toContain('the cache invalidation strategy');
    expect(result.current.feedback).toContain("This won't work with distributed systems");
  });

  it('shows line range for multi-line comments', () => {
    const sections = [makeSection({ heading: 'Architecture', status: 'approved' })];
    const comments = [
      makeComment({
        startLine: 42,
        endLine: 45,
        selectedText: 'retry after 5 seconds',
        text: 'Use exponential backoff instead',
      }),
    ];

    const { result } = renderHook(() => useFeedback(sections, comments, 'plan.md'));

    expect(result.current.feedback).toContain('plan.md:L42-L45');
  });

  it('includes header line for non-trivial feedback', () => {
    const sections = [
      makeSection({
        heading: 'Error Handling',
        status: 'rejected',
        comment: 'Fix it',
      }),
    ];

    const { result } = renderHook(() => useFeedback(sections, [], 'plan.md'));

    expect(result.current.feedback).toContain(
      'Please update the document with the following changes:',
    );
  });

  it('omits sections with pending status from Approved list', () => {
    const sections = [
      makeSection({ heading: 'Architecture', status: 'approved' }),
      makeSection({ heading: 'Pending Section', status: 'pending' }),
      makeSection({
        heading: 'Error Handling',
        status: 'rejected',
        comment: 'Fix',
      }),
    ];

    const { result } = renderHook(() => useFeedback(sections, [], 'plan.md'));

    expect(result.current.feedback).not.toContain('Pending Section');
  });

  it('returns isAllApproved flag', () => {
    const allApproved = [
      makeSection({ heading: 'A', status: 'approved' }),
      makeSection({ heading: 'B', status: 'approved' }),
    ];

    const { result: r1 } = renderHook(() => useFeedback(allApproved, [], 'plan.md'));
    expect(r1.current.isAllApproved).toBe(true);

    const mixed = [
      makeSection({ heading: 'A', status: 'approved' }),
      makeSection({ heading: 'B', status: 'rejected', comment: 'No' }),
    ];

    const { result: r2 } = renderHook(() => useFeedback(mixed, [], 'plan.md'));
    expect(r2.current.isAllApproved).toBe(false);
  });
});
