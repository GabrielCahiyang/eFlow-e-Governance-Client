import {expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('../../src/lib/supabase',()=>({supabase:{rpc:api.rpc}}));
vi.mock('../../src/app/features/project-invitations',()=>({dispatchProjectInvitation:vi.fn()}));
import {fetchOfficePeople} from '../../src/app/features/project-offices/services/officePeople';
it('uses the scoped office API rather than querying private membership tables',async()=>{
 const rows=[{request_id:'request',identity_id:'identity',participation_role:'employee',active:false,invitation:{state:'approved'}}];api.rpc.mockResolvedValueOnce({data:rows,error:null});
 expect(await fetchOfficePeople('project')).toEqual(rows);expect(api.rpc).toHaveBeenCalledWith('r8_office_people',{p_project:'project'});
});
it('preserves a genuine authorization error',async()=>{
 api.rpc.mockResolvedValueOnce({error:{message:'Project office people access denied'}});await expect(fetchOfficePeople('other')).rejects.toThrow('access denied');
});
