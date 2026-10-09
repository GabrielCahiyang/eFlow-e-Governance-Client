// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../../src/app/features/tasks';
import { timelineDraft, timelinePatch, numericPatch } from '../../src/app/features/project-table/planningDraft';
import { groupDeleteBlocker } from '../../src/app/features/project-table/groupDeletion';
import { NumberCell } from '../../src/app/features/project-table/components/NumberCell';
import { AsyncSelectCell } from '../../src/app/features/project-table/components/AsyncSelectCell';
import { usePlanningEditor } from '../../src/app/features/project-table/hooks/usePlanningEditor';
import { CreateWorkDialog } from '../../src/app/features/project-table/components/CreateWorkDialog';
import { useGroupDeletion } from '../../src/app/features/project-table/hooks/useGroupDeletion';
import { installNavigationConfirmation, requestNavigation } from '../../src/app/shared/navigationGuard';
const mocks = vi.hoisted(()=>({task:vi.fn(),group:vi.fn(),remove:vi.fn(),confirm:vi.fn()}));
vi.mock('../../src/app/features/project-table/services/workspaceService',()=>({createWorkspaceTask:mocks.task,createProjectGroup:mocks.group,deleteProjectGroup:mocks.remove}));
vi.mock('../../src/app/components/ui/useConfirmation',()=>({useConfirmation:()=>({confirm:mocks.confirm,dialog:null})}));
const task:Task={id:'task',title:'Assessment',orgId:'office',status:'todo',deadline:'2026-10-09T17:45:00+08:00',createdAt:1,updatedAt:1};
const group={id:'group',projectId:'project',title:'Work',color:'#579bfc',position:1,isDefault:false};
afterEach(()=>{cleanup();vi.restoreAllMocks();});beforeEach(()=>{vi.clearAllMocks();mocks.task.mockResolvedValue({id:'created'});mocks.group.mockResolvedValue(group);mocks.remove.mockResolvedValue(undefined);mocks.confirm.mockResolvedValue(true);});
describe('Phase 11 edit and creation contracts',()=>{
 it('closes only an opted-in date editor after success and retains denied or pending drafts',async()=>{
  const editor=renderHook(()=>usePlanningEditor(()=>({end:'2026-10-09'}),'Dates',{closeOnSuccess:true}));
  act(()=>editor.result.current.onOpenChange(true));act(()=>editor.result.current.setDraft({end:'2026-10-14'}));
  const denied=vi.fn().mockRejectedValue(new Error('Denied'));
  await act(async()=>editor.result.current.submit(denied,'Saved.'));
  expect(editor.result.current.open).toBe(true);expect(editor.result.current.draft.end).toBe('2026-10-14');expect(editor.result.current.error).toBe('Denied');
  let finish!:()=>void;const save=vi.fn(()=>new Promise<void>(resolve=>{finish=resolve;}));let operation!:Promise<void>;
  act(()=>{operation=editor.result.current.submit(save,'Saved.');});
  await act(async()=>editor.result.current.submit(save,'Saved.'));expect(save).toHaveBeenCalledOnce();expect(editor.result.current.open).toBe(true);
  expect(await requestNavigation(vi.fn())).toBe(false);
  await act(async()=>{finish();await operation;});expect(editor.result.current.open).toBe(false);expect(editor.result.current.dirty).toBe(false);
 });
 it('changes date without stripping its canonical due time or offset and validates amounts',()=>{
  expect(timelineDraft(task)).toEqual({start:'',end:'2026-10-09'});
  expect(timelinePatch(task,{start:'2026-10-01',end:'2026-10-12'})).toEqual({start_date:'2026-10-01',deadline:'2026-10-12T17:45:00+08:00'});
  expect(timelinePatch(task,{start:'',end:''})).toEqual({start_date:null,deadline:''});
  expect(()=>timelinePatch(task,{start:'2026-10-20',end:'2026-10-09'})).toThrow('Start date');
  expect(()=>numericPatch('estimated_hours','100001')).toThrow('amount');expect(()=>numericPatch('budget_impact','Infinity')).toThrow('amount');
 });
 it('explains default, nonempty including archived, and unauthorized deletion blockers',()=>{
  expect(groupDeleteBlocker({...group,isDefault:true},[],true)).toContain('default');
  expect(groupDeleteBlocker(group,[{...task,groupId:group.id,archivedAt:1}],true)).toContain('archived');
  expect(groupDeleteBlocker(group,[],false)).toContain('Head');expect(groupDeleteBlocker(group,[],true)).toBeUndefined();
 });
 it('retains failed numeric values and retries only their patch',async()=>{
  const save=vi.fn().mockRejectedValueOnce(new Error('Denied')).mockResolvedValue(undefined);
  render(<NumberCell value={8} label="Effort" disabled={false} save={save} field="estimated_hours"/>);
  const input=screen.getByRole('spinbutton',{name:'Effort'});fireEvent.change(input,{target:{value:'12'}});fireEvent.blur(input);
  expect((await screen.findByRole('alert')).textContent).toContain('Denied');expect(input).toHaveProperty('value','12');expect(input.getAttribute('aria-invalid')).toBe('true');
  fireEvent.click(screen.getByRole('button',{name:'Retry'}));await screen.findByText('Saved.');expect(save.mock.calls).toEqual([[{estimated_hours:12}],[{estimated_hours:12}]]);
 });
 it('prevents duplicate numeric writes and blocks navigation until pending save settles',async()=>{
  let finish!:()=>void;const save=vi.fn(()=>new Promise<void>(r=>{finish=r;}));
  render(<NumberCell value={8} label="Effort" disabled={false} save={save} field="estimated_hours"/>);
  const input=screen.getByRole('spinbutton');fireEvent.change(input,{target:{value:'12'}});fireEvent.blur(input);fireEvent.blur(input);
  expect(save).toHaveBeenCalledOnce();expect(await requestNavigation(vi.fn())).toBe(false);
  await act(async()=>finish());expect(await requestNavigation(vi.fn())).toBe(true);
 });
 it('cancels numeric drafts using Escape without writing',()=>{
  const save=vi.fn();render(<NumberCell value={8} label="Effort" disabled={false} save={save} field="estimated_hours"/>);
  const input=screen.getByRole('spinbutton');fireEvent.change(input,{target:{value:'12'}});fireEvent.keyDown(input,{key:'Escape'});fireEvent.blur(input);
  expect(input).toHaveProperty('value','8');expect(save).not.toHaveBeenCalled();
 });
 it('retains a failed select and restores its canonical value after explicit cancellation',async()=>{
  const save=vi.fn().mockRejectedValueOnce(new Error('Denied')).mockResolvedValue(false);
  render(<AsyncSelectCell value="medium" label="Priority" disabled={false} onSave={save}><option>medium</option><option>high</option></AsyncSelectCell>);
  const input=screen.getByRole('combobox');fireEvent.change(input,{target:{value:'high'}});await screen.findByRole('alert');expect(input).toHaveProperty('value','high');
  fireEvent.click(screen.getByRole('button',{name:'Retry'}));await waitFor(()=>expect(input).toHaveProperty('value','medium'));expect(save).toHaveBeenCalledTimes(2);
 });
 it('keeps explicit planning drafts on canceled close, prevents duplicate saves, then discards',async()=>{
  let accepted=false;const uninstall=installNavigationConfirmation(async()=>accepted);
  const editor=renderHook(()=>usePlanningEditor(()=>['original'],'Dependencies'));
  act(()=>editor.result.current.onOpenChange(true));act(()=>editor.result.current.setDraft(['changed']));
  await act(async()=>editor.result.current.onOpenChange(false));expect(editor.result.current.open).toBe(true);expect(editor.result.current.draft).toEqual(['changed']);
  let finish!:()=>void;const save=vi.fn(()=>new Promise<void>(r=>{finish=r;}));let operation!:Promise<void>;
  act(()=>{operation=editor.result.current.submit(save,'Saved.');});await act(async()=>editor.result.current.submit(save,'Saved.'));expect(save).toHaveBeenCalledOnce();expect(await requestNavigation(vi.fn())).toBe(false);
  await act(async()=>{finish();await operation;});expect(editor.result.current.dirty).toBe(false);expect(editor.result.current.open).toBe(true);
  act(()=>editor.result.current.setDraft(['another']));accepted=true;await act(async()=>editor.result.current.onOpenChange(false));expect(editor.result.current.open).toBe(false);uninstall();
 });
 it('retains explicit planning errors and retries the same draft',async()=>{
  const editor=renderHook(()=>usePlanningEditor(()=>({end:'old'}),'Dates'));act(()=>editor.result.current.onOpenChange(true));act(()=>editor.result.current.setDraft({end:'new'}));
  const save=vi.fn().mockRejectedValueOnce(new Error('Denied')).mockResolvedValue(undefined);
  await act(async()=>editor.result.current.submit(save,'Saved.'));expect(editor.result.current.error).toBe('Denied');expect(editor.result.current.draft.end).toBe('new');
  await act(async()=>editor.result.current.submit(save,'Saved.'));expect(save).toHaveBeenCalledTimes(2);expect(editor.result.current.dirty).toBe(false);
 });
 it.each(['task','group'] as const)('guards a new %s draft and retains a failed creation',async kind=>{
  const close=vi.fn();const create=kind==='task'?mocks.task:mocks.group;create.mockRejectedValueOnce(new Error('Denied'));
  const uninstall=installNavigationConfirmation(async()=>false);
  render(<CreateWorkDialog kind={kind} projectId="project" groups={[group]} onClose={close}/>);
  const input=screen.getByRole('textbox');fireEvent.change(input,{target:{value:'New work'}});fireEvent.click(screen.getByRole('button',{name:'Cancel'}));await act(async()=>{});expect(close).not.toHaveBeenCalled();
  fireEvent.submit(input.closest('form')!);await screen.findByRole('alert');expect(input).toHaveProperty('value','New work');expect(close).not.toHaveBeenCalled();
  create.mockResolvedValue(group);fireEvent.submit(input.closest('form')!);await waitFor(()=>expect(close).toHaveBeenCalledOnce());expect(create).toHaveBeenCalledTimes(2);uninstall();
 });
 it('requires confirmation and keeps server-denied group deletion available',async()=>{
  mocks.confirm.mockResolvedValueOnce(false);mocks.remove.mockRejectedValueOnce(new Error('Denied'));
  const editor=renderHook(()=>useGroupDeletion(group,vi.fn().mockResolvedValue(undefined)));
  await act(async()=>editor.result.current.remove());expect(mocks.remove).not.toHaveBeenCalled();
  await act(async()=>editor.result.current.remove());expect(editor.result.current.error).toBe('Denied');expect(editor.result.current.refreshFailed).toBe(false);
  expect(mocks.confirm.mock.calls[1][0].description).toContain('No tasks');
 });
 it('retries group refresh after committed deletion without deleting again',async()=>{
  const refresh=vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValue(undefined);const editor=renderHook(()=>useGroupDeletion(group,refresh));
  await act(async()=>editor.result.current.remove());expect(editor.result.current.error).toContain('Group deleted');
  await act(async()=>editor.result.current.retryRefresh());expect(mocks.remove).toHaveBeenCalledOnce();expect(refresh).toHaveBeenCalledTimes(2);expect(editor.result.current.error).toBe('');
 });
});
