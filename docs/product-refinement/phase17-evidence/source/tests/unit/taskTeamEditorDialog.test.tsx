// @vitest-environment jsdom

import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UserProfile } from "../../src/app/types";
import type { Task } from "../../src/app/features/tasks";

vi.mock("../../src/app/components/ui/Toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock("../../src/app/features/tasks/services/taskTeamService", () => ({
  updateTaskTeamMembers: vi.fn(),
}));

import { TaskTeamEditorDialog } from "../../src/app/features/tasks/components/team/TaskTeamEditorDialog";

import { installNavigationConfirmation } from '../../src/app/shared/navigationGuard';
import { updateTaskTeamMembers } from '../../src/app/features/tasks/services/taskTeamService';
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
