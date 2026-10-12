// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {Task} from '../../src/app/features/tasks';
import type {WorkNode,WorkTreeController,WorkTreeSnapshot} from '../../src/app/features/nested-work';
import type {SubtaskReviewItem} from '../../src/app/features/subtasks';
import type {WorkRow} from '../../src/app/features/personal-work/types';
import {rememberWorkCapabilityContext} from '../../src/app/features/nested-work/selectors/capabilities';
import {installNavigationConfirmation} from '../../src/app/shared/navigationGuard';
const api=vi.hoisted(()=>({actor:'worker',tree:undefined as WorkTreeSnapshot|undefined,read:vi.fn(),root:vi.fn(),legacy:vi.fn(),save:vi.fn(),events:vi.fn(),subscribe:vi.fn(),progress:vi.fn()}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:api.actor},userProfile:{id:api.actor,full_name:'Current worker',role:'member',org_id:'office',is_active:true}})}));
vi.mock('../../src/app/components/ui/Toast',()=>({useToast:()=>({toast:vi.fn()})}));
vi.mock('../../src/app/features/subtasks/services/subtaskWorkflowService',()=>({fetchSubitemInspectorRecord:api.read,fetchSubtask:api.legacy,saveSubtaskProgress:api.progress,submitSubtaskForReview:vi.fn(),getSubtaskEvidenceUrl:vi.fn(),subscribeToPendingSubtaskReviews:api.subscribe,decideSubtaskReview:vi.fn()}));
vi.mock('../../src/app/features/subtasks/hooks/useSubtaskReviewerDirectory',()=>({useSubtaskReviewerDirectory:()=>({reviewersById:{worker:{id:'worker',name:'Current worker',role:'member'}},loading:false})}));
vi.mock('../../src/app/features/nested-work/services/workTreeService',()=>({fetchWorkTree:async()=>api.tree,fetchWorkEvents:api.events,saveWorkTree:api.save,fetchWorkImpact:vi.fn(),WorkTreeUnavailable:class extends Error{}}));
vi.mock('../../src/app/features/tasks/services/taskRealtimeService',()=>({fetchTaskById:api.root,seedTasksIfEmpty:vi.fn(),subscribeToTasks:vi.fn(),notifyTaskListeners:vi.fn()}));
vi.mock('../../src/app/features/budget/hooks/useDepartmentBudget',()=>({useDepartmentBudget:()=>({summary:{status:'locked'},allocations:[],allocationLines:[],requests:[],requestAttachments:[],releases:[],liquidations:[],loading:false,refresh:vi.fn()})}));
vi.mock('../../src/app/features/budget/hooks/useTaskFundingContext',()=>({useTaskFundingContext:()=>({context:{funded:true,taskId:'root',taskLeaderId:'root-lead',available:100,lines:[]},loading:false,refresh:vi.fn()})}));
vi.mock('../../src/app/features/subtasks/components/SubtaskDeadlineEditor',()=>({SubtaskDeadlineEditor:()=>null}));
import {TaskSubtasksWidget,SubitemInspector} from '../../src/app/features/subtasks';
import {WorkInspector} from '../../src/app/features/personal-work/components/WorkInspector';
import {SubtaskReviewInbox} from '../../src/app/features/reviews';
import {ReviewSubitemInspector} from '../../src/app/features/reviews/components/ReviewSubitemInspector';
const allow={allowed:true,reason_code:null} as const,deny={allowed:false,reason_code:'branch_denied'} as const;
const task:Task={id:'root',title:'Root',linkedProjectId:'project',orgId:'office',assigneeId:'root-lead',status:'todo',createdAt:1,updatedAt:1};
function node(id:string,parent:string|null,title=id):WorkNode{return {id,task_id:'root',title,parent_subtask_id:parent,lead_id:'other-lead',assigned_to_ids:['worker'],depth:parent?2:1,sibling_order:0,due_date:null,is_standalone:true,status:'todo',percent_complete:20,can_work:false,can_review:false,can_manage:false,can_appoint:false,can_order:false,capabilities:{execute:allow,submit:allow,review:deny}};}
function tree():WorkTreeSnapshot{const data:WorkTreeSnapshot={root:{id:'root',project:'project',office:'office',kind:'office',lead:'root-lead',people:['root-lead'],open:true,due:null},revision:7,people:[{id:'worker',name:'Current worker',eligible:true}],nodes:[node('parent',null,'Parent'),node('a','parent','Same title'),node('b','parent','Same title')],can_manage:false,can_transfer:false,leaf_total:2,leaf_completed:0};rememberWorkCapabilityContext(data,api.actor);return data;}
const controller=():WorkTreeController=>({rootId:'root',actorId:api.actor,data:api.tree,loading:false,error:'',unavailable:false,authorityFresh:true,refreshPending:false,pending:false,reload:vi.fn(),save:api.save});
const record=(id:string)=>({subtask:{id,taskId:'root',title:api.tree!.nodes.find(node=>node.id===id)!.title,assignedToIds:['worker'],status:'todo',percentComplete:20,isStandalone:true,createdAt:1,updatedAt:1},submissions:[],progressUpdates:[]});
function reviewItem():SubtaskReviewItem{return {subtask:record('b').subtask,taskTitle:'Root',submission:{id:'attempt',taskId:'root',subtaskId:'b',version:1,submitterId:'submitter',submitterName:'Historical contributor',reviewerId:'old-reviewer',status:'pending',note:'Sealed note',submittedAt:1,attachments:[]}};}
let uninstall:(()=>void)|undefined;
beforeEach(()=>{vi.clearAllMocks();api.actor='worker';api.tree=tree();api.read.mockImplementation(async(_root,id)=>record(id));api.root.mockResolvedValue({id:'root',title:'Root',linked_project_id:'project',org_id:'office',assigned_to:'root-lead',status:'todo'});api.events.mockResolvedValue({events:[],more:false});api.subscribe.mockImplementation((_actor,_all,callback)=>{callback([reviewItem()]);return()=>{};});});
afterEach(()=>{cleanup();uninstall?.();uninstall=undefined;});
describe('NW8.4 canonical entrances and compatibility',()=>{
 it('opens the exact duplicate-title ID from Work without legacy prefetch and restores the real opener',async()=>{
  const view=render(<TaskSubtasksWidget taskId="root" parentTask={task} controller={controller()}/>);const opener=view.container.querySelector<HTMLButtonElement>('[data-work-open="b"]')!;opener.focus();fireEvent.click(opener);await screen.findByRole('heading',{name:'Same title'});expect(api.read).toHaveBeenCalledWith('root','b');expect(api.legacy).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Close subtask detail'}));await waitFor(()=>expect(document.activeElement).toBe(opener));
 });
 it('opens the canonical item in Review from its current action and retains dirty feedback on Escape/close',async()=>{
  const selected=api.tree!.nodes[2];selected.status='for_review';selected.percent_complete=100;selected.current_reviewer='worker';selected.capabilities!.review=allow;const confirm=vi.fn().mockResolvedValue(false);uninstall=installNavigationConfirmation(confirm);render(<TaskSubtasksWidget taskId="root" parentTask={task} controller={controller()}/>);
  const opener=screen.getAllByRole('button',{name:'Actions for Same title'})[1];fireEvent.keyDown(opener,{key:'Enter'});fireEvent.click(await screen.findByRole('menuitem',{name:'Review',exact:true}));const review=await screen.findByRole('dialog',{name:'Subitem evidence review'});fireEvent.change(await within(review).findByPlaceholderText('Explain what needs correction…'),{target:{value:'Retain review draft'}});fireEvent.keyDown(review,{key:'Escape'});await waitFor(()=>expect(confirm).toHaveBeenCalled());expect((within(review).getByPlaceholderText('Explain what needs correction…') as HTMLTextAreaElement).value).toBe('Retain review draft');expect(api.read).toHaveBeenCalledWith('root','b');expect(api.save).not.toHaveBeenCalled();
 });
 it('opens a deep My Work row with current execute rights despite old flags, and grants no root management',async()=>{
  const subtask=record('b').subtask,element=document.createElement('button');document.body.append(element);const row={key:'office:b',id:'b',rootId:'root',title:'Same title',kind:'office-node',task,subtask,node:api.tree!.nodes[2],tree:api.tree,actionable:true,history:false} as WorkRow;
  render(<WorkInspector selected={{row,element}} current={[row]} onClose={()=>{}}/>);await screen.findByRole('heading',{name:'Same title'});expect(screen.getByRole('button',{name:'Save update'}).matches(':disabled')).toBe(false);expect(screen.queryByRole('button',{name:'Task work actions'})).toBeNull();expect(screen.queryByRole('button',{name:'Child work actions'})).toBeNull();element.remove();
 });
 it('retains history-only My Work locks even when current maps and old assignment match',async()=>{
  const row={key:'office:b',id:'b',rootId:'root',title:'Same title',kind:'office-node',task,subtask:record('b').subtask,node:api.tree!.nodes[2],actionable:false,history:true} as WorkRow;render(<WorkInspector selected={{row,element:document.createElement('button')}} current={[row]} onClose={()=>{}}/>);await screen.findByRole('heading',{name:'Same title'});expect(screen.getByRole('button',{name:'Save update'}).matches(':disabled')).toBe(true);expect(screen.queryByRole('button',{name:'Request cash'})).toBeNull();
 });
 it('guards dirty Work-to-Activity navigation and shows only the selected Activity shell',async()=>{
  const confirm=vi.fn().mockResolvedValue(false);uninstall=installNavigationConfirmation(confirm);render(<SubitemInspector rootTask={task} itemId="b" controller={controller()} onClose={()=>{}}/>);fireEvent.change(await screen.findByLabelText('Progress note (optional)'),{target:{value:'Retain work'}});fireEvent.click(screen.getByRole('button',{name:'Activity',exact:true}));await waitFor(()=>expect(confirm).toHaveBeenCalled());expect(api.events).not.toHaveBeenCalled();confirm.mockResolvedValue(true);fireEvent.click(screen.getByRole('button',{name:'Activity',exact:true}));await screen.findByRole('region',{name:'Subitem activity'});expect(api.events).toHaveBeenCalledOnce();expect(api.events).toHaveBeenCalledWith(['root'],undefined);
 });
 it('opens current review selection through the public canonical facade only after accepted discard',async()=>{
  const confirm=vi.fn().mockResolvedValue(false);uninstall=installNavigationConfirmation(confirm);render(<SubtaskReviewInbox embedded onShowTasks={()=>{}}/>);fireEvent.change(await screen.findByPlaceholderText('Explain what needs correction…'),{target:{value:'Inbox draft'}});fireEvent.click(screen.getByRole('button',{name:'Open subitem'}));await waitFor(()=>expect(api.read).not.toHaveBeenCalled());await waitFor(()=>expect(confirm).toHaveBeenCalled());expect(api.root).not.toHaveBeenCalled();confirm.mockResolvedValue(true);fireEvent.click(screen.getByRole('button',{name:'Open subitem'}));const inspector=await screen.findByRole('dialog',{name:'Subtask details: Same title'});expect(within(inspector).getByRole('heading',{name:'Same title'})).toBeTruthy();expect(api.read).toHaveBeenCalledWith('root','b');expect(api.root).toHaveBeenCalledWith('root');
 });
 it('preserves an explicit read-only Inbox caller through its opened canonical Inspector',async()=>{
  render(<SubtaskReviewInbox embedded readOnly onShowTasks={()=>{}}/>);fireEvent.click(await screen.findByRole('button',{name:'Open subitem'}));await screen.findByRole('heading',{name:'Same title'});expect(screen.getByRole('button',{name:'Save update'}).matches(':disabled')).toBe(true);expect(screen.queryByRole('button',{name:'Request cash'})).toBeNull();expect(api.progress).not.toHaveBeenCalled();
 });
 it('keeps an opened canonical draft mounted when its parent review queue is removed and fails',async()=>{
  let update!:(items:SubtaskReviewItem[])=>void,failed!:(error:Error)=>void;api.subscribe.mockImplementation((_actor,_all,next,error)=>{update=next;failed=error;next([reviewItem()]);return()=>{};});render(<SubtaskReviewInbox embedded onShowTasks={()=>{}}/>);fireEvent.click(await screen.findByRole('button',{name:'Open subitem'}));await screen.findByRole('heading',{name:'Same title'});fireEvent.change(screen.getByLabelText('Progress note (optional)'),{target:{value:'Canonical draft'}});act(()=>{update([]);failed(new Error('Parent queue unavailable'));});expect(screen.getByRole('heading',{name:'Same title'})).toBeTruthy();expect((screen.getByLabelText('Progress note (optional)') as HTMLTextAreaElement).value).toBe('Canonical draft');
 });
 it('ignores late root metadata after the canonical review item changes',async()=>{
  let resolve!:(row:Record<string,unknown>)=>void;api.root.mockImplementationOnce(()=>new Promise(yes=>{resolve=yes;}));api.root.mockResolvedValueOnce(null);const item=reviewItem(),view=render(<ReviewSubitemInspector item={item} origin={{view:'Review'}} onClose={()=>{}}/>);view.rerender(<ReviewSubitemInspector item={{...item,subtask:{...item.subtask,id:'other',taskId:'other-root'}}} origin={{view:'Review'}} onClose={()=>{}}/>);await screen.findByRole('alert');await act(async()=>resolve({id:'root',title:'Wrong root',linked_project_id:'project',org_id:'office'}));expect(screen.queryByText('Wrong root')).toBeNull();expect(api.read).not.toHaveBeenCalled();
 });
 it('resolves canonical review ID despite a stale label and rejects ambiguous label-only focus',async()=>{
  const view=render(<SubtaskReviewInbox embedded focus={{notificationId:'canonical',kind:'subtask_review',taskId:'root',entityId:'b',entityLabel:'Old title'}} onShowTasks={()=>{}}/>);await screen.findByText('Sealed note');expect(screen.queryByRole('alert')).toBeNull();view.unmount();api.subscribe.mockImplementation((_actor,_all,callback)=>{const b=reviewItem();callback([b,{...b,subtask:{...b.subtask,id:'a'},submission:{...b.submission,id:'another-attempt',subtaskId:'a'}}]);return()=>{};});render(<SubtaskReviewInbox embedded focus={{notificationId:'legacy',kind:'subtask_review',taskId:'root',entityLabel:'Same title'}} onShowTasks={()=>{}}/>);await screen.findByRole('alert');expect(screen.queryByRole('button',{name:'Approve evidence'})).toBeNull();
 });
 it('does not render a legacy fallback for a mismatched actor or root controller',()=>{
  render(<TaskSubtasksWidget taskId="root" parentTask={task} controller={{...controller(),actorId:'other'}} fallback={<p>Unsafe legacy fallback</p>}/>);expect(screen.getByRole('alert')).toBeTruthy();expect(screen.queryByText('Unsafe legacy fallback')).toBeNull();
 });
});
