import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SectionNav } from './SectionNav';
import type { Section } from '../hooks/useSections';

function makeSections(): Section[] {
  return [
    {
      id: 'section-0-architecture',
      heading: 'Architecture',
      startLine: 5,
      endLine: 12,
      content: '',
      status: 'approved',
      comment: '',
    },
    {
      id: 'section-1-error-handling',
      heading: 'Error Handling',
      startLine: 14,
      endLine: 22,
      content: '',
      status: 'rejected',
      comment: 'Fix it',
    },
    {
      id: 'section-2-testing',
      heading: 'Testing',
      startLine: 24,
      endLine: 30,
      content: '',
      status: 'pending',
      comment: '',
    },
  ];
}

describe('SectionNav', () => {
  it('renders all section headings', () => {
    render(<SectionNav sections={makeSections()} onSectionClick={vi.fn()} />);

    expect(screen.getByText('Architecture')).toBeInTheDocument();
    expect(screen.getByText('Error Handling')).toBeInTheDocument();
    expect(screen.getByText('Testing')).toBeInTheDocument();
  });

  it('shows progress summary', () => {
    render(<SectionNav sections={makeSections()} onSectionClick={vi.fn()} />);

    // 2 of 3 reviewed (approved + rejected)
    expect(screen.getByText('2/3 reviewed')).toBeInTheDocument();
  });

  it('calls onSectionClick with section id when clicked', () => {
    const onSectionClick = vi.fn();
    render(<SectionNav sections={makeSections()} onSectionClick={onSectionClick} />);

    fireEvent.click(screen.getByText('Architecture'));
    expect(onSectionClick).toHaveBeenCalledWith('section-0-architecture');
  });

  it('shows status indicators for each section', () => {
    const { container } = render(<SectionNav sections={makeSections()} onSectionClick={vi.fn()} />);

    const badges = container.querySelectorAll('.section-nav-badge');
    expect(badges).toHaveLength(3);
  });

  it('renders empty state for no sections', () => {
    render(<SectionNav sections={[]} onSectionClick={vi.fn()} />);

    expect(screen.getByText('No sections')).toBeInTheDocument();
  });
});
