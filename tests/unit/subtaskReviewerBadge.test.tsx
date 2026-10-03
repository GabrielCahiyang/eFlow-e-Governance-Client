// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SubtaskReviewerBadge } from "../../src/app/features/subtasks/components/SubtaskReviewerBadge";

afterEach(cleanup);

describe("subtask reviewer identity", () => {
  it("names the authoritative reviewer while a submission is waiting", () => {
    render(
      <SubtaskReviewerBadge
        status="for_review"
        reviewer={{
          id: "reviewer-1",
          name: "Crispin Santos",
          role: "head",
          organizationName: "ORCHAM",
        }}
      />,
    );

    expect(screen.getByText("Awaiting review by")).toBeTruthy();
    expect(screen.getByText("Crispin Santos · Head · ORCHAM")).toBeTruthy();
  });

  it("uses the compact reviewer name in the checklist", () => {
    render(
      <SubtaskReviewerBadge
        compact
        status="for_review"
        reviewer={{ id: "reviewer-1", name: "Crispin Santos", role: "head" }}
      />,
    );

    expect(screen.getByText("Awaiting review by Crispin Santos")).toBeTruthy();
  });
});
