// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({data:{} as any,call:vi.fn(),reload:vi.fn()}));
vi.mock('../../src/app/features/project-setup/useProjectFlow',()=>({useProjectFlow:()=>({data:api.data,reload:api.reload,error:''})}));
vi.mock('../../src/app/features/project-setup/services/projectFlow',()=>({projectFlowCall:api.call,ProjectFlowError:class extends Error{}}));
import {TaskProjectFunding} from '../../src/app/features/project-setup/components/TaskProjectFunding';
import {CancelTaskFunding} from '../../src/app/features/project-setup/components/CancelTaskFunding';
beforeEach(()=>{vi.clearAllMocks();api.data={ready:true,canAllocate:true,project:{status:'active'},unallocated:600,funds:[{id:'empty',name:'Empty source',fiscal_year:2026,available:0},{id:'first',name:'First source',fiscal_year:2026,available:500},{id:'second',name:'Second source',fiscal_year:2026,available:100}]};api.reload.mockResolvedValue(undefined);api.call.mockResolvedValue({});});afterEach(cleanup);
it('combines two accounts into one task budget and sends only their separate amounts',async()=>{
 render(<TaskProjectFunding projectId="p" taskId="task" funded={false} onChanged={api.reload}/>);
 fireEvent.change(screen.getByLabelText('Task budget account 1'),{target:{value:'first'}});fireEvent.change(screen.getByLabelText('Task account 1 amount'),{target:{value:'300'}});fireEvent.click(screen.getByRole('button',{name:'Add another account'}));
 fireEvent.change(screen.getByLabelText('Task budget account 2'),{target:{value:'second'}});fireEvent.change(screen.getByLabelText('Task account 2 amount'),{target:{value:'50'}});expect(screen.getByText('Task budget').nextElementSibling).toHaveTextContent('350');
 fireEvent.change(screen.getByLabelText('Allocation reason'),{target:{value:'Supplies and travel'}});fireEvent.click(screen.getByRole('button',{name:'Allocate task budget'}));
 await waitFor(()=>expect(api.call).toHaveBeenCalledWith('allocate_project_task_funding',expect.objectContaining({p_lines:[{sourceId:'first',amount:300},{sourceId:'second',amount:50}]})));
});
it('adds a different account to an already funded task without resending its old allocation',async()=>{
 api.data.canExtendTaskFunding=true;api.data.taskFunding=[{id:'old',sourceId:'first',fiscalYear:2026,taskId:'task',amount:500,available:400}];
 render(<TaskProjectFunding projectId="p" taskId="task" funded onChanged={api.reload}/>);
 expect(screen.queryByRole('option',{name:/First source/})).toBeNull();fireEvent.change(screen.getByLabelText('Task budget account 1'),{target:{value:'second'}});fireEvent.change(screen.getByLabelText('Task account 1 amount'),{target:{value:'50'}});
 expect(screen.getByText('New task total').nextElementSibling).toHaveTextContent('550');fireEvent.change(screen.getByLabelText('Allocation reason'),{target:{value:'Additional travel'}});fireEvent.click(screen.getByRole('button',{name:'Add to task budget'}));
 await waitFor(()=>expect(api.call).toHaveBeenCalledWith('allocate_project_task_funding',expect.objectContaining({p_lines:[{sourceId:'second',amount:50}]})));
});
it('hides zero balances, prevents duplicate selections and caps the row count',()=>{
 render(<TaskProjectFunding projectId="p" taskId="task" funded={false} onChanged={api.reload}/>);
 expect(screen.queryByRole('option',{name:/Empty source/})).toBeNull();
 fireEvent.change(screen.getByLabelText('Task budget account 1'),{target:{value:'first'}});fireEvent.click(screen.getByRole('button',{name:'Add another account'}));
 const second=screen.getAllByRole('combobox')[1] as HTMLSelectElement;
 expect(second.querySelector('option[value="first"]')).toBeDisabled();expect(screen.getByRole('button',{name:'Add another account'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Remove task funding source 1'}));expect(screen.getByRole('button',{name:'Add another account'})).toBeEnabled();
});
it('names the overdrawn source before sending anything to the server',async()=>{
 render(<TaskProjectFunding projectId="p" taskId="task" funded={false} onChanged={api.reload}/>);
 fireEvent.change(screen.getByLabelText('Task budget account 1'),{target:{value:'first'}});fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'600'}});fireEvent.change(screen.getByLabelText('Allocation reason'),{target:{value:'Supplies'}});fireEvent.click(screen.getByRole('button',{name:'Allocate task budget'}));
 await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('First source (FY 2026): You entered ₱600.00, but only ₱500.00 is available. Reduce it by ₱100.00.'));expect(api.call).not.toHaveBeenCalled();
});
it('returns only unused funding and retains the same cancellation after a lost response',async()=>{
 api.call.mockRejectedValueOnce(new Error('Response lost')).mockResolvedValueOnce({});const changed=vi.fn().mockResolvedValue(undefined),lock=vi.fn();
 render(<CancelTaskFunding line={{id:'line',taskId:'task',task:'Task',source:'Supplies',amount:40000,available:30000}} onChanged={changed} onBusyChange={lock}/>);
 fireEvent.click(screen.getByRole('button',{name:'Return unused funding'}));fireEvent.change(screen.getByLabelText('Reason for cancelling'),{target:{value:'Unused budget'}});fireEvent.click(screen.getByRole('button',{name:'Confirm cancellation'}));
 await screen.findByRole('button',{name:'Retry cancellation'});const original=api.call.mock.calls[0];expect(original).toEqual(['release_project_task_funding',expect.objectContaining({p_line:'line',p_amount:30000,p_reason:'Unused budget',p_key:expect.any(String)})]);
 fireEvent.click(screen.getByRole('button',{name:'Retry cancellation'}));await waitFor(()=>expect(changed).toHaveBeenCalledOnce());expect(api.call.mock.calls[1]).toEqual(original);
});
it('lets the user back out without cancelling the allocation',()=>{
 render(<CancelTaskFunding line={{id:'line',taskId:'task',task:'Task',source:'Supplies',amount:40000,available:40000}} onChanged={api.reload} onBusyChange={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'Cancel allocation'}));fireEvent.click(screen.getByRole('button',{name:'Keep allocation'}));expect(api.call).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Cancel allocation'})).toBeEnabled();
});
