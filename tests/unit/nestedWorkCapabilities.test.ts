import {beforeEach,describe,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({rpc:vi.fn(),session:vi.fn()}));
vi.mock('../../src/lib/supabase',()=>({supabase:{rpc:api.rpc,auth:{getSession:api.session}}}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'lead'}})}));
import {fetchWorkTree,saveWorkTree,WorkTreeUnavailable,selectRootWorkCapability,selectNodeWorkCapability} from '../../src/app/features/nested-work';
import type {WorkCapabilityContext,WorkCapabilityEntry,WorkCapabilityReasonCode,WorkNode,WorkRequest,WorkTreeSnapshot} from '../../src/app/features/nested-work';

const allow:WorkCapabilityEntry={allowed:true,reason_code:null};
const deny=(reason_code:WorkCapabilityReasonCode):WorkCapabilityEntry=>({allowed:false,reason_code});
const context=(patch:Partial<WorkCapabilityContext>={}):WorkCapabilityContext=>({actorId:'lead',rootId:'root',projectId:'project',officeId:'office',kind:'office',revision:7,...patch});
const node=(patch:Partial<WorkNode>={}):WorkNode=>({id:'branch',task_id:'root',parent_subtask_id:null,lead_id:'lead',title:'Branch',assigned_to_ids:['other'],sibling_order:0,depth:1,due_date:null,is_standalone:true,status:'todo',percent_complete:0,can_manage:true,can_appoint:true,can_order:true,can_work:true,can_review:true,capabilities:{manage_contributors:allow,appoint_lead:deny('appointment_denied'),create_child:allow,edit_details:allow,move:allow,order_children:allow,delete:allow,execute:allow,submit:allow,review:deny('branch_denied')},...patch});
const tree=():WorkTreeSnapshot=>({root:{id:'root',project:'project',office:'office',lead:'lead',kind:'office',open:true,due:null,people:['lead'],capabilities:{manage_contributors:allow,appoint_lead:deny('appointment_denied'),create_child:allow,order_children:allow}},revision:7,can_manage:true,can_transfer:true,nodes:[node()],people:[],leaf_total:1,leaf_completed:0});
const session=(actor='lead',token='synthetic-token')=>({data:{session:{user:{id:actor},access_token:token}},error:null});
async function loaded(data=tree()) {api.rpc.mockResolvedValueOnce({data,error:null});return fetchWorkTree(data.root.id);}
const unavailable={allowed:false,reason_code:'capability_unavailable',disabledReason:'Action availability could not be verified. Reload the work.'};
beforeEach(()=>{vi.resetAllMocks();api.session.mockResolvedValue(session());});

