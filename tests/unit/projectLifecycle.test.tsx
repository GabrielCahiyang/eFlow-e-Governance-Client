// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "../../src/app/features/projects/services/types";
const api = vi.hoisted(() => ({ readiness: vi.fn(), complete: vi.fn(), actor: { id:'head',role:'head',is_active:true,org_id:'office' } }));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({userProfile:api.actor})}));
vi.mock("../../src/app/features/projects/services/projectLifecycleService", () => ({ fetchProjectCompletionReadiness: api.readiness, completeProject: api.complete }));
vi.mock("../../src/app/features/tasks", () => ({ tasksForProject: (tasks: unknown[]) => tasks }));
import { ProjectCompleteDialog } from "../../src/app/features/projects/components/ProjectCompleteDialog";
import { ProjectUtilities } from "../../src/app/features/projects/components/project-command/ProjectUtilities";
import { ProjectIndex } from "../../src/app/features/projects/components/ProjectIndex";
import { ProjectWorkspaceActions } from "../../src/app/features/projects/components/ProjectWorkspaceActions";

const project: Project = { id: "project-1", title: "Project Issa", description: "", status: "active", priority: "medium", createdAt: 1, updatedAt: 1 };
const ready = { projectId: project.id, title: project.title, status: "active", canComplete: true, blockers: [] };
function dialog() {
  const props = { projectId: project.id, projectTitle: project.title, onClose: vi.fn(), onSuccess: vi.fn(), onOpenTask: vi.fn(), onOpenGovernance: vi.fn() };
  render(<ProjectCompleteDialog {...props} />);
  return props;
}
function utilities(status:Project['status']='active',managed=true){
 const props={complete:vi.fn(),archive:vi.fn(),restore:vi.fn(),delete:vi.fn()};
 const view=render(<ProjectUtilities project={{...project,status}} canManage={managed} lifecycle={managed?props:{}} userId="head" contextId="office" authorizedProjectIds={[project.id]} view="tasks" onOpenOffices={vi.fn()} onOpenSettings={vi.fn()} onResolveView={vi.fn()}/>);
 return {...view,props};
}
beforeEach(() => { localStorage.clear(); vi.stubGlobal('requestAnimationFrame',(cb:FrameRequestCallback)=>{cb(0);return 1;}); vi.clearAllMocks();api.actor.role='head';api.actor.is_active=true; api.readiness.mockReset().mockResolvedValue(ready); api.complete.mockReset().mockResolvedValue(undefined); });
afterEach(()=>{cleanup();vi.unstubAllGlobals();});

describe('canonical project lifecycle controls',()=>{
 it('hides setup after activation',()=>{
  utilities('active');expect(screen.queryByRole('button',{name:'Setup & activation'})).toBeNull();
 });
 it('keeps creation and portfolio switching without a second sidebar',async()=>{
  const create=vi.fn(),open=vi.fn();render(<><ProjectWorkspaceActions canCreate onAllProjects={vi.fn()} onCreate={create} onWorkPlan={vi.fn()} onImport={vi.fn()} onTemplates={vi.fn()} onSavedPlans={vi.fn()} onReviewPlans={vi.fn()}/><ProjectIndex projects={[project]} tasks={[]} organizations={[]} profiles={[]} onOpen={open} onOpenProposal={vi.fn()}/></>);
  fireEvent.keyDown(screen.getByRole('button',{name:'+ New'}),{key:'Enter'});
  fireEvent.click(screen.getByRole('menuitem',{name:'Create project'}));await waitFor(()=>expect(create).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole('button',{name:project.title,exact:true}));expect(open).toHaveBeenCalledWith(project.id);expect(screen.queryByRole('complementary')).toBeNull();
 });
 it('offers completion and denies archive until completed',async()=>{
  const {props}=utilities();fireEvent.keyDown(screen.getByRole('button',{name:'Project actions'}),{key:'Enter'});
  const archive=await screen.findByRole('menuitem',{name:'Archive project'});expect(archive.getAttribute('aria-disabled')).toBe('true');fireEvent.click(archive);expect(props.archive).not.toHaveBeenCalled();
  const complete=screen.getByRole('menuitem',{name:'Mark project complete'});await waitFor(()=>expect(complete.getAttribute('aria-disabled')).not.toBe('true'));fireEvent.click(complete);await waitFor(()=>expect(props.complete).toHaveBeenCalledOnce());
 });
 it('offers archive after completion',async()=>{
  const {props}=utilities('completed');fireEvent.keyDown(screen.getByRole('button',{name:'Project actions'}),{key:'Enter'});fireEvent.click(await screen.findByRole('menuitem',{name:'Archive project'}));await waitFor(()=>expect(props.archive).toHaveBeenCalledOnce());expect(screen.queryByRole('menuitem',{name:'Mark project complete'})).toBeNull();
 });
 it('offers restore and delete in an archived project',async()=>{
  const {props}=utilities('archived');fireEvent.keyDown(screen.getByRole('button',{name:'Project actions'}),{key:'Enter'});fireEvent.click(await screen.findByRole('menuitem',{name:'Restore project'}));await waitFor(()=>expect(props.restore).toHaveBeenCalledOnce());
  fireEvent.keyDown(screen.getByRole('button',{name:'Project actions'}),{key:'Enter'});fireEvent.click(await screen.findByRole('menuitem',{name:'Delete project'}));await waitFor(()=>expect(props.delete).toHaveBeenCalledOnce());expect(screen.queryByRole('menuitem',{name:'Archive project'})).toBeNull();
 });
 it('keeps read-only viewers from lifecycle changes while retaining account-scoped favorites',async()=>{
  utilities('active',false);fireEvent.click(screen.getByRole('button',{name:'Add project to favorites'}));expect(screen.getByRole('button',{name:'Remove project from favorites'})).toBeTruthy();fireEvent.keyDown(screen.getByRole('button',{name:'Project actions'}),{key:'Enter'});await screen.findByRole('menuitem',{name:'Project settings'});expect(screen.queryByRole('menuitem',{name:'Mark project complete'})).toBeNull();expect(screen.queryByRole('menuitem',{name:'Delete project'})).toBeNull();
 });
});

describe("project completion confirmation", () => {
  it('retains verified display during a background refresh but disables stale confirmation', async () => {
    dialog();
    await screen.findByText(/All completion checks passed/);
    let resolve!: (value: unknown) => void;
    api.readiness.mockReturnValueOnce(new Promise(value => { resolve = value; }));
    fireEvent(window, new Event('focus'));
    await waitFor(() => expect((screen.getByRole('button', { name: 'Confirm completion' }) as HTMLButtonElement).disabled).toBe(true));
    expect(screen.getByText(/All completion checks passed/)).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Checking work');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm completion' }));
    expect(api.complete).not.toHaveBeenCalled();
    await act(async () => resolve({ ...ready, canComplete: false, blockers: [{ kind: 'cash', id: 'new', title: 'New cash', status: 'released', detail: 'Receipts required' }] }));
    await screen.findByText('New cash');
    expect(screen.queryByText(/All completion checks passed/)).toBeNull();
    expect((screen.getByRole('button', { name: 'Confirm completion' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('refuses directly opened completion for a non-Head without loading private checks',async()=>{
    api.actor.role='member';dialog();
    await screen.findByText('Only an authorized Office Head can complete this project.');
    expect(api.readiness).not.toHaveBeenCalled();expect((screen.getByRole('button',{name:'Confirm completion'}) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button',{name:'Confirm completion'}));expect(api.complete).not.toHaveBeenCalled();
  });
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
      expect(screen.getByText(/The Financial Officer must independently verify and settle/)).toBeTruthy();
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
