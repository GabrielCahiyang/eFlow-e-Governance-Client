// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import type {TaskFundingContext} from '../../src/app/features/budget/types';
import {requestFunding} from '../../src/app/features/budget/selectors/requestFunding';
const api=vi.hoisted(()=>({create:vi.fn(),legacy:vi.fn()}));
vi.mock('../../src/app/features/budget/services/pettyCashVoucherService',()=>({createVoucherCashRequest:api.create}));
vi.mock('../../src/app/features/budget/services/budgetService',()=>({createContextualCashRequest:api.legacy,resubmitContextualCashRequest:vi.fn(),uploadCashRequestAttachment:vi.fn()}));
import {CashRequestForm} from '../../src/app/features/budget/components/CashRequestForm';
const context:TaskFundingContext={funded:true,supportsItemizedCash:true,taskId:'task',taskBudget:40000,available:40000,lines:[{id:'a',expenseClass:'supplies',category:'Office supplies',particular:'Meeting materials',fundSource:'Project budget',amount:40000,available:40000}]};
beforeEach(()=>{api.create.mockResolvedValue('request');});afterEach(()=>{cleanup();vi.clearAllMocks();});
function open(data=context){const onSaved=vi.fn().mockResolvedValue(undefined),onCancel=vi.fn();render(<CashRequestForm context={data} taskId="task" subtaskId="subtask" orgId="office" currentUserId="member" onSaved={onSaved} onCancel={onCancel}/>);return {onSaved,onCancel};}
it('requests against the assigned task budget without source selectors or add-funding controls',async()=>{
 const {onSaved}=open();expect(screen.queryByRole('combobox')).toBeNull();expect(screen.queryByText('What needs to be purchased?')).toBeNull();expect(screen.queryByRole('button',{name:/Add another/})).toBeNull();
 fireEvent.change(screen.getByRole('spinbutton',{name:'Amount'}),{target:{value:'1200'}});fireEvent.change(screen.getByLabelText('Purpose'),{target:{value:'Meeting supplies'}});
 fireEvent.click(screen.getByRole('button',{name:'Request cash'}));await waitFor(()=>expect(api.create).toHaveBeenCalledWith(expect.objectContaining({taskId:'task',subtaskId:'subtask',lines:[{allocationLineId:'a',amount:1200}]})));await waitFor(()=>expect(onSaved).toHaveBeenCalledOnce());
});
it('blocks excessive amounts and still lets the user cancel',()=>{
 const {onCancel}=open();fireEvent.change(screen.getByRole('spinbutton',{name:'Amount'}),{target:{value:'40001'}});fireEvent.change(screen.getByLabelText('Purpose'),{target:{value:'Supplies'}});
 expect(screen.getByRole('alert')).toHaveTextContent('Only ₱40,000.00 is available from this task');expect(screen.getByRole('button',{name:'Request cash'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'Cancel'}));expect(onCancel).toHaveBeenCalledOnce();expect(api.create).not.toHaveBeenCalled();
});
it('automatically divides a request over existing allocations without adding budget',()=>{
 const data={...context,available:700,lines:[{...context.lines[0],available:300},{...context.lines[0],id:'b',available:400}]};
 expect(requestFunding(data,600)).toMatchObject({available:700,covered:true,lines:[{allocationLineId:'a',amount:300},{allocationLineId:'b',amount:300}]});
 expect(requestFunding(data,701).covered).toBe(false);
});
it('honors the overall available amount and the subtask cap rather than summing unrestricted sources',()=>{
 const data={...context,available:150,cap:{id:'cap',allocationLineId:'a',amount:200,available:150,reason:'Subtask limit'},lines:[{...context.lines[0],available:200},{...context.lines[0],id:'b',available:1000}]};
 expect(requestFunding(data,150)).toMatchObject({available:150,covered:true,lines:[{allocationLineId:'a',amount:150}]});expect(requestFunding(data,151).covered).toBe(false);
});
it('keeps cents exact and never selects exhausted sources',()=>{
 const data={...context,available:.3,lines:[{...context.lines[0],available:0},{...context.lines[0],id:'b',available:.1},{...context.lines[0],id:'c',available:.2}]};
 expect(requestFunding(data,.3)).toMatchObject({covered:true,lines:[{allocationLineId:'b',amount:.1},{allocationLineId:'c',amount:.2}]});
});
it('retains preferred original sources when correcting a request',()=>{
 const data={...context,lines:[{...context.lines[0],available:100},{...context.lines[0],id:'b',available:100}],available:200};
 expect(requestFunding(data,150,['b']).lines).toEqual([{allocationLineId:'b',amount:100},{allocationLineId:'a',amount:50}]);
});
