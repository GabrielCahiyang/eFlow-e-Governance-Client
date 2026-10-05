// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "../../src/app/features/projects/services/types";
const api = vi.hoisted(() => ({ readiness: vi.fn(), complete: vi.fn() }));
vi.mock("../../src/app/features/projects/services/projectLifecycleService", () => ({ fetchProjectCompletionReadiness: api.readiness, completeProject: api.complete }));
vi.mock("../../src/app/features/tasks", () => ({ tasksForProject: (tasks: unknown[]) => tasks }));
import { ProjectCompleteDialog } from "../../src/app/features/projects/components/ProjectCompleteDialog";
import { ProjectContextSidebar } from "../../src/app/features/projects/components/ProjectContextSidebar";

const project: Project = { id: "project-1", title: "Project Issa", description: "", status: "active", priority: "medium", createdAt: 1, updatedAt: 1 };
const ready = { projectId: project.id, title: project.title, status: "active", canComplete: true, blockers: [] };
function dialog() {
  const props = { projectId: project.id, projectTitle: project.title, onClose: vi.fn(), onSuccess: vi.fn(), onOpenTask: vi.fn(), onOpenGovernance: vi.fn() };
  render(<ProjectCompleteDialog {...props} />);
  return props;
}
function sidebar(projects: Project[], managed = true) {
  const props = { projects, canArchive: managed, canComplete: managed, canDelete: managed, onOpenPortfolio: vi.fn(), onOpenProject: vi.fn(), onCompleteProject: vi.fn(), onArchiveProject: vi.fn(), onRestoreProject: vi.fn(), onDeleteProject: vi.fn(), profiles: [], summaries: new Map(), tasks: [], projectMembers: [], planningCounts: { workplans: 0, signoff: 0, actionable: 0 }, planningView: "portfolio" as const, onOpenPlanning: vi.fn() };
  const view = render(<ProjectContextSidebar {...props} />);
  return { ...view, props };
}
beforeEach(() => { vi.clearAllMocks(); api.readiness.mockReset().mockResolvedValue(ready); api.complete.mockReset().mockResolvedValue(undefined); });
afterEach(cleanup);

