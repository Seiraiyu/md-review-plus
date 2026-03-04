import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SectionReview } from "./SectionReview";
import type { Section } from "../hooks/useSections";

function makeSection(overrides?: Partial<Section>): Section {
  return {
    id: "section-0-architecture",
    heading: "Architecture",
    startLine: 5,
    endLine: 12,
    content: "## Architecture\n\nSome content.",
    status: "pending",
    comment: "",
    ...overrides,
  };
}

describe("SectionReview", () => {
  it("renders section heading with approve/reject buttons", () => {
    render(
      <SectionReview
        section={makeSection()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onComment={vi.fn()}
      >
        <p>Section content</p>
      </SectionReview>
    );

    expect(screen.getByText("Architecture")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument();
  });

  it("calls onApprove when approve button clicked", () => {
    const onApprove = vi.fn();
    render(
      <SectionReview
        section={makeSection()}
        onApprove={onApprove}
        onReject={vi.fn()}
        onComment={vi.fn()}
      >
        <p>Content</p>
      </SectionReview>
    );

    fireEvent.click(screen.getByRole("button", { name: /approve/i }));
    expect(onApprove).toHaveBeenCalled();
  });

  it("calls onReject when reject button clicked", () => {
    const onReject = vi.fn();
    render(
      <SectionReview
        section={makeSection()}
        onApprove={vi.fn()}
        onReject={onReject}
        onComment={vi.fn()}
      >
        <p>Content</p>
      </SectionReview>
    );

    fireEvent.click(screen.getByRole("button", { name: /reject/i }));
    expect(onReject).toHaveBeenCalled();
  });

  it("shows green border when approved", () => {
    const { container } = render(
      <SectionReview
        section={makeSection({ status: "approved" })}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onComment={vi.fn()}
      >
        <p>Content</p>
      </SectionReview>
    );

    expect(container.firstChild).toHaveClass("section-approved");
  });

  it("shows red border when rejected", () => {
    const { container } = render(
      <SectionReview
        section={makeSection({ status: "rejected" })}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onComment={vi.fn()}
      >
        <p>Content</p>
      </SectionReview>
    );

    expect(container.firstChild).toHaveClass("section-rejected");
  });

  it("renders comment textarea and calls onComment", () => {
    const onComment = vi.fn();
    render(
      <SectionReview
        section={makeSection()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onComment={onComment}
      >
        <p>Content</p>
      </SectionReview>
    );

    const textarea = screen.getByPlaceholderText(/comment/i);
    fireEvent.change(textarea, { target: { value: "Needs work" } });
    expect(onComment).toHaveBeenCalledWith("Needs work");
  });

  it("renders children (section content)", () => {
    render(
      <SectionReview
        section={makeSection()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onComment={vi.fn()}
      >
        <p>My section content</p>
      </SectionReview>
    );

    expect(screen.getByText("My section content")).toBeInTheDocument();
  });
});