describe('current per-action capability adapter',()=>{
 it('keeps own appointment denied despite own Lead management and legacy flags',async()=>{
  const data=await loaded();expect(selectNodeWorkCapability(data,'branch','manage_contributors',context()).allowed).toBe(true);
  expect(selectNodeWorkCapability(data,'branch','appoint_lead',context())).toEqual({allowed:false,reason_code:'appointment_denied',disabledReason:'You do not have permission to appoint this Lead.'});
 });
 it('allows contributor-list root editing without granting root Lead transfer',async()=>{
  const data=await loaded();expect(selectRootWorkCapability(data,'manage_contributors',context()).allowed).toBe(true);
  expect(selectRootWorkCapability(data,'appoint_lead',context()).reason_code).toBe('appointment_denied');
 });
 it('gives Head oversight only the specific server actions and no execution',async()=>{
  api.session.mockResolvedValue(session('head'));const response=tree();response.root.capabilities!.appoint_lead=allow;
  response.nodes[0].capabilities={manage_contributors:allow,appoint_lead:allow,execute:deny('branch_denied'),review:allow};
  const data=await loaded(response),current=context({actorId:'head'});
  expect(selectRootWorkCapability(data,'appoint_lead',current).allowed).toBe(true);
  expect(selectNodeWorkCapability(data,'branch','manage_contributors',current).allowed).toBe(true);
  expect(selectNodeWorkCapability(data,'branch','execute',current).allowed).toBe(false);
  expect(selectNodeWorkCapability(data,'branch','review',current).allowed).toBe(true);
 });
 it('keeps branch management separate from ancestor/sibling authority and execution',async()=>{
  const response=tree();response.nodes.push(node({id:'ancestor',lead_id:'ancestor-lead',capabilities:{manage_contributors:deny('branch_denied'),execute:deny('branch_denied')}}),node({id:'sibling',lead_id:'sibling-lead',capabilities:{manage_contributors:deny('branch_denied'),execute:deny('branch_denied')}}));
  const data=await loaded(response);
  expect(selectNodeWorkCapability(data,'branch','manage_contributors',context()).allowed).toBe(true);
  for(const id of ['ancestor','sibling'])for(const action of ['manage_contributors','execute'] as const)expect(selectNodeWorkCapability(data,id,action,context()).reason_code).toBe('branch_denied');
 });
 it('allows own Lead execution without inferring from workers or management',async()=>{
  const response=tree();Object.assign(response.nodes[0],{can_manage:false,can_work:false,assigned_to_ids:[]});
  const data=await loaded(response);expect(selectNodeWorkCapability(data,'branch','execute',context())).toEqual({allowed:true,reason_code:null,disabledReason:null});
 });
 it('keeps execute, submit and review independent for workers and reviewers',async()=>{
  const data=await loaded();expect(selectNodeWorkCapability(data,'branch','execute',context()).allowed).toBe(true);
  expect(selectNodeWorkCapability(data,'branch','review',context()).allowed).toBe(false);
  const reviewed=tree();reviewed.nodes[0].capabilities={execute:deny('lifecycle_blocked'),submit:deny('branch_denied'),review:allow};
  const next=await loaded(reviewed);expect(selectNodeWorkCapability(next,'branch','execute',context()).allowed).toBe(false);
  expect(selectNodeWorkCapability(next,'branch','submit',context()).allowed).toBe(false);
  expect(selectNodeWorkCapability(next,'branch','review',context()).allowed).toBe(true);
 });
 it('lets readOnly override root, management, execution and review actions',async()=>{
  const response=tree();response.nodes[0].capabilities!.review=allow;const data=await loaded(response),current=context({readOnly:true});
  expect(selectRootWorkCapability(data,'manage_contributors',current).reason_code).toBe('read_only');
  for(const action of ['manage_contributors','execute','submit','review'] as const)expect(selectNodeWorkCapability(data,'branch',action,current).reason_code).toBe('read_only');
 });
 it('limits executionBlocked to execute and submit, retaining management/review',async()=>{
  const response=tree();response.nodes[0].capabilities!.review=allow;const data=await loaded(response),current=context({executionBlocked:true});
  for(const action of ['execute','submit'] as const)expect(selectNodeWorkCapability(data,'branch',action,current).reason_code).toBe('lifecycle_blocked');
  expect(selectNodeWorkCapability(data,'branch','review',current).allowed).toBe(true);
  expect(selectNodeWorkCapability(data,'branch','manage_contributors',current).allowed).toBe(true);
  expect(selectRootWorkCapability(data,'create_child',current).allowed).toBe(true);
 });
 it('treats order_children as that parent child list, never a sibling flag',async()=>{
  const response=tree();response.nodes[0].can_order=true;response.nodes[0].capabilities!.order_children=deny('branch_denied');
  const data=await loaded(response);expect(selectRootWorkCapability(data,'order_children',context()).allowed).toBe(true);
  expect(selectNodeWorkCapability(data,'branch','order_children',context()).allowed).toBe(false);
 });
 it.each(['access_unavailable','read_only','branch_denied','appointment_denied','lifecycle_blocked','history_blocked'] as const)('maps server %s to nonempty user copy',async reason=>{
  const response=tree();response.nodes[0].capabilities!.delete=deny(reason);const data=await loaded(response),result=selectNodeWorkCapability(data,'branch','delete',context());
  expect(result.allowed).toBe(false);expect(result.reason_code).toBe(reason);expect(result.disabledReason).toMatch(/\S/);
 });
 it('fails closed on absent maps/actions with positive broad legacy flags',async()=>{
  const response=tree();delete response.root.capabilities;response.nodes[0].capabilities={};
  const data=await loaded(response);expect(selectRootWorkCapability(data,'create_child',context())).toEqual(unavailable);
  expect(selectNodeWorkCapability(data,'branch','execute',context())).toEqual(unavailable);
  delete data.nodes[0].capabilities;expect(selectNodeWorkCapability(data,'branch','execute',context())).toEqual(unavailable);
 });
 it.each([null,[],true,{allowed:true},{allowed:'true',reason_code:null},{allowed:true,reason_code:'branch_denied'},{allowed:false,reason_code:null},{allowed:false,reason_code:'new_server_code'},Object.create({allowed:true,reason_code:null})])('rejects unverifiable entry %#',async entry=>{
  const response=tree();response.nodes[0].capabilities!.execute=entry as WorkCapabilityEntry;
  expect(selectNodeWorkCapability(await loaded(response),'branch','execute',context())).toEqual(unavailable);
 });
 it('rejects inherited action entries and unsupported actions',async()=>{
  const response=tree();response.nodes[0].capabilities=Object.create({execute:allow});const data=await loaded(response);
  expect(selectNodeWorkCapability(data,'branch','execute',context())).toEqual(unavailable);
  expect(selectRootWorkCapability(data,'execute' as never,context())).toEqual(unavailable);
  expect(selectNodeWorkCapability(data,'branch','finance' as never,context())).toEqual(unavailable);
 });
 it.each([{actorId:'other'},{actorId:null},{rootId:'other'},{projectId:'other'},{officeId:'other'},{officeId:null},{kind:'personal' as const},{revision:8},{revision:NaN}])('rejects stale actor/scope/revision %#',async patch=>{
  const data=await loaded();expect(selectRootWorkCapability(data,'create_child',context(patch))).toEqual(unavailable);
  expect(selectNodeWorkCapability(data,'branch','execute',context(patch))).toEqual(unavailable);
 });
 it('does not authorize detached, cloned or undefined snapshots',async()=>{
  const data=await loaded();for(const snapshot of [undefined,tree(),structuredClone(data)])expect(selectRootWorkCapability(snapshot,'create_child',context())).toEqual(unavailable);
 });
 it('rejects foreign, missing or duplicated canonical nodes',async()=>{
  const response=tree();response.nodes.push(node({id:'foreign',task_id:'other'}),node({id:'duplicate'}),node({id:'duplicate'}));const data=await loaded(response);
  for(const id of ['missing','foreign','duplicate'])expect(selectNodeWorkCapability(data,id,'execute',context())).toEqual(unavailable);
 });
 it('does not crash or enable actions for malformed node records or maps',async()=>{
  const response=tree();response.nodes=[null,3,[]] as unknown as WorkNode[];const data=await loaded(response);
  expect(selectNodeWorkCapability(data,'branch','execute',context())).toEqual(unavailable);
  data.nodes=[node({capabilities:[] as never})];expect(selectNodeWorkCapability(data,'branch','execute',context())).toEqual(unavailable);
  data.root.capabilities=null as never;expect(selectRootWorkCapability(data,'create_child',context())).toEqual(unavailable);
 });
 it('rejects scope/revision fields mutated after the response was received',async()=>{
  const data=await loaded();data.root.office='other';expect(selectRootWorkCapability(data,'create_child',context({officeId:'other'}))).toEqual(unavailable);
  data.root.office='office';data.revision=8;expect(selectRootWorkCapability(data,'create_child',context({revision:8}))).toEqual(unavailable);
 });
 it('blocks closed roots and does not invent availability for malformed lifecycle',async()=>{
  const response=tree();response.root.open=false;const data=await loaded(response);
  expect(selectRootWorkCapability(data,'create_child',context()).reason_code).toBe('lifecycle_blocked');
  data.root.open=undefined as never;expect(selectRootWorkCapability(data,'create_child',context())).toEqual(unavailable);
 });
 it('accepts a verified personal scope without inferring Office permissions',async()=>{
  const response=tree();response.root.kind='personal';response.root.office=null;response.root.capabilities!.manage_contributors=deny('read_only');
  const data=await loaded(response),current=context({kind:'personal',officeId:null});
  expect(selectRootWorkCapability(data,'manage_contributors',current).reason_code).toBe('read_only');
  expect(selectNodeWorkCapability(data,'branch','execute',current).allowed).toBe(true);
 });
});

