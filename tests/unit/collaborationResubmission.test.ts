import { describe, expect, it, vi } from "vitest";
import { canRequestCollaborationApproval, shouldResendAfterUpdate } from "../../src/app/features/interdepartment-collaboration/selectors/reviewActions";
import { saveReviewUpdate } from "../../src/app/features/interdepartment-collaboration/services/saveReviewUpdate";

describe("edited plan approval cycle", () => {
  it("keeps stuck and submitted proposals recoverable without granting participants owner actions", () => {
    for (const status of ["draft", "in_review", "changes_requested"] as const) expect(canRequestCollaborationApproval(status, true, false)).toBe(true);
    for (const status of ["committed", "archived", "deleted"] as const) expect(canRequestCollaborationApproval(status, true, false)).toBe(false);
    expect(canRequestCollaborationApproval("changes_requested", false, false)).toBe(false);
    expect(canRequestCollaborationApproval("draft", true, true)).toBe(false);
  });
  it("renews material submitted plans, while retaining editorial approvals and draft autosave behavior", () => {
    expect(shouldResendAfterUpdate("ready_to_commit", true, false)).toBe(true);
    expect(shouldResendAfterUpdate("in_review", false, false)).toBe(false);
    expect(shouldResendAfterUpdate("draft", true, false)).toBe(false);
    expect(shouldResendAfterUpdate("in_review", true, true)).toBe(false);
  });
  it("requests approval only after the latest version is saved", async () => {
    const calls: string[] = [];
    await saveReviewUpdate(async () => { calls.push("save"); }, async () => { calls.push("request"); });
    expect(calls).toEqual(["save", "request"]);
  });
  it("does not notify on save failure and explains how to retry a request failure", async () => {
    const request = vi.fn();
    await expect(saveReviewUpdate(async () => { throw new Error("Save failed"); }, request)).rejects.toThrow("Save failed");
    expect(request).not.toHaveBeenCalled();
    await expect(saveReviewUpdate(async () => undefined, async () => { throw new Error("Offline"); })).rejects.toThrow("Changes saved. Approval requests could not be sent");
  });
});
