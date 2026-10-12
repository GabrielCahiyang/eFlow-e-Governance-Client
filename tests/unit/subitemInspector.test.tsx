// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {Task} from '../../src/app/features/tasks';
import type {Subtask} from '../../src/app/services/subtaskService';
import type {WorkNode,WorkTreeController,WorkTreeSnapshot} from '../../src/app/features/nested-work';
import {rememberWorkCapabilityContext} from '../../src/app/features/nested-work/selectors/capabilities';
import {installNavigationConfirmation} from '../../src/app/shared/navigationGuard';
const api=vi.hoisted(()=>({actor:'actor',read:vi.fn(),tree:vi.fn(),save:vi.fn(),legacyRead:vi.fn(),progress:vi.fn(),impact:vi.fn()}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:api.actor}})}));
vi.mock('../../src/app/features/nested-work/services/workTreeService',()=>({fetchWorkTree:api.tree,saveWorkTree:api.save,fetchWorkImpact:api.impact,fetchWorkEvents:vi.fn(),WorkTreeUnavailable:class extends Error{}}));
vi.mock('../../src/app/features/subtasks/services/subtaskWorkflowService',()=>({fetchSubitemInspectorRecord:api.read,fetchSubtask:api.legacyRead,fetchSubtaskProgressUpdates:vi.fn().mockResolvedValue([]),fetchSubtaskSubmissions:vi.fn().mockResolvedValue([]),saveSubtaskProgress:api.progress,submitSubtaskForReview:vi.fn()}));
vi.mock('../../src/app/features/subtasks/hooks/useSubtaskReviewerDirectory',()=>({useSubtaskReviewerDirectory:()=>({reviewersById:{},loading:false})}));
vi.mock('../../src/app/features/budget',()=>({WorkBudgetCard:()=> <div>Existing budget composition</div>}));
vi.mock('../../src/app/features/subtasks/components/SubtaskDeadlineEditor',()=>({SubtaskDeadlineEditor:()=>null}));
import {nestedWorkImpactFixture} from '../fixtures/nestedWorkImpact';
import {SubitemInspector} from '../../src/app/features/subtasks/components/SubitemInspector';
import {SubtaskWorkDrawer} from '../../src/app/features/subtasks/components/SubtaskWorkDrawer';
const task:Task={id:'root',title:'Root work',orgId:'office',linkedProjectId:'project',teamMemberIds:['root-lead'],teamMemberNames:['Root Lead'],status:'todo',createdAt:1,updatedAt:1};
const allow={allowed:true,reason_code:null} as const;
const node=(id:string,parent:string|null,depth:number):WorkNode=>({id,task_id:'root',parent_subtask_id:parent,lead_id:'deep-lead',title:`Level ${depth}`,assigned_to_ids:['deep-worker'],depth,sibling_order:0,due_date:'2026-12-15',is_standalone:true,status:'todo',percent_complete:43,can_manage:false,can_appoint:false,can_order:false,can_work:true,can_review:false,capabilities:{execute:allow,create_child:allow,order_children:allow}});
function tree(nodes=Array.from({length:8},(_,i)=>node(`n${i+1}`,i?`n${i}`:null,i+1))):WorkTreeSnapshot{
 const data:WorkTreeSnapshot={root:{id:'root',project:'project',office:'office',kind:'office',open:true,lead:'root-lead',people:['root-lead'],due:null},revision:7,can_manage:false,can_transfer:false,nodes,people:[{id:'deep-lead',name:'Deep appointed Lead'},{id:'deep-worker',name:'Deep contributor'}],leaf_total:1,leaf_completed:0};
 rememberWorkCapabilityContext(data,api.actor);return data;
}
function controller(data=tree()):WorkTreeController{return {rootId:'root',actorId:api.actor,data,loading:false,error:'',unavailable:false,authorityFresh:true,refreshPending:false,pending:false,reload:vi.fn(),save:api.save};}
function record(id:string,root='root'){return {subtask:{id,taskId:root,title:'Stale root-only title',assignedToIds:['root-lead'],status:'todo',percentComplete:0,isStandalone:true,isCompleted:false,position:0,source:'manual',createdAt:1,updatedAt:1} as Subtask,submissions:[],progressUpdates:[]};}
let uninstall:(()=>void)|undefined;
beforeEach(()=>{vi.clearAllMocks();api.actor='actor';api.read.mockImplementation(async(_root,id)=>record(id));api.tree.mockImplementation(async()=>tree());api.legacyRead.mockImplementation(async(id)=>record(id).subtask);sessionStorage.clear();});
afterEach(()=>{cleanup();uninstall?.();uninstall=undefined;});
describe('NW8.1 canonical Subitem Inspector',()=>{
 it('retains the actual opener through the loading-to-loaded panel transition',async()=>{
  const opener=document.createElement('button');opener.textContent='Actual opener';document.body.append(opener);opener.focus();
  const view=render(<SubitemInspector onClose={()=>{}} rootTask={task} itemId="n8" controller={controller()}/>);await screen.findByRole('heading',{name:'Level 8'});
  view.unmount();await waitFor(()=>expect(document.activeElement).toBe(opener));opener.remove();
 });
 it('uses deep-only names, the full permitted path and item date/progress rather than root arrays',async()=>{
  render(<SubitemInspector onClose={()=>{}} rootTask={task} itemId="n8" controller={controller()}/>);
  await screen.findByRole('heading',{name:'Level 8'});
  expect(screen.getByText('Deep appointed Lead')).toBeTruthy();expect(screen.getByText('Deep contributor')).toBeTruthy();
  expect(screen.getByRole('navigation',{name:'Subitem path'}).textContent).toBe('Root work / Level 1 / Level 2 / Level 3 / Level 4 / Level 5 / Level 6 / Level 7 / Level 8');
  expect(screen.getByRole('progressbar',{name:'43% complete'}).getAttribute('aria-valuenow')).toBe('43');expect(screen.getByText('Subitem due date').nextElementSibling?.textContent).toContain('Dec');
  expect(screen.queryByText('Root Lead')).toBeNull();expect(api.tree).not.toHaveBeenCalled();expect(api.read).toHaveBeenCalledWith('root','n8');
 });
 it('navigates from depth 8 to the actual parent by canonical ID',async()=>{
  render(<SubitemInspector onClose={()=>{}} rootTask={task} itemId="n8" controller={controller()}/>);await screen.findByRole('heading',{name:'Level 8'});
  fireEvent.click(within(screen.getByText('Parent').parentElement!).getByRole('button',{name:'Level 7'}));
  await screen.findByRole('heading',{name:'Level 7'});expect(api.read).toHaveBeenLastCalledWith('root','n7');
  expect(screen.getByRole('table',{name:'Subitem hierarchy'}).textContent).toContain('Level 8');
  expect(screen.queryByRole('button',{name:'Task work actions'})).toBeNull();
 });
 it('keeps duplicate titles distinct and renders only the selected branch children',async()=>{
  const nodes=[node('a',null,1),node('b',null,1),node('c','a',2)];nodes.forEach(n=>n.title='Same title');
  render(<SubitemInspector onClose={()=>{}} rootTask={task} itemId="a" controller={controller(tree(nodes))}/>);await screen.findByRole('heading',{name:'Same title'});
  const hierarchy=screen.getByRole('table',{name:'Subitem hierarchy'});expect(hierarchy.querySelectorAll('[data-work-open]')).toHaveLength(1);
  fireEvent.click(within(hierarchy).getByRole('button',{name:'Same title',exact:true}));await waitFor(()=>expect(api.read).toHaveBeenLastCalledWith('root','c'));
  expect(api.read.mock.calls.some(([,id])=>id==='b')).toBe(false);
 });
 it('ignores a late read after switching items and never shows a stale writable form',async()=>{
  let resolve!:(data:ReturnType<typeof record>)=>void;api.read.mockImplementationOnce(()=>new Promise(yes=>resolve=yes));const c=controller();
  const view=render(<SubitemInspector onClose={()=>{}} rootTask={task} itemId="n7" controller={c}/>);expect(screen.queryByRole('button',{name:'Save update'})).toBeNull();
  view.rerender(<SubitemInspector onClose={()=>{}} rootTask={task} itemId="n8" controller={c}/>);await screen.findByRole('heading',{name:'Level 8'});
  await act(async()=>resolve(record('n7')));expect(screen.queryByRole('heading',{name:'Level 7'})).toBeNull();expect(api.read).toHaveBeenLastCalledWith('root','n8');
 });
 it('ignores results after an actor or root scope switch',async()=>{
  let resolve!:(data:ReturnType<typeof record>)=>void;api.read.mockImplementationOnce(()=>new Promise(yes=>resolve=yes));
  const c=controller(),view=render(<SubitemInspector onClose={()=>{}} rootTask={task} itemId="n8" controller={c}/>);
  api.actor='other';view.rerender(<SubitemInspector onClose={()=>{}} rootTask={task} itemId="n8" controller={c}/>);
  await act(async()=>resolve(record('n8')));expect(screen.queryByRole('heading',{name:'Level 8'})).toBeNull();expect(screen.queryByRole('button',{name:'Save update'})).toBeNull();
  view.rerender(<SubitemInspector onClose={()=>{}} rootTask={{...task,id:'other-root'}} itemId="n8" controller={c}/>);expect(screen.queryByRole('heading',{name:'Level 8'})).toBeNull();
 });
 it('shows missing parent context without reading the protected parent or inventing an edge',async()=>{
  const missing=node('leaf','protected-parent',8);render(<SubitemInspector onClose={()=>{}} rootTask={task} itemId="leaf" controller={controller(tree([missing]))}/>);
  await screen.findByRole('heading',{name:'Level 8'});expect(screen.getByText('Parent unavailable')).toBeTruthy();
  expect(screen.getByRole('navigation',{name:'Subitem path'}).textContent).toContain('Parent context unavailable');
  expect(api.read.mock.calls).toEqual([['root','leaf']]);expect(screen.queryByRole('button',{name:'protected-parent'})).toBeNull();
 });
 it('shows explicit denied read errors and retries without mounting workflow controls',async()=>{
  api.read.mockRejectedValueOnce(new Error('Evidence history denied'));const c=controller();render(<SubitemInspector onClose={()=>{}} rootTask={task} itemId="n8" controller={c}/>);
  await screen.findByRole('alert');expect(screen.getByRole('alert').textContent).toContain('Evidence history denied');expect(screen.queryByRole('button',{name:'Save update'})).toBeNull();expect(screen.queryByText('Existing budget composition')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Retry subitem'}));await screen.findByRole('heading',{name:'Level 8'});expect(c.reload).toHaveBeenCalledOnce();
 });
 it('rejects a supplied tree from a different project/Office and a removed item',async()=>{
  const c=controller();const view=render(<SubitemInspector onClose={()=>{}} rootTask={{...task,orgId:'other-office'}} itemId="n8" controller={c}/>);await screen.findByRole('alert');expect(screen.queryByRole('heading',{name:'Level 8'})).toBeNull();
  view.rerender(<SubitemInspector onClose={()=>{}} rootTask={task} itemId="removed" controller={c}/>);await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('unavailable'));expect(api.read).not.toHaveBeenCalledWith('root','removed');
 });
 it('guards parent navigation and close while preserving failed progress drafts',async()=>{
  const close=vi.fn(),confirm=vi.fn().mockResolvedValue(false);uninstall=installNavigationConfirmation(confirm);api.progress.mockRejectedValue(new Error('Write denied'));
  render(<SubitemInspector onClose={close} rootTask={task} itemId="n8" controller={controller()}/>);await screen.findByRole('heading',{name:'Level 8'});
  fireEvent.change(screen.getByLabelText('Progress note (optional)'),{target:{value:'Keep this note'}});fireEvent.click(screen.getByRole('button',{name:'Save update'}));await screen.findByRole('alert');
  fireEvent.click(within(screen.getByText('Parent').parentElement!).getByRole('button'));await waitFor(()=>expect(confirm).toHaveBeenCalled());expect(api.read).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button',{name:'Close subtask detail'}));await waitFor(()=>expect(confirm).toHaveBeenCalledTimes(2));expect(close).not.toHaveBeenCalled();expect((screen.getByLabelText('Progress note (optional)') as HTMLTextAreaElement).value).toBe('Keep this note');
 });
 it('keeps the progress draft mounted but disabled during an authority refresh',async()=>{
  const c=controller(),view=render(<SubitemInspector onClose={()=>{}} rootTask={task} itemId="n8" controller={c}/>);await screen.findByRole('heading',{name:'Level 8'});fireEvent.change(screen.getByLabelText('Progress note (optional)'),{target:{value:'Retained'}});
  view.rerender(<SubitemInspector onClose={()=>{}} rootTask={task} itemId="n8" controller={{...c,refreshPending:true}}/>);expect(screen.getByLabelText('Progress note (optional)').matches(':disabled')).toBe(true);
  view.rerender(<SubitemInspector onClose={()=>{}} rootTask={task} itemId="n8" controller={c}/>);expect((screen.getByLabelText('Progress note (optional)') as HTMLTextAreaElement).value).toBe('Retained');
 });
 it('shares the real child editor and sends complete sibling IDs from the full tree',async()=>{
  const c=controller(tree([node('a',null,1),node('b','a',2),{...node('c','a',2),sibling_order:1},node('outside',null,1)]));render(<SubitemInspector onClose={()=>{}} rootTask={task} itemId="a" controller={c}/>);await screen.findByRole('heading',{name:'Level 1'});
  fireEvent.keyDown(screen.getByRole('button',{name:'Child work actions'}),{key:'Enter'});fireEvent.click(await screen.findByRole('menuitem',{name:'Reorder children'}));
  const order=await screen.findByRole('list',{name:'Subitem sequence'});expect(within(order).getAllByRole('listitem')).toHaveLength(2);expect(order.textContent).not.toContain('Level 1');
  api.save.mockResolvedValue(c.data);api.impact.mockImplementation(async(_root,request)=>nestedWorkImpactFixture(c.data!,request));fireEvent.click(within(order).getAllByRole('button',{name:'Move down Level 2'})[0]);fireEvent.click(screen.getByRole('button',{name:'Save work changes'}));fireEvent.click(await screen.findByRole('button',{name:'Confirm changes'}));await waitFor(()=>expect(api.save).toHaveBeenCalledOnce());expect(api.save.mock.calls[0][0]).toMatchObject({command:'order',payload:{parent:'a',order:['c','b']},revision:7});
 });
 it('routes supported facade opens to the canonical Inspector and keeps excluded work legacy',async()=>{
  const view=render(<SubtaskWorkDrawer parentTask={task} subtask={record('n8').subtask} controller={controller()} onClose={()=>{}}/>);await screen.findByRole('heading',{name:'Level 8'});expect(api.legacyRead).not.toHaveBeenCalled();
  view.rerender(<SubtaskWorkDrawer parentTask={{...task,sourceCollaborationDraftId:'governed'}} subtask={record('legacy').subtask} onClose={()=>{}}/>);await screen.findByRole('heading',{name:'Stale root-only title'});expect(api.legacyRead).toHaveBeenCalledWith('legacy');expect(api.read).toHaveBeenCalledOnce();
 });
});
