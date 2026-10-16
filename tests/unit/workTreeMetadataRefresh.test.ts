import {beforeEach,expect,it,vi} from 'vitest';
import type {WorkRequest,WorkTreeSnapshot} from '../../src/app/features/nested-work/types';
const mocks=vi.hoisted(()=>({rpc:vi.fn(),refresh:vi.fn(),session:vi.fn()}));
vi.mock('../../src/lib/supabase',()=>({supabase:{rpc:mocks.rpc,auth:{getSession:mocks.session}}}));
vi.mock('../../src/app/features/tasks',()=>({notifyTaskListeners:mocks.refresh}));
import {fetchWorkTree,saveWorkTree} from '../../src/app/features/nested-work/services/workTreeService';
const snapshot:WorkTreeSnapshot={root:{id:'root',project:'project',office:'office',lead:'selected-lead',people:['selected-lead'],kind:'office',open:true,due:null},nodes:[],people:[{id:'selected-lead',name:'Selected Lead',eligible:true}],revision:2,can_manage:true,can_transfer:true,leaf_total:0,leaf_completed:0};
const request:WorkRequest={id:'stable-request',revision:1,command:'root_lead',payload:{lead:'selected-lead',people:['selected-lead']},impactFingerprint:'reviewed-impact'};
beforeEach(()=>{
 vi.clearAllMocks();
 mocks.session.mockResolvedValue({data:{session:{user:{id:'actor'},access_token:'token'}},error:null});
 mocks.rpc.mockResolvedValue({data:snapshot,error:null});
 mocks.refresh.mockResolvedValue(undefined);
});
it('refreshes existing authorized Task subscribers after a verified root appointment receipt, preserving transport and outcome',async()=>{
 expect(await saveWorkTree('root',request)).toBe(snapshot);
 expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('nw_work_command',{p_root:'root',p_revision:1,p_request:'stable-request',p_command:'root_lead',p_payload:request.payload,p_impact_fingerprint:'reviewed-impact'});
 expect(mocks.refresh).toHaveBeenCalledTimes(1);
});
it('refreshes contributor metadata but does not reload Office tasks for reads, node operations or personal staffing',async()=>{
 await fetchWorkTree('root');expect(mocks.refresh).not.toHaveBeenCalled();
 await saveWorkTree('root',{...request,command:'edit',payload:{id:'node',title:'New title'}});expect(mocks.refresh).not.toHaveBeenCalled();
 await saveWorkTree('root',{...request,command:'contributors',payload:{people:['selected-lead']}});expect(mocks.refresh).toHaveBeenCalledTimes(1);
 mocks.refresh.mockClear();mocks.rpc.mockResolvedValue({data:{...snapshot,root:{...snapshot.root,kind:'personal',office:null}},error:null});
 await saveWorkTree('root',request);expect(mocks.refresh).not.toHaveBeenCalled();
});
it('retains the confirmed save receipt when a secondary metadata read fails, with no repeat mutation',async()=>{
 mocks.refresh.mockRejectedValue(new Error('Metadata temporarily unavailable'));
 expect(await saveWorkTree('root',request)).toBe(snapshot);
 expect(mocks.rpc).toHaveBeenCalledTimes(1);
});
it('never refreshes metadata or switches RPC after a denial or unverified receipt',async()=>{
 mocks.rpc.mockResolvedValue({data:null,error:{code:'42501',message:'Current appointment authority denied'}});
 await expect(saveWorkTree('root',request)).rejects.toThrow('Current appointment authority denied');
 expect(mocks.refresh).not.toHaveBeenCalled();
 mocks.rpc.mockResolvedValue({data:{...snapshot,root:{...snapshot.root,id:'other-root'}},error:null});
 await expect(saveWorkTree('root',request)).rejects.toThrow('No work receipt');
 expect(mocks.refresh).not.toHaveBeenCalled();expect(mocks.rpc.mock.calls.every(([name])=>name==='nw_work_command')).toBe(true);
});
