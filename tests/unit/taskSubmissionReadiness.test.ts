// @vitest-environment jsdom

import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Task } from "../../src/app/services/taskService";
import { SubmitForReviewModal } from "../../src/app/features/tasks/components/board/TaskSubmissionModals";

const task = (subtaskCount: number, approvedCount: number) =>
  ({
    id: "task-1",
    title: "Prepare implementation plan",
    status: "in_progress",
    subtaskCount,
    subtaskCompletedCount: approvedCount,
  }) as Task;

const renderModal = (targetTask: Task) =>
  render(
    createElement(SubmitForReviewModal, {
      open: true,
      task: targetTask,
      note: "Final Team Lead summary",
      attachments: [],
      onNoteChange: vi.fn(),
      onAttachmentsChange: vi.fn(),
      onRemoveAttachment: vi.fn(),
      onClose: vi.fn(),
      onSubmit: vi.fn(),
      submitting: false,
      error: "",
    }),
  );

afterEach(cleanup);

describe("parent task review readiness", () => {
  it("blocks Head submission until every subtask is approved", () => {
    renderModal(task(3, 2));

    expect(screen.getByText("2 of 3 subtasks complete")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Submit for Review" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("allows the Team Lead's explicit final submission when subtasks are complete", () => {
    renderModal(task(3, 3));

    expect(screen.getByText("3 of 3 subtasks complete")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Submit for Review" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });
});
