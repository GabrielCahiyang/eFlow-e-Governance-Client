// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../../src/app/features/tasks';
const calls=vi.hoisted(()=>({context:vi.fn(),recommend:vi.fn(),assign:vi.fn(),tree:vi.fn()}));
vi.mock('../../src/app/features/tasks',()=>({assignTask:calls.assign}));
vi.mock('../../src/app/features/nested-work',async original=>({...await original<Record<string,unknown>>(),fetchWorkTree:calls.tree}));
vi.mock('../../src/app/features/staffing/services/staffingService',async original=>({...await original<Record<string,unknown>>(),fetchStaffingContext:calls.context,recommendStaff:calls.recommend}));
import { useStaffingReview } from '../../src/app/features/staffing/hooks/useStaffingReview';
const candidate={id:'m',name:'Maria',skills:['Planning'],training:[],education:[],experience:[],specializations:[],certifications:[],experience_summary:'',activeTasks:2,remainingHours:8,unknownEffortTasks:1};
const context={task:{id:'t',title:'Assess'},candidates:[candidate],excludedUnconfirmed:2};const task={id:'t',title:'Assess',teamMemberIds:[]} as unknown as Task;
beforeEach(()=>{vi.clearAllMocks();calls.context.mockResolvedValue(context);calls.recommend.mockResolvedValue([{userId:'m',evidence:['Planning'],activeTasks:2,remainingHours:8,unknownEffortTasks:1}]);calls.assign.mockResolvedValue(undefined);calls.tree.mockResolvedValue({root:{id:'t',project:'p',office:'o',kind:'office'},people:[{id:'m',eligible:true}]});});afterEach(cleanup);
describe('Phase 15 advisory staffing authority',()=>{
 it('does not assign on generation or canceled review and refreshes eligibility before explicit assignment',async()=>{const view=renderHook(()=>useStaffingReview(task));await act(async()=>{});await act(async()=>view.result.current.generate());expect(calls.assign).not.toHaveBeenCalled();act(()=>view.result.current.setSelected('m'));await act(async()=>view.result.current.confirm(async()=>false));expect(calls.assign).not.toHaveBeenCalled();await act(async()=>view.result.current.confirm(async()=>true));expect(calls.context).toHaveBeenCalledTimes(3);expect(calls.assign).toHaveBeenCalledOnce();});
 it('retains the selected recommendation after denial and blocks assignment when the candidate disappears',async()=>{const view=renderHook(()=>useStaffingReview(task));await act(async()=>{});await act(async()=>view.result.current.generate());act(()=>view.result.current.setSelected('m'));calls.context.mockRejectedValueOnce(new Error('Authority revoked'));await act(async()=>view.result.current.confirm(async()=>true));expect(view.result.current.selected).toBe('m');expect(view.result.current.error).toContain('revoked');expect(calls.assign).not.toHaveBeenCalled();calls.context.mockResolvedValueOnce({...context,candidates:[]});await act(async()=>view.result.current.confirm(async()=>true));expect(calls.assign).not.toHaveBeenCalled();expect(view.result.current.error).toContain('No recommendations');});
 it('deduplicates assignment and preserves a successful receipt after a caller refresh fails',async()=>{const view=renderHook(()=>useStaffingReview(task,()=>{throw new Error('Refresh');}));await act(async()=>{});await act(async()=>view.result.current.generate());act(()=>view.result.current.setSelected('m'));let a!:Promise<void>;act(()=>{a=view.result.current.confirm(async()=>true);void view.result.current.confirm(async()=>true);});await act(async()=>{await a;await view.result.current.confirm(async()=>true);});expect(calls.assign).toHaveBeenCalledOnce();expect(view.result.current.saved).toBe(true);await act(async()=>view.result.current.confirm(async()=>true));expect(calls.assign).toHaveBeenCalledOnce();expect(view.result.current.error).toContain('Owner assigned');});
});

