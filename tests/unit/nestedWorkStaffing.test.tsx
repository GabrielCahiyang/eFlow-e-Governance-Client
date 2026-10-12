// @vitest-environment jsdom
import {useState} from 'react';
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({rpc:vi.fn(),session:vi.fn(),invitations:vi.fn()}));
vi.mock('../../src/lib/supabase',()=>({supabase:{rpc:api.rpc,auth:{getSession:api.session}}}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'actor'}})}));
vi.mock('../../src/app/features/project-invitations',()=>({ProjectInvitations:(props:any)=>{api.invitations(props);return <p>Scoped invitation requests</p>;}}));
import {WorkStaffingDialog,fetchWorkTree,type WorkStaffingController,type WorkTreeSnapshot,type WorkNode,type WorkCapabilityEntry} from '../../src/app/features/nested-work';
import {installNavigationConfirmation} from '../../src/app/shared/navigationGuard';
import {clearedStaffingAppointments,createStaffingRequest,scopedInvitationRequestAllowed,staffingNodePath} from '../../src/app/features/nested-work/selectors/staffing';
import type {StaffingBaseline} from '../../src/app/features/nested-work/selectors/staffing';
import {nestedWorkImpactFixture} from '../fixtures/nestedWorkImpact';

const allow:WorkCapabilityEntry={allowed:true,reason_code:null},deny:WorkCapabilityEntry={allowed:false,reason_code:'branch_denied'},noAppointment:WorkCapabilityEntry={allowed:false,reason_code:'appointment_denied'};
const node=(patch:Partial<WorkNode>={}):WorkNode=>({id:'branch',task_id:'root',parent_subtask_id:null,lead_id:'actor',title:'Parent branch',assigned_to_ids:['actor','member'],sibling_order:0,depth:1,due_date:null,is_standalone:true,status:'todo',percent_complete:0,can_manage:true,can_appoint:true,can_order:false,can_work:true,can_review:false,
 capabilities:{manage_contributors:allow,appoint_lead:noAppointment,create_child:allow,order_children:allow,edit_details:allow,move:allow,delete:allow,execute:allow,submit:allow,review:deny},...patch});
const tree=():WorkTreeSnapshot=>({root:{id:'root',project:'project',office:'office',kind:'office',lead:'actor',open:true,due:null,people:['actor','member'],capabilities:{manage_contributors:allow,appoint_lead:noAppointment,create_child:allow,order_children:allow}},revision:7,can_manage:true,can_transfer:true,
 nodes:[node(),node({id:'child',parent_subtask_id:'branch',depth:2,lead_id:'member',assigned_to_ids:['member'],title:'Child work',status:'for_review',current_reviewer:'actor'}),node({id:'completed',parent_subtask_id:'branch',depth:2,lead_id:'member',assigned_to_ids:['member'],title:'Completed child',status:'completed'}),node({id:'other',title:'Other branch',lead_id:'member',assigned_to_ids:['member']})],
 people:[{id:'actor',name:'Current Lead',eligible:true},{id:'member',name:'Existing Contributor',eligible:true},{id:'next',name:'Replacement Lead',eligible:true},{id:'expired',name:'Expired Person',eligible:false}],leaf_total:3,leaf_completed:1});
async function verified(data=tree(),actor='actor'){
 api.session.mockResolvedValue({data:{session:{user:{id:actor},access_token:'synthetic-session'}},error:null});api.rpc.mockImplementation(async(name,args)=>({data:name==='nw_work_impact'?nestedWorkImpactFixture(data,{revision:args.p_revision,command:args.p_command,payload:args.p_payload}):data,error:null}));return fetchWorkTree(data.root.id);
}
const controller=(data:WorkTreeSnapshot,save=vi.fn().mockResolvedValue(data))=>({rootId:'root',actorId:'actor',data,loading:false,save} satisfies WorkStaffingController);
const leadControl=()=>screen.getByRole('combobox',{name:'Appointed Lead'});
const saveButton=()=>screen.getByRole('button',{name:'Save work changes'});
async function acceptTransfer(){fireEvent.click(await screen.findByRole('button',{name:'Transfer Lead',exact:true}));}
const baseline:StaffingBaseline={actorId:'actor',rootId:'root',projectId:'project',officeId:'office',kind:'office',nodeId:null,revision:7,leadId:'actor',workerIds:['actor','member']};
beforeEach(()=>{sessionStorage.clear();vi.clearAllMocks();});afterEach(()=>cleanup());

