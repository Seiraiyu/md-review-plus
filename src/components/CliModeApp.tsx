import { useState, useEffect, useCallback } from "react";
import { useMarkdown } from "../hooks/useMarkdown";
import { useFileWatch } from "../hooks/useFileWatch";
import { useSections } from "../hooks/useSections";
import { useFeedback } from "../hooks/useFeedback";
import { FeedbackOutput } from "./FeedbackOutput";
import { MarkdownPreview } from "./MarkdownPreview";
import { ErrorDisplay } from "./ErrorDisplay";
import { Comment } from "./CommentList";
import "../styles/review-layout.css";

export const CliModeApp = () => {
  const { content, filename, loading, error, reload } = useMarkdown();
  const [comments, setComments] = useState<Comment[]>([]);
  const [reviewMode, setReviewMode] = useState(false);

  // Watch for file changes and reload
  useFileWatch(() => {
    reload();
  });

  // Check if we're in review mode
  useEffect(() => {
    fetch("/api/review-mode")
      .then((r) => r.json())
      .then((data) => setReviewMode(data.reviewMode))
      .catch(() => setReviewMode(false));
  }, []);

  const { sections, approve, reject, setComment } = useSections(
    content ?? ""
  );
  const { feedback } = useFeedback(sections, comments, filename ?? "file.md");

  const handleSectionClick = useCallback((sectionId: string) => {
    // Find the h2 element with a matching data-line-start for this section
    // The sectionId maps to a section whose startLine corresponds to the h2 heading
    const section = sections.find((s) => s.id === sectionId);
    if (section) {
      const el = document.querySelector(
        `[data-line-start="${section.startLine}"]`
      );
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        // Add a brief highlight
        el.classList.add("highlight-line");
        setTimeout(() => el.classList.remove("highlight-line"), 2000);
      }
    }
  }, [sections]);

  const handleSubmit = useCallback(async () => {
    await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
  }, [sections, comments, filename]);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
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
      <div style={{ padding: "2rem" }}>
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

  // Review layout: left sidebar with section nav + review controls,
  // center with full MarkdownPreview (untouched), bottom with FeedbackOutput
  return (
    <div className="review-layout">
      <div className="review-sidebar">
        <div className="review-sidebar-header">
          {sections.filter((s) => s.status !== "pending").length}/
          {sections.length} reviewed
        </div>
        <div className="review-sidebar-sections">
          {sections.map((section) => (
            <div key={section.id} className="review-sidebar-item">
              <div className="review-sidebar-item-header">
                <button
                  className="review-sidebar-item-link"
                  onClick={() => handleSectionClick(section.id)}
                >
                  <span
                    className={`section-nav-badge section-nav-badge-${section.status}`}
                  />
                  <span className="section-nav-text">{section.heading}</span>
                </button>
                <div className="review-sidebar-item-actions">
                  <button
                    className={`section-btn section-btn-approve ${section.status === "approved" ? "active" : ""}`}
                    onClick={() => approve(section.id)}
                    aria-label={`Approve ${section.heading}`}
                    title="Approve this section"
                  >
                    &#x2713;
                  </button>
                  <button
                    className={`section-btn section-btn-reject ${section.status === "rejected" ? "active" : ""}`}
                    onClick={() => reject(section.id)}
                    aria-label={`Reject ${section.heading}`}
                    title="Reject this section"
                  >
                    &#x2717;
                  </button>
                </div>
              </div>
              <div className="review-sidebar-item-comment">
                <textarea
                  placeholder="Add a comment..."
                  value={section.comment}
                  onChange={(e) => setComment(section.id, e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="review-main">
        <div className="review-content">
          <MarkdownPreview
            content={content}
            filename={filename}
            comments={comments}
            onCommentsChange={setComments}
          />
        </div>
        <FeedbackOutput
          feedback={feedback}
          reviewMode={reviewMode}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
};
