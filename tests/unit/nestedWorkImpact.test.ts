import {beforeEach,describe,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({rpc:vi.fn(),session:vi.fn()}));
vi.mock('../../src/lib/supabase',()=>({supabase:{rpc:api.rpc,auth:{getSession:api.session}}}));
import {fetchWorkImpact,saveWorkTree,WorkTreeUnavailable} from '../../src/app/features/nested-work';
import type {WorkImpact,WorkRequest} from '../../src/app/features/nested-work';
const request:WorkRequest={id:'request',command:'delete',payload:{id:'node'},revision:7};
const session=(actor='lead')=>({data:{session:{user:{id:actor},access_token:'synthetic-token'}},error:null});
const impact=():WorkImpact=>({root_id:'root',expected_revision:7,current_revision:7,command:'delete',allowed:true,blocker_codes:[],selected_count:3,descendant_count:2,affected_appointment_count:0,before_path:['Branch','Item'],after_path:[],fingerprint:'opaque-current-facts'});
beforeEach(()=>{vi.resetAllMocks();api.session.mockResolvedValue(session());});
describe('authoritative work impact transport',()=>{
 it.each([true,false])('accepts additive date classification %s with verified schedule facts',async material=>{
  const dateRequest={...request,command:'edit' as const,payload:{id:'node',due:'2026-12-02'}};
  const preview={...impact(),command:'edit',requires_date_confirmation:material,date_impact:{old_due:'2026-12-01',new_due:'2026-12-02',items:[{id:'node',path:['Item'],old_bound:'2026-12-01',new_bound:'2026-12-02',bound_changed:false,history_counts:{progress:1}}]}};
  api.rpc.mockResolvedValue({data:preview,error:null});expect(await fetchWorkImpact('root',dateRequest)).toEqual(preview);
 });
 it.each([{requires_date_confirmation:'yes'},{requires_date_confirmation:false,date_impact:{old_due:null,new_due:'2026-12-02',items:'private'}},{requires_date_confirmation:false,date_impact:{old_due:null,new_due:'2026-12-03',items:[]}}])('rejects malformed or mismatched additive date impact',async patch=>{
  api.rpc.mockResolvedValue({data:{...impact(),command:'edit',...patch},error:null});await expect(fetchWorkImpact('root',{...request,command:'edit',payload:{id:'node',due:'2026-12-02'}})).rejects.toThrow('Could not verify');
 });
 it('previews through the fixed wrapper and cancellation performs no mutation',async()=>{
  api.rpc.mockResolvedValueOnce({data:impact(),error:null});expect(await fetchWorkImpact('root',request)).toEqual(impact());
  expect(api.rpc.mock.calls).toEqual([['nw_work_impact',{p_root:'root',p_revision:7,p_command:'delete',p_payload:{id:'node'}}]]);
 });
 it('uses the checked wrapper with fingerprint separate from old payloads',async()=>{
  api.rpc.mockResolvedValue({data:{root:{id:'root'},nodes:[]},error:null});
  await saveWorkTree('root',{...request,impactFingerprint:'confirmed'});
  expect(api.rpc).toHaveBeenCalledExactlyOnceWith('nw_work_command',{p_root:'root',p_revision:7,p_request:'request',p_command:'delete',p_payload:{id:'node'},p_impact_fingerprint:'confirmed'});
 });
 it('keeps ordinary command callers compatible',async()=>{
  api.rpc.mockResolvedValue({data:{root:{id:'root'},nodes:[]},error:null});await saveWorkTree('root',request);
  expect(api.rpc).toHaveBeenCalledExactlyOnceWith('r7_work_command',{p_root:'root',p_revision:7,p_request:'request',p_command:'delete',p_payload:{id:'node'}});
 });
 for(const code of ['PGRST202','42501','40001'])it(`never falls back after checked failure ${code}`,async()=>{
  api.rpc.mockResolvedValue({data:null,error:{code,message:'Refresh affected work'}});
  await expect(saveWorkTree('root',{...request,impactFingerprint:'old'})).rejects.toThrow('Refresh affected work');expect(api.rpc).toHaveBeenCalledTimes(1);
  expect(api.rpc.mock.calls[0][0]).toBe('nw_work_command');
 });
 it('sends an explicitly empty fingerprint to authoritative validation',async()=>{
  api.rpc.mockResolvedValue({error:{message:'Invalid impact'},data:null});
  await expect(saveWorkTree('root',{...request,impactFingerprint:''})).rejects.toThrow('Invalid impact');expect(api.rpc.mock.calls[0][0]).toBe('nw_work_command');
 });
 it('retains identical request terms after a lost committed result',async()=>{
  const confirmed={...request,impactFingerprint:'original'};
  api.rpc.mockResolvedValueOnce({data:null,error:null}).mockResolvedValueOnce({data:{root:{id:'root'},nodes:[]},error:null});
  await expect(saveWorkTree('root',confirmed)).rejects.toThrow('Retry the same request');await saveWorkTree('root',confirmed);
  expect(api.rpc.mock.calls[1]).toEqual(api.rpc.mock.calls[0]);
 });
 it('rejects a preview returned to another actor',async()=>{
  api.session.mockResolvedValueOnce(session()).mockResolvedValueOnce(session('another'));api.rpc.mockResolvedValue({data:impact(),error:null});
  await expect(fetchWorkImpact('root',request)).rejects.toThrow('session changed');
 });
 it('reports missing preview installation without issuing a mutation',async()=>{
  api.rpc.mockResolvedValue({data:null,error:{code:'PGRST202',message:'Missing'}});await expect(fetchWorkImpact('root',request)).rejects.toBeInstanceOf(WorkTreeUnavailable);expect(api.rpc).toHaveBeenCalledTimes(1);
 });
 for(const patch of [{root_id:'other'},{command:'move'},{selected_count:-1},{blocker_codes:['unknown']},{before_path:'private'},{allowed:false,blocker_codes:[]}])it('rejects malformed or mismatched preview '+JSON.stringify(patch),async()=>{
  api.rpc.mockResolvedValue({data:{...impact(),...patch},error:null});await expect(fetchWorkImpact('root',request)).rejects.toThrow('Could not verify');
 });
 it('returns a valid denied preview without treating it as confirmation',async()=>{
  const denied={...impact(),allowed:false,blocker_codes:['branch_denied'],before_path:[],selected_count:0};api.rpc.mockResolvedValue({data:denied,error:null});
  expect(await fetchWorkImpact('root',request)).toEqual(denied);expect(api.rpc).toHaveBeenCalledTimes(1);
 });
});
