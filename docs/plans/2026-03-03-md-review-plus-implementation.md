# md-review-plus Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fork md-review v1.3.2 and extend it with section-level review workflow, structured feedback output, and a blocking CLI mode for AI agent integration.

**Architecture:** Fork the upstream Hono + Vite + React app. Keep the existing markdown rendering and line-level comment system intact. Layer section review (approve/reject per `##` heading) on top via new hooks and components. Add a `POST /api/submit` endpoint that formats structured feedback to stdout and shuts down the server. The `--review` CLI flag enables blocking mode with auto-shutdown.

**Tech Stack:** Bun (package manager + runtime), Hono (server), Vite (build), React 19, TypeScript, react-markdown, vitest

**Design Doc:** `docs/plans/2026-03-03-md-review-plus-design.md`

---

## Phase 1: Fork & Setup

### Task 1: Fork upstream and set up project

**Files:**
- Modify: `package.json`
- Create: `bunfig.toml`
- Delete: `pnpm-workspace.yaml`, `pnpm-lock.yaml`

**Step 1: Add upstream as remote and merge code**

```bash
cd /home/stonelyd/md-review-plus
git remote add upstream https://github.com/ryo-manba/md-review.git
git fetch upstream
git merge upstream/main --allow-unrelated-histories -m "Merge upstream md-review v1.3.2"
```

Resolve any conflicts (the only local file is `docs/plans/`). Keep both sides.

**Step 2: Rename package and update identifiers**

In `package.json`, change:
```json
{
  "name": "md-review-plus",
  "bin": {
    "md-review-plus": "bin/md-review-plus.js"
  }
}
```

