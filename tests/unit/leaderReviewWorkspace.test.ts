import { describe, expect, it } from "vitest";
import { getInitialReviewWorkspaceKind } from "../../src/app/features/reviews/selectors";

describe("contextual Team Leader review workspace", () => {
  it("opens submitted subtask evidence first for employee Task Leads", () => {
    expect(getInitialReviewWorkspaceKind("leading")).toBe("subtasks");
  });

  it("keeps the Head review workspace on parent tasks", () => {
    expect(getInitialReviewWorkspaceKind("department")).toBe("tasks");
  });
});
