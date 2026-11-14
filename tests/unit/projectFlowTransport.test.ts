import {beforeEach,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('../../src/lib/supabase',()=>({supabase:{rpc:api.rpc}}));
import {projectFlowCall,ProjectFlowError} from '../../src/app/features/project-setup/services/projectFlow';
beforeEach(()=>vi.resetAllMocks());
it.each(['23514','42501','40001','PGRST202'])('treats checked server rejection %s as a definite failed command',async code=>{
 api.rpc.mockResolvedValue({data:null,error:{code,message:'Checked rejection'}});await expect(projectFlowCall('authorize_project_funding',{})).rejects.toBeInstanceOf(ProjectFlowError);
});
it.each(['','08006','PGRST500'])('keeps transport/backend failure %s uncertain so its command identity is retained',async code=>{
 api.rpc.mockResolvedValue({data:null,error:{code,message:'Result unavailable'}});try{await projectFlowCall('authorize_project_funding',{});throw new Error('Expected failure');}catch(error){expect(error).toBeInstanceOf(Error);expect(error).not.toBeInstanceOf(ProjectFlowError);expect((error as Error).message).toBe('Result unavailable');}
});

import {projectWorkAvailable} from '../../src/app/features/project-setup/projectWorkAvailable';
it('keeps Active, On hold and closed work visible independently of the setup receipt',()=>{
 for(const status of ['active','on_hold','completed','archived'])expect(projectWorkAvailable(status,false)).toBe(true);
 expect(projectWorkAvailable('planning',false)).toBe(false);
 expect(projectWorkAvailable('planning',true)).toBe(true);
});