describe("project dropdown lifecycle", () => {
  it("omits creation controls and retains project switching and Planning navigation", () => {
    const { props } = sidebar([project]);
    expect(screen.queryByRole("button", { name: "Create project", exact: true })).toBeNull();
    expect(screen.queryByRole("button", { name: "Create work plan", exact: true })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Project Issa", exact: true }));
    expect(props.onOpenProject).toHaveBeenCalledWith(project.id);
    fireEvent.click(screen.getByRole("button", { name: /^Drafts/ }));
    expect(props.onOpenPlanning).toHaveBeenCalledWith("drafts");
  });

  it("offers completion but disables archive for active work", async () => {
    const { props } = sidebar([project]);
    fireEvent.click(screen.getByRole("button", { name: "Open Project Issa actions" }));
    const archive = await screen.findByRole("menuitem", { name: "Archive (complete first)" });
    fireEvent.mouseEnter(archive); fireEvent.click(archive);
    expect(props.onArchiveProject).not.toHaveBeenCalled();
    const complete = screen.getByRole("menuitem", { name: "Mark project complete" });
    fireEvent.mouseEnter(complete); fireEvent.click(complete);
    await waitFor(() => expect(props.onCompleteProject).toHaveBeenCalledWith(project.id, project.title));
  });
  it("offers archive instead of completion after completion", async () => {
    const { props } = sidebar([{ ...project, status: "completed" }]);
    fireEvent.click(screen.getByRole("button", { name: "Open Project Issa actions" }));
    const archive = await screen.findByRole("menuitem", { name: "Archive project" });
    fireEvent.mouseEnter(archive); fireEvent.click(archive);
    await waitFor(() => expect(props.onArchiveProject).toHaveBeenCalledWith(project.id, project.title));
    expect(screen.queryByRole("menuitem", { name: "Mark project complete" })).toBeNull();
  });
  it("moves archived projects out of the active list, retaining explicit history and restore", async () => {
    const { container, props } = sidebar([{ ...project, status: "archived" }]);
    const archive = container.querySelector("details")!;
    expect(archive.open).toBe(false);
    expect(container.querySelector(".eflow-project-context__list")?.textContent).not.toContain("Project Issa");
    fireEvent.click(screen.getByText("Archived projects (1)"));
    fireEvent.click(screen.getByRole("button", { name: "Open Project Issa actions" }));
    const restore = await screen.findByRole("menuitem", { name: "Restore project" });
    fireEvent.mouseEnter(restore); fireEvent.click(restore);
    await waitFor(() => expect(props.onRestoreProject).toHaveBeenCalledWith(project.id, project.title));
    expect(screen.queryByRole("menuitem", { name: "Mark project complete" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Archive project" })).toBeNull();
  });
  it("keeps employee/read-only viewers from lifecycle controls", () => {
    sidebar([project], false);
    expect(screen.queryByRole("button", { name: /actions/ })).toBeNull();
  });
});

describe("project completion confirmation", () => {
  it("checks without changing anything, and cancel never completes", async () => {
    const props = dialog();
    await screen.findByText(/All completion checks passed/);
    expect(api.complete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onClose).toHaveBeenCalledOnce();
    expect(api.complete).not.toHaveBeenCalled();
  });
  it("lists exact task, cash and governance blockers and opens the affected record", async () => {
    api.readiness.mockResolvedValue({ ...ready, canComplete: false, blockers: [
      { kind: "task", id: "task-1", taskId: "task-1", title: "Order Food", status: "for_review", detail: "Awaiting task review" },
      { kind: "cash", id: "cash-1", taskId: "task-1", title: "FR-00006 · Order Food", status: "pending_department_settlement", detail: "Head must settle receipts", amount: 5000 },
      { kind: "governance", id: "draft-1", title: "Final governance", status: "pending", detail: "Board decision pending" },
    ] });
    const props = dialog();
    await screen.findByText("3 item(s) still holding up completion");
    expect(screen.getByText("Head must settle receipts")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Confirm completion" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getAllByRole("button", { name: "Open task" })[0]);
    expect(props.onOpenTask).toHaveBeenCalledWith("task-1");
    fireEvent.click(screen.getByRole("button", { name: "Open proposal closeout" }));
    expect(props.onOpenGovernance).toHaveBeenCalledWith("draft-1");
  });
  it("completes only the chosen project after explicit confirmation", async () => {
    const props = dialog();
    await screen.findByText(/All completion checks passed/);
    fireEvent.change(screen.getByLabelText("Completion note (optional)"), { target: { value: "All delivery approved" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm completion" }));
    await waitFor(() => expect(props.onSuccess).toHaveBeenCalledOnce());
    expect(api.complete).toHaveBeenCalledExactlyOnceWith("project-1", "All delivery approved");
  });
  it("fails closed when checks cannot load", async () => {
    api.readiness.mockRejectedValue(new Error("Completion migration missing"));
    dialog();
    await screen.findByRole("alert");
    expect((screen.getByRole("button", { name: "Confirm completion" }) as HTMLButtonElement).disabled).toBe(true);
    expect(api.complete).not.toHaveBeenCalled();
  });
  it("refreshes blockers if the server rejects a stale ready screen", async () => {
    const props = dialog();
    await screen.findByText(/All completion checks passed/);
    api.complete.mockRejectedValue(new Error("New cash remains unsettled"));
    api.readiness.mockResolvedValue({ ...ready, canComplete: false, blockers: [{ kind: "cash", id: "cash-2", title: "FR-00007", status: "released", detail: "Submit receipts" }] });
    fireEvent.click(screen.getByRole("button", { name: "Confirm completion" }));
    await screen.findByText("Submit receipts");
    expect(props.onSuccess).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Confirm completion" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
