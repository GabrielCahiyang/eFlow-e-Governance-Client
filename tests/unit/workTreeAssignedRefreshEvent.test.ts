// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({rpc:vi.fn(),session:vi.fn()}));
vi.mock('../../src/lib/supabase',()=>({supabase:{rpc:api.rpc,auth:{getSession:api.session}}}));
import {saveWorkTree} from '../../src/app/features/nested-work/services/workTreeService';
const update=vi.fn();
beforeEach(()=>{vi.resetAllMocks();api.session.mockResolvedValue({data:{session:null}});window.addEventListener('eflow:work-updated',update);});
afterEach(()=>window.removeEventListener('eflow:work-updated',update));
it('refreshes Assigned work after a verified child staffing command',async()=>{
 api.rpc.mockResolvedValue({data:{root:{id:'root',kind:'personal'},nodes:[]},error:null});
 await saveWorkTree('root',{id:'request',revision:1,command:'staff',payload:{id:'child',people:['member']}});
 expect(update).toHaveBeenCalledOnce();
});
it('does not announce an update after a denied or missing mutation receipt',async()=>{
 api.rpc.mockResolvedValueOnce({error:{code:'42501',message:'Denied'}}).mockResolvedValueOnce({data:null,error:null});
 const command={id:'request',revision:1,command:'staff' as const,payload:{id:'child',people:['member']}};
 await expect(saveWorkTree('root',command)).rejects.toThrow();await expect(saveWorkTree('root',command)).rejects.toThrow();expect(update).not.toHaveBeenCalled();
});
