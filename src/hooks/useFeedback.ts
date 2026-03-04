import { useMemo } from "react";
import type { Section } from "./useSections";

interface LineComment {
  id: string;
  text: string;
  selectedText: string;
  startLine: number;
  endLine: number;
  createdAt: Date;
}

interface FeedbackResult {
  feedback: string;
  isAllApproved: boolean;
}

export function useFeedback(
  sections: Section[],
  comments: LineComment[],
  filename: string
): FeedbackResult {
  return useMemo(() => {
    const rejected = sections.filter((s) => s.status === "rejected");
    const approved = sections.filter((s) => s.status === "approved");
    const hasAnyComment = sections.some((s) => s.comment.trim() !== "");
    const isAllApproved =
      sections.length > 0 &&
      approved.length === sections.length &&
      comments.length === 0 &&
      !hasAnyComment;

    if (isAllApproved) {
      return {
        feedback: "All sections approved. No changes needed.",
        isAllApproved: true,
      };
    }

    const parts: string[] = [];
    parts.push("Please update the document with the following changes:");

    if (rejected.length > 0) {
      parts.push("");
      parts.push("## Needs Changes");
      for (const section of rejected) {
        parts.push("");
        parts.push(`**${section.heading}**: Rejected`);
        if (section.comment) {
          parts.push(`  → ${section.comment}`);
        }
      }
    }

    // Section comments on approved/pending sections
    const otherWithComments = sections.filter(
      (s) => s.status !== "rejected" && s.comment.trim() !== ""
    );
    if (otherWithComments.length > 0) {
      parts.push("");
      parts.push("## Section Comments");
      for (const section of otherWithComments) {
        parts.push("");
        parts.push(`**${section.heading}**`);
        parts.push(`  → ${section.comment}`);
      }
    }

    if (comments.length > 0) {
      parts.push("");
      parts.push("## Line Comments");
      for (const comment of comments) {
        parts.push("");
        const lineRef =
          comment.startLine === comment.endLine
            ? `${filename}:L${comment.startLine}`
            : `${filename}:L${comment.startLine}-L${comment.endLine}`;
        parts.push(lineRef);
        parts.push(`"${comment.selectedText}"`);
        parts.push(`→ ${comment.text}`);
      }
    }

    if (approved.length > 0) {
      parts.push("");
      parts.push("## Approved");
      for (const section of approved) {
        parts.push(`- ${section.heading}`);
      }
    }

    return {
      feedback: parts.join("\n"),
      isAllApproved: false,
    };
  }, [sections, comments, filename]);
}
