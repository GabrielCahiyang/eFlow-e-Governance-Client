// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {Task} from '../../src/app/features/tasks';
import type {WorkTreeSnapshot} from '../../src/app/features/nested-work';
const api=vi.hoisted(()=>({actor:'lead',load:vi.fn(),save:vi.fn(),legacyRead:vi.fn(),create:vi.fn(),update:vi.fn(),delete:vi.fn(),order:vi.fn(),open:vi.fn(),legacyOpen:vi.fn()}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:api.actor},userProfile:{id:api.actor,full_name:'Lead',role:'member'}})}));
vi.mock('../../src/app/features/nested-work/services/workTreeService',()=>({fetchWorkTree:api.load,saveWorkTree:api.save,fetchWorkImpact:vi.fn(),fetchWorkEvents:vi.fn(),WorkTreeUnavailable:class extends Error{}}));
vi.mock('../../src/app/services/subtaskService',()=>({getCachedSubtasks:()=>[],subscribeToSubtasks:api.legacyRead,createSubtask:api.create,updateSubtask:api.update,deleteSubtask:api.delete,reorderSubtasks:api.order}));
vi.mock('../../src/app/components/ui/Toast',()=>({useToast:()=>({toast:vi.fn()})}));
vi.mock('../../src/app/services/taskService',()=>({startTaskIfTodo:vi.fn()}));
vi.mock('../../src/app/features/subtasks/components/SubitemInspector',()=>({SubitemInspector:(props:any)=>{api.open(props);return <div role="dialog" aria-label="Canonical item inspector">{props.itemId}<button onClick={props.onClose}>Close canonical item</button></div>;}}));
vi.mock('../../src/app/features/subtasks/components/LegacySubtaskWorkDrawer',()=>({LegacySubtaskWorkDrawer:(props:any)=>{api.legacyOpen(props);return props.subtask?<div role="dialog" aria-label="Legacy item detail">{props.subtask.id}</div>:null;}}));
vi.mock('../../src/app/features/tasks/components/board/TaskBoardDialog',()=>({TaskBoardDialog:({children,footer}:any)=><section aria-label="Board editor">{children}{footer}</section>}));
vi.mock('../../src/app/features/tasks/components/board/TaskChatSection',()=>({TaskChatSection:()=>null}));
vi.mock('../../src/app/features/tasks/components/TaskDepartmentLabel',()=>({TaskDepartmentLabel:()=>null}));
import {TaskSubtasksWidget} from '../../src/app/features/subtasks/components/TaskSubtasksWidget';
import {SubtaskWorkDrawer} from '../../src/app/features/subtasks/components/SubtaskWorkDrawer';
import {SubitemRows} from '../../src/app/features/project-table/components/SubitemRows';
import {TaskEditorModal} from '../../src/app/features/tasks/components/board/TaskEditorModal';
import {buildTaskEditorDraft} from '../../src/app/features/tasks/components/board/model';
import {rememberWorkCapabilityContext} from '../../src/app/features/nested-work/selectors/capabilities';
import {WorkTreeUnavailable} from '../../src/app/features/nested-work/services/workTreeService';
const task={id:'root',title:'Office task',status:'todo',orgId:'office',linkedProjectId:'project',assigneeId:'lead',teamMemberIds:['lead'],percentComplete:0,deadline:'2026-10-21'} as Task;
const allow={allowed:true,reason_code:null} as const;
function tree():WorkTreeSnapshot{
 const snapshot:WorkTreeSnapshot={root:{id:'root',project:'project',office:'office',kind:'office',open:true,lead:'lead',people:['lead'],due:'2026-10-21',capabilities:{create_child:allow,manage_contributors:allow,appoint_lead:allow,order_children:allow}},revision:7,can_manage:true,can_transfer:true,leaf_total:1,leaf_completed:0,people:[{id:'lead',name:'Recorded Lead',eligible:true}],nodes:Array.from({length:8},(_,i)=>({id:'node-'+i,task_id:'root',title:'Level '+(i+1),parent_subtask_id:i?'node-'+(i-1):null,lead_id:'lead',assigned_to_ids:['lead'],sibling_order:0,depth:i+1,due_date:null,is_standalone:true,status:'todo',percent_complete:0,can_manage:true,can_appoint:true,can_order:true,can_work:true,can_review:false,capabilities:{edit_details:allow,manage_contributors:allow,appoint_lead:allow,create_child:allow,order_children:allow,execute:allow,submit:allow}}))};
 rememberWorkCapabilityContext(snapshot,api.actor);return snapshot;
}
beforeEach(()=>{vi.clearAllMocks();api.actor='lead';api.load.mockImplementation(async()=>tree());api.legacyRead.mockImplementation((_id,callback)=>{callback([]);return()=>{};});});afterEach(cleanup);
describe('NW9.7 proven compatibility entrances',()=>{
 it('routes the actual board editor through canonical depth-eight work and item IDs',async()=>{
  render(<TaskEditorModal open task={task} draft={buildTaskEditorDraft(task)} onChange={vi.fn()} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} onCancelTask={vi.fn()} onOpenTeamEditor={vi.fn()} saving={false} error="" employees={[]} availableTasks={[]} employeeById={{}}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Level 8',exact:true}));expect(screen.getByRole('dialog',{name:'Canonical item inspector'}).textContent).toContain('node-7');expect(api.open).toHaveBeenLastCalledWith(expect.objectContaining({rootTask:task,itemId:'node-7',initialSection:'work',readOnly:false}));
  expect(api.legacyRead).not.toHaveBeenCalled();expect(api.create).not.toHaveBeenCalled();
 });
 it('passes the editor saving lock through to canonical controls',async()=>{
  const props={open:true,task,draft:buildTaskEditorDraft(task),onChange:vi.fn(),onClose:vi.fn(),onSave:vi.fn(),onDelete:vi.fn(),onCancelTask:vi.fn(),onOpenTeamEditor:vi.fn(),saving:false,error:'',employees:[],availableTasks:[],employeeById:{}};
  const view=render(<TaskEditorModal {...props}/>);await screen.findByRole('button',{name:'Task work actions'});view.rerender(<TaskEditorModal {...props} saving/>);expect(screen.queryByRole('button',{name:'Task work actions'})).toBeNull();expect(api.save).not.toHaveBeenCalled();
 });
 it('shares one board controller across hierarchy and canonical detail',async()=>{
  render(<TaskEditorModal open task={task} draft={buildTaskEditorDraft(task)} onChange={vi.fn()} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} onCancelTask={vi.fn()} onOpenTeamEditor={vi.fn()} saving={false} error="" employees={[]} availableTasks={[]} employeeById={{}}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Level 8',exact:true}));expect(api.load).toHaveBeenCalledOnce();expect(api.open).toHaveBeenLastCalledWith(expect.objectContaining({controller:expect.objectContaining({rootId:'root',actorId:'lead',authorityFresh:true})}));
 });
 it('uses canonical project root people instead of the old metadata team picker',async()=>{
  const onOpenTeamEditor=vi.fn();render(<TaskEditorModal open task={task} draft={buildTaskEditorDraft(task)} onChange={vi.fn()} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} onCancelTask={vi.fn()} onOpenTeamEditor={onOpenTeamEditor} saving={false} error="" employees={[]} availableTasks={[]} employeeById={{}}/>);
  await screen.findByRole('button',{name:'Choose task lead and contributors'});expect(screen.queryByRole('button',{name:'Edit Team'})).toBeNull();expect(onOpenTeamEditor).not.toHaveBeenCalled();expect(api.load).toHaveBeenCalledOnce();
 });
 it('hands the metadata save a checked missing scope only after the current root read proves it',async()=>{
  api.load.mockRejectedValue(new WorkTreeUnavailable('Missing'));const onSave=vi.fn();render(<TaskEditorModal open task={task} draft={buildTaskEditorDraft(task)} onChange={vi.fn()} onClose={vi.fn()} onSave={onSave} onDelete={vi.fn()} onCancelTask={vi.fn()} onOpenTeamEditor={vi.fn()} saving={false} error="" employees={[]} availableTasks={[]} employeeById={{}}/>);
  await screen.findByRole('button',{name:'Edit Team'});fireEvent.click(screen.getByRole('button',{name:'Save changes',exact:true}));expect(onSave).toHaveBeenCalledExactlyOnceWith({rootId:'root',actorId:'lead',code:'PGRST202'});
 });
 it('hands a proven missing installation to the legacy detail while preserving prerequisite/readOnly/deadline callbacks',async()=>{
  api.load.mockRejectedValue(new WorkTreeUnavailable('Missing'));const prerequisite={id:'prior',taskId:'root'} as any,onClose=vi.fn();
  render(<SubtaskWorkDrawer parentTask={task} subtask={{id:'flat',taskId:'root'} as any} prerequisite={prerequisite} readOnly canManageDeadline onClose={onClose}/>);
  await screen.findByRole('dialog',{name:'Legacy item detail'});expect(api.legacyOpen).toHaveBeenLastCalledWith(expect.objectContaining({subtask:expect.objectContaining({id:'flat'}),prerequisite,readOnly:true,canManageDeadline:true,onClose}));expect(screen.queryByRole('dialog',{name:'Canonical item inspector'})).toBeNull();
 });
 it('keeps standalone detail denial in the canonical error owner and rejects stale supplied missing flags',async()=>{
  api.load.mockRejectedValue(Object.assign(new Error('Current access expired'),{code:'42501'}));const props={parentTask:task,subtask:{id:'flat',taskId:'root'} as any,onClose:vi.fn()},view=render(<SubtaskWorkDrawer {...props}/>);
  await waitFor(()=>expect(api.open).toHaveBeenLastCalledWith(expect.objectContaining({controller:expect.objectContaining({error:'Current access expired',unavailable:false})})));expect(screen.queryByRole('dialog',{name:'Legacy item detail'})).toBeNull();
  view.rerender(<SubtaskWorkDrawer {...props} controller={{rootId:'root',actorId:'other',data:undefined,loading:false,error:'',unavailable:true,authorityFresh:false,refreshPending:false,pending:false,reload:vi.fn(),save:api.save}}/>);expect(screen.queryByRole('dialog',{name:'Legacy item detail'})).toBeNull();
 });
 it.each([{linkedProjectId:undefined},{proposedOfficeIdentityId:'proposed'},{sourceCollaborationDraftId:'governed'}])('keeps excluded work on its original flat path: %j',async patch=>{
  render(<TaskSubtasksWidget taskId="root" parentTask={{...task,...patch}} canManage/>);await waitFor(()=>expect(api.legacyRead).toHaveBeenCalled());expect(api.load).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:'Task work actions'})).toBeNull();
 });
 it.each(['42501','PGRST301','23514','NETWORK'])('does not mount legacy mutations on current read failure %s',async code=>{
  api.load.mockRejectedValue(Object.assign(new Error('Current read failed: '+code),{code}));render(<TaskSubtasksWidget taskId="root" parentTask={task} canManage/>);await screen.findByRole('alert');expect(api.legacyRead).not.toHaveBeenCalled();expect(screen.queryByPlaceholderText('Add a subtask for team members…')).toBeNull();expect(api.create).not.toHaveBeenCalled();
 });
 it('allows only proven missing installation to mount the old checklist, with readOnly retained',async()=>{
  api.load.mockRejectedValue(new WorkTreeUnavailable('Missing'));render(<TaskSubtasksWidget taskId="root" parentTask={task} canManage readOnly/>);await waitFor(()=>expect(api.legacyRead).toHaveBeenCalled());expect(screen.queryByPlaceholderText('Add a subtask for team members…')).toBeNull();expect(api.create).not.toHaveBeenCalled();
 });
 it('rejects supplied actor/root mismatch before rendering a legacy fallback',()=>{
  const controller={rootId:'root',actorId:'other-actor',data:tree(),loading:false,error:'',unavailable:false,authorityFresh:true,refreshPending:false,pending:false,reload:vi.fn(),save:api.save};
  render(<TaskSubtasksWidget taskId="root" parentTask={task} controller={controller} canManage/>);expect(screen.getByRole('alert').textContent).toContain('current actor or task scope');expect(api.legacyRead).not.toHaveBeenCalled();expect(api.load).not.toHaveBeenCalled();
 });
 it('keeps excluded Main Table readOnly and callbacks without enabling inline writes',()=>{
  const onOpen=vi.fn(),onOpenTask=vi.fn();render(<table><tbody><SubitemRows task={{...task,sourceCollaborationDraftId:'governed'}} subtasks={[{id:'flat',taskId:'root',title:'Legacy child',status:'todo',assignedToIds:[],position:0,percentComplete:0} as any]} columns={5} profiles={[]} canAdd readOnly unavailableReason="Locked" onOpen={onOpen} onOpenTask={onOpenTask} refresh={vi.fn()}/></tbody></table>);
  fireEvent.click(screen.getByRole('button',{name:'Open subitem Legacy child'}));expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({id:'flat',taskId:'root'}),true);fireEvent.click(screen.getByRole('button',{name:'Task details'}));expect(onOpenTask).toHaveBeenCalledOnce();expect(screen.queryByRole('textbox')).toBeNull();expect(api.create).not.toHaveBeenCalled();expect(api.update).not.toHaveBeenCalled();
 });
});
