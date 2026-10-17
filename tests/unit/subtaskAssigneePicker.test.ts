// @vitest-environment jsdom

import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createSubtaskMock, startTaskIfTodoMock, updateSubtaskMock } = vi.hoisted(() => ({
  createSubtaskMock: vi.fn(),
  startTaskIfTodoMock: vi.fn(),
  updateSubtaskMock: vi.fn(),
}));

vi.mock("../../src/app/services/subtaskService", () => ({
  getCachedSubtasks: () => undefined,
  subscribeToSubtasks: (_taskId: string, callback: (subtasks: unknown[]) => void) => {
    callback([
      {
        id: "subtask-1",
        taskId: "task-1",
        title: "Prepare the agenda",
        isCompleted: false,
        status: "todo",
        percentComplete: 0,
        assignedToIds: ["employee-1"],
        position: 0,
        isStandalone: false,
        source: "manual",
        createdAt: 0,
        updatedAt: 0,
      },
    ]);
    return vi.fn();
  },
  createSubtask: createSubtaskMock,
  updateSubtask: updateSubtaskMock,
  deleteSubtask: vi.fn(),
  reorderSubtasks: vi.fn(),
}));

vi.mock("../../src/app/services/taskService", () => ({
  startTaskIfTodo: startTaskIfTodoMock,
}));

vi.mock("../../src/app/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "lead-1" },
    userProfile: { full_name: "Team Lead" },
  }),
}));

vi.mock("../../src/app/components/ui/Toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { TaskSubtasksWidget } from "../../src/app/features/subtasks/components/TaskSubtasksWidget";

beforeEach(() => { vi.useFakeTimers({toFake:["Date"]}); vi.setSystemTime(new Date("2026-08-01T04:00:00+08:00")); });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("subtask assignee picker", () => {
  it("closes when the manager left-clicks outside the picker", async () => {
    const view = render(
      createElement(TaskSubtasksWidget, {
        taskId: "task-1",
        canManage: true,
        allowedAssignees: [
          { id: "employee-1", name: "Maria Clara", initials: "MC" },
          { id: "employee-2", name: "Juan Dela Cruz", initials: "JD" },
        ],
      }),
    );

    // Completion is no longer a raw checkbox; contributors must open the
    // evidence workflow and receive a Team Leader decision.
    expect(view.container.querySelector('input[type="checkbox"]')).toBeNull();
    expect(screen.getByRole("button", { name: "Details" })).toBeTruthy();

    fireEvent.click(await screen.findByTitle("Assigned to: Maria Clara"));
    await waitFor(() => {
      expect(screen.getByText("Assign Team Members")).toBeTruthy();
    });

    fireEvent.pointerDown(document.body, { button: 0 });
    await waitFor(() => {
      expect(screen.queryByText("Assign Team Members")).toBeNull();
    });
  });

  it("starts a to-do parent automatically when its lead creates a subtask", async () => {
    createSubtaskMock.mockResolvedValueOnce({ id: "subtask-2" });
    startTaskIfTodoMock.mockResolvedValueOnce(true);

    const view = render(
      createElement(TaskSubtasksWidget, {
        taskId: "task-1",
        canManage: true,
        startParentOnCreate: true,
        parentTask: {
          id: "task-1",
          title: "Prepare the work plan",
          description: "",
          status: "todo",
          createdAt: 0,
          updatedAt: 0,
        },
      }),
    );

    const widget = within(view.container);
    fireEvent.change(widget.getByPlaceholderText("Add a subtask for team members…"), {
      target: { value: "Draft the activity schedule" },
    });
    fireEvent.change(widget.getByLabelText("New subtask due date"), {
      target: { value: "2026-08-30" },
    });
    fireEvent.click(widget.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(createSubtaskMock).toHaveBeenCalledWith(
        "task-1",
        "Draft the activity schedule",
        expect.objectContaining({ source: "manual" }),
      );
      expect(startTaskIfTodoMock).toHaveBeenCalledWith("task-1");
    });
  });

  it("lets the Team Lead create independent work with no ordered prerequisite", async () => {
    createSubtaskMock.mockResolvedValueOnce({ id: "subtask-standalone" });
    const view = render(createElement(TaskSubtasksWidget, {
      taskId: "task-1",
      canManage: true,
    }));
    const widget = within(view.container);
    fireEvent.change(widget.getByPlaceholderText("Add a subtask for team members…"), {
      target: { value: "Arrange refreshments" },
    });
    fireEvent.change(widget.getByLabelText("New subtask due date"), {
      target: { value: "2026-08-30" },
    });
    fireEvent.click(widget.getByRole("button", { name: "Standalone" }));
    fireEvent.click(widget.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(createSubtaskMock).toHaveBeenCalledWith(
        "task-1",
        "Arrange refreshments",
        expect.objectContaining({ isStandalone: true }),
      );
    });
  });
});
