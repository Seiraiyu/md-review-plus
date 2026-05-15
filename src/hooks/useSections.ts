import { useState, useMemo, useCallback } from 'react';

export interface Section {
  id: string;
  heading: string;
  startLine: number;
  endLine: number;
  content: string;
  status: 'pending' | 'approved' | 'rejected';
  comment: string;
}

interface ParsedContent {
  intro: string;
  sections: Section[];
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'section'
  );
}

function generateIds(headings: string[]): string[] {
  const counts: Record<string, number> = {};
  return headings.map((h) => {
    const slug = slugify(h);
    counts[slug] = (counts[slug] ?? 0) + 1;
    return counts[slug] === 1 ? `section-${slug}` : `section-${slug}-${counts[slug]}`;
  });
}

function parseMarkdownSections(
  content: string,
  singleSectionFallback: boolean = false,
): ParsedContent {
  if (!content) {
    return { intro: '', sections: [] };
  }

  const lines = content.split('\n');
  const sectionStarts: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^## /)) {
      sectionStarts.push(i);
    }
  }

  if (sectionStarts.length === 0) {
    if (singleSectionFallback) {
      // Find heading from first # line, or use "Document"
      const firstH1 = lines.find((l) => l.match(/^# /));
      const heading = firstH1 ? firstH1.replace(/^# /, '') : 'Document';
      return {
        intro: '',
        sections: [
          {
            id: generateIds([heading])[0],
            heading,
            startLine: 1,
            endLine: lines.length,
            content,
            status: 'pending' as const,
            comment: '',
          },
        ],
      };
    }
    return { intro: content, sections: [] };
  }

  const intro = lines.slice(0, sectionStarts[0]).join('\n');

  const headings = sectionStarts.map((start) => lines[start].replace(/^## /, ''));
  const ids = generateIds(headings);

  const sections: Section[] = sectionStarts.map((start, i) => {
    const end = i + 1 < sectionStarts.length ? sectionStarts[i + 1] : lines.length;
    const heading = headings[i];
    const sectionLines = lines.slice(start, end);
    while (sectionLines.length > 0 && sectionLines[sectionLines.length - 1] === '') {
      sectionLines.pop();
    }

    return {
      id: ids[i],
      heading,
      startLine: start + 1,
      endLine: start + sectionLines.length,
      content: lines.slice(start, end).join('\n'),
      status: 'pending' as const,
      comment: '',
    };
  });

  return { intro, sections };
}

export function useSections(content: string, singleSectionFallback: boolean = false) {
  const parsed = useMemo(
    () => parseMarkdownSections(content, singleSectionFallback),
    [content, singleSectionFallback],
  );

  const [sectionState, setSectionState] = useState<
    Map<string, { status: Section['status']; comment: string }>
  >(new Map());

  const sections = useMemo(
    () =>
      parsed.sections.map((s) => {
        const state = sectionState.get(s.id);
        return state ? { ...s, ...state } : s;
      }),
    [parsed.sections, sectionState],
  );

  const approve = useCallback((id: string) => {
    setSectionState((prev) => {
      const next = new Map(prev);
      const current = next.get(id);
      next.set(id, {
        status: current?.status === 'approved' ? 'pending' : 'approved',
        comment: current?.comment ?? '',
      });
      return next;
    });
  }, []);

  const reject = useCallback((id: string) => {
    setSectionState((prev) => {
      const next = new Map(prev);
      const current = next.get(id);
      next.set(id, {
        status: current?.status === 'rejected' ? 'pending' : 'rejected',
        comment: current?.comment ?? '',
      });
      return next;
    });
  }, []);

  const approveAll = useCallback(() => {
    setSectionState((prev) => {
      const next = new Map(prev);
      for (const s of parsed.sections) {
        const current = next.get(s.id);
        next.set(s.id, { status: 'approved', comment: current?.comment ?? '' });
      }
      return next;
    });
  }, [parsed.sections]);

  const clearAll = useCallback(() => {
    setSectionState(new Map());
  }, []);

  const setComment = useCallback((id: string, comment: string) => {
    setSectionState((prev) => {
      const next = new Map(prev);
      const current = next.get(id);
      next.set(id, {
        status: current?.status ?? 'pending',
        comment,
      });
      return next;
    });
  }, []);

  return {
    intro: parsed.intro,
    sections,
    approve,
    reject,
    approveAll,
    clearAll,
    setComment,
  };
}
