// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {Task} from '../../src/app/features/tasks';
import type {Subtask} from '../../src/app/services/subtaskService';
const api=vi.hoisted(()=>({actor:'lead',loading:false,create:vi.fn(),cap:vi.fn(),refresh:vi.fn(),requests:[] as unknown[]}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:api.actor},userProfile:{id:api.actor,org_id:'office',role:'member',is_active:true}})}));
vi.mock('../../src/app/features/budget/hooks/useDepartmentBudget',()=>({useDepartmentBudget:()=>({summary:{status:'locked'},allocations:[],allocationLines:[],requests:api.requests,requestAttachments:[],releases:[],liquidations:[],loading:false,refresh:api.refresh})}));
vi.mock('../../src/app/features/budget/hooks/useTaskFundingContext',()=>({useTaskFundingContext:()=>({context:{funded:true,taskId:'root',subtaskId:'node',taskLeaderId:'lead',taskBudget:1000,available:500,lines:[{id:'line',available:500,amount:1000,category:'Travel',particular:'Local travel',fundSource:'General fund'}]},loading:api.loading,refresh:api.refresh})}));
vi.mock('../../src/app/features/budget/services/budgetService',()=>({setSubtaskBudgetCap:api.cap,removeSubtaskBudgetCap:vi.fn(),createContextualCashRequest:api.create,resubmitContextualCashRequest:vi.fn(),uploadCashRequestAttachment:vi.fn(),createReceiptSignedUrl:vi.fn(),cancelContextualCashRequest:vi.fn(),acknowledgePettyCashRelease:vi.fn()}));
import {WorkBudgetCard} from '../../src/app/features/budget/components/WorkBudgetCard';
const task={id:'root',title:'Root',status:'in_progress',orgId:'office',assigneeId:'lead'} as Task;
const subtask={id:'node',taskId:'root',title:'Node',assignedToIds:['worker'],status:'todo',percentComplete:0} as Subtask;
beforeEach(()=>{vi.clearAllMocks();api.actor='lead';api.loading=false;api.requests=[];api.create.mockResolvedValue('request');api.cap.mockResolvedValue('cap');api.refresh.mockResolvedValue(undefined);});afterEach(cleanup);
describe('NW8.2 budget caller gates and preserved financial rights',()=>{
 it('preserves Task Lead cap rights and independent contributor cash requests without canManage',async()=>{
  const view=render(<WorkBudgetCard task={task} subtask={subtask} canManage/>);expect(screen.getByRole('button',{name:'Set cap'})).toBeTruthy();expect(screen.getByRole('button',{name:'Request cash'})).toBeTruthy();
  api.actor='worker';view.rerender(<WorkBudgetCard task={task} subtask={subtask} canManage={false}/>);expect(screen.queryByRole('button',{name:'Set cap'})).toBeNull();expect(screen.getByRole('button',{name:'Request cash'})).toBeTruthy();
  api.actor='reviewer';view.rerender(<WorkBudgetCard task={task} subtask={subtask} canManage/>);expect(screen.queryByRole('button',{name:'Set cap'})).toBeNull();expect(screen.queryByRole('button',{name:'Request cash'})).toBeNull();
 });
 for(const pending of [false,true])it(`retains an opened cap draft and blocks its RPC while ${pending?'authority pending':'caller readOnly'}`,async()=>{
  const view=render(<WorkBudgetCard task={task} subtask={subtask} canManage/>);fireEvent.click(screen.getByRole('button',{name:'Set cap'}));fireEvent.change(screen.getByPlaceholderText('Amount'),{target:{value:'100'}});fireEvent.change(screen.getByPlaceholderText('Why protect this amount?'),{target:{value:'Protect travel'}});
  view.rerender(<WorkBudgetCard task={task} subtask={subtask} canManage readOnly={!pending} authorityPending={pending}/>);const save=screen.getByRole('button',{name:'Save cap'});expect(save.matches(':disabled')).toBe(true);fireEvent.click(save);expect(api.cap).not.toHaveBeenCalled();expect((screen.getByPlaceholderText('Why protect this amount?') as HTMLInputElement).value).toBe('Protect travel');
  view.rerender(<WorkBudgetCard task={task} subtask={subtask} canManage/>);fireEvent.click(screen.getByRole('button',{name:'Save cap'}));await waitFor(()=>expect(api.cap).toHaveBeenCalledOnce());expect(api.cap.mock.calls[0][0]).toMatchObject({taskId:'root',subtaskId:'node',allocationLineId:'line',amount:100,reason:'Protect travel'});
 });
 for(const pending of [false,true])it(`retains an opened cash draft without issuing cash/attachment writes while ${pending?'authority pending':'caller readOnly'}`,async()=>{
  api.actor='worker';const view=render(<WorkBudgetCard task={task} subtask={subtask}/>);fireEvent.click(screen.getByRole('button',{name:'Request cash'}));fireEvent.change(screen.getByLabelText('Amount'),{target:{value:'100'}});fireEvent.change(screen.getByLabelText('Purchase and purpose'),{target:{value:'Travel for assigned work'}});fireEvent.change(screen.getByLabelText('Needed by'),{target:{value:'2099-12-01'}});
  view.rerender(<WorkBudgetCard task={task} subtask={subtask} readOnly={!pending} authorityPending={pending}/>);const send=screen.getByRole('button',{name:'Request cash'});expect(send.matches(':disabled')).toBe(true);fireEvent.click(send);expect(api.create).not.toHaveBeenCalled();expect((screen.getByLabelText('Purchase and purpose') as HTMLTextAreaElement).value).toBe('Travel for assigned work');
  view.rerender(<WorkBudgetCard task={task} subtask={subtask}/>);fireEvent.click(screen.getByRole('button',{name:'Request cash'}));await waitFor(()=>expect(api.create).toHaveBeenCalledOnce());expect(api.create.mock.calls[0][0]).toMatchObject({taskId:'root',subtaskId:'node',amount:100,purpose:'Travel for assigned work'});
 });
 it('withholds controls while funding context is being refreshed even with a retained funded result',()=>{
  api.loading=true;render(<WorkBudgetCard task={task} subtask={subtask} canManage/>);expect(screen.queryByRole('button',{name:'Request cash'})).toBeNull();expect(screen.queryByRole('button',{name:'Set cap'})).toBeNull();
 });
 it('withholds a stale Task Lead funding context after a current Lead change',()=>{
  render(<WorkBudgetCard task={{...task,assigneeId:'replacement'}} subtask={{...subtask,assignedToIds:['lead']}} canManage/>);expect(screen.queryByRole('button',{name:'Request cash'})).toBeNull();expect(screen.queryByRole('button',{name:'Set cap'})).toBeNull();
 });
});
