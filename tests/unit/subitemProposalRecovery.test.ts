import { beforeEach, expect, it, vi } from 'vitest';
const api=vi.hoisted(()=>({rpc:vi.fn(),session:vi.fn(),upload:vi.fn()}));
vi.mock('../../src/lib/supabase',()=>({supabase:{rpc:api.rpc,auth:{getSession:api.session},storage:{from:()=>({upload:api.upload})}}}));
import { proposeSubitemWork } from '../../src/app/features/subtasks/services/subitemLeadReview';
beforeEach(()=>{vi.resetAllMocks();api.session.mockResolvedValue({data:{session:{user:{id:'author'}}}});api.upload.mockResolvedValue({});});
const context={canProposeCompletion:true,canProposeProgress:false,items:[]};
const input=()=>({root:'task',node:'step',actor:'author',kind:'completion' as const,note:'Finished',files:[new File(['proof'],'proof.pdf')],attempt:{id:'request',uploaded:[]},supersedes:'returned'});
it('sends blocker and next step through the existing reviewed-update terms',async()=>{
 api.rpc.mockResolvedValueOnce({data:{...context,canProposeProgress:true}}).mockResolvedValueOnce({data:{id:'request'}});
 await proposeSubitemWork({...input(),kind:'progress',note:'',blocker:'Supplies delayed',nextStep:'Call supplier',files:[]});
 expect(api.rpc.mock.calls[1][1].p_terms).toEqual({note:'',blocker:'Supplies delayed',next_step:'Call supplier',attachments:[]});
});
it('rechecks Lead review eligibility before uploading or proposing',async()=>{
 api.rpc.mockResolvedValue({data:{...context,canProposeCompletion:false}});
 await expect(proposeSubitemWork(input())).rejects.toThrow('access changed');
 expect(api.rpc.mock.calls.map(call=>call[0])).toEqual(['m7_work_proposals']);expect(api.upload).not.toHaveBeenCalled();
});
it('retries an uncertain proposal with the same evidence, request and superseded submission',async()=>{
 const draft=input();api.rpc.mockResolvedValueOnce({data:context}).mockResolvedValueOnce({error:{message:'Failed to fetch'}}).mockResolvedValueOnce({data:{id:'request'}});
 await expect(proposeSubitemWork(draft)).rejects.toThrow('Failed to fetch');await proposeSubitemWork(draft);
 expect(api.rpc.mock.calls.map(call=>call[0])).toEqual(['m7_work_proposals','m7_propose_work','m7_propose_work']);
 expect(api.rpc.mock.calls[1]).toEqual(api.rpc.mock.calls[2]);expect(api.rpc.mock.calls[2][1].p_supersedes).toBe('returned');expect(api.upload).toHaveBeenCalledTimes(1);
});
it('rechecks after a confirmed denial and refuses a changed account on retry',async()=>{
 const draft=input();api.rpc.mockResolvedValueOnce({data:context}).mockResolvedValueOnce({error:{code:'42501',message:'Scope changed'}}).mockResolvedValueOnce({data:context}).mockResolvedValueOnce({data:{id:'request'}});
 await expect(proposeSubitemWork(draft)).rejects.toThrow('Scope changed');await proposeSubitemWork(draft);
 expect(api.rpc.mock.calls.map(call=>call[0])).toEqual(['m7_work_proposals','m7_propose_work','m7_work_proposals','m7_propose_work']);
 api.session.mockResolvedValue({data:{session:{user:{id:'other'}}}});
 await expect(proposeSubitemWork(draft)).rejects.toThrow('Sign in again');expect(api.rpc).toHaveBeenCalledTimes(4);
});
