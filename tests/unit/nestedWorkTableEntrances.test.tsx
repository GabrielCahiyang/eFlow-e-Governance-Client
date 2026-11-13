// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {Task} from '../../src/app/features/tasks';
import type {WorkCapabilityEntry,WorkTreeSnapshot} from '../../src/app/features/nested-work';
import {rememberWorkCapabilityContext} from '../../src/app/features/nested-work/selectors/capabilities';
import {installNavigationConfirmation} from '../../src/app/shared/navigationGuard';
const api=vi.hoisted(()=>({load:vi.fn(),save:vi.fn(),impact:vi.fn(),actor:'head',role:'head',office:'office',officeState:{loading:false,error:'',offices:[],members:[]}}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:api.actor},userProfile:{id:api.actor,role:api.role,org_id:api.office,is_active:true}})}));
vi.mock('../../src/app/features/nested-work/services/workTreeService',()=>({fetchWorkTree:api.load,saveWorkTree:api.save,fetchWorkImpact:api.impact,fetchWorkEvents:vi.fn().mockResolvedValue({events:[],more:false}),WorkTreeUnavailable:class extends Error{}}));
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
beforeEach(()=>{api.actor='head';api.role='head';api.office='office';api.officeState.error='';vi.clearAllMocks();localStorage.clear();sessionStorage.clear();api.load.mockImplementation(async()=>snapshot());api.save.mockResolvedValue(snapshot());api.impact.mockResolvedValue({root_id:'root',expected_revision:7,current_revision:7,command:'edit',allowed:true,blocker_codes:[],selected_count:1,descendant_count:0,affected_appointment_count:0,before_path:['Parent'],after_path:['Parent'],fingerprint:'fp-1',requires_date_confirmation:false,date_impact:{old_due:null,new_due:null,items:[]}});});
afterEach(()=>{cleanup();vi.useRealTimers();});
if(!globalThis.ResizeObserver)globalThis.ResizeObserver=class {observe(){}unobserve(){}disconnect(){}};
describe('NW6.3 existing Main Table entrances',()=>{
 it('shares one controller across Owner, expansion, focus refresh and the 15-second timer',async()=>{
  vi.useFakeTimers();show();await act(async()=>{});expect(api.load).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button',{name:'Subtasks for Office delivery'}));await act(async()=>{});
  expect(screen.getByRole('table',{name:'Subtask hierarchy'})).toBeTruthy();expect(api.load).toHaveBeenCalledTimes(1);
  await act(async()=>vi.advanceTimersByTime(15000));expect(api.load).toHaveBeenCalledTimes(2);
  fireEvent(window,new Event('focus'));await act(async()=>{});expect(api.load).toHaveBeenCalledTimes(3);
  fireEvent.click(screen.getByRole('button',{name:'Subtasks for Office delivery'}));await act(async()=>vi.advanceTimersByTime(15000));expect(api.load).toHaveBeenCalledTimes(4);expect(api.save).not.toHaveBeenCalled();
 });
 it('lets eligible Head oversight add a root child inline despite not being Task Lead, expands and focuses Title',async()=>{
  show();await screen.findByText('Branch Lead');await menu();const add=screen.getByRole('menuitem',{name:'Add subtask',exact:true});expect(add.getAttribute('aria-disabled')).not.toBe('true');fireEvent.click(add);
  const input=await screen.findByLabelText('Add subtask to Office delivery');await waitFor(()=>expect(document.activeElement).toBe(input));expect(screen.getByRole('button',{name:'Subtasks for Office delivery'}).getAttribute('aria-expanded')).toBe('true');expect(api.load).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('dialog',{name:'Add subtask'})).toBeNull();
  expect(screen.queryByRole('button',{name:'Add subtask',exact:true})).toBeNull();
  fireEvent.change(input,{target:{value:'New root child'}});fireEvent.keyDown(input,{key:'Enter'});await waitFor(()=>expect(api.save).toHaveBeenCalledTimes(1));expect(api.save.mock.calls[0][1]).toMatchObject({command:'create',payload:{parent:null,title:'New root child'},revision:7});
 });
 it('fails closed for legacy management booleans without current create-child capability',async()=>{
  api.load.mockImplementation(async()=>snapshot(false));show();await screen.findByText('Branch Lead');await menu();expect(screen.getByRole('menuitem',{name:'Add subtask'}).getAttribute('aria-disabled')).toBe('true');expect(api.save).not.toHaveBeenCalled();
 });
 for(const [label,patch,locked] of [['archive',{archivedAt:1},false],['caller lock',{},true],['review state',{status:'for_review'},false]] as const)it(`propagates ${label} through row, owner and widget`,async()=>{
  show(patch as Partial<Task>,locked);await screen.findByText('Branch Lead');expect(screen.queryByRole('button',{name:'Choose task lead and contributors'})).toBeNull();await menu();expect(screen.getByRole('menuitem',{name:'Add subtask'}).getAttribute('aria-disabled')).toBe('true');fireEvent.keyDown(screen.getByRole('menu'),{key:'Escape'});fireEvent.click(screen.getByRole('button',{name:'Subtasks for Office delivery'}));const parentEdit=await screen.findByRole('button',{name:'Edit subtask Parent'}) as HTMLButtonElement;expect(parentEdit.disabled).toBe(true);expect(screen.queryByRole('button',{name:'Choose subtask lead and contributors for Parent'})).toBeNull();expect((screen.getByRole('button',{name:'Edit dates for Parent'}) as HTMLButtonElement).disabled).toBe(true);expect(screen.queryByRole('button',{name:'Task work actions'})).toBeNull();expect(api.save).not.toHaveBeenCalled();
 });
 it('keeps proposed Office work in the locked legacy path without a nested-work controller',async()=>{
  show({proposedOfficeIdentityId:'proposal'});expect((screen.getByRole('combobox',{name:'Owner for Office delivery'}) as HTMLSelectElement).disabled).toBe(true);await menu();expect(screen.getByRole('menuitem',{name:'Add subtask'}).getAttribute('aria-disabled')).toBe('true');fireEvent.keyDown(screen.getByRole('menu'),{key:'Escape'});fireEvent.click(screen.getByRole('button',{name:'Subtasks for Office delivery'}));expect(screen.queryByRole('button',{name:'Task work actions'})).toBeNull();expect(api.load).not.toHaveBeenCalled();expect(api.save).not.toHaveBeenCalled();
 });
 it('retains this task collapse state across row close and does not refocus an old Add request',async()=>{
  show();await screen.findByText('Branch Lead');const toggle=screen.getByRole('button',{name:'Subtasks for Office delivery'});await menu();fireEvent.click(screen.getByRole('menuitem',{name:'Add subtask'}));const input=await screen.findByLabelText('Add subtask to Office delivery');await waitFor(()=>expect(document.activeElement).toBe(input));fireEvent.change(input,{target:{value:'Draft title'}});fireEvent.keyDown(input,{key:'Escape'});expect((input as HTMLInputElement).value).toBe('');
  fireEvent.click(screen.getByRole('button',{name:'Collapse children of Parent'}));expect(screen.queryByRole('button',{name:'Edit subtask Child'})).toBeNull();fireEvent.click(toggle);await waitFor(()=>expect(toggle.getAttribute('aria-expanded')).toBe('false'));fireEvent.click(toggle);await screen.findByRole('button',{name:'Expand children of Parent'});expect(screen.queryByRole('button',{name:'Edit subtask Child'})).toBeNull();expect(document.activeElement).not.toBe(screen.getByLabelText('Add subtask to Office delivery'));expect(api.save).not.toHaveBeenCalled();
 });
 it('keeps personal progress drafts locked when the caller execution scope changes',async()=>{
  const data=snapshot();data.root.kind='personal';data.root.office=null;data.nodes[0].capabilities={execute:allow,submit:allow};rememberWorkCapabilityContext(data,api.actor);
  const controller:WorkTreeController={rootId:'root',actorId:api.actor,data,loading:false,error:'',unavailable:false,authorityFresh:true,refreshPending:false,pending:false,reload:vi.fn(),save:api.save};
  const view=render(<WorkTree rootId="root" controller={controller}/>);await menu('Actions for Parent');fireEvent.click(screen.getByRole('menuitem',{name:'Update work'}));fireEvent.change(await screen.findByLabelText('Note / feedback'),{target:{value:'Retained personal work update'}});
  view.rerender(<WorkTree rootId="root" controller={controller} executionBlocked/>);expect((screen.getByLabelText('Note / feedback') as HTMLTextAreaElement).value).toBe('Retained personal work update');expect(screen.queryByLabelText('Progress')).toBeNull();expect((screen.getByRole('button',{name:'Post update'}) as HTMLButtonElement).disabled).toBe(true);expect(api.load).not.toHaveBeenCalled();expect(api.save).not.toHaveBeenCalled();
 });
 it('never exposes the retired Office subtask review action, including permissive legacy flags',async()=>{
  const data=snapshot();data.nodes[0].capabilities={review:allow};rememberWorkCapabilityContext(data,api.actor);const review=vi.fn();
  const controller:WorkTreeController={rootId:'root',actorId:api.actor,data,loading:false,error:'',unavailable:false,authorityFresh:true,refreshPending:false,pending:false,reload:vi.fn(),save:api.save};
  render(<WorkTree rootId="root" controller={controller} onReviewOfficeNode={review}/>);await menu('Actions for Parent');expect(screen.queryByRole('menuitem',{name:'Review',exact:true})).toBeNull();expect(review).not.toHaveBeenCalled();expect(api.save).not.toHaveBeenCalled();
 });
 it('retains dirty branch and row on declined collapse and discards only after accepted navigation',async()=>{
  const confirm=vi.fn().mockResolvedValue(false),uninstall=installNavigationConfirmation(confirm);
  try{show();await screen.findByText('Branch Lead');const toggle=screen.getByRole('button',{name:'Subtasks for Office delivery'});fireEvent.click(toggle);await screen.findByRole('button',{name:'Edit subtask Parent'});await menu('Actions for Parent');fireEvent.click(screen.getByRole('menuitem',{name:'Edit subtask'}));fireEvent.change(await screen.findByLabelText('Subtask title'),{target:{value:'Retained branch'}});
   fireEvent.click(screen.getByRole('button',{name:'Collapse children of Parent'}));await waitFor(()=>expect(confirm).toHaveBeenCalledTimes(1));expect(screen.getByRole('button',{name:'Edit subtask Child'})).toBeTruthy();expect(screen.getByDisplayValue('Retained branch')).toBeTruthy();
   fireEvent.click(toggle);await waitFor(()=>expect(confirm).toHaveBeenCalledTimes(2));expect(toggle.getAttribute('aria-expanded')).toBe('true');confirm.mockResolvedValue(true);fireEvent.click(toggle);await waitFor(()=>expect(toggle.getAttribute('aria-expanded')).toBe('false'));fireEvent.click(toggle);await screen.findByRole('button',{name:'Edit subtask Parent'});expect(screen.queryByLabelText('Subtask title')).toBeNull();expect(api.save).not.toHaveBeenCalled();
  }finally{uninstall();}
 });
 it('renders the subtask columns, inline title rename on click, and PanelRight open trigger',async()=>{
  const data=snapshot();data.root.due='2099-11-30';data.nodes[0]={...data.nodes[0],lead_id:'lead',assigned_to_ids:['lead','head'],start_date:'2099-11-10',due_date:'2099-11-20',capabilities:{...data.nodes[0].capabilities,manage_contributors:allow,appoint_lead:allow}};rememberWorkCapabilityContext(data,api.actor);
  api.load.mockImplementation(async()=>data);api.save.mockResolvedValue(data);
  show({startDate:'2099-11-05',deadline:'2099-11-30T23:59:00+08:00'});
  await screen.findByText('Branch Lead');
  fireEvent.click(screen.getByRole('button',{name:'Subtasks for Office delivery'}));
  const table=await screen.findByRole('table',{name:'Subtask hierarchy'});
  expect(within(table).getAllByRole('columnheader').map(cell=>cell.textContent)).toEqual(['','Subtask','Owner','Status','Due date','Priority','Dependencies','']);

  fireEvent.click(within(table).getByRole('button',{name:'Edit subtask Parent'}));
  const titleInput=within(table).getByLabelText('subtask Parent') as HTMLInputElement;
  fireEvent.change(titleInput,{target:{value:'Updated parent'}});
  fireEvent.keyDown(titleInput,{key:'Enter'});
  await waitFor(()=>expect(api.save).toHaveBeenCalledWith('root',expect.objectContaining({command:'edit',payload:expect.objectContaining({id:'parent',title:'Updated parent'})})));
  expect(within(table).getByRole('button',{name:'Open subtask Parent'}).dataset.workOpen).toBe('parent');
  expect(within(table).getAllByText('Not started')[0].className).toContain('work-status-trigger--todo');
 });
 it('combines Lead and Contributors into Owner with Choose people opening subtask staffing',async()=>{
  const data=snapshot();data.nodes[0]={...data.nodes[0],lead_id:'lead',assigned_to_ids:['lead','head'],capabilities:{...data.nodes[0].capabilities,manage_contributors:allow,appoint_lead:allow}};rememberWorkCapabilityContext(data,api.actor);
  api.load.mockImplementation(async()=>data);
  show();await screen.findByText('Branch Lead');
  fireEvent.click(screen.getByRole('button',{name:'Subtasks for Office delivery'}));
  const table=await screen.findByRole('table',{name:'Subtask hierarchy'});
  const ownerCell=within(table).getByText((_content,el)=>el?.tagName==='TD'&&el.textContent?.includes('Lead: Branch Lead')&&el.textContent?.includes('Contributors (1): Office Head')||false);
  expect(ownerCell).toBeTruthy();
  fireEvent.click(within(ownerCell).getByRole('button',{name:'Choose subtask lead and contributors for Parent'}));
  expect(await screen.findByRole('dialog',{name:'Subtask Lead and contributors'})).toBeTruthy();
 });
 it('edits subtask dates via root-style timeline popover within parent schedule bounds',async()=>{
  const data=snapshot();data.root.due='2099-11-30';data.nodes[0]={...data.nodes[0],start_date:'2099-11-10',due_date:'2099-11-20',capabilities:{...data.nodes[0].capabilities}};rememberWorkCapabilityContext(data,api.actor);
  api.load.mockImplementation(async()=>data);api.save.mockResolvedValue(data);
  show({startDate:'2099-11-05',deadline:'2099-11-30T23:59:00+08:00'});
  await screen.findByText('Branch Lead');
  fireEvent.click(screen.getByRole('button',{name:'Subtasks for Office delivery'}));
  const table=await screen.findByRole('table',{name:'Subtask hierarchy'});
  fireEvent.click(within(table).getByRole('button',{name:'Edit dates for Parent'}));
  const dueInput=await screen.findByLabelText('Due date',{selector:'input'}) as HTMLInputElement;
  fireEvent.change(dueInput,{target:{value:'2099-12-05'}});
  expect(await screen.findByText('Subtask dates must stay within the parent schedule.')).toBeTruthy();
  expect((screen.getByRole('button',{name:'Save dates'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(dueInput,{target:{value:'2099-11-25'}});
  fireEvent.click(screen.getByRole('button',{name:'Save dates'}));
  await waitFor(()=>expect(api.save).toHaveBeenCalledWith('root',expect.objectContaining({command:'edit',impactFingerprint:'fp-1',payload:expect.objectContaining({id:'parent',due:'2099-11-25'})})));
 });
 it('adds subtasks inline via Shift+Enter (keeping focus) and outside click without a submit button',async()=>{
  render(<><button type="button">Outside target</button><table><tbody><ProjectTaskRow {...rowProps()}/></tbody></table></>);
  await screen.findByText('Branch Lead');
  fireEvent.click(screen.getByRole('button',{name:'Subtasks for Office delivery'}));
  const table=await screen.findByRole('table',{name:'Subtask hierarchy'});
  const addInput=within(table).getByLabelText('Add subtask to Office delivery');
  addInput.focus();
  fireEvent.change(addInput,{target:{value:'Child via Shift+Enter'}});
  fireEvent.keyDown(addInput,{key:'Enter',shiftKey:true});
  await waitFor(()=>expect(api.save).toHaveBeenCalledWith('root',expect.objectContaining({command:'create',payload:expect.objectContaining({title:'Child via Shift+Enter',parent:null})})));
  expect(document.activeElement).toBe(addInput);
  fireEvent.change(addInput,{target:{value:'Child via outside click'}});
  fireEvent.click(screen.getByRole('button',{name:'Outside target'}));
  await waitFor(()=>expect(api.save).toHaveBeenCalledWith('root',expect.objectContaining({command:'create',payload:expect.objectContaining({title:'Child via outside click',parent:null})})));
 });
 it('supports hiding columns via header 3-dot menus and toggling columns via the + column picker',async()=>{
  show();await screen.findByText('Branch Lead');
  fireEvent.click(screen.getByRole('button',{name:'Subtasks for Office delivery'}));
  const table=await screen.findByRole('table',{name:'Subtask hierarchy'});
  expect(within(table).getByRole('columnheader',{name:'Status'})).toBeTruthy();

  fireEvent.keyDown(within(table).getByRole('button',{name:'Column actions for Status'}),{key:'Enter'});
  fireEvent.click(await screen.findByRole('menuitem',{name:'Hide column'}));
  expect(within(table).queryByRole('columnheader',{name:'Status'})).toBeNull();
  expect(within(table).queryAllByText('Not started')).toEqual([]);

  fireEvent.click(within(table).getByRole('button',{name:'Add column'}));
  const picker=await screen.findByRole('region',{name:'Supported subtask columns'});
  fireEvent.click(within(picker).getByRole('button',{name:/Status/}));
  expect(within(table).getByRole('columnheader',{name:'Status'})).toBeTruthy();

  fireEvent.click(within(table).getByRole('button',{name:'Add column'}));
  const columnPicker=await screen.findByRole('region',{name:'Supported subtask columns'});
  expect(within(columnPicker).queryByRole('button',{name:/Progress/})).toBeNull();
  fireEvent.click(within(columnPicker).getByRole('button',{name:'Budget'}));

  fireEvent.keyDown(within(table).getByRole('button',{name:'Column actions for Subtask'}),{key:'Enter'});
  fireEvent.click(await screen.findByRole('menuitem',{name:'Restore default columns'}));
  expect(within(table).queryByRole('columnheader',{name:'Progress'})).toBeNull();
  expect(within(table).queryByRole('columnheader',{name:'Budget'})).toBeNull();
 });
 it('saves priority and sibling prerequisites with the current Subtask command',async()=>{
  const data=snapshot();
  data.supportsSubtaskDependencies=true;
  const parent={...data.nodes[0],priority:'medium' as const,can_edit_dependencies:true,dependency_ids:[]};
  data.nodes[0]=parent;
  data.nodes.push({...parent,id:'prerequisite',title:'Prepare materials',sibling_order:1});
  api.load.mockResolvedValue(data);api.save.mockResolvedValue(data);
  show();await screen.findByText('Branch Lead');
  fireEvent.click(screen.getByRole('button',{name:'Subtasks for Office delivery'}));
  const table=await screen.findByRole('table',{name:'Subtask hierarchy'});
  fireEvent.change(within(table).getByLabelText('Priority for Parent'),{target:{value:'high'}});
  await waitFor(()=>expect(api.save).toHaveBeenCalledWith('root',expect.objectContaining({
   command:'edit',revision:7,payload:expect.objectContaining({id:'parent',priority:'high'}),
  })));
  const dependencies=within(table).getByRole('button',{name:'Edit dependencies for Parent'}) as HTMLButtonElement;
  await waitFor(()=>expect(dependencies.disabled).toBe(false));
  fireEvent.click(dependencies);
  expect(screen.queryByRole('checkbox',{name:/^Child/})).toBeNull();
  fireEvent.click(await screen.findByRole('checkbox',{name:/^Prepare materials/}));
  fireEvent.click(screen.getByRole('button',{name:'Save dependencies'}));
  await waitFor(()=>expect(api.save).toHaveBeenCalledWith('root',expect.objectContaining({
   command:'edit',revision:7,payload:expect.objectContaining({id:'parent',dependency_ids:['prerequisite']}),
  })));
 });
 it('exposes Budget in the + column picker without faking unsupported schema columns',async()=>{
  show();await screen.findByText('Branch Lead');
  fireEvent.click(screen.getByRole('button',{name:'Subtasks for Office delivery'}));
  const table=await screen.findByRole('table',{name:'Subtask hierarchy'});

  fireEvent.click(within(table).getByRole('button',{name:'Add column'}));
  const budgetPicker=await screen.findByRole('region',{name:'Supported subtask columns'});
  fireEvent.click(within(budgetPicker).getByRole('button',{name:/Budget/}));
  expect(within(table).getByRole('columnheader',{name:'Budget'})).toBeTruthy();
 });
 it('inherits bounded start and due dates from the parent task when adding subtasks inline',async()=>{
  const data=snapshot();data.root.due='2099-11-25';rememberWorkCapabilityContext(data,api.actor);
  api.load.mockImplementation(async()=>data);api.save.mockResolvedValue(data);
  show({startDate:'2099-11-18',deadline:'2099-11-25T23:59:00+08:00'});
  await screen.findByText('Branch Lead');
  fireEvent.click(screen.getByRole('button',{name:'Subtasks for Office delivery'}));
  const table=await screen.findByRole('table',{name:'Subtask hierarchy'});
  const addInput=within(table).getByLabelText('Add subtask to Office delivery');
  fireEvent.change(addInput,{target:{value:'Scheduled inline step'}});
  fireEvent.keyDown(addInput,{key:'Enter'});
  await waitFor(()=>expect(api.save).toHaveBeenCalledWith('root',expect.objectContaining({
   command:'create',
   payload:expect.objectContaining({title:'Scheduled inline step',start:'2099-11-18',due:'2099-11-25'}),
  })));
 });
});