describe('canonical staffing dialog capability and commands',()=>{
 it('lets a shared Task Lead edit contributors without enabling root transfer from legacy flags',async()=>{
  const data=await verified(),ctrl=controller(data),changed=vi.fn();render(<WorkStaffingDialog controller={ctrl} nodeId={null} onClose={vi.fn()} onChanged={changed}/>);
  expect((leadControl() as HTMLSelectElement).disabled).toBe(true);
  fireEvent.change(leadControl(),{target:{value:'next'}});expect((leadControl() as HTMLSelectElement).value).toBe('actor');
  fireEvent.click(screen.getByRole('button',{name:'Add contributor Replacement Lead'}));fireEvent.click(saveButton());
  await waitFor(()=>expect(ctrl.save).toHaveBeenCalledOnce());
  expect(ctrl.save.mock.calls[0][0]).toMatchObject({command:'contributors',revision:7,payload:{people:['actor','member','next']}});
  expect(changed).toHaveBeenCalledWith(data);expect(screen.queryByRole('alertdialog')).toBeNull();
 });
 it('lets an own Subitem Lead edit contributors but never replace itself',async()=>{
  const data=await verified(),ctrl=controller(data);render(<WorkStaffingDialog controller={ctrl} nodeId="branch" onClose={vi.fn()} onChanged={vi.fn()}/>);
  expect((leadControl() as HTMLSelectElement).disabled).toBe(true);fireEvent.click(screen.getByRole('button',{name:'Add contributor Replacement Lead'}));fireEvent.click(saveButton());
  await waitFor(()=>expect(ctrl.save).toHaveBeenCalledOnce());expect(ctrl.save.mock.calls[0][0]).toMatchObject({command:'staff',payload:{id:'branch',lead:'actor',people:['actor','member','next']}});
 });
 it('allows an eligible ancestor to transfer a descendant, discloses exact clearing and preserves workers',async()=>{
  const raw=tree();raw.nodes[0].capabilities!.appoint_lead=allow;const data=await verified(raw),ctrl=controller(data);render(<WorkStaffingDialog controller={ctrl} nodeId="branch" onClose={vi.fn()} onChanged={vi.fn()}/>);
  fireEvent.change(leadControl(),{target:{value:'next'}});fireEvent.click(saveButton());const impact=await screen.findByRole('alertdialog');
  expect(impact.textContent).toContain('2 descendant Lead appointments will be cleared');expect(impact.textContent).toContain('Parent branch / Child work · child');expect(impact.textContent).toContain('Completed work remains historical');
  expect(impact.textContent).toContain('Retained workers: Current Lead, Existing Contributor');expect(impact.textContent).toContain('Current reviewer: Current Lead');expect(impact.textContent).not.toContain('Other branch · other');expect(ctrl.save).not.toHaveBeenCalled();
  await acceptTransfer();await waitFor(()=>expect(ctrl.save).toHaveBeenCalledOnce());
  expect(ctrl.save.mock.calls[0][0]).toMatchObject({command:'staff',revision:7,payload:{id:'branch',lead:'next',people:['actor','member','next']}});
 });
 it('maps root Lead change to root_lead and includes compatibility workers, without identity fields',async()=>{
  const raw=tree();raw.root.capabilities!.appoint_lead=allow;const data=await verified(raw),ctrl=controller(data);render(<WorkStaffingDialog controller={ctrl} nodeId={null} onClose={vi.fn()} onChanged={vi.fn()}/>);
  fireEvent.change(leadControl(),{target:{value:'next'}});fireEvent.click(saveButton());
  expect((await screen.findByRole('alertdialog')).textContent).toContain('4 descendant Lead appointments will be cleared');await acceptTransfer();await waitFor(()=>expect(ctrl.save).toHaveBeenCalledOnce());
  expect(ctrl.save.mock.calls[0][0].payload).toEqual({lead:'next',people:['actor','member','next']});expect(ctrl.save.mock.calls[0][0].command).toBe('root_lead');
 });
 it('allows initial root appointment through appointment capability without contributor permission',async()=>{
  const raw=tree();raw.root.lead=null;raw.root.people=[];raw.root.capabilities={appoint_lead:allow,manage_contributors:{allowed:false,reason_code:'lifecycle_blocked'}};
  const ctrl=controller(await verified(raw));render(<WorkStaffingDialog controller={ctrl} nodeId={null} onClose={vi.fn()} onChanged={vi.fn()}/>);
  fireEvent.change(leadControl(),{target:{value:'next'}});fireEvent.click(saveButton());await acceptTransfer();await waitFor(()=>expect(ctrl.save).toHaveBeenCalledOnce());
  expect(ctrl.save.mock.calls[0][0]).toMatchObject({command:'root_lead',payload:{lead:'next',people:['next']}});
 });
 it('saves personal root appointment without inventing a team/worker payload',async()=>{
  const raw=tree();raw.root.kind='personal';raw.root.office=null;raw.root.capabilities={appoint_lead:allow,manage_contributors:{allowed:false,reason_code:'read_only'}};
  const ctrl=controller(await verified(raw));render(<WorkStaffingDialog controller={ctrl} nodeId={null} onClose={vi.fn()} onChanged={vi.fn()}/>);
  fireEvent.change(leadControl(),{target:{value:'next'}});fireEvent.click(saveButton());await acceptTransfer();await waitFor(()=>expect(ctrl.save).toHaveBeenCalledOnce());
  expect(ctrl.save.mock.calls[0][0].payload).toEqual({lead:'next'});
 });
 it('does not automatically retain an appointment-only historical Lead as a worker',async()=>{
  const raw=tree();raw.root.people=['member'];raw.root.capabilities!.appoint_lead=allow;const ctrl=controller(await verified(raw));
  render(<WorkStaffingDialog controller={ctrl} nodeId={null} onClose={vi.fn()} onChanged={vi.fn()}/>);fireEvent.change(leadControl(),{target:{value:'next'}});fireEvent.click(saveButton());await acceptTransfer();
  await waitFor(()=>expect(ctrl.save).toHaveBeenCalledOnce());expect(ctrl.save.mock.calls[0][0].payload).toEqual({lead:'next',people:['member','next']});
 });
 it.each(['absent maps','detached snapshot','readOnly'])('fails closed for %s despite legacy management flags',async mode=>{
  const raw=tree();if(mode==='absent maps')raw.root.capabilities=undefined;
  let data=await verified(raw);if(mode==='detached snapshot')data=structuredClone(data);
  const ctrl=controller(data);render(<WorkStaffingDialog controller={ctrl} nodeId={null} readOnly={mode==='readOnly'} onClose={vi.fn()} onChanged={vi.fn()}/>);
  expect((saveButton() as HTMLButtonElement).disabled).toBe(true);fireEvent.click(saveButton());expect(ctrl.save).not.toHaveBeenCalled();
 });
 it('excludes expired replacements and preserves named historical assignments until explicit removal',async()=>{
  const raw=tree();raw.root.people.push('expired');const ctrl=controller(await verified(raw));render(<WorkStaffingDialog controller={ctrl} nodeId={null} onClose={vi.fn()} onChanged={vi.fn()}/>);
  expect(screen.queryByRole('option',{name:'Expired Person'})).toBeNull();expect(screen.queryByRole('button',{name:'Add contributor Expired Person'})).toBeNull();
  expect((saveButton() as HTMLButtonElement).disabled).toBe(true);fireEvent.click(screen.getByRole('button',{name:'Remove contributor Expired Person'}));
  expect((saveButton() as HTMLButtonElement).disabled).toBe(false);
 });
 it('blocks a transfer that drops original workers even after explicit draft removal',async()=>{
  const raw=tree();raw.root.capabilities!.appoint_lead=allow;const ctrl=controller(await verified(raw));render(<WorkStaffingDialog controller={ctrl} nodeId={null} onClose={vi.fn()} onChanged={vi.fn()}/>);
  fireEvent.change(leadControl(),{target:{value:'next'}});fireEvent.click(screen.getByRole('button',{name:'Remove contributor Current Lead'}));
  expect(screen.getByRole('alert').textContent).toContain('Save contributor removals separately');fireEvent.click(saveButton());expect(ctrl.save).not.toHaveBeenCalled();
 });
 it('blocks removing a worker still assigned to unfinished descendants',async()=>{
  const ctrl=controller(await verified());render(<WorkStaffingDialog controller={ctrl} nodeId="branch" onClose={vi.fn()} onChanged={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button',{name:'Remove contributor Existing Contributor'}));expect(screen.getByRole('alert').textContent).toContain('Reassign unfinished descendant workers');
  fireEvent.click(saveButton());expect(ctrl.save).not.toHaveBeenCalled();
 });
});

describe('fresh authority, checked confirmation and request outcomes',()=>{
 it('retains values but disables save after a fresh revoked capability',async()=>{
  const ctrl=controller(await verified()),props={controller:ctrl,nodeId:null,onClose:vi.fn(),onChanged:vi.fn()};const view=render(<WorkStaffingDialog {...props}/>);
  fireEvent.click(screen.getByRole('button',{name:'Add contributor Replacement Lead'}));const raw=tree();raw.root.capabilities!.manage_contributors=deny;
  view.rerender(<WorkStaffingDialog {...props} controller={{...ctrl,data:await verified(raw)}}/>);
  expect(screen.getByRole('button',{name:'Remove contributor Replacement Lead'})).toBeTruthy();expect((saveButton() as HTMLButtonElement).disabled).toBe(true);fireEvent.click(saveButton());expect(ctrl.save).not.toHaveBeenCalled();
 });
 it('rejects a changed revision without silently rebaselining the draft',async()=>{
  const ctrl=controller(await verified()),props={controller:ctrl,nodeId:null,onClose:vi.fn(),onChanged:vi.fn()};const view=render(<WorkStaffingDialog {...props}/>);
  fireEvent.click(screen.getByRole('button',{name:'Add contributor Replacement Lead'}));const raw=tree();raw.revision=8;
  view.rerender(<WorkStaffingDialog {...props} controller={{...ctrl,data:await verified(raw)}}/>);
  expect(screen.getByRole('alert').textContent).toContain('Work changed');expect(screen.getByRole('button',{name:'Remove contributor Replacement Lead'})).toBeTruthy();expect(ctrl.save).not.toHaveBeenCalled();
 });
 it('cancels transfer confirmation with zero writes and retains draft fields',async()=>{
  const raw=tree();raw.root.capabilities!.appoint_lead=allow;const ctrl=controller(await verified(raw));render(<WorkStaffingDialog controller={ctrl} nodeId={null} onClose={vi.fn()} onChanged={vi.fn()}/>);
  fireEvent.change(leadControl(),{target:{value:'next'}});fireEvent.click(saveButton());const alert=await screen.findByRole('alertdialog');fireEvent.click(within(alert).getByRole('button',{name:'Cancel',exact:true}));
  await waitFor(()=>expect(screen.queryByRole('alertdialog')).toBeNull());expect((leadControl() as HTMLSelectElement).value).toBe('next');expect(ctrl.save).not.toHaveBeenCalled();
 });
 it('rechecks capability after confirmation and denies a revoked appointment without writes',async()=>{
  const raw=tree();raw.root.capabilities!.appoint_lead=allow;const ctrl=controller(await verified(raw)),props={controller:ctrl,nodeId:null,onClose:vi.fn(),onChanged:vi.fn()};const view=render(<WorkStaffingDialog {...props}/>);
  fireEvent.change(leadControl(),{target:{value:'next'}});fireEvent.click(saveButton());await screen.findByRole('alertdialog');
  view.rerender(<WorkStaffingDialog {...props} controller={{...ctrl,data:await verified(tree())}}/>);await acceptTransfer();await waitFor(()=>expect(screen.queryByRole('alertdialog')).toBeNull());
  expect(ctrl.save).not.toHaveBeenCalled();expect((leadControl() as HTMLSelectElement).value).toBe('next');
 });
 it('rejects current eligibility or impact changes while transfer confirmation is open',async()=>{
  const raw=tree();raw.root.capabilities!.appoint_lead=allow;const ctrl=controller(await verified(raw)),props={controller:ctrl,nodeId:null,onClose:vi.fn(),onChanged:vi.fn()};const view=render(<WorkStaffingDialog {...props}/>);
  fireEvent.change(leadControl(),{target:{value:'next'}});fireEvent.click(saveButton());await screen.findByRole('alertdialog');
  const refreshed=tree();refreshed.root.capabilities!.appoint_lead=allow;refreshed.nodes[1].current_reviewer='member';
  view.rerender(<WorkStaffingDialog {...props} controller={{...ctrl,data:await verified(refreshed)}}/>);await acceptTransfer();await screen.findByText(/changed during confirmation/);expect(ctrl.save).not.toHaveBeenCalled();
 });
 it('retains the identical request/payload/revision for uncertain retry and prevents double sends',async()=>{
  let reject:(reason:Error)=>void=()=>{};const save=vi.fn().mockImplementationOnce(()=>new Promise((_yes,no)=>{reject=no;})).mockResolvedValue(tree());
  const ctrl=controller(await verified(),save),changed=vi.fn();render(<WorkStaffingDialog controller={ctrl} nodeId={null} onClose={vi.fn()} onChanged={changed}/>);
  fireEvent.click(screen.getByRole('button',{name:'Add contributor Replacement Lead'}));const submit=saveButton();fireEvent.click(submit);fireEvent.click(submit);expect(save).toHaveBeenCalledOnce();
  await act(async()=>reject(new Error('Receipt interrupted')));await screen.findByText(/Receipt interrupted/);
  expect((leadControl() as HTMLSelectElement).disabled).toBe(true);fireEvent.click(screen.getByRole('button',{name:'Retry saved request'}));await waitFor(()=>expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls[1][0]).toBe(save.mock.calls[0][0]);expect(save.mock.calls[1][0].revision).toBe(7);expect(changed).toHaveBeenCalledOnce();
 });
 it('allows the same uncertain request receipt retry after a fresh revision advances',async()=>{
  const save=vi.fn().mockRejectedValueOnce(new Error('Receipt interrupted')).mockResolvedValue(tree()),ctrl=controller(await verified(),save),props={controller:ctrl,nodeId:null,onClose:vi.fn(),onChanged:vi.fn()};const view=render(<WorkStaffingDialog {...props}/>);
  fireEvent.click(screen.getByRole('button',{name:'Add contributor Replacement Lead'}));fireEvent.click(saveButton());await screen.findByText(/Receipt interrupted/);
  const raw=tree();raw.revision=8;raw.root.people.push('next');view.rerender(<WorkStaffingDialog {...props} controller={{...ctrl,data:await verified(raw)}}/>);
  fireEvent.click(screen.getByRole('button',{name:'Retry saved request'}));await waitFor(()=>expect(save).toHaveBeenCalledTimes(2));expect(save.mock.calls[1][0]).toBe(save.mock.calls[0][0]);
 });
 it('does not save a second time when a confirmed receipt is followed by refresh failure',async()=>{
  const ctrl=controller(await verified()),changed=vi.fn().mockRejectedValue(new Error('Refresh interrupted'));render(<WorkStaffingDialog controller={ctrl} nodeId={null} onClose={vi.fn()} onChanged={changed}/>);
  fireEvent.click(screen.getByRole('button',{name:'Add contributor Replacement Lead'}));fireEvent.click(saveButton());await screen.findByText(/People were saved, but/);
  expect(screen.getByText('People saved.')).toBeTruthy();expect(screen.queryByRole('button',{name:'Retry saved request'})).toBeNull();expect(ctrl.save).toHaveBeenCalledOnce();
 });
 it('blocks an expired replacement discovered during transfer confirmation',async()=>{
  const raw=tree();raw.root.capabilities!.appoint_lead=allow;const ctrl=controller(await verified(raw)),props={controller:ctrl,nodeId:null,onClose:vi.fn(),onChanged:vi.fn()};const view=render(<WorkStaffingDialog {...props}/>);
  fireEvent.change(leadControl(),{target:{value:'next'}});fireEvent.click(saveButton());await screen.findByRole('alertdialog');
  const expired=tree();expired.root.capabilities!.appoint_lead=allow;expired.people[2].eligible=false;view.rerender(<WorkStaffingDialog {...props} controller={{...ctrl,data:await verified(expired)}}/>);
  await acceptTransfer();await waitFor(()=>expect(screen.queryByRole('alertdialog')).toBeNull());expect(ctrl.save).not.toHaveBeenCalled();expect((leadControl() as HTMLSelectElement).value).toBe('next');
 });
 it('does not reinterpret a pending save response after actor scope changes',async()=>{
  let resolve:(data:WorkTreeSnapshot)=>void=()=>{};const save=vi.fn().mockImplementation(()=>new Promise(yes=>{resolve=yes;})),ctrl=controller(await verified(),save),changed=vi.fn(),props={controller:ctrl,nodeId:null,onClose:vi.fn(),onChanged:changed};
  const view=render(<WorkStaffingDialog {...props}/>);fireEvent.click(screen.getByRole('button',{name:'Add contributor Replacement Lead'}));fireEvent.click(saveButton());
  const other=await verified(tree(),'other');view.rerender(<WorkStaffingDialog {...props} controller={{...ctrl,actorId:'other',data:other}}/>);
  await act(async()=>resolve(tree()));expect(changed).not.toHaveBeenCalled();expect(save).toHaveBeenCalledOnce();
 });
 it('prevents Escape/close while an operation is pending',async()=>{
  let resolve:(data:WorkTreeSnapshot)=>void=()=>{};const save=vi.fn().mockImplementation(()=>new Promise(yes=>{resolve=yes;})),ctrl=controller(await verified(),save),close=vi.fn();
  render(<WorkStaffingDialog controller={ctrl} nodeId={null} onClose={close} onChanged={vi.fn()}/>);fireEvent.click(screen.getByRole('button',{name:'Add contributor Replacement Lead'}));fireEvent.click(saveButton());
  fireEvent.keyDown(screen.getByRole('dialog'),{key:'Escape'});fireEvent.click(screen.getByRole('button',{name:'Cancel changes'}));expect(close).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:'Close'})).toBeNull();
  await act(async()=>resolve(tree()));
 });
 it('keeps a dirty draft on canceled dismissal, then closes once with zero writes',async()=>{
  const ctrl=controller(await verified()),close=vi.fn(),confirm=vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true),uninstall=installNavigationConfirmation(confirm);
  try{
   render(<WorkStaffingDialog controller={ctrl} nodeId={null} onClose={close} onChanged={vi.fn()}/>);fireEvent.click(screen.getByRole('button',{name:'Add contributor Replacement Lead'}));
   fireEvent.click(screen.getByRole('button',{name:'Cancel changes'}));await waitFor(()=>expect(confirm).toHaveBeenCalledOnce());expect(close).not.toHaveBeenCalled();
   expect(screen.getByRole('button',{name:'Remove contributor Replacement Lead'})).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Cancel changes'}));await waitFor(()=>expect(close).toHaveBeenCalledOnce());expect(ctrl.save).not.toHaveBeenCalled();
  }finally{uninstall();}
 });
 it('restores focus to the opener after clean dismissal',async()=>{
  const data=await verified(),close=vi.fn();function Host(){const [open,setOpen]=useState(false);return <><button onClick={()=>setOpen(true)}>Open staffing</button>{open&&<WorkStaffingDialog controller={controller(data)} nodeId={null} onClose={()=>{close();setOpen(false);}} onChanged={vi.fn()}/>}</>;}
  render(<Host/>);const opener=screen.getByRole('button',{name:'Open staffing'});opener.focus();fireEvent.click(opener);await screen.findByRole('dialog');fireEvent.click(screen.getByRole('button',{name:'Cancel changes'}));await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());expect(document.activeElement).toBe(opener);
 });
});

