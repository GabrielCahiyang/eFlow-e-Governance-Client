import { describe, expect, it } from "vitest";
import {
  canUserReviewTask,
  isTaskVisibleInReviewQueue,
} from "../../src/app/features/reviews/selectors";
import type { Task } from "../../src/app/services/taskService";

const task: Task = {
  id: "task-1",
  title: "Inspect drainage works",
  status: "for_review",
  reviewerId: "reviewer-1",
  backupReviewerId: "reviewer-2",
  latestSubmission: {
    id: "submission-1",
    version: 2,
    note: "Evidence uploaded",
    submitterId: "submitter-1",
    submitterName: "Submitter",
    submittedAt: Date.now(),
    attachments: [],
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe("review routing", () => {
  it("allows the primary and backup reviewer", () => {
    expect(canUserReviewTask(task, "reviewer-1", "member")).toBe(true);
    expect(canUserReviewTask(task, "reviewer-2", "member")).toBe(true);
  });

  it("prevents a submitter from reviewing the same attempt", () => {
    expect(canUserReviewTask(task, "submitter-1", "super_admin")).toBe(false);
  });

  it("denies automatic Admin operational review", () => {
    expect(canUserReviewTask(task, "admin-1", "super_admin")).toBe(false);
  });

  it("keeps an explicitly assigned governance reviewer in the queue across organizations", () => {
    const governedTask: Task = {
      ...task,
      orgId: "ledipo",
      reviewerId: "orcham-head",
      reviewRouteMode: "governance",
    };

    expect(isTaskVisibleInReviewQueue(governedTask, "orcham-head", "head")).toBe(true);
  });

  it("keeps unrelated users out of the queue", () => {
    expect(isTaskVisibleInReviewQueue(task, "unrelated-head", "head")).toBe(false);
  });

  it("allows accountable Head self-finalization only for normal office work", () => {
    const ownWork = {...task,reviewerId:"head-1",latestSubmission:{...task.latestSubmission!,submitterId:"head-1"}};
    expect(canUserReviewTask({...ownWork,reviewRouteMode:"organization_default"},"head-1","head")).toBe(true);
    expect(canUserReviewTask({...ownWork,reviewRouteMode:"governance"},"head-1","head")).toBe(false);
    expect(canUserReviewTask({...ownWork,reviewRouteMode:"explicit"},"head-1","head")).toBe(false);
    expect(canUserReviewTask(ownWork,"head-1","member")).toBe(false);
  });
});
