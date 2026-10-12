// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {installNavigationConfirmation,requestNavigation} from '../../src/app/shared/navigationGuard';
async function chooseWorkAction(label:string, action:string){const trigger=await screen.findByRole('button',{name:label,exact:true});fireEvent.keyDown(trigger,{key:'Enter'});fireEvent.click(await screen.findByRole('menuitem',{name:action,exact:true}));}

const mocks=vi.hoisted(()=>({actor:'lead',load:vi.fn(),save:vi.fn(),impact:vi.fn()}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:mocks.actor}})}));
vi.mock('../../src/app/features/nested-work/services/workTreeService',()=>({fetchWorkTree:mocks.load,saveWorkTree:mocks.save,fetchWorkImpact:mocks.impact,fetchPersonalWorkRoots:vi.fn(),fetchOfficeWorkRoots:vi.fn(),fetchWorkEvents:vi.fn(),WorkTreeUnavailable:class WorkTreeUnavailable extends Error{}}));
import {WorkTree,WorkRootOwner,descendantIds,reparentChoices,leafCompletion,supportsNestedWork} from '../../src/app/features/nested-work';
import {WorkTreeUnavailable} from '../../src/app/features/nested-work/services/workTreeService';
import {getSubtaskPrerequisite} from '../../src/app/features/subtasks/selectors/sequencing';
import {rememberWorkCapabilityContext} from '../../src/app/features/nested-work/selectors/capabilities';
import type {WorkCapabilityEntry,WorkNode,WorkTreeSnapshot} from '../../src/app/features/nested-work';
import {nestedWorkImpactFixture} from '../fixtures/nestedWorkImpact';
import {InspectorTeam} from '../../src/app/features/task-inspector/components/InspectorTeam';
import {ProjectTaskCell} from '../../src/app/features/project-table/components/ProjectTaskCells';
const allow:WorkCapabilityEntry={allowed:true,reason_code:null},deny:WorkCapabilityEntry={allowed:false,reason_code:'branch_denied'},noAppointment:WorkCapabilityEntry={allowed:false,reason_code:'appointment_denied'};
const node=(patch:Partial<WorkNode>={}):WorkNode=>({id:'branch',task_id:'root',parent_subtask_id:null,lead_id:'lead',title:'Branch',assigned_to_ids:['lead'],depth:1,sibling_order:0,due_date:'2026-12-01',is_standalone:true,status:'todo',percent_complete:0,can_manage:true,can_appoint:false,can_order:false,can_work:true,can_review:false,
 capabilities:{manage_contributors:allow,appoint_lead:noAppointment,create_child:allow,order_children:allow,edit_details:allow,move:allow,delete:allow,execute:allow,submit:allow,review:deny},...patch});
