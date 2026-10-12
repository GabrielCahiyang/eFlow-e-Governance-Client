import {beforeEach,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('../../src/lib/supabase',()=>({supabase:{rpc:api.rpc}}));
import {fetchWorkEvents} from '../../src/app/features/nested-work/services/workTreeService';
const event={id:'event',root_id:'root',node_id:'child',command:'delete',actor_name:'Recorded actor',occurred_at:'2026-10-12T00:00:00Z',before_data:null,after_data:null};
beforeEach(()=>vi.clearAllMocks());
it('uses the existing RPC and complete cursor without changing the public result',async()=>{
 const result={events:[event],more:true};api.rpc.mockResolvedValue({data:result,error:null});
 expect(await fetchWorkEvents(['root'],{time:'2026-10-13T00:00:00Z',id:'cursor'})).toBe(result);
 expect(api.rpc).toHaveBeenCalledExactlyOnceWith('r7_work_activity',{p_roots:['root'],p_before:'2026-10-13T00:00:00Z',p_id:'cursor'});
});
it('rejects foreign roots, duplicate identities, malformed time and oversized pages',async()=>{
 for(const events of [[{...event,root_id:'foreign'}],[event,event],[{...event,occurred_at:'invalid'}],Array.from({length:26},(_,i)=>({...event,id:String(i)}))]){
  api.rpc.mockResolvedValueOnce({data:{events,more:false},error:null});await expect(fetchWorkEvents(['root'])).rejects.toThrow('could not be verified');
 }
});
it('retains only the proven missing-installation fallback and propagates denied reads',async()=>{
 api.rpc.mockResolvedValueOnce({data:null,error:{code:'PGRST202',message:'Missing'}}).mockResolvedValueOnce({data:null,error:{code:'42501',message:'Denied'}});
 expect(await fetchWorkEvents(['root'])).toEqual({events:[],more:false});await expect(fetchWorkEvents(['root'])).rejects.toThrow('Denied');
 expect(await fetchWorkEvents([])).toEqual({events:[],more:false});expect(api.rpc).toHaveBeenCalledTimes(2);
});
