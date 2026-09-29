import { describe, expect, it } from "vitest";
import { getNotificationDetail } from "../../src/app/features/notifications";

describe("notification detail presentation", () => {
  it("labels approval feedback as an approval note", () => {
    expect(getNotificationDetail({
      type: "completed",
      title: "Task approved",
      reason: "Good job",
      statusFrom: "for_review",
      statusTo: "completed",
    })).toEqual({ label: "Approval note", text: "Good job", tone: "success" });
  });

  it("labels subtask evidence text as a submission note", () => {
    expect(getNotificationDetail({
      type: "approval_needed",
      title: "Subtask evidence ready for review",
      reason: "Final photos and attendance sheet attached",
      statusFrom: "in_progress",
      statusTo: "for_review",
    })).toEqual({
      label: "Submission note",
      text: "Final photos and attendance sheet attached",
      tone: "info",
    });
  });

  it("labels requested changes as reviewer feedback", () => {
    expect(getNotificationDetail({
      type: "status_change",
      title: "Updates needed",
      reason: "Add the missing signature",
      statusFrom: "for_review",
      statusTo: "changes_requested",
    })).toEqual({
      label: "Reviewer feedback",
      text: "Add the missing signature",
      tone: "danger",
    });
  });

  it("does not render a detail block when the stored value is empty", () => {
    expect(getNotificationDetail({
      type: "status_change",
      title: "Subtask progress updated",
      reason: "",
      statusFrom: "",
      statusTo: "20%",
    })).toBeNull();
  });
});
