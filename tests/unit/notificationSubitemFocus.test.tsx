// @vitest-environment jsdom
import {useState} from 'react';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {Task} from '../../src/app/services/taskService';
import {useExplicitDraft} from '../../src/app/shared/useExplicitDraft';
import {installNavigationConfirmation} from '../../src/app/shared/navigationGuard';
const api=vi.hoisted(()=>({actor:'me',tasks:[] as Task[],read:vi.fn(),record:vi.fn(),drawer:vi.fn(),remove:vi.fn(),update:undefined as undefined|(()=>void)}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:api.actor},userProfile:{id:api.actor,role:'member'}})}));
vi.mock('../../src/app/hooks/useSupabaseData',()=>({useTasksData:()=>({tasks:api.tasks,loading:false})}));
vi.mock('../../src/app/hooks/useFirebaseData',()=>({useTasks:()=>({tasks:api.tasks,loading:false})}));
vi.mock('../../src/lib/supabase',()=>({supabase:{from:()=>{const query={select:()=>query,order:()=>query,then:(yes:(value:unknown)=>unknown,no:(error:unknown)=>unknown)=>Promise.resolve(api.read()).then(yes,no)};return query;},channel:()=>{const channel={on:(_kind:unknown,_filter:unknown,update:()=>void)=>{api.update=update;return channel;},subscribe:()=>channel};return channel;},removeChannel:api.remove}}));
vi.mock('../../src/app/features/subtasks/hooks/useSubtaskReviewerDirectory',()=>({useSubtaskReviewerDirectory:()=>({reviewersById:{},loading:false})}));
vi.mock('../../src/app/features/task-inspector',()=>({TaskDetailDrawer:()=>null}));
vi.mock('../../src/app/features/subtasks',()=>({TaskSubtasksWidget:()=>null,fetchSubitemInspectorRecord:api.record,SubtaskWorkDrawer:(props:any)=>{
 const [draft,setDraft]=useState('');useExplicitDraft('Fixture Work draft',!!draft,false,()=>setDraft(''),props.subtask?.id);api.drawer(props);
 return props.subtask?<aside aria-label="Canonical Inspector fixture"><p>Selected ID: {props.subtask.id}</p><input aria-label="Fixture Work draft" disabled={props.readOnly} value={draft} onChange={event=>setDraft(event.target.value)}/><button onClick={props.onClose}>Close fixture</button></aside>:null;
}}));
import {SubtasksWorkspace} from '../../src/app/components/workflow/SubtasksWorkspace';
import {LeadingNotificationTarget} from '../../src/app/features/personal-work/components/LeadingNotificationTarget';
import {queueNotificationNavigationIntent} from '../../src/app/features/notifications';
import {completeNotificationNavigationIntent,peekNotificationNavigationIntent} from '../../src/app/features/notifications/navigationIntent';
const task:Task={id:'root',title:'Root',status:'todo',assigneeId:'me',memberIds:['me'],memberNames:['Me'],linkedProjectId:'project',orgId:'office',createdAt:1,updatedAt:1};
const rows=()=>Array.from({length:8},(_,index)=>({id:index===7?'eight':`parent-${index+1}`,task_id:'root',title:'Same',parent_subtask_id:index?`parent-${index}`:null,lead_id:index===7?'me':'other',assigned_to_ids:[],status:'todo',position:index,sibling_order:0,percent_complete:20,created_at:'2026-10-12T00:00:00Z',updated_at:'2026-10-12T00:00:00Z'}));
const pointer={notificationId:'notification',kind:'subtask' as const,taskId:'root',entityId:'eight',entityLabel:'Old title',inspectorSection:'work' as const};
let uninstall:(()=>void)|undefined;
beforeEach(()=>{vi.clearAllMocks();api.actor='me';api.tasks=[task];api.read.mockResolvedValue({data:rows(),error:null});api.record.mockImplementation(async(rootId:string,id:string)=>{if(!['eight','sibling','new-node'].includes(id))throw new Error('Subitem unavailable.');return {subtask:{id,taskId:rootId,title:'Same',assignedToIds:[],leadId:'me',status:'todo',percentComplete:20,createdAt:1,updatedAt:1},submissions:[],progressUpdates:[]};});const pending=peekNotificationNavigationIntent();if(pending)completeNotificationNavigationIntent(pending.notificationId);sessionStorage.clear();});
afterEach(()=>{cleanup();uninstall?.();uninstall=undefined;const pending=peekNotificationNavigationIntent();if(pending)completeNotificationNavigationIntent(pending.notificationId);sessionStorage.clear();});
describe('NW9.5 canonical notification entrances',()=>{
 it('opens an appointed Lead-only depth-eight item by ID despite a stale label and forwards the Work origin/section',async()=>{
  queueNotificationNavigationIntent(pointer,'me');render(<SubtasksWorkspace/>);
  // The first Vibe-backed mount can exceed Testing Library's one-second default
  // while the complete suite transforms other feature modules concurrently.
  await screen.findByText('Selected ID: eight',{}, {timeout:5000});
  expect(api.drawer.mock.calls.at(-1)?.[0]).toMatchObject({subtask:{id:'eight',taskId:'root',leadId:'me'},parentTask:{id:'root'},initialSection:'work',origin:{view:'Subtasks',section:'work'},readOnly:false});
  await waitFor(()=>expect(peekNotificationNavigationIntent('me')).toBeNull());expect(sessionStorage.getItem('eflow.notification-intent.v1:me')).toBeNull();expect(api.record).not.toHaveBeenCalled();
 });
 it.each(['ambiguous','missing'] as const)('explains %s targets without opening a same-title sibling or falling back to its root',async mode=>{
  api.read.mockResolvedValue({data:[...rows(),{...rows()[7],id:'sibling',assigned_to_ids:['me']}],error:null});
  queueNotificationNavigationIntent({...pointer,entityId:mode==='missing'?'deleted':undefined,entityLabel:'Same'},'me');render(<SubtasksWorkspace/>);await screen.findByRole('alert');
  expect(screen.queryByRole('complementary',{name:'Canonical Inspector fixture'})).toBeNull();if(mode==='missing')expect(api.record).toHaveBeenCalledWith('root','deleted');else expect(api.record).not.toHaveBeenCalled();await waitFor(()=>expect(peekNotificationNavigationIntent('me')).toBeNull());
 });
 it('does not use stale rows after an authorized source denial',async()=>{
  api.read.mockResolvedValue({data:null,error:{message:'Subitem access denied'}});queueNotificationNavigationIntent(pointer,'me');render(<SubtasksWorkspace/>);await screen.findByText('Subitem access denied');expect(screen.queryByText('Selected ID: eight')).toBeNull();expect(api.record).not.toHaveBeenCalled();await waitFor(()=>expect(peekNotificationNavigationIntent('me')).toBeNull());
 });
 it('resolves an authorized canonical item beyond capped discovery and revalidates its current assignment on refresh',async()=>{
  api.read.mockResolvedValue({data:rows().slice(0,7),error:null});queueNotificationNavigationIntent(pointer,'me');render(<SubtasksWorkspace/>);await screen.findByText('Selected ID: eight');expect(api.record).toHaveBeenCalledWith('root','eight');expect((screen.getByLabelText('Fixture Work draft') as HTMLInputElement).disabled).toBe(false);
  fireEvent.change(screen.getByLabelText('Fixture Work draft'),{target:{value:'Keep exact target draft'}});api.record.mockResolvedValue({subtask:{id:'eight',taskId:'root',title:'Same',leadId:'other',assignedToIds:[],status:'todo'},submissions:[],progressUpdates:[]});await act(async()=>api.update!());expect(screen.getByDisplayValue('Keep exact target draft')).toBeTruthy();expect((screen.getByLabelText('Fixture Work draft') as HTMLInputElement).disabled).toBe(true);
 });
 it('does not treat a readable but no-longer-assigned exact record as current assigned work',async()=>{
  api.read.mockResolvedValue({data:[],error:null});api.record.mockResolvedValue({subtask:{id:'eight',taskId:'root',title:'Same',leadId:'other',assignedToIds:[],status:'todo'},submissions:[],progressUpdates:[]});queueNotificationNavigationIntent(pointer,'me');render(<SubtasksWorkspace/>);await screen.findByRole('alert');expect(screen.queryByText('Selected ID: eight')).toBeNull();expect(api.record).toHaveBeenCalledWith('root','eight');
 });
 it('ignores a late old-account read and keeps that account unfinished pointer private',async()=>{
  let finish!:(value:unknown)=>void;api.read.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));queueNotificationNavigationIntent(pointer,'me');const view=render(<SubtasksWorkspace/>);await waitFor(()=>expect(api.read).toHaveBeenCalledOnce());
  api.actor='other';api.read.mockResolvedValue({data:[],error:null});view.rerender(<SubtasksWorkspace/>);await act(async()=>finish({data:rows(),error:null}));
  expect(screen.queryByText('Selected ID: eight')).toBeNull();expect(screen.queryByRole('button',{name:/Same/})).toBeNull();expect(peekNotificationNavigationIntent('other')).toBeNull();expect(sessionStorage.getItem('eflow.notification-intent.v1:me')).not.toBeNull();
 });
 it('keeps an open Work draft mounted through queue refresh and marks it read-only after revocation',async()=>{
  queueNotificationNavigationIntent(pointer,'me');render(<SubtasksWorkspace/>);fireEvent.change(await screen.findByLabelText('Fixture Work draft'),{target:{value:'Keep Work draft'}});
  api.read.mockResolvedValue({data:[],error:null});await act(async()=>api.update!());expect(screen.getByDisplayValue('Keep Work draft')).toBeTruthy();expect((screen.getByLabelText('Fixture Work draft') as HTMLInputElement).disabled).toBe(true);
 });
 it('keeps declined notification navigation unfinished without discarding the current dirty Work draft',async()=>{
  const confirm=vi.fn().mockResolvedValue(false);uninstall=installNavigationConfirmation(confirm);queueNotificationNavigationIntent(pointer,'me');render(<SubtasksWorkspace/>);fireEvent.change(await screen.findByLabelText('Fixture Work draft'),{target:{value:'Unsaved Work'}});
  api.read.mockResolvedValue({data:[...rows(),{...rows()[7],id:'sibling'}],error:null});await act(async()=>api.update!());act(()=>queueNotificationNavigationIntent({...pointer,notificationId:'next',entityId:'sibling'},'me'));await waitFor(()=>expect(confirm).toHaveBeenCalled());
  expect(screen.getByText('Selected ID: eight')).toBeTruthy();expect(screen.getByDisplayValue('Unsaved Work')).toBeTruthy();expect(peekNotificationNavigationIntent('me')?.entityId).toBe('sibling');
 });
 it('opens a progress notification from My Work Leading without changing root-list eligibility',async()=>{
  queueNotificationNavigationIntent({...pointer,kind:'leading_task'},'me');render(<LeadingNotificationTarget rows={[{kind:'office-task',id:'root',task} as any]} loading={false} onOpen={vi.fn()}/>);await screen.findByText('Selected ID: eight');expect(api.record).toHaveBeenCalledWith('root','eight');expect(api.drawer.mock.calls.at(-1)?.[0]).toMatchObject({subtask:{id:'eight'},initialSection:'work',origin:{view:'My Work',section:'work'}});await waitFor(()=>expect(peekNotificationNavigationIntent('me')).toBeNull());
 });
 it('opens an older parent-only progress notification through the current task page callback',async()=>{
  const open=vi.fn().mockResolvedValue(true);queueNotificationNavigationIntent({...pointer,kind:'leading_task',entityId:undefined},'me');
  render(<LeadingNotificationTarget rows={[{kind:'office-task',id:'root',task,leading:true,history:false} as any]} loading={false} onOpen={open}/>);
  await waitFor(()=>expect(open).toHaveBeenCalledWith(expect.objectContaining({id:'root'}),expect.any(HTMLElement),expect.any(Function)));
  await waitFor(()=>expect(peekNotificationNavigationIntent('me')).toBeNull());expect(api.record).not.toHaveBeenCalled();
 });
 it('does not let a late progress lookup replace a newer canonical intent with the same notification ID',async()=>{
  let finish!:(value:unknown)=>void;api.record.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));queueNotificationNavigationIntent({...pointer,kind:'leading_task'},'me');render(<LeadingNotificationTarget rows={[{kind:'office-task',id:'root',task} as any]} loading={false} onOpen={vi.fn()}/>);await waitFor(()=>expect(api.record).toHaveBeenCalledWith('root','eight'));
  act(()=>queueNotificationNavigationIntent({...pointer,kind:'leading_task',entityId:'new-node'},'me'));await screen.findByText('Selected ID: new-node');await act(async()=>finish({subtask:{id:'eight',taskId:'root',title:'Late old node'},submissions:[],progressUpdates:[]}));expect(screen.queryByText('Selected ID: eight')).toBeNull();
 });
});
