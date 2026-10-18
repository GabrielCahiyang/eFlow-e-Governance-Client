// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {Task} from '../../src/app/features/tasks';
import type {WorkCapabilityEntry,WorkTreeSnapshot} from '../../src/app/features/nested-work';
import {rememberWorkCapabilityContext} from '../../src/app/features/nested-work/selectors/capabilities';
import {installNavigationConfirmation} from '../../src/app/shared/navigationGuard';
const api=vi.hoisted(()=>({load:vi.fn(),save:vi.fn(),actor:'head',role:'head',office:'office',officeState:{loading:false,error:'',offices:[],members:[]}}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:api.actor},userProfile:{id:api.actor,role:api.role,org_id:api.office,is_active:true}})}));
vi.mock('../../src/app/features/nested-work/services/workTreeService',()=>({fetchWorkTree:api.load,saveWorkTree:api.save,fetchWorkImpact:vi.fn(),fetchWorkEvents:vi.fn().mockResolvedValue({events:[],more:false}),WorkTreeUnavailable:class extends Error{}}));
vi.mock('../../src/app/features/tasks',async()=>{
 const {getTaskLeadId,getTaskTeamMemberIds}=await import('../../src/app/features/tasks/selectors/teamMembership');
 const {isTaskLead}=await import('../../src/app/features/tasks/selectors/leadership');
 return {getTaskLeadId,getTaskTeamMemberIds,isTaskLead,TASK_STATUS_LABELS:{todo:'To Do',for_review:'For Review',completed:'Completed',cancelled:'Cancelled'},TaskTeamEditorDialog:()=>null,assignTask:vi.fn(),updateTaskStatus:vi.fn()};
});
vi.mock('../../src/app/features/project-offices',()=>({useProjectOfficeContext:()=>api.officeState,TaskOfficeControl:()=>null,projectOfficePeople:()=>[],moveProjectOfficeTask:vi.fn()}));
vi.mock('../../src/app/features/project-table/services/workspaceService',()=>({patchWorkspaceTask:vi.fn()}));
vi.mock('../../src/app/features/project-table/components/PlanningCells',()=>({TimelineCell:()=>null,DependencyCell:()=>null,NumberCell:()=>null}));
vi.mock('../../src/app/features/staffing',()=>({StaffingDialog:()=>null}));
vi.mock('../../src/app/features/subtasks/components/SubtaskWorkDrawer',()=>({SubtaskWorkDrawer:()=>null}));
vi.mock('../../src/app/features/reviews',()=>({SubtaskReviewInbox:()=>null}));
import {ProjectTaskRow} from '../../src/app/features/project-table/components/ProjectTaskRow';
import {WorkTree,type WorkTreeController} from '../../src/app/features/nested-work';
const allow:WorkCapabilityEntry={allowed:true,reason_code:null},deny:WorkCapabilityEntry={allowed:false,reason_code:'branch_denied'};
const task:Task={id:'root',title:'Office delivery',orgId:'office',linkedProjectId:'project',assigneeId:'lead',status:'todo',createdAt:1,updatedAt:1};
function snapshot(create=true):WorkTreeSnapshot{
 const data:WorkTreeSnapshot={root:{id:'root',project:'project',office:'office',kind:'office',open:true,lead:'lead',people:['lead'],due:null,capabilities:{create_child:create?allow:deny,manage_contributors:allow,appoint_lead:allow,order_children:allow}},revision:7,can_manage:true,can_transfer:true,leaf_total:1,leaf_completed:0,people:[{id:'lead',name:'Branch Lead',eligible:true},{id:'head',name:'Office Head',eligible:true}],nodes:[{id:'parent',task_id:'root',parent_subtask_id:null,lead_id:'lead',title:'Parent',assigned_to_ids:['lead'],depth:1,sibling_order:0,due_date:null,is_standalone:true,status:'todo',percent_complete:0,can_manage:true,can_order:true,can_work:true,can_appoint:true,can_review:false,capabilities:{create_child:allow,edit_details:allow,order_children:allow}},{id:'child',task_id:'root',parent_subtask_id:'parent',lead_id:'lead',title:'Child',assigned_to_ids:['lead'],depth:2,sibling_order:0,due_date:null,is_standalone:true,status:'todo',percent_complete:0,can_manage:false,can_order:false,can_work:false,can_appoint:false,can_review:false}]};
 rememberWorkCapabilityContext(data,api.actor);return data;
}
const rowProps=()=>({task,tasks:[task],groups:[],profiles:[],orgs:[],columns:['owner'] as const,editable:false,userId:api.actor,subtasks:[],onOpen:vi.fn(),onOpenSubitem:vi.fn(),refreshSubitems:vi.fn().mockResolvedValue(undefined),reorderable:false,onMove:vi.fn(),run:async(fn:()=>Promise<void>)=>{await fn();}});
function show(patch:Partial<Task>={},locked=false){const props={...rowProps(),columns:['owner'] as ('owner')[],task:{...task,...patch},locked};return render(<table><tbody><ProjectTaskRow {...props}/></tbody></table>);}
async function menu(name='Actions for Office delivery'){fireEvent.keyDown(screen.getByRole('button',{name,exact:true}),{key:'Enter'});await screen.findByRole('menu');}
beforeEach(()=>{api.actor='head';api.role='head';api.office='office';api.officeState.error='';vi.clearAllMocks();sessionStorage.clear();api.load.mockImplementation(async()=>snapshot());api.save.mockResolvedValue(snapshot());});
afterEach(()=>{cleanup();vi.useRealTimers();});
if(!globalThis.ResizeObserver)globalThis.ResizeObserver=class {observe(){}unobserve(){}disconnect(){}};
describe('NW6.3 existing Main Table entrances',()=>{
 it('shares one controller across Owner, expansion, focus refresh and the 15-second timer',async()=>{
  vi.useFakeTimers();show();await act(async()=>{});expect(api.load).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button',{name:'Subitems for Office delivery'}));await act(async()=>{});
  expect(screen.getByRole('table',{name:'Subitem hierarchy'})).toBeTruthy();expect(api.load).toHaveBeenCalledTimes(1);
  await act(async()=>vi.advanceTimersByTime(15000));expect(api.load).toHaveBeenCalledTimes(2);
  fireEvent(window,new Event('focus'));await act(async()=>{});expect(api.load).toHaveBeenCalledTimes(3);
  fireEvent.click(screen.getByRole('button',{name:'Subitems for Office delivery'}));await act(async()=>vi.advanceTimersByTime(15000));expect(api.load).toHaveBeenCalledTimes(4);expect(api.save).not.toHaveBeenCalled();
 });
 it('lets eligible Head oversight add a root child despite not being Task Lead, expands and focuses Title',async()=>{
  show();await screen.findByText('Branch Lead');await menu();const add=screen.getByRole('menuitem',{name:'Add subitem',exact:true});expect(add.getAttribute('aria-disabled')).not.toBe('true');fireEvent.click(add);
  const input=await screen.findByLabelText('Subitem title');await waitFor(()=>expect(document.activeElement).toBe(input));expect(screen.getByRole('button',{name:'Subitems for Office delivery'}).getAttribute('aria-expanded')).toBe('true');expect(api.load).toHaveBeenCalledTimes(1);
  fireEvent.change(input,{target:{value:'New root child'}});fireEvent.click(screen.getByRole('button',{name:'Save work changes'}));await waitFor(()=>expect(api.save).toHaveBeenCalledTimes(1));expect(api.save.mock.calls[0][1]).toMatchObject({command:'create',payload:{parent:null,title:'New root child'},revision:7});
 });
 it('fails closed for legacy management booleans without current create-child capability',async()=>{
  api.load.mockImplementation(async()=>snapshot(false));show();await screen.findByText('Branch Lead');await menu();expect(screen.getByRole('menuitem',{name:'Add subitem'}).getAttribute('aria-disabled')).toBe('true');expect(api.save).not.toHaveBeenCalled();
 });
 for(const [label,patch,locked] of [['archive',{archivedAt:1},false],['caller lock',{},true],['review state',{status:'for_review'},false]] as const)it(`propagates ${label} through row, owner and widget`,async()=>{
  show(patch as Partial<Task>,locked);await screen.findByText('Branch Lead');expect(screen.queryByRole('button',{name:'Choose task lead and contributors'})).toBeNull();await menu();expect(screen.getByRole('menuitem',{name:'Add subitem'}).getAttribute('aria-disabled')).toBe('true');fireEvent.keyDown(screen.getByRole('menu'),{key:'Escape'});fireEvent.click(screen.getByRole('button',{name:'Subitems for Office delivery'}));await screen.findByRole('button',{name:'Parent',exact:true});expect(screen.queryByRole('button',{name:'Task work actions'})).toBeNull();expect(api.save).not.toHaveBeenCalled();
 });
 it('keeps proposed Office work in the locked legacy path without a nested-work controller',async()=>{
  show({proposedOfficeIdentityId:'proposal'});expect((screen.getByRole('combobox',{name:'Owner for Office delivery'}) as HTMLSelectElement).disabled).toBe(true);await menu();expect(screen.getByRole('menuitem',{name:'Add subitem'}).getAttribute('aria-disabled')).toBe('true');fireEvent.keyDown(screen.getByRole('menu'),{key:'Escape'});fireEvent.click(screen.getByRole('button',{name:'Subitems for Office delivery'}));expect(screen.queryByRole('button',{name:'Task work actions'})).toBeNull();expect(api.load).not.toHaveBeenCalled();expect(api.save).not.toHaveBeenCalled();
 });
 it('retains this task collapse state across row close and does not reopen an old Add request',async()=>{
  show();await screen.findByText('Branch Lead');const toggle=screen.getByRole('button',{name:'Subitems for Office delivery'});await menu();fireEvent.click(screen.getByRole('menuitem',{name:'Add subitem'}));await screen.findByLabelText('Subitem title');fireEvent.click(screen.getByRole('button',{name:'Cancel changes'}));await waitFor(()=>expect(screen.queryByLabelText('Subitem title')).toBeNull());
  fireEvent.click(screen.getByRole('button',{name:'Collapse children of Parent'}));expect(screen.queryByRole('button',{name:'Child',exact:true})).toBeNull();fireEvent.click(toggle);fireEvent.click(toggle);await screen.findByRole('button',{name:'Expand children of Parent'});expect(screen.queryByRole('button',{name:'Child',exact:true})).toBeNull();expect(screen.queryByLabelText('Subitem title')).toBeNull();expect(api.save).not.toHaveBeenCalled();
 });
 it('keeps personal progress drafts locked when the caller execution scope changes',async()=>{
  const data=snapshot();data.root.kind='personal';data.root.office=null;data.nodes[0].capabilities={execute:allow,submit:allow};rememberWorkCapabilityContext(data,api.actor);
  const controller:WorkTreeController={rootId:'root',actorId:api.actor,data,loading:false,error:'',unavailable:false,authorityFresh:true,refreshPending:false,pending:false,reload:vi.fn(),save:api.save};
  const view=render(<WorkTree rootId="root" controller={controller}/>);await menu('Actions for Parent');fireEvent.click(screen.getByRole('menuitem',{name:'Update progress'}));fireEvent.change(await screen.findByLabelText('Note / feedback'),{target:{value:'Retained personal work update'}});
  view.rerender(<WorkTree rootId="root" controller={controller} executionBlocked/>);expect((screen.getByLabelText('Note / feedback') as HTMLTextAreaElement).value).toBe('Retained personal work update');expect(screen.queryByLabelText('Progress')).toBeNull();expect((screen.getByRole('button',{name:'Save work changes'}) as HTMLButtonElement).disabled).toBe(true);expect(api.load).not.toHaveBeenCalled();expect(api.save).not.toHaveBeenCalled();
 });
 it('routes Office Review to the existing callback and hides it when there is no review owner',async()=>{
  const data=snapshot();data.nodes[0].capabilities={review:allow};rememberWorkCapabilityContext(data,api.actor);const review=vi.fn();
  const controller:WorkTreeController={rootId:'root',actorId:api.actor,data,loading:false,error:'',unavailable:false,authorityFresh:true,refreshPending:false,pending:false,reload:vi.fn(),save:api.save};
  const view=render(<WorkTree rootId="root" controller={controller} onReviewOfficeNode={review}/>);await menu('Actions for Parent');fireEvent.click(screen.getByRole('menuitem',{name:'Review',exact:true}));await waitFor(()=>expect(review).toHaveBeenCalledWith(data.nodes[0],data));expect(api.save).not.toHaveBeenCalled();
  view.rerender(<WorkTree rootId="root" controller={controller}/>);await menu('Actions for Parent');expect(screen.queryByRole('menuitem',{name:'Review',exact:true})).toBeNull();expect(api.load).not.toHaveBeenCalled();
 });
 it('retains dirty branch and row on declined collapse and discards only after accepted navigation',async()=>{
  const confirm=vi.fn().mockResolvedValue(false),uninstall=installNavigationConfirmation(confirm);
  try{show();await screen.findByText('Branch Lead');const toggle=screen.getByRole('button',{name:'Subitems for Office delivery'});fireEvent.click(toggle);await screen.findByRole('button',{name:'Parent',exact:true});await menu('Actions for Parent');fireEvent.click(screen.getByRole('menuitem',{name:'Edit details'}));fireEvent.change(await screen.findByLabelText('Subitem title'),{target:{value:'Retained branch'}});
   fireEvent.click(screen.getByRole('button',{name:'Collapse children of Parent'}));await waitFor(()=>expect(confirm).toHaveBeenCalledTimes(1));expect(screen.getByRole('button',{name:'Child',exact:true})).toBeTruthy();expect(screen.getByDisplayValue('Retained branch')).toBeTruthy();
   fireEvent.click(toggle);await waitFor(()=>expect(confirm).toHaveBeenCalledTimes(2));expect(toggle.getAttribute('aria-expanded')).toBe('true');confirm.mockResolvedValue(true);fireEvent.click(toggle);await waitFor(()=>expect(toggle.getAttribute('aria-expanded')).toBe('false'));fireEvent.click(toggle);await screen.findByRole('button',{name:'Parent',exact:true});expect(screen.queryByLabelText('Subitem title')).toBeNull();expect(api.save).not.toHaveBeenCalled();
  }finally{uninstall();}
 });
});
