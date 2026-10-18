import {beforeEach,describe,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({auth:vi.fn(),from:vi.fn(),rpc:vi.fn(),upload:vi.fn(),storage:vi.fn()}));
vi.mock('../../src/lib/supabase',()=>({supabase:{auth:{getUser:api.auth},from:api.from,rpc:api.rpc,storage:{from:api.storage}}}));
import {saveDraft,publishAnnouncement} from '../../src/app/services/announcementService';
import {createTaskTemplate} from '../../src/app/features/tasks/services/taskTemplateService';
import {submitPettyCashLiquidation} from '../../src/app/features/budget/services/budgetService';
import {saveGovernanceConfiguration} from '../../src/app/features/interdepartment-collaboration/services/governanceService';
import {parsePdsFile} from '../../src/app/features/members/services/pds-parser/pdsParser';
beforeEach(()=>{vi.clearAllMocks();api.auth.mockRejectedValue(new Error('Unexpected auth call'));api.from.mockImplementation(()=>{throw new Error('Unexpected write');});api.rpc.mockResolvedValue({error:{message:'Unexpected RPC'}});api.storage.mockReturnValue({upload:api.upload});api.upload.mockResolvedValue({error:null});});
describe('invalid input stops before any side effect',()=>{
 for(const operation of ['draft','publish'] as const)it('rejects an expired announcement before '+operation,async()=>{
  const draft={title:'Notice',body:'Hello',audience:'all' as const,expiresAt:'2000-01-01'};
  await expect(operation==='draft'?saveDraft(draft):publishAnnouncement('announcement',draft)).rejects.toThrow(/expir/i);
  expect(api.auth).not.toHaveBeenCalled();expect(api.from).not.toHaveBeenCalled();
 });
 it.each([0,366,1.5,NaN,Infinity])('rejects recurring interval %s before auth or persistence',async interval=>{
  await expect(createTaskTemplate({title:'Work',description:'',priority:'medium',tags:[],acceptanceCriteria:[],orgId:'office',recurrenceRule:{frequency:'daily',interval},nextRunAt:Date.now()+86400000,isActive:true})).rejects.toThrow(/interval/i);
  expect(api.auth).not.toHaveBeenCalled();expect(api.from).not.toHaveBeenCalled();
 });
 it.each([NaN,Infinity,0,-1,.0001,1e30])('rejects receipt quantity %s before upload or RPC',async quantity=>{
  const receipt={id:'receipt',vendor:'Shop',receiptNumber:'1',receiptDate:'2000-01-01',description:'Goods',amount:10,file:{name:'receipt.pdf',type:'application/pdf',size:10} as File,items:[{id:'item',allocationLineId:'line',quantity,unit:'kg',particular:'Goods',purpose:'Work',amount:10}]};
  await expect(submitPettyCashLiquidation({orgId:'office',requestId:'request',spent:10,note:'Purchased',receipts:[receipt]})).rejects.toThrow(/quantity/i);
  expect(api.storage).not.toHaveBeenCalled();expect(api.rpc).not.toHaveBeenCalled();
 });
 it('rejects a 91-day governance deadline before RPC',async()=>{
  await expect(saveGovernanceConfiguration({draftId:'draft',organizations:[{orgId:'office',reviewDeadlineDays:91} as never],assignments:[]})).rejects.toThrow(/deadline/i);
  expect(api.rpc).not.toHaveBeenCalled();
 });
 it('rejects a non-Excel PDS file before reading bytes',async()=>{
  const arrayBuffer=vi.fn().mockRejectedValue(new Error('Unexpected read'));
  await expect(parsePdsFile({name:'profile.exe',type:'application/octet-stream',size:10,arrayBuffer} as unknown as File)).rejects.toThrow(/Excel|workbook/i);
  expect(arrayBuffer).not.toHaveBeenCalled();
 });
});
