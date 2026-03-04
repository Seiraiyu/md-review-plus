import { useState, useCallback } from "react";
import "../styles/feedback-output.css";

interface FeedbackOutputProps {
  feedback: string;
  reviewMode: boolean;
  onSubmit: () => void;
}

export function FeedbackOutput({
  feedback,
  reviewMode,
  onSubmit,
}: FeedbackOutputProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(feedback);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [feedback]);

  return (
    <div className="feedback-output">
      <div className="feedback-output-header">
        <button
          className="feedback-output-toggle"
          onClick={() => setCollapsed(!collapsed)}
          aria-label="Feedback"
        >
          <span className={`feedback-chevron ${collapsed ? "collapsed" : ""}`}>
            ▾
          </span>
          Feedback Output
        </button>
        <div className="feedback-output-actions">
          {reviewMode ? (
            <button
              className="feedback-btn feedback-btn-submit"
              onClick={onSubmit}
              aria-label="Submit Review"
            >
              Submit Review
            </button>
          ) : (
            <button
              className="feedback-btn feedback-btn-copy"
              onClick={handleCopy}
              aria-label="Copy"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          )}
        </div>
      </div>
      <div
        className={`feedback-output-body ${collapsed ? "collapsed" : ""}`}
      >
        <pre className="feedback-output-text">{feedback}</pre>
      </div>
    </div>
  );
}