describe('NW3.4 advisory appointment handoff',()=>{
 const supported={...task,linkedProjectId:'p',orgId:'o'};
 async function ready(onAssigned?:()=>void|Promise<void>){const view=renderHook(()=>useStaffingReview(supported,onAssigned));await act(async()=>{});await act(async()=>view.result.current.generate());act(()=>view.result.current.setSelected('m'));return view;}
 it('enters canonical appointment only after renewed evidence and selected project eligibility; cancellation keeps the recommendation',async()=>{
  const view=await ready();await act(async()=>view.result.current.confirm(async()=>false));expect(calls.tree).not.toHaveBeenCalled();
  await act(async()=>view.result.current.confirm(async()=>true));expect(view.result.current.appointment?.leadId).toBe('m');expect(calls.assign).not.toHaveBeenCalled();
  await act(async()=>view.result.current.confirm(async()=>true));expect(calls.tree).toHaveBeenCalledOnce();act(()=>view.result.current.cancelAppointment());expect(view.result.current.selected).toBe('m');expect(view.result.current.saved).toBe(false);
 });
 it('blocks changed confirmed evidence before entering the canonical editor',async()=>{
  const view=await ready();calls.context.mockResolvedValueOnce({...context,candidates:[{...candidate,skills:['Different fact']}]});await act(async()=>view.result.current.confirm(async()=>true));expect(view.result.current.appointment).toBeNull();expect(view.result.current.error).toContain('No recommendations');expect(calls.tree).not.toHaveBeenCalled();expect(calls.assign).not.toHaveBeenCalled();
 });
 it.each([{people:[]},{people:[{id:'m',eligible:false}]},{people:[{id:'m'}]}])('guides missing or expired selected membership to Members without insertion (%j)',async ({people})=>{
  const view=await ready();calls.tree.mockResolvedValueOnce({root:{id:'t',project:'p',office:'o',kind:'office'},people});await act(async()=>view.result.current.confirm(async()=>true));expect(view.result.current.appointment).toBeNull();expect(view.result.current.error).toContain('responsible Office Head to review Members');expect(view.result.current.selected).toBe('m');expect(calls.assign).not.toHaveBeenCalled();
 });
 it('does not fall back to legacy assignment when the tree read is denied',async()=>{
  const view=await ready();calls.tree.mockRejectedValueOnce(new Error('Access revoked'));await act(async()=>view.result.current.confirm(async()=>true));expect(view.result.current.error).toContain('revoked');expect(view.result.current.appointment).toBeNull();expect(calls.assign).not.toHaveBeenCalled();
 });
 it('retains the receipt across async refresh failure and cannot re-enter appointment',async()=>{
  const view=await ready(async()=>{throw new Error('Refresh');});await act(async()=>view.result.current.confirm(async()=>true));await act(async()=>{await expect(view.result.current.appointmentSaved()).rejects.toThrow('Lead appointed');});expect(view.result.current.saved).toBe(true);act(()=>view.result.current.cancelAppointment());await act(async()=>{await view.result.current.confirm(async()=>true);await view.result.current.generate();await view.result.current.refresh();});expect(calls.tree).toHaveBeenCalledOnce();expect(calls.assign).not.toHaveBeenCalled();expect(view.result.current.error).toContain('do not appoint again');
 });
 it('ignores a late eligibility read when the task changes',async()=>{
  const view=renderHook(({task})=>useStaffingReview(task),{initialProps:{task:supported}});await act(async()=>{});await act(async()=>view.result.current.generate());act(()=>view.result.current.setSelected('m'));let finish!:(value:unknown)=>void;calls.tree.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));let pending!:Promise<void>;await act(async()=>{pending=view.result.current.confirm(async()=>true);});view.rerender({task:{...supported,id:'other'}});await act(async()=>{finish({root:{id:'t',project:'p',office:'o',kind:'office'},people:[{id:'m',eligible:true}]});await pending;});expect(view.result.current.appointment).toBeNull();expect(calls.assign).not.toHaveBeenCalled();
 });
 it.each([{...supported,sourceCollaborationDraftId:'governed'},{...supported,proposedOfficeIdentityId:'unresolved'}])('retains assignTask for excluded workflows (%j)',async excluded=>{
  const view=renderHook(()=>useStaffingReview(excluded));await act(async()=>{});await act(async()=>view.result.current.generate());act(()=>view.result.current.setSelected('m'));await act(async()=>view.result.current.confirm(async()=>true));expect(calls.assign).toHaveBeenCalledOnce();expect(calls.tree).not.toHaveBeenCalled();
 });
 it('does not close a different task when the legacy receipt refresh finishes late',async()=>{
  let finish!:()=>void;const refreshed=vi.fn(()=>new Promise<void>(resolve=>{finish=resolve;})),closed=vi.fn();const view=renderHook(({task})=>useStaffingReview(task,refreshed,closed),{initialProps:{task}});await act(async()=>{});await act(async()=>view.result.current.generate());act(()=>view.result.current.setSelected('m'));let pending!:Promise<void>;await act(async()=>{pending=view.result.current.confirm(async()=>true);});expect(calls.assign).toHaveBeenCalledOnce();view.rerender({task:{...task,id:'other'}});await act(async()=>{finish();await pending;});expect(closed).not.toHaveBeenCalled();expect(view.result.current.saved).toBe(false);
 });
});