Remove the `packageManager` field (we're switching to Bun).

Rename the CLI entry point:
```bash
mv bin/md-review.js bin/md-review-plus.js
```

In `bin/md-review-plus.js`, update the help text to say `md-review-plus` instead of `md-review`.

**Step 3: Create bunfig.toml**

```toml
[install]
peer = false
```

**Step 4: Delete pnpm files**

```bash
rm -f pnpm-workspace.yaml pnpm-lock.yaml
```

**Step 5: Install dependencies with Bun**

```bash
bun install
```

**Step 6: Verify the app builds and runs**

```bash
bun run build
```

Expected: Build succeeds, `dist/` directory created.

```bash
bun run test
```

Expected: Existing tests pass.

**Step 7: Commit**

```bash
git add -A
git commit -m "fork: rename to md-review-plus, convert pnpm to bun"
```

---

### Task 2: Convert server to TypeScript

The upstream `server/index.js` is plain JavaScript. Convert it to TypeScript for consistency with the rest of the codebase.

**Files:**
- Delete: `server/index.js`
- Create: `server/index.ts`
- Modify: `package.json` (update scripts)
- Modify: `bin/md-review-plus.js` (update server path)

**Step 1: Rename and convert server file**

Copy `server/index.js` to `server/index.ts`. Add type annotations:

- Import types from Hono: `import { Hono } from 'hono'`
- Type the file scanning function params and return
- Type SSE client tracking
- Type route handler params

Keep all logic identical — this is a mechanical conversion, not a refactor.

**Step 2: Update package.json scripts**

Change the `server` script:
```json
"server": "bun run server/index.ts"
```

**Step 3: Update CLI entry point**

In `bin/md-review-plus.js`, change the server spawn to use `bun`:
```javascript
const serverProcess = spawn('bun', ['run', 'server/index.ts'], {
  // ... keep existing options
});
```

**Step 4: Update package.json files field**

```json
"files": ["bin", "dist", "server"]
```

**Step 5: Verify server starts**

```bash
bun run server
```

Expected: "API Server running on http://localhost:3030" (or similar). Ctrl+C to stop.

**Step 6: Verify full dev mode works**

```bash
bun run dev
```

Expected: Both server and client start. Browser opens to the app.

**Step 7: Commit**

```bash
git add -A
git commit -m "chore: convert server to TypeScript, use bun runtime"
```

---

## Phase 2: Data Layer (Hooks)

### Task 3: Create useSections hook

This hook parses markdown content to extract `##` sections and manages their review state (pending/approved/rejected + comments).

**Files:**
- Create: `src/hooks/useSections.ts`
- Create: `src/hooks/useSections.test.ts`

**Step 1: Write the failing tests**

Create `src/hooks/useSections.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSections } from "./useSections";

const SAMPLE_MARKDOWN = `# Title

Intro paragraph.

## Architecture

Architecture content here.
More architecture details.

## Error Handling

Error handling content.

## Testing

Testing content.
`;

describe("useSections", () => {
  it("parses ## headings into sections", () => {
    const { result } = renderHook(() => useSections(SAMPLE_MARKDOWN));

    expect(result.current.sections).toHaveLength(3);
    expect(result.current.sections[0].heading).toBe("Architecture");
    expect(result.current.sections[1].heading).toBe("Error Handling");
    expect(result.current.sections[2].heading).toBe("Testing");
  });

  it("assigns correct line ranges", () => {
    const { result } = renderHook(() => useSections(SAMPLE_MARKDOWN));

    // "## Architecture" is on line 5 (1-based)
    expect(result.current.sections[0].startLine).toBe(5);
    // Ends just before "## Error Handling" on line 10
    expect(result.current.sections[0].endLine).toBe(9);
  });

  it("extracts intro content before first ##", () => {
    const { result } = renderHook(() => useSections(SAMPLE_MARKDOWN));

    expect(result.current.intro).toContain("# Title");
    expect(result.current.intro).toContain("Intro paragraph.");
    expect(result.current.intro).not.toContain("## Architecture");
  });

  it("extracts section content (including heading)", () => {
    const { result } = renderHook(() => useSections(SAMPLE_MARKDOWN));

    expect(result.current.sections[0].content).toContain(
      "## Architecture"
    );
    expect(result.current.sections[0].content).toContain(
      "Architecture content here."
    );
  });

  it("initializes all sections as pending", () => {
    const { result } = renderHook(() => useSections(SAMPLE_MARKDOWN));

    for (const section of result.current.sections) {
      expect(section.status).toBe("pending");
      expect(section.comment).toBe("");
    }
  });

  it("approves a section", () => {
    const { result } = renderHook(() => useSections(SAMPLE_MARKDOWN));

    act(() => {
      result.current.approve(result.current.sections[0].id);
    });

    expect(result.current.sections[0].status).toBe("approved");
  });

  it("rejects a section", () => {
    const { result } = renderHook(() => useSections(SAMPLE_MARKDOWN));

    act(() => {
      result.current.reject(result.current.sections[1].id);
    });

    expect(result.current.sections[1].status).toBe("rejected");
  });

  it("sets a comment on a section", () => {
    const { result } = renderHook(() => useSections(SAMPLE_MARKDOWN));

    act(() => {
      result.current.setComment(result.current.sections[0].id, "Looks good");
    });

    expect(result.current.sections[0].comment).toBe("Looks good");
  });

  it("toggles approved → pending when clicking approve again", () => {
    const { result } = renderHook(() => useSections(SAMPLE_MARKDOWN));

    act(() => {
      result.current.approve(result.current.sections[0].id);
    });
    expect(result.current.sections[0].status).toBe("approved");

    act(() => {
      result.current.approve(result.current.sections[0].id);
    });
    expect(result.current.sections[0].status).toBe("pending");
  });

  it("returns empty sections for content with no ## headings", () => {
    const { result } = renderHook(() => useSections("# Just a title\n\nSome text."));

    expect(result.current.sections).toHaveLength(0);
    expect(result.current.intro).toContain("# Just a title");
  });

  it("handles empty content", () => {
    const { result } = renderHook(() => useSections(""));

    expect(result.current.sections).toHaveLength(0);
    expect(result.current.intro).toBe("");
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
bun run test src/hooks/useSections.test.ts
```

Expected: FAIL — module `./useSections` not found.

**Step 3: Implement useSections hook**

Create `src/hooks/useSections.ts`:

```typescript
import { useState, useMemo, useCallback } from "react";

export interface Section {
  id: string;
  heading: string;
  startLine: number;
  endLine: number;
  content: string;
  status: "pending" | "approved" | "rejected";
  comment: string;
}

interface ParsedContent {
  intro: string;
  sections: Section[];
}

function generateId(heading: string, index: number): string {
  return `section-${index}-${heading.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function parseMarkdownSections(content: string): ParsedContent {
  if (!content) {
    return { intro: "", sections: [] };
  }

  const lines = content.split("\n");
  const sectionStarts: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^## /)) {
      sectionStarts.push(i);
    }
  }

  if (sectionStarts.length === 0) {
    return { intro: content, sections: [] };
  }

  const intro = lines.slice(0, sectionStarts[0]).join("\n");

  const sections: Section[] = sectionStarts.map((start, i) => {
    const end =
      i + 1 < sectionStarts.length ? sectionStarts[i + 1] : lines.length;
    const heading = lines[start].replace(/^## /, "");
    const sectionLines = lines.slice(start, end);
    // Remove trailing empty lines from section content
    while (sectionLines.length > 0 && sectionLines[sectionLines.length - 1] === "") {
      sectionLines.pop();
    }

    return {
      id: generateId(heading, i),
      heading,
      startLine: start + 1, // 1-based
      endLine: start + sectionLines.length, // 1-based, inclusive
      content: lines.slice(start, end).join("\n"),
      status: "pending" as const,
      comment: "",
    };
  });

  return { intro, sections };
}

export function useSections(content: string) {
  const parsed = useMemo(() => parseMarkdownSections(content), [content]);

  const [sectionState, setSectionState] = useState<
    Map<string, { status: Section["status"]; comment: string }>
  >(new Map());

  const sections = useMemo(
    () =>
      parsed.sections.map((s) => {
        const state = sectionState.get(s.id);
        return state ? { ...s, ...state } : s;
      }),
    [parsed.sections, sectionState]
  );

  const approve = useCallback((id: string) => {
    setSectionState((prev) => {
      const next = new Map(prev);
      const current = next.get(id);
      next.set(id, {
        status: current?.status === "approved" ? "pending" : "approved",
        comment: current?.comment ?? "",
      });
      return next;
    });
  }, []);

  const reject = useCallback((id: string) => {
    setSectionState((prev) => {
      const next = new Map(prev);
      const current = next.get(id);
      next.set(id, {
        status: current?.status === "rejected" ? "pending" : "rejected",
        comment: current?.comment ?? "",
      });
      return next;
    });
  }, []);

  const setComment = useCallback((id: string, comment: string) => {
    setSectionState((prev) => {
      const next = new Map(prev);
      const current = next.get(id);
      next.set(id, {
        status: current?.status ?? "pending",
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
    setComment,
  };
}
```

**Step 4: Run tests to verify they pass**

```bash
bun run test src/hooks/useSections.test.ts
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/hooks/useSections.ts src/hooks/useSections.test.ts
git commit -m "feat: add useSections hook for section-level review state"
```

---

### Task 4: Create useFeedback hook

This hook generates the structured feedback prompt string from sections and line comments.

**Files:**
- Create: `src/hooks/useFeedback.ts`
- Create: `src/hooks/useFeedback.test.ts`

**Step 1: Write the failing tests**

Create `src/hooks/useFeedback.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFeedback } from "./useFeedback";
import type { Section } from "./useSections";

function makeSection(
  overrides: Partial<Section> & { heading: string }
): Section {
  return {
    id: `section-0-${overrides.heading.toLowerCase().replace(/\s+/g, "-")}`,
    startLine: 1,
    endLine: 10,
    content: "",
    status: "pending",
    comment: "",
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
    id: "c1",
    text: "Fix this",
    selectedText: "some text",
    startLine: 5,
    endLine: 5,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("useFeedback", () => {
  it("returns all-approved message when everything is approved and no comments", () => {
    const sections = [
      makeSection({ heading: "Architecture", status: "approved" }),
      makeSection({ heading: "Data Flow", status: "approved" }),
    ];

    const { result } = renderHook(() =>
      useFeedback(sections, [], "plan.md")
    );

    expect(result.current.feedback).toBe(
      "All sections approved. No changes needed."
    );
  });

  it("lists rejected sections under Needs Changes", () => {
    const sections = [
      makeSection({
        heading: "Error Handling",
        status: "rejected",
        comment: "Add retry logic for API failures",
      }),
      makeSection({ heading: "Architecture", status: "approved" }),
    ];

    const { result } = renderHook(() =>
      useFeedback(sections, [], "plan.md")
    );

    expect(result.current.feedback).toContain("## Needs Changes");
    expect(result.current.feedback).toContain("**Error Handling**");
    expect(result.current.feedback).toContain(
      "Add retry logic for API failures"
    );
  });

  it("lists approved sections under Approved", () => {
    const sections = [
      makeSection({ heading: "Architecture", status: "approved" }),
      makeSection({
        heading: "Error Handling",
        status: "rejected",
        comment: "Fix it",
      }),
    ];

    const { result } = renderHook(() =>
      useFeedback(sections, [], "plan.md")
    );

    expect(result.current.feedback).toContain("## Approved");
    expect(result.current.feedback).toContain("- Architecture");
  });

  it("includes line comments", () => {
    const sections = [
      makeSection({ heading: "Architecture", status: "approved" }),
    ];
    const comments = [
      makeComment({
        startLine: 17,
        endLine: 17,
        selectedText: "the cache invalidation strategy",
        text: "This won't work with distributed systems",
      }),
    ];

    const { result } = renderHook(() =>
      useFeedback(sections, comments, "plan.md")
    );

    expect(result.current.feedback).toContain("## Line Comments");
    expect(result.current.feedback).toContain("plan.md:L17");
    expect(result.current.feedback).toContain(
      "the cache invalidation strategy"
    );
    expect(result.current.feedback).toContain(
      "This won't work with distributed systems"
    );
  });

  it("shows line range for multi-line comments", () => {
    const sections = [
      makeSection({ heading: "Architecture", status: "approved" }),
    ];
    const comments = [
      makeComment({
        startLine: 42,
        endLine: 45,
        selectedText: "retry after 5 seconds",
        text: "Use exponential backoff instead",
      }),
    ];

    const { result } = renderHook(() =>
      useFeedback(sections, comments, "plan.md")
    );

    expect(result.current.feedback).toContain("plan.md:L42-L45");
  });

  it("includes header line for non-trivial feedback", () => {
    const sections = [
      makeSection({
        heading: "Error Handling",
        status: "rejected",
        comment: "Fix it",
      }),
    ];

    const { result } = renderHook(() =>
      useFeedback(sections, [], "plan.md")
    );

    expect(result.current.feedback).toContain(
      "Please update the document with the following changes:"
    );
  });

  it("omits sections with pending status from Approved list", () => {
    const sections = [
      makeSection({ heading: "Architecture", status: "approved" }),
      makeSection({ heading: "Pending Section", status: "pending" }),
      makeSection({
        heading: "Error Handling",
        status: "rejected",
        comment: "Fix",
      }),
    ];

    const { result } = renderHook(() =>
      useFeedback(sections, [], "plan.md")
    );

    expect(result.current.feedback).not.toContain("Pending Section");
  });

  it("returns isAllApproved flag", () => {
    const allApproved = [
      makeSection({ heading: "A", status: "approved" }),
      makeSection({ heading: "B", status: "approved" }),
    ];

    const { result: r1 } = renderHook(() =>
      useFeedback(allApproved, [], "plan.md")
    );
    expect(r1.current.isAllApproved).toBe(true);

    const mixed = [
      makeSection({ heading: "A", status: "approved" }),
      makeSection({ heading: "B", status: "rejected", comment: "No" }),
    ];

    const { result: r2 } = renderHook(() =>
      useFeedback(mixed, [], "plan.md")
    );
    expect(r2.current.isAllApproved).toBe(false);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
bun run test src/hooks/useFeedback.test.ts
```

Expected: FAIL — module `./useFeedback` not found.

**Step 3: Implement useFeedback hook**

Create `src/hooks/useFeedback.ts`:

```typescript
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
    const isAllApproved =
      sections.length > 0 &&
      approved.length === sections.length &&
      comments.length === 0;

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
```

**Step 4: Run tests to verify they pass**

```bash
bun run test src/hooks/useFeedback.test.ts
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/hooks/useFeedback.ts src/hooks/useFeedback.test.ts
git commit -m "feat: add useFeedback hook for structured feedback generation"
```

---

## Phase 3: Server API

### Task 5: Add POST /api/submit endpoint

This endpoint receives the review state, formats it as structured feedback, prints to stdout, and shuts down the server when in review mode.

**Files:**
- Modify: `server/index.ts`

**Step 1: Add the review-mode endpoint**

In `server/index.ts`, add a route that returns whether the server is in review mode:

```typescript
app.get("/api/review-mode", (c) => {
  return c.json({ reviewMode: process.env.REVIEW_MODE === "true" });
});
```

**Step 2: Add the submit endpoint**

In `server/index.ts`, add the submit route. This is the core integration point:

```typescript
interface SubmitBody {
  sections: Array<{
    heading: string;
    status: "approved" | "rejected" | "pending";
    comment: string;
  }>;
  lineComments: Array<{
    file: string;
    startLine: number;
    endLine: number;
    selectedText: string;
    comment: string;
  }>;
  filename: string;
}

app.post("/api/submit", async (c) => {
  const body = await c.req.json<SubmitBody>();
  const feedback = formatFeedback(body);

  // Print feedback to stdout (this is what the CLI captures)
  console.log(feedback);

  // Respond to client first
  const response = c.json({ ok: true });

  // If in review mode, schedule shutdown
  if (process.env.REVIEW_MODE === "true") {
    setTimeout(() => {
      process.exit(0);
    }, 100);
  }

  return response;
});

function formatFeedback(body: SubmitBody): string {
  const { sections, lineComments, filename } = body;
  const rejected = sections.filter((s) => s.status === "rejected");
  const approved = sections.filter((s) => s.status === "approved");

  const isAllApproved =
    sections.length > 0 &&
    approved.length === sections.length &&
    lineComments.length === 0;

  if (isAllApproved) {
    return "All sections approved. No changes needed.";
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

  if (lineComments.length > 0) {
    parts.push("");
    parts.push("## Line Comments");
    for (const comment of lineComments) {
      parts.push("");
      const lineRef =
        comment.startLine === comment.endLine
          ? `${filename}:L${comment.startLine}`
          : `${filename}:L${comment.startLine}-L${comment.endLine}`;
      parts.push(lineRef);
      parts.push(`"${comment.selectedText}"`);
      parts.push(`→ ${comment.comment}`);
    }
  }

  if (approved.length > 0) {
    parts.push("");
    parts.push("## Approved");
    for (const section of approved) {
      parts.push(`- ${section.heading}`);
    }
  }

  return parts.join("\n");
}
```

**Step 3: Verify server starts with new endpoints**

```bash
REVIEW_MODE=true bun run server/index.ts &
sleep 1
curl -s http://localhost:3030/api/review-mode
# Expected: {"reviewMode":true}
kill %1
```

**Step 4: Commit**

```bash
git add server/index.ts
git commit -m "feat: add POST /api/submit and GET /api/review-mode endpoints"
```

---

## Phase 4: UI Components

### Task 6: Create SectionReview component

This component wraps a section of markdown content and provides approve/reject buttons + a comment textarea.

**Files:**
- Create: `src/components/SectionReview.tsx`
- Create: `src/components/SectionReview.test.tsx`
- Create: `src/styles/section-review.css`

**Step 1: Write failing tests**

Create `src/components/SectionReview.test.tsx`:

```tsx
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
```

**Step 2: Run tests to verify they fail**

```bash
bun run test src/components/SectionReview.test.tsx
```

Expected: FAIL — module not found.

**Step 3: Implement SectionReview component**

Create `src/components/SectionReview.tsx`:

```tsx
import type { ReactNode } from "react";
import type { Section } from "../hooks/useSections";
import "../styles/section-review.css";

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
    section.status === "approved"
      ? "section-approved"
      : section.status === "rejected"
        ? "section-rejected"
        : "section-pending";

  return (
    <div
      className={`section-review ${statusClass}`}
      id={section.id}
      data-section-id={section.id}
    >
      <div className="section-review-header">
        <h2 className="section-review-heading">{section.heading}</h2>
        <div className="section-review-actions">
          <button
            className={`section-btn section-btn-approve ${section.status === "approved" ? "active" : ""}`}
            onClick={onApprove}
            aria-label="Approve"
            title="Approve this section"
          >
            ✓
          </button>
          <button
            className={`section-btn section-btn-reject ${section.status === "rejected" ? "active" : ""}`}
            onClick={onReject}
            aria-label="Reject"
            title="Reject this section"
          >
            ✗
          </button>
        </div>
      </div>
      <div className="section-review-content">{children}</div>
      <div className="section-review-comment">
        <textarea
          className="section-comment-textarea"
          placeholder="Add a comment..."
          value={section.comment}
          onChange={(e) => onComment(e.target.value)}
          rows={2}
        />
      </div>
    </div>
  );
}
```

Create `src/styles/section-review.css`:

```css
.section-review {
  border-left: 3px solid var(--border-color, #e0e0e0);
  margin: 1rem 0;
  padding: 0 1rem;
  transition: border-color 0.2s ease;
}

.section-review.section-approved {
  border-left-color: #2da44e;
}

.section-review.section-rejected {
  border-left-color: #cf222e;
}

.section-review.section-pending {
  border-left-color: var(--border-color, #e0e0e0);
}

.section-review-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.25rem 0;
}

.section-review-heading {
  margin: 0;
  flex: 1;
}

.section-review-actions {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
}

.section-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid var(--border-color, #d0d7de);
  background: var(--bg-secondary, #f6f8fa);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  transition: all 0.15s ease;
}

.section-btn:hover {
  opacity: 0.8;
}

.section-btn-approve.active {
  background: #2da44e;
  color: white;
  border-color: #2da44e;
}

.section-btn-reject.active {
  background: #cf222e;
  color: white;
  border-color: #cf222e;
}

.section-review-content {
  padding: 0.25rem 0;
}

.section-review-comment {
  padding: 0.25rem 0 0.5rem;
}

.section-comment-textarea {
  width: 100%;
  min-height: 40px;
  padding: 0.5rem;
  border: 1px solid var(--border-color, #d0d7de);
  border-radius: 6px;
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #1f2328);
  font-family: inherit;
  font-size: 0.875rem;
  resize: vertical;
  box-sizing: border-box;
}

.section-comment-textarea:focus {
  outline: none;
  border-color: #0969da;
  box-shadow: 0 0 0 3px rgba(9, 105, 218, 0.3);
}

/* Dark mode overrides */
.dark-mode .section-review {
  --border-color: #30363d;
  --bg-secondary: #161b22;
  --bg-primary: #0d1117;
  --text-primary: #e6edf3;
}
```

**Step 4: Run tests to verify they pass**

```bash
bun run test src/components/SectionReview.test.tsx
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/components/SectionReview.tsx src/components/SectionReview.test.tsx src/styles/section-review.css
git commit -m "feat: add SectionReview component with approve/reject/comment controls"
```

---

### Task 7: Create SectionNav component

Left sidebar TOC generated from `##` headings with status badges and progress summary.

**Files:**
- Create: `src/components/SectionNav.tsx`
- Create: `src/components/SectionNav.test.tsx`
- Create: `src/styles/section-nav.css`

**Step 1: Write failing tests**

Create `src/components/SectionNav.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SectionNav } from "./SectionNav";
import type { Section } from "../hooks/useSections";

function makeSections(): Section[] {
  return [
    {
      id: "section-0-architecture",
      heading: "Architecture",
      startLine: 5,
      endLine: 12,
      content: "",
      status: "approved",
      comment: "",
    },
    {
      id: "section-1-error-handling",
      heading: "Error Handling",
      startLine: 14,
      endLine: 22,
      content: "",
      status: "rejected",
      comment: "Fix it",
    },
    {
      id: "section-2-testing",
      heading: "Testing",
      startLine: 24,
      endLine: 30,
      content: "",
      status: "pending",
      comment: "",
    },
  ];
}

describe("SectionNav", () => {
  it("renders all section headings", () => {
    render(
      <SectionNav sections={makeSections()} onSectionClick={vi.fn()} />
    );

    expect(screen.getByText("Architecture")).toBeInTheDocument();
    expect(screen.getByText("Error Handling")).toBeInTheDocument();
    expect(screen.getByText("Testing")).toBeInTheDocument();
  });

  it("shows progress summary", () => {
    render(
      <SectionNav sections={makeSections()} onSectionClick={vi.fn()} />
    );

    // 2 of 3 reviewed (approved + rejected)
    expect(screen.getByText("2/3 reviewed")).toBeInTheDocument();
  });

  it("calls onSectionClick with section id when clicked", () => {
    const onSectionClick = vi.fn();
    render(
      <SectionNav sections={makeSections()} onSectionClick={onSectionClick} />
    );

    fireEvent.click(screen.getByText("Architecture"));
    expect(onSectionClick).toHaveBeenCalledWith("section-0-architecture");
  });

  it("shows status indicators for each section", () => {
    const { container } = render(
      <SectionNav sections={makeSections()} onSectionClick={vi.fn()} />
    );

    const badges = container.querySelectorAll(".section-nav-badge");
    expect(badges).toHaveLength(3);
  });

  it("renders empty state for no sections", () => {
    render(<SectionNav sections={[]} onSectionClick={vi.fn()} />);

    expect(screen.getByText("No sections")).toBeInTheDocument();
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
bun run test src/components/SectionNav.test.tsx
```

Expected: FAIL — module not found.

**Step 3: Implement SectionNav component**

Create `src/components/SectionNav.tsx`:

```tsx
import type { Section } from "../hooks/useSections";
import "../styles/section-nav.css";

interface SectionNavProps {
  sections: Section[];
  onSectionClick: (sectionId: string) => void;
}

export function SectionNav({ sections, onSectionClick }: SectionNavProps) {
  if (sections.length === 0) {
    return (
      <nav className="section-nav">
        <div className="section-nav-empty">No sections</div>
      </nav>
    );
  }

  const reviewed = sections.filter(
    (s) => s.status === "approved" || s.status === "rejected"
  ).length;

  return (
    <nav className="section-nav">
      <div className="section-nav-summary">
        {reviewed}/{sections.length} reviewed
      </div>
      <ul className="section-nav-list">
        {sections.map((section) => (
          <li key={section.id} className="section-nav-item">
            <button
              className="section-nav-link"
              onClick={() => onSectionClick(section.id)}
            >
              <span
                className={`section-nav-badge section-nav-badge-${section.status}`}
              />
              <span className="section-nav-text">{section.heading}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

Create `src/styles/section-nav.css`:

```css
.section-nav {
  width: 220px;
  min-width: 220px;
  border-right: 1px solid var(--border-color, #d0d7de);
  padding: 1rem 0;
  overflow-y: auto;
  height: 100%;
  box-sizing: border-box;
}

.section-nav-summary {
  padding: 0 1rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary, #656d76);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.section-nav-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.section-nav-item {
  margin: 0;
}

.section-nav-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 1rem;
  border: none;
  background: none;
  cursor: pointer;
  text-align: left;
  font-size: 0.875rem;
  color: var(--text-primary, #1f2328);
  transition: background 0.1s;
}

.section-nav-link:hover {
  background: var(--bg-hover, #f6f8fa);
}

.section-nav-badge {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.section-nav-badge-pending {
  background: var(--text-secondary, #656d76);
  opacity: 0.4;
}

.section-nav-badge-approved {
  background: #2da44e;
}

.section-nav-badge-rejected {
  background: #cf222e;
}

.section-nav-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.section-nav-empty {
  padding: 1rem;
  color: var(--text-secondary, #656d76);
  font-size: 0.875rem;
}

/* Dark mode */
.dark-mode .section-nav {
  --border-color: #30363d;
  --text-primary: #e6edf3;
  --text-secondary: #8b949e;
  --bg-hover: #161b22;
}
```

**Step 4: Run tests to verify they pass**

```bash
bun run test src/components/SectionNav.test.tsx
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/components/SectionNav.tsx src/components/SectionNav.test.tsx src/styles/section-nav.css
git commit -m "feat: add SectionNav sidebar with TOC and status badges"
```

---

### Task 8: Create FeedbackOutput component

Bottom panel that displays the structured feedback prompt with submit/copy buttons.

**Files:**
- Create: `src/components/FeedbackOutput.tsx`
- Create: `src/components/FeedbackOutput.test.tsx`
- Create: `src/styles/feedback-output.css`

**Step 1: Write failing tests**

Create `src/components/FeedbackOutput.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FeedbackOutput } from "./FeedbackOutput";

describe("FeedbackOutput", () => {
  it("renders feedback text", () => {
    render(
      <FeedbackOutput
        feedback="All sections approved. No changes needed."
        reviewMode={false}
        onSubmit={vi.fn()}
      />
    );

    expect(
      screen.getByText("All sections approved. No changes needed.")
    ).toBeInTheDocument();
  });

  it("shows Submit Review button in review mode", () => {
    render(
      <FeedbackOutput
        feedback="Some feedback"
        reviewMode={true}
        onSubmit={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: /submit review/i })
    ).toBeInTheDocument();
  });

  it("shows Copy button in browse mode", () => {
    render(
      <FeedbackOutput
        feedback="Some feedback"
        reviewMode={false}
        onSubmit={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: /copy/i })
    ).toBeInTheDocument();
  });

  it("calls onSubmit when Submit Review is clicked", () => {
    const onSubmit = vi.fn();
    render(
      <FeedbackOutput
        feedback="Some feedback"
        reviewMode={true}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /submit review/i }));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("is collapsible", () => {
    const { container } = render(
      <FeedbackOutput
        feedback="Some feedback"
        reviewMode={false}
        onSubmit={vi.fn()}
      />
    );

    const toggle = screen.getByRole("button", { name: /feedback/i });
    fireEvent.click(toggle);

    expect(container.querySelector(".feedback-output-body")).toHaveClass(
      "collapsed"
    );
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
bun run test src/components/FeedbackOutput.test.tsx
```

Expected: FAIL — module not found.

**Step 3: Implement FeedbackOutput component**

Create `src/components/FeedbackOutput.tsx`:

```tsx
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
```

Create `src/styles/feedback-output.css`:

```css
.feedback-output {
  border-top: 1px solid var(--border-color, #d0d7de);
  background: var(--bg-secondary, #f6f8fa);
}

.feedback-output-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
}

.feedback-output-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #1f2328);
}

.feedback-chevron {
  transition: transform 0.2s;
}

.feedback-chevron.collapsed {
  transform: rotate(-90deg);
}

.feedback-output-actions {
  display: flex;
  gap: 0.5rem;
}

.feedback-btn {
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  border: 1px solid var(--border-color, #d0d7de);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.feedback-btn-submit {
  background: #2da44e;
  color: white;
  border-color: #2da44e;
}

.feedback-btn-submit:hover {
  background: #218838;
}

.feedback-btn-copy {
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #1f2328);
}

.feedback-btn-copy:hover {
  background: var(--bg-hover, #eaeef2);
}

.feedback-output-body {
  overflow: hidden;
  max-height: 300px;
  transition: max-height 0.2s ease;
}

.feedback-output-body.collapsed {
  max-height: 0;
}

.feedback-output-text {
  margin: 0;
  padding: 0.75rem 1rem;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.8125rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-y: auto;
  max-height: 250px;
  color: var(--text-primary, #1f2328);
}

/* Dark mode */
.dark-mode .feedback-output {
  --border-color: #30363d;
  --bg-secondary: #161b22;
  --bg-primary: #0d1117;
  --bg-hover: #21262d;
  --text-primary: #e6edf3;
}
```

**Step 4: Run tests to verify they pass**

```bash
bun run test src/components/FeedbackOutput.test.tsx
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/components/FeedbackOutput.tsx src/components/FeedbackOutput.test.tsx src/styles/feedback-output.css
git commit -m "feat: add FeedbackOutput panel with submit and copy buttons"
```

---

## Phase 5: Integration

### Task 9: Wire section review into CliModeApp

This is the main integration task. We modify `CliModeApp.tsx` to use the new hooks and components, creating the full review layout.

**Files:**
- Modify: `src/components/CliModeApp.tsx`
- Create: `src/styles/review-layout.css`

**Step 1: Read the current CliModeApp to understand existing structure**

Read `src/components/CliModeApp.tsx` and understand how it currently works:
- It uses `useMarkdown()` for content
- It uses `useFileWatch()` for hot reload
- It passes content to `MarkdownPreview`
- Comments are in component state

**Step 2: Add review layout styles**

Create `src/styles/review-layout.css`:

```css
.review-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.review-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.review-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 2rem;
}

.review-intro {
  padding-bottom: 1rem;
}

.review-sections {
  padding-bottom: 2rem;
}
```

**Step 3: Update CliModeApp with section review integration**

Modify `src/components/CliModeApp.tsx` to add the review system. The updated component should:

1. Import and use `useSections` hook
2. Import and use `useFeedback` hook
3. Fetch `/api/review-mode` on mount to determine if Submit button should show
4. Render `SectionNav` as left sidebar
5. Split markdown content rendering: render intro with react-markdown, then each section wrapped in `SectionReview`
6. Render `FeedbackOutput` at the bottom
7. Keep existing `MarkdownPreview` comment system (SelectionPopover + CommentList) working alongside section review
8. Handle submit: POST to `/api/submit` with sections + lineComments

Key integration points:

```tsx
import { useState, useEffect, useCallback } from "react";
import { useMarkdown } from "../hooks/useMarkdown";
import { useFileWatch } from "../hooks/useFileWatch";
import { useSections } from "../hooks/useSections";
import { useFeedback } from "../hooks/useFeedback";
import { SectionNav } from "./SectionNav";
import { SectionReview } from "./SectionReview";
import { FeedbackOutput } from "./FeedbackOutput";
import { MarkdownPreview } from "./MarkdownPreview";
import "../styles/review-layout.css";

// Comment type from existing codebase
interface Comment {
  id: string;
  text: string;
  selectedText: string;
  startLine: number;
  endLine: number;
  createdAt: Date;
}

export const CliModeApp = () => {
  const { content, filename, loading, error, reload } = useMarkdown();
  const [comments, setComments] = useState<Comment[]>([]);
  const [reviewMode, setReviewMode] = useState(false);

  useFileWatch(() => reload());

  // Check if we're in review mode
  useEffect(() => {
    fetch("/api/review-mode")
      .then((r) => r.json())
      .then((data) => setReviewMode(data.reviewMode))
      .catch(() => setReviewMode(false));
  }, []);

  const { intro, sections, approve, reject, setComment } = useSections(
    content ?? ""
  );
  const { feedback } = useFeedback(sections, comments, filename ?? "file.md");

  const handleSectionClick = useCallback((sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
  }, []);

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

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">{error.message}</div>;
  if (!content) return null;

  // If there are no ## sections, fall back to the standard MarkdownPreview
  if (sections.length === 0) {
    return (
      <MarkdownPreview
        content={content}
        filename={filename ?? ""}
        comments={comments}
        onCommentsChange={setComments}
      />
    );
  }

  return (
    <div className="review-layout">
      <SectionNav sections={sections} onSectionClick={handleSectionClick} />
      <div className="review-main">
        <div className="review-content">
          {intro && (
            <div className="review-intro">
              <MarkdownPreview
                content={intro}
                filename={filename ?? ""}
                comments={[]}
                onCommentsChange={() => {}}
              />
            </div>
          )}
          <div className="review-sections">
            {sections.map((section) => (
              <SectionReview
                key={section.id}
                section={section}
                onApprove={() => approve(section.id)}
                onReject={() => reject(section.id)}
                onComment={(text) => setComment(section.id, text)}
              >
                <MarkdownPreview
                  content={section.content}
                  filename={filename ?? ""}
                  comments={comments.filter(
                    (c) =>
                      c.startLine >= section.startLine &&
                      c.endLine <= section.endLine
                  )}
                  onCommentsChange={setComments}
                />
              </SectionReview>
            ))}
          </div>
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
```

**Important:** The above is the target architecture. The exact implementation will need to adapt to the actual `MarkdownPreview` component's interface. Key concerns:

- `MarkdownPreview` renders its own `CommentList` and `SelectionPopover`. When rendered per-section, comments need to be filtered by line range and line offsets may need adjustment.
- If `MarkdownPreview` doesn't easily support being rendered with partial content, you may need to render the full content once and overlay section boundaries using DOM refs. Read the component carefully before implementing.

**Step 4: Verify the app builds**

```bash
bun run build
```

Expected: Build succeeds.

**Step 5: Verify visually**

```bash
echo "# Test\n\nIntro text.\n\n## Section One\n\nFirst section content.\n\n## Section Two\n\nSecond section content." > /tmp/test-review.md
bun run bin/md-review-plus.js /tmp/test-review.md
```

Expected: Browser opens, showing:
- Left sidebar with "Section One" and "Section Two"
- Each section has approve/reject buttons
- Bottom panel shows feedback output

**Step 6: Commit**

```bash
git add src/components/CliModeApp.tsx src/styles/review-layout.css
git commit -m "feat: integrate section review system into CliModeApp"
```

---

## Phase 6: CLI Enhancements

### Task 10: Add --review blocking mode to CLI

When `--review` is passed, the CLI uses a random port, blocks until submit, and exits with structured output.

**Files:**
- Modify: `bin/md-review-plus.js`

**Step 1: Read the current CLI entry point**

Read `bin/md-review-plus.js` carefully. Understand:
- How args are parsed (via `mri`)
- How the server is spawned
- How the browser is opened
- How graceful shutdown works

**Step 2: Add --review flag handling**

Add `review` to the boolean args in mri:
```javascript
const args = mri(process.argv.slice(2), {
  alias: { p: 'port', h: 'help', v: 'version' },
  default: { port: '3030', open: true },
  boolean: ['help', 'version', 'open', 'review'],
});
```

When `--review` is set:
1. Override port to `0` (random available port) unless user specified a port
2. Set `process.env.REVIEW_MODE = 'true'`
3. Require a file argument (not directory mode)
4. Suppress all server log output — only stdout from submit is captured

```javascript
if (args.review) {
  if (!filePath) {
    console.error('Error: --review requires a markdown file path');
    process.exit(1);
  }
  process.env.REVIEW_MODE = 'true';
  // Use port 0 for random port unless explicitly specified
  if (!args.p && !process.argv.includes('--port')) {
    port = '0';
  }
}
```

**Step 3: Capture server stdout for port detection and feedback**

The server prints its actual port on startup. In review mode, we need to:
- Parse the startup message to find the actual port
- Forward only the submit feedback to parent stdout
- On server process exit, propagate the exit code

```javascript
serverProcess.stdout.on('data', (data) => {
  const msg = data.toString();

  // Detect server started message to get actual port
  const portMatch = msg.match(/running on http:\/\/localhost:(\d+)/);
  if (portMatch) {
    actualPort = portMatch[1];
    if (args.open !== false) {
      open(`http://localhost:${actualPort}`);
    }
    return;
  }

  if (args.review) {
    // In review mode, forward all other stdout (this is the feedback)
    process.stdout.write(data);
  }
});

serverProcess.on('exit', (code) => {
  process.exit(code ?? 0);
});
```

**Step 4: Add disconnect detection**

For review mode, if the browser disconnects without submitting, exit with code 1:

The server already has SSE connections. Add a timeout mechanism: if no submit is received within a configurable timeout (default: no timeout, but exit on server shutdown), the CLI exits with code 1.

This is handled by the server process exiting — if the server crashes or is killed, the CLI exits via the `exit` handler above.

For browser disconnect detection, add to the server (in `server/index.ts`):
- Track active SSE connections
- When last SSE connection closes and review mode is active, start a 30-second grace period
- If no new connection or submit within grace period, exit with code 1 and stderr message

```typescript
// In server/index.ts, add to the SSE /api/watch handler
if (process.env.REVIEW_MODE === "true") {
  let disconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // When SSE client disconnects
  c.req.raw.signal.addEventListener("abort", () => {
    // Remove client from set
    clients.delete(client);
    if (clients.size === 0) {
      disconnectTimer = setTimeout(() => {
        console.error("Browser disconnected without submitting review.");
        process.exit(1);
      }, 30_000);
    }
  });

  // Clear timer when new client connects
  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
    disconnectTimer = null;
  }
}
```

**Step 5: Update help text**

Add `--review` to the help output:

```
md-review-plus <file> --review    Review mode (blocks, outputs feedback)
--review               Enable review mode (blocks until submit)
```

**Step 6: Test review mode end-to-end**

```bash
echo "# Test\n\n## Section A\n\nContent A.\n\n## Section B\n\nContent B." > /tmp/test.md
bun run bin/md-review-plus.js /tmp/test.md --review
```

Expected: Browser opens, CLI blocks. After clicking "Submit Review" in browser:
- Structured feedback prints to stdout
- CLI exits with code 0

**Step 7: Commit**

```bash
git add bin/md-review-plus.js server/index.ts
git commit -m "feat: add --review blocking CLI mode with auto-shutdown"
```

---

### Task 11: Add install --skills command

Installs a Claude Code skill definition file.

**Files:**
- Modify: `bin/md-review-plus.js`
- Create: `skills/md-review-plus.md`

**Step 1: Create the skill definition file**

Create `skills/md-review-plus.md`:

```markdown
---
name: md-review-plus
description: Request human review of a markdown document with section-level approval and structured feedback
---

# md-review-plus

Use this skill when you need a human to review a markdown document (plan, spec, design doc, etc.) and provide structured feedback.

## Usage

Run the review command and wait for the human to submit feedback:

```bash
md-review-plus ./path/to/document.md --review
```

The command blocks until the human submits their review, then prints structured feedback to stdout.

## Handling Feedback

The stdout output follows this format:

**All approved:**
```
All sections approved. No changes needed.
```

**Changes requested:**
```
Please update the document with the following changes:

## Needs Changes

**Section Name**: Rejected
  → Reviewer's comment about what to change

## Line Comments

file.md:L17
"selected text from the document"
→ Reviewer's comment about this specific text

## Approved
- Section Name 1
- Section Name 2
```

## Workflow

1. Generate or update a markdown document
2. Run `md-review-plus ./document.md --review`
3. Wait for the human to review in the browser UI
4. Parse the stdout feedback
5. Apply the requested changes to the document
6. If changes were requested, repeat from step 2

## Important

- The document MUST have `##` headings to define reviewable sections
- Content before the first `##` is shown but not reviewable
- Exit code 0 = review submitted, exit code 1 = browser closed without review
```

**Step 2: Add the install --skills subcommand to CLI**

In `bin/md-review-plus.js`, handle the `install` subcommand:

```javascript
// After arg parsing, before mode detection
if (args._[0] === 'install' && args.skills) {
  installSkills();
  process.exit(0);
}

async function installSkills() {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const os = await import('node:os');

  const skillSource = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    '..',
    'skills',
    'md-review-plus.md'
  );

  const claudeDir = path.join(os.homedir(), '.claude', 'skills');

  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
  }

  const dest = path.join(claudeDir, 'md-review-plus.md');
  fs.copyFileSync(skillSource, dest);
  console.log(`Installed skill to ${dest}`);
}
```

Also add to the boolean args:
```javascript
boolean: ['help', 'version', 'open', 'review', 'skills'],
```

**Step 3: Update help text**

```
md-review-plus install --skills   Install Claude Code skill
```

**Step 4: Test the skill installation**

```bash
bun run bin/md-review-plus.js install --skills
```

Expected: "Installed skill to ~/.claude/skills/md-review-plus.md"

Verify the file exists:
```bash
cat ~/.claude/skills/md-review-plus.md
```

**Step 5: Update package.json files field to include skills/**

```json
"files": ["bin", "dist", "server", "skills"]
```

**Step 6: Commit**

```bash
git add bin/md-review-plus.js skills/md-review-plus.md package.json
git commit -m "feat: add install --skills command and skill definition file"
```

---

## Phase 7: Polish & Publish

### Task 12: End-to-end verification and fixes

**Step 1: Run all tests**

```bash
bun run test
```

Expected: All tests pass. Fix any failures.

**Step 2: Run the linter**

```bash
bun run lint
```

Fix any lint errors.

**Step 3: Build for production**

```bash
bun run build
```

Expected: Clean build.

**Step 4: Test CLI mode (standard)**

```bash
echo "# My Document\n\nIntro.\n\n## Section A\n\nContent A.\n\n## Section B\n\nContent B." > /tmp/test-e2e.md
bun run bin/md-review-plus.js /tmp/test-e2e.md
```

Expected: Browser opens, sections visible with approve/reject controls, section nav sidebar, feedback panel.

**Step 5: Test review mode**

```bash
bun run bin/md-review-plus.js /tmp/test-e2e.md --review
```

Expected:
- Browser opens with review UI
- CLI blocks
- Click approve on both sections → feedback output shows "All sections approved"
- Click "Submit Review" → stdout prints feedback, CLI exits with code 0

**Step 6: Test dev mode (directory browse)**

```bash
cd /tmp && bun run /home/stonelyd/md-review-plus/bin/md-review-plus.js
```

Expected: File browser mode still works (no regressions).

**Step 7: Verify dark mode**

Toggle dark mode in the UI. Verify section review controls, nav sidebar, and feedback panel all render correctly.

**Step 8: Commit any fixes**

```bash
git add -A
git commit -m "fix: polish and end-to-end verification"
```

---

### Task 13: Prepare for npm publish

**Files:**
- Modify: `package.json`

**Step 1: Update package.json metadata**

```json
{
  "name": "md-review-plus",
  "version": "0.1.0",
  "description": "Review markdown files in the browser with section-level approval, structured feedback, and Claude Code integration",
  "repository": {
    "type": "git",
    "url": "https://github.com/seiraiyu/md-review-plus"
  },
  "keywords": ["markdown", "review", "cli", "claude", "ai", "feedback"],
  "files": ["bin", "dist", "server", "skills"]
}
```

**Step 2: Verify npx works**

```bash
bun run build
npx . /tmp/test-e2e.md
```

Expected: App opens in browser.

**Step 3: Commit**

```bash
git add package.json
git commit -m "chore: prepare package metadata for npm publish"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1. Setup | 1-2 | Fork, rename, convert to Bun + TypeScript server |
| 2. Data Layer | 3-4 | useSections + useFeedback hooks with tests |
| 3. Server API | 5 | POST /api/submit + GET /api/review-mode |
| 4. UI Components | 6-8 | SectionReview + SectionNav + FeedbackOutput |
| 5. Integration | 9 | Wire everything into CliModeApp |
| 6. CLI | 10-11 | --review blocking mode + install --skills |
| 7. Polish | 12-13 | E2E testing + npm publish prep |
