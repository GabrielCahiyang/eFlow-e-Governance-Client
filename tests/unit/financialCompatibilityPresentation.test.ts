import {beforeEach,describe,expect,it,vi} from 'vitest';
import type {DepartmentBudgetBundle,PettyCashRequest} from '../../src/app/features/budget/types';
import {buildPettyCashVoucherRows} from '../../src/app/features/budget/selectors/pettyCashVoucherReport';
import {mapRequest} from '../../src/app/features/budget/services/budgetMappers';
const api=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('../../src/lib/supabase',()=>({supabase:api}));
import {fetchBudgetSections} from '../../src/app/features/budget/services/budgetSectionService';

const request=(overrides:Partial<PettyCashRequest>={})=>({id:'request-9',requestNumber:9,status:'settled',purpose:'Office purchases',pcvLegacy:true,...overrides} as PettyCashRequest);
const bundle=(requests:PettyCashRequest[])=>({requests,liquidations:[]} as unknown as DepartmentBudgetBundle);
beforeEach(()=>vi.clearAllMocks());
describe('financial compatibility presentation',()=>{
  it('shows an unnumbered historical settlement with its canonical request reference',()=>{
    const rows=buildPettyCashVoucherRows(bundle([request()]));
    expect(rows[0][0]).toContain('Legacy · unnumbered · request 9');
    expect(rows[0][0]).toContain('PCV date not recorded');
    expect(rows[0][0]).not.toContain('PCV 00');
  });
  it('preserves recorded historical PCV numbers and dates',()=>{
    const rows=buildPettyCashVoucherRows(bundle([request({pcvNumber:87,pcvDate:'2025-06-03'})]));
    expect(rows[0][0]).toContain('PCV 87 · 2025-06-03');
  });
  it('keeps a new unapproved request outside the authorized voucher register',()=>{
    expect(buildPettyCashVoucherRows(bundle([request({status:'pending_department_approval',pcvLegacy:false})]),false)).toEqual([]);
  });
  it('retains pre-migration legacy requests and separates verified-only results',()=>{
    const data=bundle([request({pcvLegacy:undefined,status:'released'}),request({id:'settled'})]);
    expect(buildPettyCashVoucherRows(data,false)).toHaveLength(4);
    expect(buildPettyCashVoucherRows(data,true)).toHaveLength(2);
  });
  it('maps the historical flag without classifying new rows as legacy',()=>{
    expect(mapRequest({id:'a',pcv_legacy:true}).pcvLegacy).toBe(true);
    expect(mapRequest({id:'b',pcv_legacy:false}).pcvLegacy).toBe(false);
    expect(mapRequest({id:'c'}).pcvLegacy).toBeUndefined();
  });
  it('recognizes installed itemized capability even when no annual sections exist',async()=>{
    api.rpc.mockResolvedValue({data:{sections:[],version:0,itemizedCashAvailable:true},error:null});
    expect(await fetchBudgetSections('office',2026)).toMatchObject({sections:[],itemizedCashAvailable:true});
  });
  it('continues to recognize the older section capability contract',async()=>{
    api.rpc.mockResolvedValue({data:{sections:[{id:'section',name:'Supplies',amount:1,journalAccountCode:null}],version:1},error:null});
    expect(await fetchBudgetSections('office',2026)).toMatchObject({itemizedCashAvailable:true});
  });
});
