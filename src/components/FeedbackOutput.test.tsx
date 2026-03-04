import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FeedbackOutput } from './FeedbackOutput';

describe('FeedbackOutput', () => {
  it('renders feedback text', () => {
    render(
      <FeedbackOutput
        feedback="All sections approved. No changes needed."
        reviewMode={false}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText('All sections approved. No changes needed.')).toBeInTheDocument();
  });

  it('shows Submit Review button in review mode', () => {
    render(<FeedbackOutput feedback="Some feedback" reviewMode={true} onSubmit={vi.fn()} />);

    expect(screen.getByRole('button', { name: /submit review/i })).toBeInTheDocument();
  });

  it('shows Copy button in browse mode', () => {
    render(<FeedbackOutput feedback="Some feedback" reviewMode={false} onSubmit={vi.fn()} />);

    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
  });

  it('calls onSubmit when Submit Review is clicked', () => {
    const onSubmit = vi.fn();
    render(<FeedbackOutput feedback="Some feedback" reviewMode={true} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: /submit review/i }));
    expect(onSubmit).toHaveBeenCalled();
  });

  it('is collapsible', () => {
    const { container } = render(
      <FeedbackOutput feedback="Some feedback" reviewMode={false} onSubmit={vi.fn()} />,
    );

    const toggle = screen.getByRole('button', { name: /feedback/i });
    fireEvent.click(toggle);

    expect(container.querySelector('.feedback-output-body')).toHaveClass('collapsed');
  });
});
