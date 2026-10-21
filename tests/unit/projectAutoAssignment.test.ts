import {beforeEach,describe,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({context:vi.fn(),chat:vi.fn(),rpc:vi.fn(),session:vi.fn(),tree:vi.fn(),notify:vi.fn(),access:vi.fn()}));
vi.mock('../../src/lib/supabase',()=>({supabase:{rpc:api.rpc,auth:{getSession:api.session}}}));
vi.mock('../../src/app/shared/phase2Api',()=>({phase2Request:api.context}));
vi.mock('../../src/app/features/ai',()=>({requestAiChat:api.chat,readAiText:(r:any)=>r.message.content}));
vi.mock('../../src/app/features/nested-work',()=>({fetchWorkTree:api.tree}));
vi.mock('../../src/app/features/tasks',()=>({notifyTaskListeners:api.notify}));
vi.mock('../../src/app/features/project-access',()=>({notifyAccessChanged:api.access}));
import {prepareAutoAssignment,applyAutoAssignment} from '../../src/app/features/staffing/services/autoAssignment';
import type {WorkTreeSnapshot} from '../../src/app/features/nested-work';
const snapshot={root:{id:'task',project:'project',office:'office',kind:'office',lead:null,people:['retained']},revision:3,nodes:[],people:[]} as unknown as WorkTreeSnapshot;
beforeEach(()=>{vi.clearAllMocks();api.context.mockResolvedValue({task:{id:'task'},candidates:[{id:'outside-current-project',name:'Available person',skills:['Planning'],training:[],education:[],experience:[],specializations:[],certifications:[],activeTasks:1}],excludedUnconfirmed:0});api.chat.mockResolvedValue({message:{content:JSON.stringify({recommendations:[{userId:'outside-current-project',evidence:['Planning']}]})}});api.session.mockResolvedValue({data:{session:{access_token:'same',user:{id:'head'}}}});api.rpc.mockResolvedValue({data:snapshot,error:null});api.tree.mockResolvedValue(snapshot);});
describe('AI project task assignment',()=>{
 it('uses Qwen 4B and the available directory instead of restricting to selected project people',async()=>{
  const request=await prepareAutoAssignment(snapshot,vi.fn());
  expect(api.context).toHaveBeenCalledWith('staffing/task/context?auto_assign=true');
  expect(api.chat.mock.calls[0][0]).toMatchObject({model:'qwen3.5:4b',workspace_staffing:{taskId:'task',autoAssign:true}});
  expect(request).toMatchObject({root:'task',revision:3,lead:'outside-current-project',people:['outside-current-project','retained']});
 });
 it('sends enrollment and staffing through one immutable request and refreshes both views',async()=>{
  const request=await prepareAutoAssignment(snapshot,vi.fn());await applyAutoAssignment(request);await applyAutoAssignment(request);
  expect(api.rpc).toHaveBeenCalledWith('auto_assign_project_task',{p_root:'task',p_revision:3,p_request:request.id,p_lead:request.lead,p_people:request.people});
  expect(api.rpc.mock.calls[0]).toEqual(api.rpc.mock.calls[1]);expect(api.access).toHaveBeenCalledTimes(2);expect(api.tree).toHaveBeenCalledWith('task');
 });
 it('does not announce an update when the atomic operation fails',async()=>{
  api.rpc.mockResolvedValue({error:{message:'Work changed',code:'40001'}});
  const request=await prepareAutoAssignment(snapshot,vi.fn());await expect(applyAutoAssignment(request)).rejects.toMatchObject({code:'40001'});
  expect(api.access).not.toHaveBeenCalled();expect(api.tree).not.toHaveBeenCalled();
 });
 it('does not announce success without a matching assignment receipt',async()=>{
  api.rpc.mockResolvedValue({data:null,error:null});
  const request=await prepareAutoAssignment(snapshot,vi.fn());await expect(applyAutoAssignment(request)).rejects.toThrow('receipt was not confirmed');
  expect(api.access).not.toHaveBeenCalled();expect(api.tree).not.toHaveBeenCalled();
 });
});
