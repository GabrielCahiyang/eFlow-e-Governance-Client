// @vitest-environment jsdom

import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserProfile } from "../../src/app/types";
import type { Task } from "../../src/app/features/tasks";

const work = vi.hoisted(() => ({ actor: "lead", load: vi.fn(), save: vi.fn() }));
vi.mock("../../src/app/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: work.actor } }),
}));
vi.mock("../../src/app/features/nested-work/services/workTreeService", () => ({
  fetchWorkTree: work.load,
  saveWorkTree: work.save,
  WorkTreeUnavailable: class WorkTreeUnavailable extends Error {},
}));
vi.mock("../../src/app/features/project-invitations", () => ({
  ProjectInvitations: () => null,
}));
vi.mock("../../src/app/components/ui/Toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock("../../src/app/features/tasks/services/taskTeamService", () => ({
  updateTaskTeamMembers: vi.fn(),
}));

import { TaskTeamEditorDialog } from "../../src/app/features/tasks/components/team/TaskTeamEditorDialog";
import { updateTaskTeamMembers } from "../../src/app/features/tasks/services/taskTeamService";
import { rememberWorkCapabilityContext } from "../../src/app/features/nested-work/selectors/capabilities";
import { WorkTreeUnavailable } from "../../src/app/features/nested-work/services/workTreeService";
import type { WorkTreeSnapshot, WorkTreeController } from "../../src/app/features/nested-work";

beforeEach(() => {
  sessionStorage.clear();
  work.actor = "lead";
  work.load.mockReset();
  work.save.mockReset();
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

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

const supportedTask = { ...task, linkedProjectId: "project" };
const granted = { allowed: true, reason_code: null } as const;
const denied = { allowed: false, reason_code: "appointment_denied" } as const;

function workSnapshot(appointment = false, contributors = true): WorkTreeSnapshot {
  const data: WorkTreeSnapshot = {
    root: {
      id: "task",
      project: "project",
      office: "ledipo",
      kind: "office",
      lead: "lead",
      open: true,
      people: ["lead", "member"],
      due: null,
      capabilities: {
        appoint_lead: appointment ? granted : denied,
        manage_contributors: contributors
          ? granted
          : { allowed: false, reason_code: "branch_denied" },
        create_child: granted,
        order_children: granted,
      },
    },
    revision: 7,
    can_manage: true,
    can_transfer: true,
    nodes: [],
    people: [
      { id: "lead", name: "Raoul Cam", eligible: true },
      { id: "member", name: "Gabriel Cahiyang", eligible: true },
      { id: "available", name: "Selected Maria Clara", eligible: true },
      { id: "expired", name: "Expired guest", eligible: false },
    ],
    leaf_total: 0,
    leaf_completed: 0,
  };
  rememberWorkCapabilityContext(data, work.actor);
  return data;
}

describe("TaskTeamEditorDialog canonical contributor staffing (no legacy fallback)", () => {
  it("uses a supplied table controller and rechecks contributor-only authority immediately before saving", async () => {
    const data = workSnapshot(true);
    const save = vi.fn().mockResolvedValue(data);
    const onClose = vi.fn();
    const controller: WorkTreeController = {
      rootId: "task",
      actorId: "lead",
      data,
      loading: false,
      error: "",
      unavailable: false,
      authorityFresh: true,
      refreshPending: false,
      pending: false,
      reload: vi.fn(),
      save,
    };
    work.load.mockResolvedValue(data);
    render(createElement(TaskTeamEditorDialog, { task: supportedTask, profiles, subtasks: [], controller, onClose }));
    expect((screen.getByLabelText("Appointed Lead") as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Add contributor Selected Maria Clara" }));
    fireEvent.click(screen.getByRole("button", { name: /^Save (?:work )?changes$/ }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][0]).toMatchObject({
      command: "contributors",
      revision: 7,
      payload: { people: ["lead", "member", "available"] },
    });
    expect(work.load).toHaveBeenCalledOnce();
    expect(work.save).not.toHaveBeenCalled();
    expect(updateTaskTeamMembers).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("saves contributors through the canonical versioned operation without legacy writes", async () => {
    work.load.mockResolvedValue(workSnapshot());
    work.save.mockResolvedValue(workSnapshot());
    const onClose = vi.fn();
    render(createElement(TaskTeamEditorDialog, { task: supportedTask, profiles, subtasks: [], onClose }));
    const lead = await screen.findByLabelText("Appointed Lead");
    expect((lead as HTMLSelectElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Add contributor Expired guest" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add contributor Selected Maria Clara" }));
    fireEvent.click(screen.getByRole("button", { name: /^Save (?:work )?changes$/ }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(work.save).toHaveBeenCalledTimes(1);
    expect(updateTaskTeamMembers).not.toHaveBeenCalled();
  });

  it("never falls back to the legacy writer when the supported RPC is unavailable", async () => {
    work.load.mockRejectedValue(new WorkTreeUnavailable("Missing"));
    render(createElement(TaskTeamEditorDialog, { task: supportedTask, profiles, subtasks: [], onClose: vi.fn() }));
    await screen.findByText(/couldn’t load the people assigned to this task/i);
    expect(screen.queryByRole("button", { name: "Save members" })).toBeNull();
    expect(updateTaskTeamMembers).not.toHaveBeenCalled();
  });

  for (const status of ["for_review", "completed", "cancelled"] as const) {
    it("locks canonical contributors for " + status, async () => {
      work.load.mockResolvedValue(workSnapshot(true));
      render(
        createElement(TaskTeamEditorDialog, {
          task: { ...supportedTask, status },
          profiles,
          subtasks: [],
          onClose: vi.fn(),
        }),
      );
      await screen.findByLabelText("Appointed Lead");
      expect((screen.getByRole("button", { name: /^Save (?:work )?changes$/ }) as HTMLButtonElement).disabled).toBe(true);
      expect(work.save).not.toHaveBeenCalled();
    });
  }

  for (const patch of [
    { linkedProjectId: undefined },
    { proposedOfficeIdentityId: "unresolved" },
    { sourceCollaborationDraftId: "governed" },
  ]) {
    it("shows clean centered parent-plan notice instead of a legacy fallback modal for excluded task " + JSON.stringify(patch), () => {
      render(
        createElement(TaskTeamEditorDialog, {
          task: { ...supportedTask, ...patch },
          profiles,
          subtasks: [],
          onClose: vi.fn(),
        }),
      );
      expect(screen.getByText(/Managed through parent plan/i)).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Save members" })).toBeNull();
      expect(work.load).not.toHaveBeenCalled();
      expect(updateTaskTeamMembers).not.toHaveBeenCalled();
    });
  }
});
