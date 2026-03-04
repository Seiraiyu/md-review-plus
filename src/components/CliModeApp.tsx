import { useState, useEffect, useCallback, useRef } from 'react';
import { useMarkdown } from '../hooks/useMarkdown';
import { useFileWatch } from '../hooks/useFileWatch';
import { useSections } from '../hooks/useSections';
import { useFeedback } from '../hooks/useFeedback';
import { useDarkMode } from '../hooks/useDarkMode';
import { MarkdownPreview } from './MarkdownPreview';
import { MarkdownSection } from './MarkdownSection';
import { SectionReview } from './SectionReview';
import { SelectionPopover } from './SelectionPopover';
import { CommentList, Comment } from './CommentList';
import { ErrorDisplay } from './ErrorDisplay';
import { useResizable } from '../hooks/useResizable';
import 'highlight.js/styles/github.css';
import 'highlight.js/styles/github-dark.css';
import '../styles/review-layout.css';
import '../styles/markdown.css';

export const CliModeApp = () => {
  const { content, filename, loading, error, reload } = useMarkdown();
  const [comments, setComments] = useState<Comment[]>([]);
  const [reviewMode, setReviewMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const { isDark } = useDarkMode();

  // Watch for file changes and reload
  useFileWatch(() => {
    reload();
  });

  // Check if we're in review mode
  useEffect(() => {
    fetch('/api/review-mode')
      .then((r) => r.json())
      .then((data) => setReviewMode(data.reviewMode))
      .catch(() => setReviewMode(false));
  }, []);

  // Update highlight.js theme based on dark mode
  useEffect(() => {
    const lightTheme = document.querySelector('link[href*="github.css"]');
    const darkTheme = document.querySelector('link[href*="github-dark.css"]');

    if (lightTheme && darkTheme) {
      if (isDark) {
        (lightTheme as HTMLLinkElement).disabled = true;
        (darkTheme as HTMLLinkElement).disabled = false;
      } else {
        (lightTheme as HTMLLinkElement).disabled = false;
        (darkTheme as HTMLLinkElement).disabled = true;
      }
    }
  }, [isDark]);

  const { intro, sections, approve, reject, approveAll, clearAll, setComment } = useSections(
    content ?? '',
    reviewMode,
  );
  const { feedback } = useFeedback(sections, comments, filename ?? 'file.md');

  const reviewedCount = sections.filter((s) => s.status !== 'pending').length;

  const handleSubmit = useCallback(async () => {
    await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sections: sections.map((s) => ({
          heading: s.heading,
          status: s.status,
          comment: s.comment,
        })),
        lineComments: comments.map((c) => ({
          file: filename,
          startLine: c.startLine,
          endLine: c.endLine,
          selectedText: c.selectedText,
          comment: c.text,
        })),
        filename,
      }),
    });
    window.close();
  }, [sections, comments, filename]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(feedback);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [feedback]);

  // Inline comment handlers
  const handleSubmitComment = (
    comment: string,
    selectedText: string,
    startLine: number,
    endLine: number,
  ) => {
    const newComment: Comment = {
      id: crypto.randomUUID(),
      text: comment,
      selectedText,
      startLine,
      endLine,
      createdAt: new Date(),
    };
    setComments((prev) => [...prev, newComment]);
  };

  const handleDeleteComment = (id: string) => {
    setComments((prev) => prev.filter((c) => c.id !== id));
  };

  const handleDeleteAllComments = () => {
    setComments([]);
  };

  const handleEditComment = (id: string, newText: string) => {
    setComments((prev) => prev.map((c) => (c.id === id ? { ...c, text: newText } : c)));
  };

  const handleLineClick = (line: number) => {
    if (!contentRef.current) return;
    const element = contentRef.current.querySelector(`[data-line-start="${line}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('highlight-line');
      setTimeout(() => element.classList.remove('highlight-line'), 2000);
    }
  };

  const {
    width: commentsSidebarWidth,
    isResizing,
    isCollapsed,
    handleMouseDown,
    toggleCollapse,
  } = useResizable({
    initialWidth: 300,
    minWidth: 250,
    maxWidth: 600,
    storageKey: 'md-review-comments-sidebar-width',
    direction: 'right',
    collapsible: true,
    collapseThreshold: 70,
  });

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  if (!content || !filename) {
    return (
      <div style={{ padding: '2rem' }}>
        <p>No content available</p>
      </div>
    );
  }

  // If there are no ## sections, fall back to the standard MarkdownPreview without review UI
  if (sections.length === 0) {
    return (
      <MarkdownPreview
        content={content}
        filename={filename}
        comments={comments}
        onCommentsChange={setComments}
      />
    );
  }

  const progressPercent = sections.length > 0 ? (reviewedCount / sections.length) * 100 : 0;

  return (
    <div
      className={`markdown-with-comments ${isResizing ? 'resizing' : ''} ${isCollapsed ? 'comments-collapsed' : ''}`}
    >
      <div
        className="markdown-container"
        style={{
          paddingRight: isCollapsed ? '0' : `${commentsSidebarWidth + 20}px`,
        }}
      >
        {/* Sticky top bar */}
        <div className="review-topbar">
          <span className="review-topbar-filename">{filename}</span>
          {reviewMode && <span className="review-mode-badge">REVIEW</span>}
          <span className="review-topbar-spacer" />
          <div className="review-progress">
            <span className="review-progress-text">
              {reviewedCount}/{sections.length} reviewed
            </span>
            <div className="review-progress-bar">
              <div className="review-progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
          <div className="review-topbar-actions">
            <button className="review-approve-all-btn" onClick={approveAll}>
              Approve All
            </button>
            <button className="review-clear-all-btn" onClick={clearAll}>
              Clear All
            </button>
            {reviewMode ? (
              <button className="review-submit-btn" onClick={handleSubmit}>
                Submit Review
              </button>
            ) : (
              <button className="review-copy-btn" onClick={handleCopy}>
                {copied ? 'Copied!' : 'Copy Feedback'}
              </button>
            )}
          </div>
        </div>

        {/* Document content */}
        <div className="review-document" ref={contentRef}>
          {/* Intro content (before first ##) */}
          {intro && (
            <div className="markdown-content">
              <MarkdownSection content={intro} />
            </div>
          )}

          {/* Sections as review cards */}
          {sections.map((section) => (
            <SectionReview
              key={section.id}
              section={section}
              onApprove={() => approve(section.id)}
              onReject={() => reject(section.id)}
              onComment={(comment) => setComment(section.id, comment)}
            >
              <div className="markdown-content">
                <MarkdownSection content={section.content} />
              </div>
            </SectionReview>
          ))}
        </div>

        <SelectionPopover containerRef={contentRef} onSubmitComment={handleSubmitComment} />
      </div>

      {/* Comments sidebar toggle */}
      {isCollapsed && (
        <button
          className="comments-toggle-button"
          onClick={toggleCollapse}
          title="Show comments"
          aria-label="Show comments"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M2 5a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H6l-4 3V5z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {comments.length > 0 && <span className="comments-badge">{comments.length}</span>}
        </button>
      )}

      {/* Comments sidebar */}
      {!isCollapsed && (
        <aside className="comments-sidebar" style={{ width: `${commentsSidebarWidth}px` }}>
          <div className="comments-sidebar-resizer" onMouseDown={handleMouseDown} />
          <CommentList
            comments={[...comments].sort((a, b) => a.startLine - b.startLine)}
            filename={filename}
            onDeleteComment={handleDeleteComment}
            onDeleteAll={handleDeleteAllComments}
            onClose={toggleCollapse}
            onLineClick={handleLineClick}
            onEditComment={handleEditComment}
          />
        </aside>
      )}
    </div>
  );
};
