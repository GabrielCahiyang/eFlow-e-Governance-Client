// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({rpc:vi.fn(),session:vi.fn(),context:vi.fn(),recommend:vi.fn(),assign:vi.fn()}));
vi.mock('../../src/lib/supabase',()=>({supabase:{rpc:api.rpc,auth:{getSession:api.session}}}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'head'}})}));
vi.mock('../../src/app/features/tasks',async original=>({...await original<Record<string,unknown>>(),assignTask:api.assign}));
vi.mock('../../src/app/features/staffing/services/staffingService',async original=>({...await original<Record<string,unknown>>(),fetchStaffingContext:api.context,recommendStaff:api.recommend}));
vi.mock('../../src/app/features/project-invitations',()=>({ProjectInvitations:()=>null}));
import {StaffingDialog} from '../../src/app/features/staffing/components/StaffingDialog';
import type {Task} from '../../src/app/features/tasks';
import type {WorkTreeSnapshot} from '../../src/app/features/nested-work';
import {installNavigationConfirmation} from '../../src/app/shared/navigationGuard';
import {nestedWorkImpactFixture} from '../fixtures/nestedWorkImpact';
const task={id:'t',title:'Assess',linkedProjectId:'p',orgId:'o',teamMemberIds:[]} as unknown as Task;
const person={id:'m',name:'Maria',skills:['Planning'],training:[],education:[],experience:[],specializations:[],certifications:[],experience_summary:'',activeTasks:2,remainingHours:8,unknownEffortTasks:1};
const allow={allowed:true,reason_code:null} as const;
function tree():WorkTreeSnapshot{return {root:{id:'t',project:'p',office:'o',kind:'office',lead:null,people:['worker'],open:true,due:null,capabilities:{appoint_lead:allow,manage_contributors:allow}},revision:7,can_manage:true,can_transfer:true,nodes:[],people:[{id:'m',name:'Maria',eligible:true},{id:'worker',name:'Existing worker',eligible:true}],leaf_total:0,leaf_completed:0};}
let current:WorkTreeSnapshot;
const writes=()=>api.rpc.mock.calls.filter(([name])=>name==='nw_work_command');
beforeEach(()=>{
 sessionStorage.clear();
 vi.clearAllMocks();current=tree();api.session.mockResolvedValue({data:{session:{user:{id:'head'},access_token:'synthetic'}},error:null});
 api.context.mockResolvedValue({task:{id:'t',title:'Assess'},candidates:[person],excludedUnconfirmed:1});api.recommend.mockResolvedValue([{userId:'m',evidence:['Planning'],activeTasks:2,remainingHours:8,unknownEffortTasks:1}]);
 api.rpc.mockImplementation(async(name,args)=>({data:name==='nw_work_impact'?nestedWorkImpactFixture(current,{revision:args.p_revision,command:args.p_command,payload:args.p_payload}):name==='r7_work_tree'?current:{...current,revision:8,root:{...current.root,lead:'m',people:['worker','m']}},error:null}));
});afterEach(cleanup);
async function enter(onAssigned?:()=>void|Promise<void>){
 const closed=vi.fn();render(<StaffingDialog task={task} onClose={closed} onAssigned={onAssigned}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Generate recommendations'}));fireEvent.click(await screen.findByRole('radio'));
 fireEvent.click(screen.getByRole('button',{name:'Confirm owner'}));fireEvent.click(await screen.findByRole('button',{name:'Review appointment',exact:true}));
 await screen.findByRole('combobox',{name:'Appointed Lead'});return closed;
}
async function submit(){fireEvent.click(screen.getByRole('button',{name:'Save work changes'}));fireEvent.click(await screen.findByRole('button',{name:'Transfer Lead',exact:true}));}
describe('NW3.4 AI selection through the actual canonical appointment editor',()=>{
 it('prefills the recommended Lead; canceled appointment review writes nothing',async()=>{
  await enter();expect((screen.getByRole('combobox',{name:'Appointed Lead'}) as HTMLSelectElement).value).toBe('m');
  fireEvent.click(screen.getByRole('button',{name:'Save work changes'}));const review=await screen.findByRole('alertdialog');expect(within(review).getByText(/Retained workers: Existing worker/)).toBeTruthy();fireEvent.click(within(review).getByRole('button',{name:'Cancel',exact:true}));expect(writes()).toHaveLength(0);expect(api.assign).not.toHaveBeenCalled();
  await waitFor(()=>expect((screen.getByRole('button',{name:'Cancel changes'}) as HTMLButtonElement).disabled).toBe(false));const navigation=installNavigationConfirmation(async()=>true);fireEvent.click(screen.getByRole('button',{name:'Cancel changes'}));await screen.findByRole('radio');navigation();expect((screen.getByRole('radio') as HTMLInputElement).checked).toBe(true);
 });
 it('fails closed on fresh canonical appointment denial despite legacy can_transfer',async()=>{
  current.root.capabilities!.appoint_lead={allowed:false,reason_code:'appointment_denied'};await enter();expect((screen.getByRole('combobox',{name:'Appointed Lead'}) as HTMLSelectElement).disabled).toBe(true);expect((screen.getByRole('button',{name:'Save work changes'}) as HTMLButtonElement).disabled).toBe(true);expect(writes()).toHaveLength(0);expect(api.assign).not.toHaveBeenCalled();
 });
 it('keeps one request identity after server denial and retry, without a legacy or membership write',async()=>{
  const assigned=vi.fn(),closed=await enter(assigned);let attempts=0;
  api.rpc.mockImplementation(async(name,args)=>name==='nw_work_command'&&++attempts===1?{data:null,error:{message:'Appointment denied'}}:{data:name==='nw_work_impact'?nestedWorkImpactFixture(current,{revision:args.p_revision,command:args.p_command,payload:args.p_payload}):current,error:null});
  await submit();await screen.findByText(/Appointment denied/);expect(assigned).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Retry saved request'}));await waitFor(()=>expect(assigned).toHaveBeenCalledOnce());
  expect(writes()).toHaveLength(2);expect(writes()[1][1]).toEqual(writes()[0][1]);expect(writes()[0][1]).toMatchObject({p_root:'t',p_revision:7,p_command:'root_lead',p_payload:{lead:'m',people:['worker','m']},p_impact_fingerprint:'synthetic-checked-impact'});expect(closed).toHaveBeenCalledOnce();expect(api.assign).not.toHaveBeenCalled();expect(api.rpc.mock.calls.every(([name])=>['r7_work_tree','nw_work_impact','nw_work_command'].includes(name))).toBe(true);
 });
 it('saves once and disables all resubmission after caller refresh fails',async()=>{
  const assigned=vi.fn().mockRejectedValue(new Error('Refresh failed'));await enter(assigned);await submit();await screen.findByText(/People were saved, but/);expect(writes()).toHaveLength(1);expect(screen.queryByRole('button',{name:'Save work changes'})).toBeNull();expect(screen.queryByRole('button',{name:'Retry saved request'})).toBeNull();
  fireEvent.click(within(screen.getByRole('form',{name:'Task/subitem people changes'})).getByRole('button',{name:'Close',exact:true}));await screen.findByText('Lead appointed.');const confirm=screen.getByRole('button',{name:'Confirm owner'});expect(confirm.getAttribute('aria-disabled')).toBe('true');fireEvent.click(confirm);expect(writes()).toHaveLength(1);expect(api.assign).not.toHaveBeenCalled();
 });
});
