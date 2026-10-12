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
  it('leaves supported project staffing to checked commands and does not infer a Lead or rewrite workers',async()=>{
    const projectTask={...task,linkedProjectId:'project',teamMemberIds:['worker']},onUpdateTask=vi.fn().mockResolvedValue(undefined);
    const {result}=renderHook(()=>useMondayBoardController({tasks:[projectTask],role:'head',currentUserId:'head',onUpdateTask}));act(()=>result.current.openTaskEditor(projectTask));await act(()=>result.current.handleTaskEditorSave());
    const payload=onUpdateTask.mock.calls[0][1];for(const field of ['teamMemberIds','teamMemberNames','assigneeId','assigneeName','recommendedEmployeeIds','teamId','teamName'])expect(payload).not.toHaveProperty(field);expect(payload.title).toBe('Task');
  });
  it('retains unsaved metadata and rejects a refreshed canonical staffing change',async()=>{
    const projectTask={...task,linkedProjectId:'project',assigneeId:'lead',teamMemberIds:['worker']},onUpdateTask=vi.fn();
    const {result,rerender}=renderHook(({tasks})=>useMondayBoardController({tasks,role:'head',onUpdateTask}),{initialProps:{tasks:[projectTask]}});act(()=>result.current.openTaskEditor(projectTask));act(()=>result.current.setTaskEditorDraft(draft=>draft&&{...draft,description:'Preserve my unsaved details'}));rerender({tasks:[{...projectTask,updatedAt:2,assigneeId:'new-lead'}]});
    await act(()=>result.current.handleTaskEditorSave());expect(onUpdateTask).not.toHaveBeenCalled();expect(result.current.taskEditorDraft?.description).toBe('Preserve my unsaved details');expect(result.current.taskEditorOpen).toBe(true);expect(result.current.taskEditorError).toContain('The task changed');
  });
  it('retains the old staffing payload only for a checked missing installation in this actor/root scope',async()=>{
    const projectTask={...task,linkedProjectId:'project',assigneeId:'lead',teamMemberIds:['lead','worker']},onUpdateTask=vi.fn().mockResolvedValue(undefined);
    const first=renderHook(()=>useMondayBoardController({tasks:[projectTask],role:'head',currentUserId:'head',onUpdateTask}));act(()=>first.result.current.openTaskEditor(projectTask));await act(()=>first.result.current.handleTaskEditorSave({rootId:'task-1',actorId:'head',code:'PGRST202'}));expect(onUpdateTask.mock.calls[0][1]).toMatchObject({assigneeId:'lead',teamMemberIds:['lead','worker']});first.unmount();
    const second=renderHook(()=>useMondayBoardController({tasks:[projectTask],role:'head',currentUserId:'head',onUpdateTask}));act(()=>second.result.current.openTaskEditor(projectTask));await act(()=>second.result.current.handleTaskEditorSave({rootId:'task-1',actorId:'other',code:'PGRST202'}));expect(onUpdateTask.mock.calls[1][1]).not.toHaveProperty('assigneeId');
  });
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
