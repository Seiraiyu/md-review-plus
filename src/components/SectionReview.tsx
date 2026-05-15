import type { ReactNode } from 'react';
import type { Section } from '../hooks/useSections';
import '../styles/section-review.css';

interface SectionReviewProps {
  section: Section;
  onApprove: () => void;
  onReject: () => void;
  onComment: (comment: string) => void;
  children: ReactNode;
}

export function SectionReview({
  section,
  onApprove,
  onReject,
  onComment,
  children,
}: SectionReviewProps) {
  const statusClass =
    section.status === 'approved'
      ? 'section-approved'
      : section.status === 'rejected'
        ? 'section-rejected'
        : 'section-pending';

  return (
    <div className={`section-review ${statusClass}`} id={section.id} data-section-id={section.id}>
      <div className="section-review-header">
        <h2 className="section-review-heading">{section.heading}</h2>
      </div>
      <div className="section-review-content">{children}</div>
      <div className="section-review-comment">
        <textarea
          className="section-comment-textarea"
          placeholder={
            section.status === 'rejected' ? 'Describe what needs to change...' : 'Add a comment...'
          }
          value={section.comment}
          onChange={(e) => onComment(e.target.value)}
          rows={section.status === 'rejected' ? 3 : 2}
        />
      </div>
      <div className="section-review-actions">
        <button
          className={`section-action-btn section-action-btn-approve ${section.status === 'approved' ? 'active' : ''}`}
          onClick={onApprove}
          aria-label="Approve"
          title="Approve this section"
        >
          <span className="section-action-icon">&#x2713;</span>
          Approve
        </button>
        <button
          className={`section-action-btn section-action-btn-reject ${section.status === 'rejected' ? 'active' : ''}`}
          onClick={onReject}
          aria-label="Reject"
          title="Reject this section"
        >
          <span className="section-action-icon">&#x2717;</span>
          Reject
        </button>
      </div>
    </div>
  );
}
