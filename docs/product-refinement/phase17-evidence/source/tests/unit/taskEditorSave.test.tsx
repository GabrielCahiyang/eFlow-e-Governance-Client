// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/app/services/taskService", () => ({
  undoCompletedTask: vi.fn(),
}));
vi.mock("../../src/app/features/tasks/services/taskLifecycleService", () => ({
  cancelTask: vi.fn(),
}));
vi.mock("../../src/app/features/tasks/services/taskArchiveService", () => ({
  archiveTask: vi.fn(),
  unarchiveTask: vi.fn(),
}));
vi.mock("../../src/app/features/projects", () => ({
  offerEmptyProjectCleanup: vi.fn(),
}));

import type { Task } from "../../src/app/features/tasks/taskTypes";
import { useMondayBoardController } from "../../src/app/features/tasks/components/board/useMondayBoardController";

const task: Task = {
  id: "task-1",
  title: "Task",
  status: "todo",
  createdAt: 1,
  updatedAt: 1,
};
afterEach(cleanup);

describe("task editor save feedback", () => {
  it("retains a draft and rejects a refreshed task before Save is pressed", async () => {
    const onUpdateTask = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ tasks }) =>
        useMondayBoardController({ tasks, role: "head", onUpdateTask }),
      { initialProps: { tasks: [task] } },
    );
    act(() => result.current.openTaskEditor(task));
    act(() =>
      result.current.setTaskEditorDraft(
        (draft) => draft && { ...draft, description: "Keep my local draft" },
      ),
    );
    rerender({
      tasks: [{ ...task, updatedAt: 2, description: "New server details" }],
    });
    await act(() => result.current.handleTaskEditorSave());
    expect(onUpdateTask).not.toHaveBeenCalled();
    expect(result.current.taskEditorError).toContain("The task changed");
    expect(result.current.taskEditorDraft?.description).toBe(
      "Keep my local draft",
    );
    expect(result.current.taskEditorOpen).toBe(true);
  });

  it("keeps the editor and draft open with the precise partial-save reason", async () => {
    const message =
      "Saved task details, but could not save team and reviewer changes. Member has unfinished work.";
    const onUpdateTask = vi.fn().mockRejectedValue(new Error(message));
    const { result } = renderHook(() =>
      useMondayBoardController({ tasks: [task], role: "head", onUpdateTask }),
    );
    act(() => result.current.openTaskEditor(task));
    act(() =>
      result.current.setTaskEditorDraft(
        (draft) => draft && { ...draft, description: "Keep this draft" },
      ),
    );
    await act(() => result.current.handleTaskEditorSave());
    expect(result.current.taskEditorError).toBe(message);
    expect(result.current.taskEditorDraft?.description).toBe("Keep this draft");
    expect(result.current.taskEditorOpen).toBe(true);
    expect(result.current.taskEditorSaving).toBe(false);
  });

  it("closes the editor only after the whole save succeeds", async () => {
    const onUpdateTask = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useMondayBoardController({ tasks: [task], role: "head", onUpdateTask }),
    );
    act(() => result.current.openTaskEditor(task));
    await act(() => result.current.handleTaskEditorSave());
    expect(onUpdateTask).toHaveBeenCalledOnce();
    expect(result.current.taskEditorOpen).toBe(false);
    expect(result.current.taskEditorError).toBe("");
  });
});