describe('staffing selectors and invitation separation',()=>{
 it('keeps request-only server authority separate from staffing permission',async()=>{
  const raw=tree();raw.can_manage=false;const data=await verified(raw),context={actorId:'actor',rootId:'root',projectId:'project',officeId:'office',kind:'office' as const,revision:7};
  expect(scopedInvitationRequestAllowed(data,null,context)).toBe(false);
  const ctrl=controller(data);render(<WorkStaffingDialog controller={ctrl} nodeId={null} onClose={vi.fn()} onChanged={vi.fn()}/>);
  expect((saveButton() as HTMLButtonElement).disabled).toBe(false);expect(api.invitations.mock.calls[api.invitations.mock.calls.length-1]?.[0].canRequest).toBe(false);
 });
 it('preserves existing scoped R8 requests without ever passing approval/dispatch permission',async()=>{
  const data=await verified();render(<WorkStaffingDialog controller={controller(data)} nodeId="branch" onClose={vi.fn()} onChanged={vi.fn()}/>);
  expect(api.invitations.mock.calls[api.invitations.mock.calls.length-1]?.[0]).toEqual({project:'project',office:'office',root:'root',node:'branch',canRequest:true});
 });
 it('does not render invitation actions in a read-only staffing dialog',async()=>{
  render(<WorkStaffingDialog controller={controller(await verified())} nodeId={null} readOnly onClose={vi.fn()} onChanged={vi.fn()}/>);expect(api.invitations).not.toHaveBeenCalled();
 });
 it('clears only descendant appointments and bounds missing/cyclic path display',()=>{
  const data=tree();expect(clearedStaffingAppointments(data,'branch').map(node=>node.id)).toEqual(['child','completed']);
  expect(staffingNodePath(data,'child')).toBe('Parent branch / Child work');data.nodes[0].parent_subtask_id='child';expect(staffingNodePath(data,'child')).toBe('Parent branch / Child work');expect(staffingNodePath(data,'missing')).toBe('');
 });
 it('creates exact canonical command payloads with distinct stable request IDs',()=>{
  const first=createStaffingRequest(baseline,'next',['actor','member']),second=createStaffingRequest(baseline,'next',['actor','member']);
  expect(first.id).not.toBe(second.id);expect(first).toMatchObject({revision:7,command:'root_lead',payload:{lead:'next',people:['actor','member','next']}});
 });
});
