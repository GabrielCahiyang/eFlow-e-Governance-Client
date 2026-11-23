import {beforeEach,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('../../src/lib/supabase',()=>({supabase:{rpc:api.rpc}}));
vi.mock('../../src/app/features/projects',()=>({notifyProjectListeners:vi.fn()}));
import {fetchReadiness} from '../../src/app/features/project-readiness/services/readinessService';
beforeEach(()=>vi.resetAllMocks());
const readiness={projectId:'p',ready:true,canActivate:true,governed:false,checks:[]};
const project={id:'p',title:'Outreach',description:'Workshop',scope:'Deliver materials',project_lead_id:'lead',start_date:'2026-11-01',target_date:'2026-11-05',funding_not_required:false};
it('blocks activation and names missing setup fields despite otherwise passing reviews',async()=>{
 api.rpc.mockResolvedValueOnce({data:readiness}).mockResolvedValueOnce({data:{project:{...project,scope:'',project_lead_id:null},total:0,ready:false}});
 const result=await fetchReadiness('p');expect(result.canActivate).toBe(false);expect(result.checks[0].detail).toContain('scope, project lead, funding or No funding required');
});
it('allows completed setup with explicitly no funding required',async()=>{
 api.rpc.mockResolvedValueOnce({data:readiness}).mockResolvedValueOnce({data:{project:{...project,funding_not_required:true},total:0,ready:true}});
 const result=await fetchReadiness('p');expect(result.canActivate).toBe(true);expect(result.checks[0].ok).toBe(true);
});
it('requires Finish setup even when fields are filled',async()=>{
 api.rpc.mockResolvedValueOnce({data:readiness}).mockResolvedValueOnce({data:{project,total:1000,ready:false}});
 const result=await fetchReadiness('p');expect(result.canActivate).toBe(false);expect(result.checks[0].detail).toBe('Finish project setup before activating.');
});
it('blocks activation with an explicit Accounting Staff certification message while funding is pending_accounting',async()=>{
 api.rpc.mockResolvedValueOnce({data:readiness}).mockResolvedValueOnce({data:{project,total:0,ready:false,canDraftWork:true,fundingRequests:[{id:'r1',status:'pending_accounting'}]}});
 const result=await fetchReadiness('p');expect(result.canActivate).toBe(false);expect(result.checks[0].detail).toContain('Independent Accounting Staff certification is required');
});
it('retains the separate governed proposal workflow',async()=>{
 api.rpc.mockResolvedValueOnce({data:{...readiness,governed:true}});const result=await fetchReadiness('p');expect(result.governed).toBe(true);expect(api.rpc).toHaveBeenCalledTimes(1);
});
it('blocks early activation before the Philippine Time start date and flags automatic start-date activation',async()=>{
 api.rpc
  .mockResolvedValueOnce({data:readiness})
  .mockResolvedValueOnce({data:{project:{...project,start_date:'2099-12-01',target_date:'2099-12-15',funding_not_required:true},total:0,ready:true}});
 const result=await fetchReadiness('p');
 expect(result.canActivate).toBe(false);
 expect(result.autoActivationScheduled).toBe(true);
 expect(result.stage).toBe('Scheduled for start date');
 const startCheck=result.checks.find(item=>item.key==='start_date_reached');
 expect(startCheck?.ok).toBe(false);
 expect(startCheck?.detail).toContain('12/01/2099 at 12:00 AM (Philippine Time)');
});
