// @vitest-environment jsdom

import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserProfile } from "../../src/app/types";
import type { Task } from "../../src/app/features/tasks";

const work=vi.hoisted(()=>({actor:'lead',load:vi.fn(),save:vi.fn()}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:work.actor}})}));
vi.mock('../../src/app/features/nested-work/services/workTreeService',()=>({fetchWorkTree:work.load,saveWorkTree:work.save,WorkTreeUnavailable:class WorkTreeUnavailable extends Error{}}));
vi.mock('../../src/app/features/project-invitations',()=>({ProjectInvitations:()=>null}));

vi.mock("../../src/app/components/ui/Toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock("../../src/app/features/tasks/services/taskTeamService", () => ({
  updateTaskTeamMembers: vi.fn(),
}));

import { TaskTeamEditorDialog } from "../../src/app/features/tasks/components/team/TaskTeamEditorDialog";

import { installNavigationConfirmation } from '../../src/app/shared/navigationGuard';
import { updateTaskTeamMembers } from '../../src/app/features/tasks/services/taskTeamService';
import {rememberWorkCapabilityContext} from '../../src/app/features/nested-work/selectors/capabilities';
import {WorkTreeUnavailable} from '../../src/app/features/nested-work/services/workTreeService';
import type {WorkTreeSnapshot,WorkTreeController} from '../../src/app/features/nested-work';
beforeEach(()=>{sessionStorage.clear();work.actor='lead';work.load.mockReset();work.save.mockReset();});
afterEach(() => { cleanup(); vi.clearAllMocks(); });
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

