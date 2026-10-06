// @vitest-environment jsdom

import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Task } from "../../src/app/services/taskService";

vi.mock("../../src/app/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "lead-1", email: "lead@example.com" },
    userProfile: { full_name: "Team Lead" },
  }),
}));

vi.mock("../../src/app/services/taskService", () => ({
  submitTaskForReview: vi.fn(),
}));

vi.mock("../../src/app/components/ui/Toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { SubmitForReviewForm } from "../../src/app/components/workflow/SubmitForReviewForm";

const task = {
  id: "task-1",
  title: "Prepare implementation plan",
  status: "in_progress",
  subtaskCount: 1,
  subtaskCompletedCount: 0,
} as Task;

afterEach(cleanup);

describe("task detail submission readiness", () => {
  it("replaces the submission form while a subtask is still under review", () => {
    render(
      createElement(SubmitForReviewForm, {
        task,
        subtasks: [{ isCompleted: false, status: "for_review" }],
      }),
    );

    expect(screen.getByText("Finish subtask review first")).toBeTruthy();
    expect(screen.getByText("0 of 1 subtasks approved. The parent task can be submitted only after every subtask is approved by its reviewer.")).toBeTruthy();
    expect(screen.getByText("1 awaiting Team Leader review")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Submit for review" })).toBeNull();
  });

  it("shows the completion form after every subtask is approved", () => {
    render(
      createElement(SubmitForReviewForm, {
        task: { ...task, subtaskCompletedCount: 1 },
        subtasks: [{ isCompleted: true, status: "completed" }],
      }),
    );

    expect(screen.getByText("Ready for review?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Submit for review" })).toBeTruthy();
  });
});
