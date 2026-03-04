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
