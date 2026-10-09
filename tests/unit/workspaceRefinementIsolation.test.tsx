// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceScopeContext } from '../../src/app/features/workspaces/WorkspaceScopeContext';
import { useWorkspaceState } from '../../src/app/features/workspaces/hooks/useWorkspaceState';
import { usePersonalProject } from '../../src/app/features/workspaces/hooks/usePersonalProject';
import { useTableLayout } from '../../src/app/features/project-table/hooks/useTableLayout';
import { WorkspaceCreateDialog } from '../../src/app/features/workspaces/components/WorkspaceCreateDialog';
import { PersonalTaskList } from '../../src/app/features/workspaces/components/PersonalTaskList';
import { PersonalTaskCreate } from '../../src/app/features/workspaces/components/PersonalTaskList';
import { readWorkspacePreference, saveWorkspacePreference, writeWorkspaceLocation } from '../../src/app/features/workspaces/workspaceLocation';
import type { PersonalSnapshot, Workspace } from '../../src/app/features/workspaces/types';
import { EflowVibeThemeProvider } from '../../src/app/shared/vibe';
import { buildWorkspaceNavigation } from '../../src/app/features/workspaces/navigation';
import { buildShellNavigation } from '../../src/app/features/navigation';
import { useProjectLocation } from '../../src/app/features/projects/hooks/useProjectLocation';

const api=vi.hoisted(()=>({list:vi.fn(),select:vi.fn(),personal:vi.fn(),command:vi.fn()}));
vi.mock('../../src/app/features/workspaces/services/workspaceService',()=>({
 listWorkspaces:api.list,selectWorkspace:api.select,fetchPersonalProject:api.personal,personalCommand:api.command,
 WorkspaceApiUnavailable:class extends Error {},
}));
const office:Workspace={id:'office',name:'LEDIPO',kind:'office',office_id:'office',owner_id:null,state:'active',timezone:'Asia/Singapore'};
const personal:Workspace={id:'private',name:'Private research',kind:'personal',office_id:null,owner_id:'owner',state:'active',timezone:'Asia/Singapore'};
const detail:PersonalSnapshot={owner:'owner',project:{id:'private-project',workspace_id:'private',title:'Private project',status:'active',revision:1},tasks:[{id:'task',project_id:'private-project',title:'Research',lead_id:'owner',reviewer_id:'reviewer',status:'submitted',progress:100,note:'Ready',review_note:'',revision:2}],members:[{user_id:'owner',name:'Owner',access:'member',state:'active',eligible:true},{user_id:'reviewer',name:'Reviewer',access:'member',state:'active',eligible:true},{user_id:'viewer',name:'Viewer',access:'viewer',state:'active',eligible:false}],shortcuts:[]};
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>resolve=r);return {promise,resolve};}
afterEach(()=>{cleanup();vi.resetAllMocks();localStorage.clear();window.history.replaceState({},'','/projects');});

