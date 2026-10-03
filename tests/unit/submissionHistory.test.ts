// @vitest-environment jsdom

import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SubmissionHistory } from "../../src/app/features/reviews/components/SubmissionHistory";

describe("SubmissionHistory", () => {
  it("keeps every review attempt visible in version order", () => {
    render(
      createElement(SubmissionHistory, {
        submissions: [
          {
            id: "submission-2",
            taskId: "task-1",
            version: 2,
            submitterId: "employee-1",
            submitterName: "A. Member",
            note: "Revised evidence",
            status: "approved",
            submittedAt: Date.parse("2026-08-07T02:00:00Z"),
          },
          {
            id: "submission-1",
            taskId: "task-1",
            version: 1,
            submitterId: "employee-1",
            submitterName: "A. Member",
            note: "Initial evidence",
            status: "changes_requested",
            decisionFeedback: "Attach the signed form",
            submittedAt: Date.parse("2026-08-06T02:00:00Z"),
          },
        ],
      }),
    );

    expect(screen.getByText(/Attempt 2/).textContent).toContain("Attempt 2");
    expect(screen.getByText(/Attempt 1/).textContent).toContain("Attempt 1");
    expect(document.body.textContent).toContain("Attach the signed form");
  });
});
