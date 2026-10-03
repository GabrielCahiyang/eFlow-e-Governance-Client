import { describe, expect, it } from "vitest";
import { getNavigationActionAlerts } from "../../src/app/features/app-shell/navigationActionAlerts";
import type { Task } from "../../src/app/features/tasks";
import type { Project } from "../../src/app/features/projects";
import type { CollaborationDraft } from "../../src/app/features/interdepartment-collaboration";

const reviewTask = (reviewerId: string) => ({
  id: "task-1", status: "for_review", reviewerId,
  latestSubmission: { submitterId: "submitter" },
}) as Task;

describe("navigation action alerts", () => {
  it("does not glow for another person's review", () => {
    expect(getNavigationActionAlerts({
      tasks: [reviewTask("other")], projects: [], drafts: [],
      userId: "me", role: "head", orgId: "org-1",
    })).toEqual({ reviews: false, projects: false });
  });

  it("glows for the assigned reviewer and an actionable owner proposal", () => {
    expect(getNavigationActionAlerts({
      tasks: [reviewTask("me")], projects: [],
      drafts: [{ status: "ready_to_commit", ownerUserId: "me", ownerOrgId: "org-1" } as CollaborationDraft],
      userId: "me", role: "head", orgId: "org-1",
    })).toEqual({ reviews: true, projects: true });
  });

  it("glows for a completed project its owner can archive", () => {
    expect(getNavigationActionAlerts({
      tasks: [], drafts: [],
      projects: [{ status: "completed", ownerId: "me" } as Project],
      userId: "me", role: "member", orgId: "org-1",
    }).projects).toBe(true);
  });
});