const tree=(patch:Partial<WorkTreeSnapshot>={}):WorkTreeSnapshot=>{
 const snapshot:WorkTreeSnapshot={root:{id:'root',project:'project',office:'office',kind:'office',lead:'lead',open:true,due:'2026-12-31',people:['lead'],capabilities:{manage_contributors:allow,appoint_lead:noAppointment,create_child:allow,order_children:allow}},revision:7,can_manage:true,can_transfer:false,nodes:[node()],people:[{id:'lead',name:'Current Lead',eligible:true},{id:'bob',name:'Bob selected for project',eligible:true}],leaf_total:1,leaf_completed:0,...patch};
 // Mock the service's successful response bookkeeping, not a production fallback.
 rememberWorkCapabilityContext(snapshot,mocks.actor);return snapshot;
};
beforeEach(()=>{sessionStorage.clear();vi.resetAllMocks();mocks.actor='lead';mocks.load.mockResolvedValue(tree());mocks.impact.mockImplementation(async(_root,request)=>nestedWorkImpactFixture(tree(),request));});afterEach(()=>{cleanup();vi.useRealTimers();});
describe('R7 checked nested-work UI',()=>{
 it('keeps loaded owners visible during refresh and coalesces overlapping focus reads',async()=>{
  let resolve:(data:WorkTreeSnapshot)=>void=()=>{};
  render(<WorkRootOwner rootId="root"/>);await screen.findByText('Current Lead');
  mocks.load.mockImplementationOnce(()=>new Promise(yes=>{resolve=yes;}));
  fireEvent(window,new Event('focus'));fireEvent(window,new Event('focus'));fireEvent(window,new Event('focus'));
  expect(mocks.load).toHaveBeenCalledTimes(2);expect(screen.getByText('Current Lead')).toBeTruthy();expect(screen.queryByText('Loading project people…')).toBeNull();
  await act(async()=>resolve(tree({root:{...tree().root,lead:'bob',people:['bob'],capabilities:{manage_contributors:deny,appoint_lead:noAppointment}},can_manage:false})));
  expect(screen.getByText('Bob selected for project')).toBeTruthy();expect(screen.queryByRole('button',{name:'Choose task lead and contributors'})).toBeNull();
 });
 it('refreshes owners quietly on the access timer and clears them on an access denial',async()=>{
  vi.useFakeTimers();render(<WorkRootOwner rootId="root"/>);await act(async()=>{});
  let reject:(error:Error)=>void=()=>{};mocks.load.mockImplementationOnce(()=>new Promise((_yes,no)=>{reject=no;}));
  await act(async()=>vi.advanceTimersByTime(15000));
  expect(mocks.load).toHaveBeenCalledTimes(2);expect(screen.getByText('Current Lead')).toBeTruthy();expect(screen.queryByText('Loading project people…')).toBeNull();
  await act(async()=>reject(new Error('Current project access denied')));
  expect(screen.getByRole('alert').textContent).toContain('Current project access denied');expect(screen.queryByText('Current Lead')).toBeNull();expect(screen.queryByRole('button',{name:'Choose task lead and contributors'})).toBeNull();
 });
 it('does not let a pre-save refresh replace a newly saved owner snapshot',async()=>{
  let resolve:(data:WorkTreeSnapshot)=>void=()=>{};
  mocks.load.mockResolvedValue(tree({root:{...tree().root,capabilities:{...tree().root.capabilities,appoint_lead:allow}},can_transfer:true}));mocks.save.mockResolvedValue(tree({root:{...tree().root,lead:'bob',people:['lead','bob']},can_transfer:true}));
  render(<WorkRootOwner rootId="root"/>);fireEvent.click(await screen.findByRole('button',{name:'Choose task lead and contributors'}));
  mocks.load.mockImplementationOnce(()=>new Promise(yes=>{resolve=yes;}));fireEvent(window,new Event('focus'));
  fireEvent.change(screen.getByLabelText('Appointed Lead'),{target:{value:'bob'}});fireEvent.click(screen.getByRole('button',{name:'Save work changes'}));
  fireEvent.click(await screen.findByRole('button',{name:'Transfer Lead',exact:true}));
  await screen.findByText('Task people saved.');await act(async()=>resolve(tree()));
  expect(screen.getByText('Bob selected for project')).toBeTruthy();expect(screen.getByText('Lead:').parentElement?.textContent).toBe('Lead: Bob selected for project');
 });
 it('retains one request and creation identity after a lost response, prevents double saves, and guards drafts',async()=>{
  let reject:(reason:Error)=>void=()=>{};mocks.save.mockImplementationOnce(()=>new Promise((_r,no)=>{reject=no;})).mockImplementation(async(_root,request)=>tree({nodes:[node(),node({id:request.payload.id,title:request.payload.title,parent_subtask_id:'branch',depth:2})]}));
  const uninstall=installNavigationConfirmation(vi.fn().mockResolvedValue(false));render(<WorkTree rootId="root"/>);
  await chooseWorkAction('Actions for Branch','Add subitem');fireEvent.change(screen.getByLabelText('Subitem title'),{target:{value:'Deep work'}});fireEvent.change(screen.getByLabelText('Appointed Lead'),{target:{value:'bob'}});
  expect(await requestNavigation(vi.fn())).toBe(false);const save=screen.getByRole('button',{name:'Save work changes'});fireEvent.click(save);fireEvent.click(save);expect(mocks.save).toHaveBeenCalledTimes(1);
  await act(async()=>reject(new Error('Receipt interrupted')));await screen.findByText(/Receipt interrupted/);expect((screen.getByLabelText('Subitem title') as HTMLInputElement).disabled).toBe(true);
  const request=mocks.save.mock.calls[0][1];expect(request.payload).toMatchObject({title:'Deep work',parent:'branch',lead:'bob',people:['bob']});expect(request.revision).toBe(7);
  fireEvent.click(screen.getByRole('button',{name:'Retry saved request'}));await screen.findByText('Deep work');expect(mocks.save.mock.calls[1][1]).toBe(request);uninstall();
 });
 it('retains expired assignment names while allowing replacement and excluding them from new choices',async()=>{
  mocks.load.mockResolvedValue(tree({can_transfer:true,root:{...tree().root,people:['lead','expired']},people:[...tree().people,{id:'expired',name:'Expired contributor',eligible:false}]}));
  render(<WorkRootOwner rootId="root"/>);fireEvent.click(await screen.findByRole('button',{name:'Choose task lead and contributors'}));
  expect(screen.queryByRole('option',{name:'Expired contributor'})).toBeNull();expect(screen.queryByRole('checkbox',{name:'Expired contributor · Contributor'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Remove contributor Expired contributor'}));expect(screen.queryByRole('button',{name:'Remove contributor Expired contributor'})).toBeNull();
 });
 it('allows a root lead to change contributors without gaining root-transfer authority',async()=>{
  mocks.save.mockResolvedValue(tree());render(<WorkRootOwner rootId="root"/>);fireEvent.click(await screen.findByRole('button',{name:'Choose task lead and contributors'}));
  expect((screen.getByLabelText('Appointed Lead') as HTMLSelectElement).disabled).toBe(true);fireEvent.click(screen.getByRole('button',{name:'Add contributor Bob selected for project'}));fireEvent.click(screen.getByRole('button',{name:'Save work changes'}));
  await waitFor(()=>expect(mocks.save).toHaveBeenCalled());expect(mocks.save.mock.calls[0][1]).toMatchObject({command:'contributors',payload:{people:['lead','bob']}});
 });
 it('keeps original draft revision during a capability refresh and disables a revoked editor',async()=>{
  mocks.save.mockResolvedValue(tree());const {rerender}=render(<WorkTree rootId="root"/>);await chooseWorkAction('Task work actions','Add subitem');fireEvent.change(screen.getByLabelText('Subitem title'),{target:{value:'Retained draft'}});
  mocks.load.mockResolvedValue(tree({root:{...tree().root,capabilities:{manage_contributors:deny,appoint_lead:noAppointment,create_child:deny,order_children:deny}},revision:8,can_manage:false}));fireEvent(window,new Event('focus'));await screen.findByText('Your current branch authority changed. Reload the tree before saving.');
  expect((screen.getByLabelText('Subitem title') as HTMLInputElement).value).toBe('Retained draft');expect((screen.getByRole('button',{name:'Save work changes'}) as HTMLButtonElement).disabled).toBe(true);expect(mocks.save).not.toHaveBeenCalled();
  mocks.actor='other';mocks.load.mockRejectedValue(new Error('Current access denied'));rerender(<WorkTree rootId="root"/>);await screen.findByText('Current access denied');expect(screen.queryByDisplayValue('Retained draft')).toBeNull();
 });
 it('clears stale roots and ignores late reads across scope changes',async()=>{
  let resolve:(data:WorkTreeSnapshot)=>void=()=>{};mocks.load.mockImplementationOnce(()=>new Promise(yes=>{resolve=yes;})).mockResolvedValue(tree({root:{...tree().root,id:'other'},nodes:[],leaf_total:0}));
  const {rerender}=render(<WorkTree rootId="root"/>);rerender(<WorkTree rootId="other"/>);await screen.findByText('Subitems with no children: 0/0 reviewed · Task progress is managed separately.');
  await act(async()=>resolve(tree()));expect(screen.queryByText('Branch')).toBeNull();
 });
 it('uses the legacy adapter only for an explicitly missing RPC, and fails closed on denial',async()=>{
  mocks.load.mockRejectedValue(new WorkTreeUnavailable('Missing'));const {rerender}=render(<WorkTree rootId="root" fallback={<p>Legacy checklist</p>}/>);await screen.findByText('Legacy checklist');
  mocks.load.mockRejectedValue(new Error('Access denied'));rerender(<WorkTree rootId="different" fallback={<p>Legacy checklist</p>}/>);await screen.findByText('Access denied');expect(screen.queryByText('Legacy checklist')).toBeNull();
 });
 it('shows historical work for a Viewer without exposing mutation actions or inventing an email invitation',async()=>{
  mocks.load.mockResolvedValue(tree({root:{...tree().root,capabilities:{manage_contributors:deny,appoint_lead:noAppointment,create_child:deny,order_children:deny}},can_manage:false,can_transfer:false,nodes:[node({can_manage:false,can_appoint:false,can_work:false,can_order:false,capabilities:{manage_contributors:deny,appoint_lead:noAppointment,create_child:deny,order_children:deny,edit_details:deny,move:deny,delete:deny,execute:deny,submit:deny,review:deny}})]}));render(<WorkTree rootId="root"/>);await screen.findByRole('button',{name:'Branch',exact:true});expect(screen.queryByRole('button',{name:'Task work actions'})).toBeNull();expect(screen.getByRole('button',{name:'Actions for Branch'})).toBeTruthy();fireEvent.keyDown(screen.getByRole('button',{name:'Actions for Branch'}),{key:'Enter'});await screen.findByRole('menuitem',{name:'Open work / evidence'});expect(screen.queryByRole('menuitem',{name:'Edit details'})).toBeNull();expect(screen.queryByRole('menuitem',{name:'Add subitem'})).toBeNull();
 });
});
describe('R7 hierarchy adapters',()=>{
 it('preserves flat planning for unresolved Offices and governed work',()=>{
  expect(supportsNestedWork({linkedProjectId:'project'})).toBe(true);expect(supportsNestedWork({})).toBe(false);
  expect(supportsNestedWork({linkedProjectId:'project',proposedOfficeIdentityId:'named'})).toBe(false);
  expect(supportsNestedWork({linkedProjectId:'project',sourceCollaborationDraftId:'governed'})).toBe(false);
 });
 it('bounds subtree traversal, excludes cycles and rejects destinations that would exceed depth 8',()=>{
  const parent=node(),child=node({id:'child',parent_subtask_id:'branch',depth:2}),deep=node({id:'deep',parent_subtask_id:null,depth:8}),safe=node({id:'safe',depth:2});const nodes=[parent,child,deep,safe];
  expect([...descendantIds(nodes,'branch')]).toEqual(['child']);expect(reparentChoices(nodes,parent).map(n=>n.id)).toEqual(['safe']);
  expect([...descendantIds([parent,child,node({id:'branch',parent_subtask_id:'child'})],'branch')]).toEqual(['child']);
 });
 it('counts only leaves and preserves parent work as a separate review',()=>{
  expect(leafCompletion([node({status:'completed'}),node({id:'child',parent_subtask_id:'branch',status:'completed'}),node({id:'sibling',status:'todo'})])).toEqual({total:2,completed:1});
 });
 it('blocks only earlier ordered siblings under the same root and parent',()=>{
  const current={id:'c',taskId:'root',title:'Current',position:20,siblingOrder:1,parentSubtaskId:'parent',isCompleted:false};
  const foreign={...current,id:'f',position:1,siblingOrder:0,parentSubtaskId:'other'};const prior={...current,id:'p',position:19,siblingOrder:0};
  expect(getSubtaskPrerequisite(current,[foreign,current])).toBeNull();expect(getSubtaskPrerequisite(current,[foreign,prior,current])).toBe(prior);
 });
});

describe('NW3.3 staffing and hierarchy caller locks',()=>{
 const task={id:'root',linkedProjectId:'project',orgId:'office',title:'Supported root',status:'todo' as const,createdAt:1,updatedAt:1};
 it('lets verified canonical capability control Inspector contributors independently of legacy Head-only flags',async()=>{
  render(<InspectorTeam task={task} profiles={[]} canManageTaskTeam={false} canManageSubtasks={false} currentUserIsLead={false} onManage={vi.fn()}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Choose task lead and contributors'}));expect((screen.getByLabelText('Appointed Lead') as HTMLSelectElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Add contributor Bob selected for project'}));mocks.save.mockResolvedValue(tree());fireEvent.click(screen.getByRole('button',{name:'Save work changes'}));
  await waitFor(()=>expect(mocks.save).toHaveBeenCalled());expect(mocks.save.mock.calls[0][1].command).toBe('contributors');
 });
 it('propagates Inspector read-only to both root staffing and nested work despite affirmative legacy booleans',async()=>{
  render(<InspectorTeam task={task} profiles={[]} canManageTaskTeam canManageSubtasks currentUserIsLead readOnly onManage={vi.fn()}/>);
  await screen.findAllByText('Current Lead');await screen.findByRole('button',{name:'Branch',exact:true});expect(screen.queryByRole('button',{name:'Choose task lead and contributors'})).toBeNull();expect(screen.queryByRole('button',{name:'Task work actions'})).toBeNull();fireEvent.keyDown(screen.getByRole('button',{name:'Actions for Branch'}),{key:'Enter'});await screen.findByRole('menuitem',{name:'Open work / evidence'});expect(screen.queryByRole('menuitem',{name:'Choose people'})).toBeNull();expect(screen.queryByRole('menuitem',{name:'Add subitem'})).toBeNull();expect(screen.queryByRole('button',{name:'Manage',exact:true})).toBeNull();
 });
 it('updates an open Inspector staffing draft when its caller becomes read-only',async()=>{
  const props={task,profiles:[],canManageTaskTeam:true,canManageSubtasks:true,currentUserIsLead:true,onManage:vi.fn()},view=render(<InspectorTeam {...props}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Choose task lead and contributors'}));fireEvent.click(screen.getByRole('button',{name:'Add contributor Bob selected for project'}));view.rerender(<InspectorTeam {...props} readOnly/>);
  expect((screen.getByRole('button',{name:'Remove contributor Bob selected for project'}) as HTMLButtonElement).disabled).toBe(true);expect((screen.getByRole('button',{name:'Save work changes'}) as HTMLButtonElement).disabled).toBe(true);expect(mocks.save).not.toHaveBeenCalled();
 });
 it('propagates table read-only without confusing non-Head metadata permission with staffing capability',async()=>{
  const props={column:'owner' as const,task,tasks:[task],profiles:[],people:[],orgs:[],editable:false,busy:false,canSetOffice:false,hasStaffedSubitems:false,statuses:[task.status],save:vi.fn(),write:vi.fn()},view=render(<ProjectTaskCell {...props}/>);
  await screen.findByRole('button',{name:'Choose task lead and contributors'});view.rerender(<ProjectTaskCell {...props} readOnly/>);expect(screen.queryByRole('button',{name:'Choose task lead and contributors'})).toBeNull();expect(mocks.save).not.toHaveBeenCalled();
 });
 for(const status of ['for_review','completed','cancelled'] as const)it('locks the table staffing caller for '+status,async()=>{
  render(<ProjectTaskCell column="owner" task={{...task,status}} tasks={[task]} profiles={[]} people={[]} orgs={[]} editable busy={false} canSetOffice={false} hasStaffedSubitems={false} statuses={[status]} save={vi.fn()} write={vi.fn()}/>);await screen.findByText('Current Lead');expect(screen.queryByRole('button',{name:'Choose task lead and contributors'})).toBeNull();
 });
});
