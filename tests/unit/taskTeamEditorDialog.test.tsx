// @vitest-environment jsdom

import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { UserProfile } from "../../src/app/types";
import type { Task } from "../../src/app/features/tasks";

vi.mock("../../src/app/components/ui/Toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock("../../src/app/features/tasks/services/taskTeamService", () => ({
  updateTaskTeamMembers: vi.fn(),
}));

import { TaskTeamEditorDialog } from "../../src/app/features/tasks/components/team/TaskTeamEditorDialog";

const task: Task = {
  id: "task",
  title: "Prepare investment brief",
  status: "in_progress",
  orgId: "ledipo",
  assigneeId: "lead",
  assigneeName: "Raoul Cam",
  recommendationLeadId: "lead",
  teamMemberIds: ["lead", "member"],
  teamMemberNames: ["Raoul Cam", "Gabriel Cahiyang"],
  createdAt: 1,
  updatedAt: 1,
};
const profiles = [
  { id: "lead", full_name: "Raoul Cam", role: "member", org_id: "ledipo", org_name: "LEDIPO", is_active: true },
  { id: "member", full_name: "Gabriel Cahiyang", role: "member", org_id: "ledipo", org_name: "LEDIPO", is_active: true },
  { id: "available", full_name: "Maria Clara", role: "member", org_id: "ledipo", org_name: "LEDIPO", is_active: true },
] as UserProfile[];

describe("task team editor", () => {
  it("shows the complete team and refuses to remove a member with unfinished subtask work", () => {
    render(createElement(TaskTeamEditorDialog, {
      task,
      profiles,
      responsibleOrgId: "ledipo",
      subtasks: [{
        id: "subtask",
        taskId: "task",
        title: "Prepare presentation",
        status: "in_progress",
        isCompleted: false,
        percentComplete: 40,
        assignedToIds: ["member"],
        position: 0,
        isStandalone: false,
        source: "manual",
        createdAt: 1,
        updatedAt: 1,
      }],
      onClose: vi.fn(),
    }));

    expect(screen.getByText("Raoul Cam")).toBeTruthy();
    expect(screen.getByText("Gabriel Cahiyang")).toBeTruthy();
    expect(screen.getByText("Maria Clara")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Gabriel Cahiyang/i }));
    expect(document.body.textContent).toContain("still owns 1 unfinished subtask");
    expect(document.body.textContent).toContain("Prepare presentation");
  });
});