describe('Phase 12 task team safety',()=>{
 it('rechecks newly assigned unfinished work after confirmation opens',async()=>{
  const props={task,profiles,subtasks:[] as any[],responsibleOrgId:'ledipo',onClose:vi.fn()};
  const view=render(createElement(TaskTeamEditorDialog,props));
  fireEvent.click(screen.getByRole('button',{name:/Gabriel Cahiyang/}));
  fireEvent.click(screen.getByRole('button',{name:'Save members',exact:true}));
  const alert=await screen.findByRole('alertdialog');
  view.rerender(createElement(TaskTeamEditorDialog,{...props,subtasks:[{id:'new-work',title:'Newly assigned work',assignedToIds:['member'],isCompleted:false,status:'in_progress'}] as any[]}));
  fireEvent.click(Array.from(alert.querySelectorAll('button')).find(button=>button.textContent==='Save members')!);
  await screen.findByText(/still owns 1 unfinished subtask.*Newly assigned work/);
  expect(updateTaskTeamMembers).not.toHaveBeenCalled();expect(props.onClose).not.toHaveBeenCalled();
 });
 it('rejects a newly inactive selected member after confirmation opens',async()=>{
  const props={task,profiles,subtasks:[],responsibleOrgId:'ledipo',onClose:vi.fn()};
  const view=render(createElement(TaskTeamEditorDialog,props));
  fireEvent.click(screen.getByRole('button',{name:/Maria Clara/}));
  fireEvent.click(screen.getByRole('button',{name:'Save members',exact:true}));
  const alert=await screen.findByRole('alertdialog');
  view.rerender(createElement(TaskTeamEditorDialog,{...props,profiles:profiles.map(profile=>profile.id==='available'?{...profile,is_active:false}:profile)}));
  fireEvent.click(Array.from(alert.querySelectorAll('button')).find(button=>button.textContent==='Save members')!);
  await screen.findByText(/selected member is no longer eligible/);
  expect(updateTaskTeamMembers).not.toHaveBeenCalled();
 });
 it('keeps a team draft on cancelled dismissal, then discards only after acceptance',async()=>{
  const onClose=vi.fn(), confirm=vi.fn().mockResolvedValue(false), uninstall=installNavigationConfirmation(confirm);
  render(createElement(TaskTeamEditorDialog,{task,profiles,subtasks:[],responsibleOrgId:'ledipo',onClose}));
  fireEvent.click(screen.getByRole('button',{name:/Maria Clara/}));
  fireEvent.click(screen.getByRole('button',{name:'Cancel',exact:true}));
  await waitFor(()=>expect(confirm).toHaveBeenCalledWith(['Task team members']));expect(onClose).not.toHaveBeenCalled();
  confirm.mockResolvedValue(true);fireEvent.click(screen.getByRole('button',{name:'Cancel',exact:true}));
  await waitFor(()=>expect(onClose).toHaveBeenCalledTimes(1));uninstall();
 });
 it('uses an impact dialog once and retains selected members after a server denial',async()=>{
  vi.mocked(updateTaskTeamMembers).mockRejectedValueOnce(new Error('Office access denied'));
  const onClose=vi.fn();render(createElement(TaskTeamEditorDialog,{task,profiles,subtasks:[],responsibleOrgId:'ledipo',onClose}));
  fireEvent.click(screen.getByRole('button',{name:/Maria Clara/}));
  const save=screen.getByRole('button',{name:'Save members',exact:true});fireEvent.click(save);fireEvent.click(save);
  const alert=await screen.findByRole('alertdialog');expect(alert.textContent).toContain('1 added');
  fireEvent.click(Array.from(alert.querySelectorAll('button')).find(button=>button.textContent==='Save members')!);
  await waitFor(()=>expect(screen.getByText('Office access denied')).toBeTruthy());
  expect(updateTaskTeamMembers).toHaveBeenCalledTimes(1);expect(onClose).not.toHaveBeenCalled();
  expect(updateTaskTeamMembers).toHaveBeenCalledWith(expect.objectContaining({nextMemberIds:['lead','member','available']}));
 });
 it('refuses to overwrite a team changed remotely while a draft is open',async()=>{
  const onClose=vi.fn(), props={task,profiles,subtasks:[],responsibleOrgId:'ledipo',onClose};
  const {rerender}=render(createElement(TaskTeamEditorDialog,props));fireEvent.click(screen.getByRole('button',{name:/Maria Clara/}));
  rerender(createElement(TaskTeamEditorDialog,{...props,task:{...task,teamMemberIds:['lead','member','remote']}}));
  fireEvent.click(screen.getByRole('button',{name:'Save members',exact:true}));
  const alert=await screen.findByRole('alertdialog');fireEvent.click(Array.from(alert.querySelectorAll('button')).find(button=>button.textContent==='Save members')!);
  await screen.findByText('The task team changed while you were editing. Close and reopen to review current members.');
  expect(updateTaskTeamMembers).not.toHaveBeenCalled();expect(onClose).not.toHaveBeenCalled();
 });

});