describe('R3 scope boundaries in active sessions',()=>{
 it('clears previous rows synchronously while switching and discards a late old response',async()=>{
  window.history.replaceState({},'','/projects?workspace=office&project=old&view=tasks');
  api.list.mockResolvedValue([office,personal]);
  const late=deferred<{workspace:Workspace;projects:{id:string;title:string;status:string;kind:'office';home_workspace_id:string}[]}>();
  const next=deferred<{workspace:Workspace;projects:{id:string;title:string;kind:'personal';status:string;home_workspace_id:string}[]}>();
  api.select.mockResolvedValueOnce({workspace:office,projects:[{id:'old',title:'Old Office row',status:'active',kind:'office',home_workspace_id:'office'}]});
  api.select.mockImplementation((id:string)=>id==='office'?late.promise:next.promise);
  const view=renderHook(()=>useWorkspaceState('owner','office',true));
  await waitFor(()=>expect(view.result.current.snapshot?.workspace.id).toBe('office'));
  act(()=>{void view.result.current.refresh();});
  await act(async()=>{await view.result.current.select('private');});
  expect(window.location.search).not.toContain('project=old');
  expect(window.location.search).not.toContain('view=');
  expect(view.result.current.snapshot).toBeUndefined();
  await act(async()=>next.resolve({workspace:personal,projects:[{id:'private-project',title:'Private project',kind:'personal',status:'active',home_workspace_id:'private'}]}));
  await waitFor(()=>expect(view.result.current.snapshot?.workspace.id).toBe('private'));
  await act(async()=>late.resolve({workspace:office,projects:[{id:'old',title:'Old Office row',status:'active',kind:'office',home_workspace_id:'office'}]}));
  expect(view.result.current.snapshot?.projects.map(p=>p.id)).toEqual(['private-project']);
  expect(readWorkspacePreference('owner').current).toBe('private');
 });
 it('rehydrates the explicit URL over a saved workspace, and clears rows/names after membership revocation',async()=>{
  saveWorkspacePreference('owner','office');window.history.replaceState({},'','/projects?workspace=private&project=private-project');
  api.list.mockResolvedValue([office,personal]);api.select.mockResolvedValue({workspace:personal,projects:[{id:'private-project'}]});
  const view=renderHook(()=>useWorkspaceState('owner','office',true));
  await waitFor(()=>expect(view.result.current.snapshot?.workspace.id).toBe('private'));
  api.list.mockResolvedValue([office]);await act(async()=>view.result.current.refresh());
  expect(view.result.current.snapshot).toBeUndefined();expect(view.result.current.workspaces).toEqual([office]);
  expect(view.result.current.error).toMatch(/membership has ended/);
 });
 it('does not expose another account workspace list or personal snapshot during account changes',async()=>{
  window.history.replaceState({},'','/projects?workspace=private');api.list.mockResolvedValue([personal]);api.select.mockResolvedValue({workspace:personal,projects:[]});
  const pending=deferred<Workspace[]>();
  const view=renderHook(({user})=>useWorkspaceState(user,'office',true),{initialProps:{user:'owner'}});
  await waitFor(()=>expect(view.result.current.snapshot).toBeTruthy());
  api.list.mockReturnValue(pending.promise);view.rerender({user:'other'});
  expect(view.result.current.workspaces).toEqual([]);expect(view.result.current.snapshot).toBeUndefined();
 });
 it('bridges only the current canonical Office committed create receipt while fresh scope data is pending',async()=>{
  window.history.replaceState({},'','/projects?workspace=office');api.list.mockResolvedValue([office]);api.select.mockResolvedValueOnce({workspace:office,projects:[]});
  const pending=deferred<{workspace:Workspace;projects:[]}>();api.select.mockReturnValue(pending.promise);
  const view=renderHook(()=>useWorkspaceState('owner','office',true));await waitFor(()=>expect(view.result.current.snapshot).toBeTruthy());
  act(()=>view.result.current.includeCreatedOfficeProject({id:'wrong',title:'Other Office',orgId:'elsewhere',status:'planning'}));
  expect(view.result.current.snapshot?.projects).toEqual([]);
  act(()=>view.result.current.includeCreatedOfficeProject({id:'new',title:'Committed Office creation',orgId:'office',status:'planning'}));
  expect(view.result.current.snapshot?.projects.map(p=>p.id)).toEqual(['new']);
 });
 it('rejects a personal project whose home differs from the selected workspace',async()=>{
  api.personal.mockResolvedValue(detail);
  const view=renderHook(()=>usePersonalProject('another','private-project','owner'));
  await waitFor(()=>expect(view.result.current.error).toMatch(/another workspace/));expect(view.result.current.data).toBeUndefined();
 });
 it('clears a denied personal snapshot and retains a committed mutation receipt when refresh fails',async()=>{
  api.personal.mockResolvedValue(detail);api.command.mockResolvedValue({status:'done'});
  const view=renderHook(()=>usePersonalProject('private','private-project','owner'));
  await waitFor(()=>expect(view.result.current.data).toBeTruthy());
  api.personal.mockRejectedValue(new Error('Project access denied'));
  await act(async()=>{expect(await view.result.current.run('submit_task',{task_id:'task',revision:2})).toBe(true);});
  await waitFor(()=>expect(view.result.current.data).toBeUndefined());expect(view.result.current.saved).toBe('Changes saved.');expect(api.command).toHaveBeenCalledTimes(1);
 });
 it('blocks double submit and retries an uncertain mutation with its original request ID',async()=>{
  api.personal.mockResolvedValue(detail);const pending=deferred<Record<string,unknown>>();api.command.mockReturnValueOnce(pending.promise).mockResolvedValue({});
  const view=renderHook(()=>usePersonalProject('private','private-project','owner'));
  await waitFor(()=>expect(view.result.current.data).toBeTruthy());
  let first!:Promise<boolean>;
  act(()=>{first=view.result.current.run('complete_project',{});});
  await act(async()=>expect(await view.result.current.run('complete_project',{})).toBe(false));
  await act(async()=>{pending.resolve({});await first;});expect(api.command).toHaveBeenCalledTimes(1);
  api.command.mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValue({});
  await act(async()=>view.result.current.run('archive_project',{}));
  const request=api.command.mock.calls.at(-1)![3];
  await act(async()=>view.result.current.run('archive_project',{}));expect(api.command.mock.calls.at(-1)![3]).toBe(request);
 });
});
describe('R3 scoped navigation, drafts and personal review',()=>{
 it('does not let the previously mounted Office clear a shortcut destination in another workspace',()=>{
  window.history.replaceState({},'','/projects?workspace=office&project=office-project');const unavailable=vi.fn();
  renderHook(()=>useProjectLocation({projects:[{id:'office-project'}],loading:false,activeProjectId:'office-project',workspaceId:'office',onOpen:vi.fn(),onUnavailable:unavailable}));
  act(()=>writeWorkspaceLocation('private',true,'push',{pathname:'/projects',page:'Projects',project:'private-project',view:'tasks'}));
  expect(unavailable).not.toHaveBeenCalled();expect(window.location.search).toContain('project=private-project');
 });
 it('keeps authorized Inbox, Accounting and support destinations discoverable in a personal workspace',()=>{
  const original=buildShellNavigation({role:'accounting_staff',can:()=>true});
  const scoped=buildWorkspaceNavigation(original,true,false);
  expect(scoped.some(item=>item.id==='inbox')).toBe(true);
  expect(scoped.filter(item=>item.group==='accounting').map(item=>item.id)).toEqual(original.filter(item=>item.group==='accounting').map(item=>item.id));
  expect(scoped.filter(item=>item.group==='admin-center').map(item=>item.id)).toEqual(original.filter(item=>item.group==='admin-center').map(item=>item.id));
  expect(scoped.filter(item=>item.group==='workspaces').map(item=>item.id)).toEqual(['dashboard','projects']);
 });
 it('keeps user/workspace/project table layouts independent while seeding legacy preferences',()=>{
  localStorage.setItem('eflow_project_columns_project',JSON.stringify(['effort']));
  const wrapper=({children,workspace='office',user='owner'}:{children:React.ReactNode;workspace?:string;user?:string})=><WorkspaceScopeContext.Provider value={{workspace:{...office,id:workspace},userId:user,officeProjectIds:['project']}}>{children}</WorkspaceScopeContext.Provider>;
  const first=renderHook(()=>useTableLayout('project'),{wrapper});expect(first.result.current.hidden).toContain('effort');
  act(()=>first.result.current.hideColumn('priority'));first.unmount();
  const second=renderHook(()=>useTableLayout('project'),{wrapper:({children})=>wrapper({children,workspace:'other'})});expect(second.result.current.hidden).not.toContain('priority');second.unmount();
  const third=renderHook(()=>useTableLayout('project'),{wrapper:({children})=>wrapper({children,user:'other'})});expect(third.result.current.hidden).not.toContain('priority');third.unmount();
  expect(renderHook(()=>useTableLayout('project'),{wrapper}).result.current.hidden).toContain('priority');
 });
 it('keeps recents account-local and removes the entire old project context on switch',()=>{
  saveWorkspacePreference('owner','office');saveWorkspacePreference('owner','private');expect(readWorkspacePreference('other').recent).toEqual([]);
  window.history.replaceState({},'','/projects?project=old&view=board&plans=saved&task=old#inspector');writeWorkspaceLocation('private');
  expect(window.location.search).toBe('?workspace=private&page=Projects');expect(window.location.hash).toBe('');expect(readWorkspacePreference('owner').recent).toEqual(['private','office']);
 });
 it('preserves failed creation drafts and retries with the same creation identity',async()=>{
  const create=vi.fn().mockRejectedValueOnce(new Error('Server refused')).mockResolvedValue(undefined);
  render(<EflowVibeThemeProvider preference="light"><WorkspaceCreateDialog kind="project" context="Private research" owner="Owner" onClose={vi.fn()} onCreate={create}/></EflowVibeThemeProvider>);
  fireEvent.change(screen.getByRole('textbox',{name:'Project name'}),{target:{value:'My project'}});fireEvent.click(screen.getByRole('button',{name:'Create project',exact:true}));
  await screen.findByRole('alert');expect((screen.getByRole('textbox',{name:'Project name'}) as HTMLInputElement).value).toBe('My project');
  fireEvent.click(screen.getByRole('button',{name:'Create project',exact:true}));await waitFor(()=>expect(create).toHaveBeenCalledTimes(2));expect(create.mock.calls[1][0]).toBe(create.mock.calls[0][0]);
 });
 it('never offers task execution or review to a Viewer, or self-review to the owner',()=>{
  const run=vi.fn();const view=render(<PersonalTaskList data={detail} userId="viewer" busy={false} run={run}/>);
  expect(screen.queryByRole('button',{name:/Record progress|Submit for review|Mark done|Approve personal work|Return for changes|Staff /})).toBeNull();
  expect(screen.getByRole('button',{name:'Files for '+detail.tasks[0].title})).toBeTruthy();view.rerender(<PersonalTaskList data={detail} userId="owner" busy={false} run={run}/>);
  expect(screen.queryByRole('button',{name:'Approve personal work'})).toBeNull();view.rerender(<PersonalTaskList data={detail} userId="reviewer" busy={false} run={run}/>);
  fireEvent.click(screen.getByRole('button',{name:'Approve personal work'}));expect(run).toHaveBeenCalledWith('review_task',{task_id:'task',revision:2,decision:'approve'});
 });
 it('only offers another active Member for independent review',()=>{
  render(<PersonalTaskCreate members={detail.members} userId="owner" busy={false} run={vi.fn()}/>);
  const select=screen.getByRole('combobox',{name:'Independent review'});expect([...select.querySelectorAll('option')].map(o=>o.value)).toEqual(['','reviewer']);
 });
});
