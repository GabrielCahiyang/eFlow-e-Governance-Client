// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({rpc:vi.fn(),session:vi.fn(),actor:'actor'}));
vi.mock('../../src/lib/supabase',()=>({supabase:{rpc:api.rpc,auth:{getSession:api.session}}}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:api.actor}})}));
vi.mock('../../src/app/features/project-invitations',()=>({ProjectInvitations:()=>null}));
import {WorkTreeEditor} from '../../src/app/features/nested-work/components/WorkTreeEditor';
import {WorkStaffingDialog} from '../../src/app/features/nested-work/components/WorkStaffingDialog';
import {fetchWorkTree,saveWorkTree} from '../../src/app/features/nested-work/services/workTreeService';
import {rememberWorkCapabilityContext} from '../../src/app/features/nested-work/selectors/capabilities';
import {nestedWorkImpactFixture} from '../fixtures/nestedWorkImpact';
import type {WorkImpact,WorkNode,WorkRequest,WorkTreeSnapshot} from '../../src/app/features/nested-work/types';
import type {WorkEdit} from '../../src/app/features/nested-work/types/editor';
const allow={allowed:true,reason_code:null} as const;
function tree():WorkTreeSnapshot {
 const node=(id:string,title:string,parent:string|null=null):WorkNode=>({id,title,task_id:'root',parent_subtask_id:parent,lead_id:'actor',assigned_to_ids:['actor'],sibling_order:0,depth:parent?2:1,due_date:'2026-12-01',is_standalone:false,status:'todo',percent_complete:0,can_manage:true,can_appoint:true,can_order:true,can_work:true,can_review:true,capabilities:{create_child:allow,order_children:allow,edit_details:allow,move:allow,delete:allow,execute:allow,submit:allow,review:allow,manage_contributors:allow,appoint_lead:allow}});
 return {root:{id:'root',project:'project',office:'office',kind:'office',lead:'actor',people:['actor','worker'],open:true,due:'2026-12-31',capabilities:{create_child:allow,order_children:allow,appoint_lead:allow,manage_contributors:allow}},revision:7,can_manage:true,can_transfer:true,
  nodes:[node('source','Source'),node('child','Child','source'),{...node('destination','Destination'),sibling_order:1},{...node('sibling','Sibling'),sibling_order:2},{...node('denied','Other branch'),sibling_order:3}],
  people:[{id:'actor',name:'Current Lead',eligible:true},{id:'worker',name:'Worker',eligible:true},{id:'next',name:'New Lead',eligible:true},{id:'expired',name:'Expired',eligible:false}],leaf_total:4,leaf_completed:0};
}
let data:WorkTreeSnapshot,previewPatch:Partial<WorkImpact>,lost:boolean;
const writes=()=>api.rpc.mock.calls.filter(([name])=>['r7_work_command','nw_work_command'].includes(name));
const previews=()=>api.rpc.mock.calls.filter(([name])=>name==='nw_work_impact');
beforeEach(async()=>{
 sessionStorage.clear();vi.resetAllMocks();api.actor='actor';data=tree();previewPatch={};lost=false;
 data.nodes[4].capabilities!.create_child={allowed:false,reason_code:'branch_denied'};
 api.session.mockResolvedValue({data:{session:{user:{id:'actor'},access_token:'synthetic'}},error:null});
 api.rpc.mockImplementation(async(name,args)=>{
  if(name==='nw_work_impact')return {data:nestedWorkImpactFixture(data,{revision:args.p_revision,command:args.p_command,payload:args.p_payload},previewPatch),error:null};
  if(name==='nw_work_command'&&lost){lost=false;return {data:null,error:{code:'XX000',message:'Committed response lost'}};}
  return {data,error:null};
 });
 data=await fetchWorkTree('root');
});
afterEach(cleanup);
function open(command:WorkEdit['command'],patch:Partial<WorkEdit>={}){
 const props={data,edit:{command,node:['create','order'].includes(command)?undefined:data.nodes[0],...patch},save:(request:WorkRequest)=>saveWorkTree('root',request),onDone:vi.fn(),onCancel:vi.fn()};
 return {props,view:render(<WorkTreeEditor {...props}/>)};
}
const save=()=>fireEvent.click(screen.getByRole('button',{name:'Save work changes'}));
async function accept(name='Confirm changes'){fireEvent.click(await screen.findByRole('button',{name,exact:true}));}
describe('NW5.5 lightweight forms and authoritative confirmation',()=>{
 it('checks a server-classified routine date without an extra confirmation',async()=>{
  open('edit');fireEvent.change(screen.getByLabelText('Subitem due date'),{target:{value:'2026-12-02'}});save();await waitFor(()=>expect(writes()).toHaveLength(1));expect(previews()).toHaveLength(1);expect(screen.queryByRole('alertdialog')).toBeNull();expect(writes()[0][0]).toBe('nw_work_command');expect(writes()[0][1].p_impact_fingerprint).toBe('synthetic-checked-impact');
 });
 it('discloses material date bounds and recorded commitments before checked saving',async()=>{
  previewPatch={requires_date_confirmation:true,date_impact:{old_due:'2026-12-01',new_due:'2026-12-02',items:[{id:'child',path:['Source','Child'],old_bound:'2026-12-01',new_bound:'2026-12-02',bound_changed:true,history_counts:{evidence:1}}]}};
  open('edit');fireEvent.change(screen.getByLabelText('Subitem due date'),{target:{value:'2026-12-02'}});save();const dialog=await screen.findByRole('alertdialog');expect(dialog.textContent).toContain('Due date: 2026-12-01 → 2026-12-02');expect(dialog.textContent).toContain('Source / Child');expect(dialog.textContent).toContain('Recorded work or commitments require review');expect(writes()).toHaveLength(0);await accept();await waitFor(()=>expect(writes()).toHaveLength(1));expect(writes()[0][0]).toBe('nw_work_command');
 });
 it('keeps a material date draft on cancellation without issuing a write',async()=>{
  previewPatch={requires_date_confirmation:true};open('edit');fireEvent.change(screen.getByLabelText('Subitem due date'),{target:{value:'2026-12-02'}});save();const dialog=await screen.findByRole('alertdialog');fireEvent.click(within(dialog).getByRole('button',{name:'Cancel',exact:true}));await waitFor(()=>expect(screen.queryByRole('alertdialog')).toBeNull());expect(writes()).toHaveLength(0);expect((screen.getByLabelText('Subitem due date') as HTMLInputElement).value).toBe('2026-12-02');
 });
 it('fails closed when an older server cannot classify a date change',async()=>{
  previewPatch={requires_date_confirmation:undefined,date_impact:undefined};open('edit');fireEvent.change(screen.getByLabelText('Subitem due date'),{target:{value:'2026-12-02'}});save();await screen.findByText(/Date impact confirmation is not installed/);expect(writes()).toHaveLength(0);
 });
 it('does not skip mode confirmation when a combined date is routine',async()=>{
  open('edit');fireEvent.change(screen.getByLabelText('Subitem due date'),{target:{value:'2026-12-02'}});fireEvent.change(screen.getByLabelText('Execution mode'),{target:{value:'independent'}});save();await screen.findByRole('alertdialog');expect(writes()).toHaveLength(0);await accept();await waitFor(()=>expect(writes()).toHaveLength(1));expect(writes()[0][0]).toBe('nw_work_command');
 });
 it('never downgrades a routine date after hidden history invalidates the checked write',async()=>{
  api.rpc.mockImplementation(async(name,args)=>name==='nw_work_impact'?{data:nestedWorkImpactFixture(data,{revision:args.p_revision,command:args.p_command,payload:args.p_payload}),error:null}:{data:null,error:{code:'40001',message:'Work impact changed; review affected work'}});
  open('edit');fireEvent.change(screen.getByLabelText('Subitem due date'),{target:{value:'2026-12-02'}});save();await screen.findByText(/Work impact changed; review affected work/);expect(writes()).toHaveLength(1);expect(writes()[0][0]).toBe('nw_work_command');expect(previews()).toHaveLength(1);
 });
 it('keeps initial execution mode and optional eligible staffing in the advanced create draft',async()=>{
  open('create');expect(screen.getByLabelText('Execution mode')).toBeTruthy();expect(screen.getByRole('option',{name:'In sequence'})).toBeTruthy();expect(screen.getByRole('option',{name:'Can start independently'})).toBeTruthy();
  expect(screen.getByText('Advanced: Lead and contributors (optional)').closest('details')?.hasAttribute('open')).toBe(false);fireEvent.click(screen.getByText('Advanced: Lead and contributors (optional)'));
  expect(screen.queryByRole('option',{name:'Expired'})).toBeNull();fireEvent.change(screen.getByLabelText('Subitem title'),{target:{value:'Created'}});fireEvent.change(screen.getByLabelText('Execution mode'),{target:{value:'independent'}});save();
  await waitFor(()=>expect(writes()).toHaveLength(1));expect(writes()[0][0]).toBe('r7_work_command');expect(writes()[0][1].p_payload).toMatchObject({title:'Created',standalone:true,lead:null,people:[]});expect(previews()).toHaveLength(0);
 });
 it.each(['edit','progress','submit','review'] as const)('does not add impact prompts to routine %s',async command=>{
  data.root.kind='personal';data.root.office=null;rememberWorkCapabilityContext(data,'actor');open(command);
  if(command==='edit')fireEvent.change(screen.getByLabelText('Subitem title'),{target:{value:'Rename'}});
  else if(command==='progress')fireEvent.change(screen.getByLabelText('Progress'),{target:{value:'25'}});
  else if(command==='review')fireEvent.change(screen.getByLabelText('Decision'),{target:{value:'approve'}});
  save();await waitFor(()=>expect(writes()).toHaveLength(1));expect(writes()[0][0]).toBe('r7_work_command');expect(previews()).toHaveLength(0);expect(screen.queryByRole('alertdialog')).toBeNull();
 });
 it('preserves an existing empty date during a title-only rename',async()=>{
  data.root.kind='personal';data.root.office=null;data.nodes[0].due_date=null;rememberWorkCapabilityContext(data,'actor');open('edit');expect((screen.getByLabelText('Subitem due date') as HTMLInputElement).value).toBe('');fireEvent.change(screen.getByLabelText('Subitem title'),{target:{value:'Renamed'}});save();await waitFor(()=>expect(writes()).toHaveLength(1));expect(writes()[0][1].p_payload.due).toBeNull();expect(previews()).toHaveLength(0);
 });
 it('shows only authorized safe destinations as readable paths and confirms exact move terms',async()=>{
  open('move');const select=screen.getByLabelText('Destination parent');expect(within(select).queryByRole('option',{name:'Other branch'})).toBeNull();expect(within(select).queryByRole('option',{name:'Source / Child'})).toBeNull();expect(within(select).getByRole('option',{name:'This task'})).toBeTruthy();
  fireEvent.change(select,{target:{value:'destination'}});save();const dialog=await screen.findByRole('alertdialog');expect(writes()).toHaveLength(0);expect(dialog.textContent).toContain('subitems in the selected scope');await accept();
  await waitFor(()=>expect(writes()).toHaveLength(1));expect(writes()[0]).toEqual(['nw_work_command',expect.objectContaining({p_command:'move',p_revision:7,p_payload:{id:'source',parent:'destination'},p_impact_fingerprint:'synthetic-checked-impact'})]);
  expect(previews()[0][1].p_payload).toEqual(writes()[0][1].p_payload);
 });
 it('preserves the complete sibling list and labelled move controls',async()=>{
  open('order');const list=screen.getByRole('list',{name:'Subitem sequence'});expect(within(list).getAllByRole('listitem')).toHaveLength(4);expect((screen.getByRole('button',{name:'Move up Source'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Move down Source'}));save();await accept();await waitFor(()=>expect(writes()).toHaveLength(1));expect(writes()[0][1].p_payload.order).toEqual(['destination','source','sibling','denied']);expect(writes()[0][1].p_payload.parent).toBeNull();
 });
 it('requires a checked review of changed execution mode with sequential consequences',async()=>{
  open('edit');fireEvent.change(screen.getByLabelText('Execution mode'),{target:{value:'independent'}});save();const dialog=await screen.findByRole('alertdialog');expect(dialog.textContent).toContain('In sequence → Can start independently');expect(writes()).toHaveLength(0);await accept();await waitFor(()=>expect(writes()).toHaveLength(1));expect(writes()[0][0]).toBe('nw_work_command');
 });
 it('uses server subtree counts and danger confirmation for deletion',async()=>{
  previewPatch={selected_count:8,descendant_count:7};open('delete');fireEvent.click(screen.getByRole('button',{name:'Review deletion'}));const dialog=await screen.findByRole('alertdialog');expect(dialog.textContent).toContain('8 subitems in the selected scope; 7 are child subitems');expect(writes()).toHaveLength(0);await accept('Delete subtree');await waitFor(()=>expect(writes()).toHaveLength(1));expect(writes()[0][1]).toMatchObject({p_command:'delete',p_payload:{id:'source'},p_impact_fingerprint:'synthetic-checked-impact'});
 });
 it('cancels impact review without sending a command or losing the draft',async()=>{
  open('edit');fireEvent.change(screen.getByLabelText('Execution mode'),{target:{value:'independent'}});save();const dialog=await screen.findByRole('alertdialog');fireEvent.click(within(dialog).getByRole('button',{name:'Cancel',exact:true}));await waitFor(()=>expect(screen.queryByRole('alertdialog')).toBeNull());expect(writes()).toHaveLength(0);expect((screen.getByLabelText('Execution mode') as HTMLSelectElement).value).toBe('independent');
 });
 it('shows denied preview blockers without permitting deletion',async()=>{
  previewPatch={allowed:false,blocker_codes:['history_blocked'],selected_count:2,descendant_count:1};open('delete');fireEvent.click(screen.getByRole('button',{name:'Review deletion'}));const dialog=await screen.findByRole('alertdialog');expect((within(dialog).getByRole('button',{name:'Delete subtree'}) as HTMLButtonElement).disabled).toBe(true);expect(dialog.textContent).toContain('financial commitments');fireEvent.click(within(dialog).getByRole('button',{name:'Cancel',exact:true}));expect(writes()).toHaveLength(0);
 });
 it.each(['PGRST202','42501'])('never falls back when preview fails with %s',async code=>{
  api.rpc.mockImplementation(async()=>({data:null,error:{code,message:'Preview unavailable'}}));open('move');save();await screen.findByText(code==='PGRST202'?/Work impact confirmation is not installed/:/Preview unavailable/);expect(writes()).toHaveLength(0);expect(screen.queryByRole('alertdialog')).toBeNull();
 });
 it('rejects an already stale preview before displaying a confirm action',async()=>{
  previewPatch={current_revision:8};open('move');save();await screen.findByText(/Work changed. Reload/);expect(writes()).toHaveLength(0);expect(screen.queryByRole('alertdialog')).toBeNull();
 });
 it('blocks a revoked scope during an open confirmation',async()=>{
  const {props,view}=open('move');save();await screen.findByRole('alertdialog');const revoked=tree();revoked.nodes[0].capabilities!.move={allowed:false,reason_code:'branch_denied'};rememberWorkCapabilityContext(revoked,'actor');view.rerender(<WorkTreeEditor {...props} data={revoked}/>);await accept();await screen.findByText(/changed during confirmation/);expect(writes()).toHaveLength(0);
 });
 it('does not display a late preview after actor change',async()=>{
  let resolve!:(result:unknown)=>void;api.rpc.mockImplementationOnce(()=>new Promise(yes=>{resolve=yes;}));const {props,view}=open('move');save();await waitFor(()=>expect(previews()).toHaveLength(1));api.actor='other';view.rerender(<WorkTreeEditor {...props}/>);
  await act(async()=>resolve({data:nestedWorkImpactFixture(data,{revision:7,command:'move',payload:{id:'source',parent:null}}),error:null}));expect(screen.queryByRole('alertdialog')).toBeNull();expect(writes()).toHaveLength(0);
 });
 it('retries a lost checked result with identical terms without another preview or confirmation',async()=>{
  lost=true;const {props,view}=open('move');save();await accept();await screen.findByText(/Committed response lost/);expect(writes()).toHaveLength(1);const refreshed={...data,revision:8};rememberWorkCapabilityContext(refreshed,'actor');view.rerender(<WorkTreeEditor {...props} data={refreshed}/>);
  fireEvent.click(screen.getByRole('button',{name:'Retry saved request'}));await waitFor(()=>expect(writes()).toHaveLength(2));expect(writes()[1]).toEqual(writes()[0]);expect(previews()).toHaveLength(1);expect(screen.queryByRole('alertdialog')).toBeNull();
 });
 it('never downgrades an accepted confirmation after checked RPC denial',async()=>{
  open('move');save();await screen.findByRole('alertdialog');api.rpc.mockResolvedValue({data:null,error:{code:'23514',message:'History changed after preview'}});await accept();await screen.findByText(/History changed after preview/);expect(writes()).toHaveLength(1);expect(writes()[0][0]).toBe('nw_work_command');
 });
 it('reviews contributor removal separately and preserves the checked request on uncertain retry',async()=>{
  data.nodes=[];rememberWorkCapabilityContext(data,'actor');let count=0;const savePeople=vi.fn().mockImplementation(async request=>{if(count++===0)throw new Error('Lost people receipt');return data;});
  render(<WorkStaffingDialog controller={{rootId:'root',actorId:'actor',data,loading:false,save:savePeople}} nodeId={null} onChanged={vi.fn()} onClose={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button',{name:'Remove contributor Worker'}));fireEvent.click(screen.getByRole('button',{name:'Save changes',exact:true}));const dialog=await screen.findByRole('alertdialog');expect(dialog.textContent).toContain('Remove contributors?');expect(dialog.textContent).toContain('Worker');expect(savePeople).not.toHaveBeenCalled();await accept('Remove contributors');await screen.findByText(/Lost people receipt/);fireEvent.click(screen.getByRole('button',{name:'Try again',exact:true}));await waitFor(()=>expect(savePeople).toHaveBeenCalledTimes(2));expect(savePeople.mock.calls[1][0]).toBe(savePeople.mock.calls[0][0]);expect(savePeople.mock.calls[0][0].impactFingerprint).toBe('synthetic-checked-impact');expect(previews()).toHaveLength(1);
 });
});
