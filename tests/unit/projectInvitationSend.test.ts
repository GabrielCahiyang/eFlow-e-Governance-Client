import {beforeEach,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({rpc:vi.fn(),http:vi.fn()}));
vi.mock('../../src/lib/supabase',()=>({supabase:{rpc:api.rpc}}));
vi.mock('../../src/app/shared/phase2Api',()=>({jsonRequest:(_method:string,body:unknown)=>body,phase2Request:api.http}));
import {sendProjectInvitation} from '../../src/app/features/project-invitations/services/projectInvitationService';
const draft={id:'request',email:' Guest@Example.test ',summary:'',skills:'',engagement:'Other' as const,end:'',untilClose:true};
const pending={id:'request',state:'pending',revision:1,can_approve:true,can_dispatch:false};
const approved={...pending,state:'approved',revision:2,can_approve:false,can_dispatch:true};
beforeEach(()=>{vi.resetAllMocks();});
it('approves using the returned revision and sends once for an authorized Head',async()=>{
 api.rpc.mockResolvedValueOnce({data:pending}).mockResolvedValueOnce({data:approved});api.http.mockResolvedValue({delivery_status:'provider_accepted'});
 await sendProjectInvitation('project','office',draft,'Asia/Manila');
 expect(api.rpc.mock.calls[0][1]).toMatchObject({p_id:'request',p_email:'guest@example.test',p_summary:'',p_skills:[]});
 expect(api.rpc.mock.calls[1]).toEqual(['r8_decide_request',{p_id:'request',p_revision:1,p_action:'approved'}]);
 expect(api.http.mock.calls[0]).toEqual(['/project-invitations/request/dispatch',{revision:2,resend:false}]);
});
it('rejects a forged direct-send mode when server approval capability is absent',async()=>{
 api.rpc.mockResolvedValue({data:{...pending,can_approve:false}});
 await expect(sendProjectInvitation('project','office',draft,'Asia/Manila')).rejects.toThrow('Head approval');
 expect(api.rpc).toHaveBeenCalledOnce();expect(api.http).not.toHaveBeenCalled();
});
it('does not create another email after a lost dispatch response was already recorded',async()=>{
 api.rpc.mockResolvedValue({data:{...approved,delivery_status:'provider_accepted'}});
 await sendProjectInvitation('project','office',draft,'Asia/Manila');expect(api.rpc).toHaveBeenCalledOnce();expect(api.http).not.toHaveBeenCalled();
});
it('reuses approved saved terms after failure without approving twice',async()=>{
 api.rpc.mockResolvedValue({data:{...approved,delivery_status:'failed'}});api.http.mockResolvedValue({delivery_status:'failed',delivery_error:'Try mail later'});
 await expect(sendProjectInvitation('project','office',draft,'Asia/Manila')).rejects.toThrow('Try mail later');
 expect(api.rpc).toHaveBeenCalledOnce();expect(api.http).toHaveBeenCalledOnce();
});
it('does not report an expired or revoked previously sent invitation as a success',async()=>{
 api.rpc.mockResolvedValue({data:{...approved,state:'revoked',delivery_status:'provider_accepted'}});
 await expect(sendProjectInvitation('project','office',draft,'Asia/Manila')).rejects.toThrow('current authority');expect(api.http).not.toHaveBeenCalled();
});
