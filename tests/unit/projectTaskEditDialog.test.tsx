// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({tasks:[] as Task[]}));
const api=vi.hoisted(()=>({policy:vi.fn()}));
vi.mock('../../src/app/features/tasks',()=>({fetchTaskDetailEditState:api.policy}));
vi.mock('../../src/app/hooks/useFirebaseData',()=>({useTasks:()=>({tasks:mocks.tasks})}));
import {ProjectTaskEditDialog} from '../../src/app/features/project-table/components/ProjectTaskEditDialog';
import type {Task} from '../../src/app/features/tasks';

const task:Task={id:'task',title:'Prepare report',status:'in_progress',priority:'medium',linkedProjectId:'project',startDate:'2099-11-01',deadline:'2099-12-01T00:00:00Z',createdAt:1,updatedAt:1};
beforeEach(()=>{vi.clearAllMocks();mocks.tasks=[];api.policy.mockResolvedValue({version:1,task_id:'task',node_id:null,started:true,details:true,due:true,planning:false});});
afterEach(cleanup);

it('explains locked planning, shows a reason only for a changed due date, and sends the recorded reason',async()=>{
 const save=vi.fn(async()=>{});render(<ProjectTaskEditDialog task={task} save={save} onClose={vi.fn()}/>);
 await screen.findByText(/Start date and prerequisites cannot be changed/);
 expect((screen.getByLabelText('Start date') as HTMLInputElement).disabled).toBe(true);
 expect((screen.getByRole('group',{name:'Prerequisite tasks'}) as HTMLFieldSetElement).disabled).toBe(true);
 expect(screen.queryByLabelText('Reason for due-date change')).toBeNull();
 expect(screen.queryByText(/Estimated (hours|days)/i)).toBeNull();
 const due=screen.getByLabelText('Due date');
 fireEvent.change(due,{target:{value:'2099-12-02'}});
 const reason=screen.getByLabelText('Reason for due-date change');
 expect(due.closest('label')?.nextElementSibling?.contains(reason)).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'Save task'}));
 await screen.findByRole('alert');expect(save).not.toHaveBeenCalled();
 fireEvent.change(due,{target:{value:'2099-12-01'}});
 expect(screen.queryByLabelText('Reason for due-date change')).toBeNull();
 fireEvent.change(due,{target:{value:'2099-12-02'}});
 fireEvent.change(screen.getByLabelText('Reason for due-date change'),{target:{value:'Approved extension'}});
 fireEvent.click(screen.getByRole('button',{name:'Save task'}));
 await waitFor(()=>expect(save).toHaveBeenCalledExactlyOnceWith({deadline:'2099-12-02',change_reason:'Approved extension'}));
});

 it('saves a title correction without requesting or sending a schedule reason',async()=>{
 const save=vi.fn(async()=>{});render(<ProjectTaskEditDialog task={task} save={save} onClose={vi.fn()}/>);
 await screen.findByText(/Start date and prerequisites cannot be changed/);
 expect(screen.queryByText(/Use Budget to allocate project funding/i)).toBeNull();
 fireEvent.change(screen.getByLabelText('Task title'),{target:{value:'Corrected report'}});
 expect(screen.queryByLabelText('Reason for due-date change')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Save task'}));
 await waitFor(()=>expect(save).toHaveBeenCalledExactlyOnceWith({title:'Corrected report'}));
});

it('saves a non-date correction on an unstarted task with historical dates without failing date validation or sending date fields',async()=>{
 api.policy.mockResolvedValue({version:1,task_id:'task',node_id:null,started:false,details:true,due:true,planning:true});
 const save=vi.fn(async()=>{});
 render(<ProjectTaskEditDialog task={{...task,status:'todo',startDate:'2020-01-01',deadline:'2020-01-10T00:00:00Z'}} save={save} onClose={vi.fn()}/>);
 await screen.findByLabelText('Task title');
 fireEvent.change(screen.getByLabelText('Task title'),{target:{value:'Historical task title fix'}});
 fireEvent.click(screen.getByRole('button',{name:'Save task'}));
 await waitFor(()=>expect(save).toHaveBeenCalledExactlyOnceWith({title:'Historical task title fix',priority:'medium'}));
});

it('renders prerequisite cards without visible checkboxes and allows toggling before work starts',async()=>{
 mocks.tasks=[
  {...task,id:'prereq-1',title:'hh',status:'todo'},
  {...task,id:'prereq-2',title:'asdsadsa',status:'pending_assignment'},
 ];
 api.policy.mockResolvedValue({version:1,task_id:'task',node_id:null,started:false,details:true,due:true,planning:true});
 const save=vi.fn(async()=>{});
 render(<ProjectTaskEditDialog task={{...task,status:'todo'}} save={save} onClose={vi.fn()}/>);
 const option=await screen.findByRole('checkbox',{name:/^hh/});
 expect(option.className).toContain('sr-only');
 expect(screen.getByText('To do')).toBeTruthy();
 expect(screen.getByText('Pending assignment')).toBeTruthy();
 expect(screen.queryByText(/Use Budget to allocate project funding/i)).toBeNull();
 fireEvent.click(option);
 expect(screen.getByText('1 prerequisite selected')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Save task'}));
 await waitFor(()=>expect(save).toHaveBeenCalledWith(expect.objectContaining({dependency_ids:['prereq-1']})));
});