const supportedTask={...task,linkedProjectId:'project'};
const granted={allowed:true,reason_code:null} as const,denied={allowed:false,reason_code:'appointment_denied'} as const;
function workSnapshot(appointment=false,contributors=true):WorkTreeSnapshot {
 const data:WorkTreeSnapshot={root:{id:'task',project:'project',office:'ledipo',kind:'office',lead:'lead',open:true,people:['lead','member'],due:null,capabilities:{appoint_lead:appointment?granted:denied,manage_contributors:contributors?granted:{allowed:false,reason_code:'branch_denied'},create_child:granted,order_children:granted}},revision:7,can_manage:true,can_transfer:true,nodes:[],people:[{id:'lead',name:'Raoul Cam',eligible:true},{id:'member',name:'Gabriel Cahiyang',eligible:true},{id:'available',name:'Selected Maria Clara',eligible:true},{id:'expired',name:'Expired guest',eligible:false}],leaf_total:0,leaf_completed:0};
 rememberWorkCapabilityContext(data,work.actor);return data;
}
describe('NW3.3 supported task team callers',()=>{
 it('uses a supplied table controller without another read and retains contributor-only authority',async()=>{
  const data=workSnapshot(true),save=vi.fn().mockResolvedValue(data),onClose=vi.fn();
  const controller:WorkTreeController={rootId:'task',actorId:'lead',data,loading:false,error:'',unavailable:false,authorityFresh:true,refreshPending:false,pending:false,reload:vi.fn(),save};
  render(createElement(TaskTeamEditorDialog,{task:supportedTask,profiles,subtasks:[],controller,onClose}));expect((screen.getByLabelText('Appointed Lead') as HTMLSelectElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Add contributor Selected Maria Clara'}));fireEvent.click(screen.getByRole('button',{name:/^Save (?:work )?changes$/}));await waitFor(()=>expect(save).toHaveBeenCalledTimes(1));
  expect(save.mock.calls[0][0]).toMatchObject({command:'contributors',revision:7,payload:{people:['lead','member','available']}});expect(work.load).not.toHaveBeenCalled();expect(work.save).not.toHaveBeenCalled();expect(updateTaskTeamMembers).not.toHaveBeenCalled();expect(onClose).toHaveBeenCalledTimes(1);
 });
 it('saves contributors through the canonical versioned operation without legacy writes or notifications',async()=>{
  work.load.mockResolvedValue(workSnapshot());work.save.mockResolvedValue(workSnapshot());const onClose=vi.fn();
  render(createElement(TaskTeamEditorDialog,{task:supportedTask,profiles,subtasks:[],onClose}));
  const lead=await screen.findByLabelText('Appointed Lead');expect((lead as HTMLSelectElement).disabled).toBe(true);
  expect(screen.queryByRole('button',{name:'Add contributor Maria Clara',exact:true})).toBeNull();expect(screen.queryByRole('button',{name:'Add contributor Expired guest'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Add contributor Selected Maria Clara'}));fireEvent.click(screen.getByRole('button',{name:/^Save (?:work )?changes$/}));
  await waitFor(()=>expect(onClose).toHaveBeenCalledTimes(1));expect(work.save).toHaveBeenCalledTimes(1);expect(work.save.mock.calls[0]).toEqual(['task',expect.objectContaining({command:'contributors',revision:7,payload:{people:['lead','member','available']}})]);
  expect(updateTaskTeamMembers).not.toHaveBeenCalled();
 });
 it('keeps Head appointment authority separate from the contributor-only Team action',async()=>{
  work.load.mockResolvedValue(workSnapshot(true));render(createElement(TaskTeamEditorDialog,{task:supportedTask,profiles,subtasks:[],onClose:vi.fn()}));
  const lead=await screen.findByLabelText('Appointed Lead');expect((lead as HTMLSelectElement).disabled).toBe(true);
  fireEvent.change(lead,{target:{value:'available'}});expect((lead as HTMLSelectElement).value).toBe('lead');
  fireEvent.click(screen.getByRole('button',{name:'Add contributor Selected Maria Clara'}));work.save.mockResolvedValue(workSnapshot(true));fireEvent.click(screen.getByRole('button',{name:/^Save (?:work )?changes$/}));
  await waitFor(()=>expect(work.save).toHaveBeenCalled());expect(work.save.mock.calls[0][1].command).toBe('contributors');expect(screen.queryByRole('alertdialog')).toBeNull();
 });
 it('retains a contributor draft when fresh capability revokes saving',async()=>{
  work.load.mockResolvedValue(workSnapshot());render(createElement(TaskTeamEditorDialog,{task:supportedTask,profiles,subtasks:[],onClose:vi.fn()}));await screen.findByLabelText('Appointed Lead');
  fireEvent.click(screen.getByRole('button',{name:'Add contributor Selected Maria Clara'}));work.load.mockResolvedValue(workSnapshot(false,false));fireEvent(window,new Event('focus'));
  await waitFor(()=>expect((screen.getByRole('button',{name:/^Save (?:work )?changes$/}) as HTMLButtonElement).disabled).toBe(true));expect((screen.getByRole('button',{name:'Remove contributor Selected Maria Clara'}) as HTMLButtonElement).disabled).toBe(true);expect(work.save).not.toHaveBeenCalled();
 });
 it('fails closed with absent capability maps even when old management booleans are true',async()=>{
  const data=workSnapshot();delete data.root.capabilities;work.load.mockResolvedValue(data);render(createElement(TaskTeamEditorDialog,{task:supportedTask,profiles,subtasks:[],onClose:vi.fn()}));
  await screen.findByLabelText('Appointed Lead');expect((screen.getByRole('button',{name:/^Save (?:work )?changes$/}) as HTMLButtonElement).disabled).toBe(true);expect(work.save).not.toHaveBeenCalled();expect(updateTaskTeamMembers).not.toHaveBeenCalled();
 });
 it('never falls back to the legacy writer when the supported RPC is unavailable',async()=>{
  work.load.mockRejectedValue(new WorkTreeUnavailable('Missing'));render(createElement(TaskTeamEditorDialog,{task:supportedTask,profiles,subtasks:[],onClose:vi.fn()}));
  await screen.findByText(/Staffing is unavailable/);expect(screen.queryByRole('button',{name:'Save members'})).toBeNull();expect(updateTaskTeamMembers).not.toHaveBeenCalled();
 });
 it('retains values and blocks saves when the caller becomes read-only',async()=>{
  work.load.mockResolvedValue(workSnapshot());const props={task:supportedTask,profiles,subtasks:[],onClose:vi.fn()},view=render(createElement(TaskTeamEditorDialog,props));await screen.findByLabelText('Appointed Lead');
  fireEvent.click(screen.getByRole('button',{name:'Add contributor Selected Maria Clara'}));view.rerender(createElement(TaskTeamEditorDialog,{...props,readOnly:true}));
  expect((screen.getByRole('button',{name:'Remove contributor Selected Maria Clara'}) as HTMLButtonElement).disabled).toBe(true);expect((screen.getByRole('button',{name:/^Save (?:work )?changes$/}) as HTMLButtonElement).disabled).toBe(true);expect(work.save).not.toHaveBeenCalled();
 });
 for(const status of ['for_review','completed','cancelled'] as const)it('locks canonical contributors for '+status,async()=>{
  work.load.mockResolvedValue(workSnapshot(true));render(createElement(TaskTeamEditorDialog,{task:{...supportedTask,status},profiles,subtasks:[],onClose:vi.fn()}));await screen.findByLabelText('Appointed Lead');
  expect((screen.getByRole('button',{name:/^Save (?:work )?changes$/}) as HTMLButtonElement).disabled).toBe(true);expect(work.save).not.toHaveBeenCalled();
 });
 for(const patch of [{linkedProjectId:undefined},{proposedOfficeIdentityId:'unresolved'},{sourceCollaborationDraftId:'governed'}])it('retains the legacy workflow for an excluded task '+JSON.stringify(patch),()=>{
  render(createElement(TaskTeamEditorDialog,{task:{...supportedTask,...patch},profiles,subtasks:[],onClose:vi.fn()}));expect(screen.getByRole('button',{name:'Save members',exact:true})).toBeTruthy();expect(work.load).not.toHaveBeenCalled();
 });
 it('blocks a legacy save if read-only changes while its confirmation is open',async()=>{
  const props={task,profiles,subtasks:[],onClose:vi.fn()},view=render(createElement(TaskTeamEditorDialog,props));fireEvent.click(screen.getByRole('button',{name:/Maria Clara/}));fireEvent.click(screen.getByRole('button',{name:'Save members',exact:true}));
  const alert=await screen.findByRole('alertdialog');view.rerender(createElement(TaskTeamEditorDialog,{...props,readOnly:true}));fireEvent.click(Array.from(alert.querySelectorAll('button')).find(button=>button.textContent==='Save members')!);
  await screen.findByText('This task is read-only in the current view.');expect(updateTaskTeamMembers).not.toHaveBeenCalled();
 });
});