describe('service compatibility and request context',()=>{
 it('keeps the wire object, legacy fields and read RPC payload untouched',async()=>{
  const response=tree(),before=structuredClone(response),data=await loaded(response);
  expect(data).toBe(response);expect(data).toEqual(before);expect(api.rpc).toHaveBeenCalledExactlyOnceWith('r7_work_tree',{p_root:'root'});
 });
 it('marks real save receipts without changing request identity, payload or revision',async()=>{
  const response=tree(),request:WorkRequest={id:'stable-request',command:'contributors',payload:{people:['lead','other']},revision:6};api.rpc.mockResolvedValue({data:response,error:null});
  const data=await saveWorkTree('root',request);expect(data).toBe(response);
  expect(api.rpc).toHaveBeenCalledExactlyOnceWith('r7_work_command',{p_root:'root',p_revision:6,p_request:'stable-request',p_command:'contributors',p_payload:request.payload});
  expect(selectRootWorkCapability(data,'manage_contributors',context()).allowed).toBe(true);
 });
 it.each(['actor','token','signout'])('leaves a response unverifiable when %s changes during the RPC',async change=>{
  api.session.mockResolvedValueOnce(session()).mockResolvedValueOnce(change==='actor'?session('other'):change==='token'?session('lead','new-token'):{data:{session:null},error:null});
  const data=await loaded();expect(selectRootWorkCapability(data,'create_child',context())).toEqual(unavailable);
 });
 it.each(['error','throw','anonymous'])('preserves legacy reading while %s session context is unavailable',async mode=>{
  if(mode==='throw')api.session.mockRejectedValue(new Error('Context unavailable'));
  else api.session.mockResolvedValue(mode==='error'?{data:{session:null},error:{message:'Context unavailable'}}:{data:{session:null},error:null});
  const response=tree(),data=await loaded(response);expect(data).toBe(response);expect(selectNodeWorkCapability(data,'branch','execute',context())).toEqual(unavailable);
 });
 it('preserves missing-installation and access-denial errors without fallback authority',async()=>{
  api.rpc.mockResolvedValueOnce({data:null,error:{code:'PGRST202',message:'Missing'}});await expect(fetchWorkTree('root')).rejects.toBeInstanceOf(WorkTreeUnavailable);
  api.rpc.mockResolvedValueOnce({data:null,error:{code:'42501',message:'Access denied'}});await expect(fetchWorkTree('root')).rejects.toThrow('Access denied');
  expect(selectRootWorkCapability(undefined,'create_child',context())).toEqual(unavailable);
 });
 it('keeps malformed scope and uncertain-save receipt errors',async()=>{
  const response=tree();response.root.id='other';api.rpc.mockResolvedValue({data:response,error:null});await expect(fetchWorkTree('root')).rejects.toThrow('Could not verify');
  await expect(saveWorkTree('root',{id:'same',command:'create',payload:{},revision:7})).rejects.toThrow('Retry the same request');
 });
});
