import { describe, expect, it } from "vitest";
import { getInitialReviewWorkspaceKind } from "../../src/app/features/reviews/selectors";

describe("contextual Team Leader review workspace", () => {
  it("opens parent task reviews because subtasks complete directly", () => {
    expect(getInitialReviewWorkspaceKind("leading")).toBe("tasks");
  });

  it("keeps the Head review workspace on parent tasks", () => {
    expect(getInitialReviewWorkspaceKind("department")).toBe("tasks");
  });
});
