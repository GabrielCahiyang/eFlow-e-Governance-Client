// @vitest-environment jsdom
import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
vi.mock('../../src/app/features/budget',()=>({WorkBudgetCard:()=> <div>Existing task funding</div>}));
vi.mock('../../src/app/features/nested-work',()=>({supportsNestedWork:()=>true}));
import {InspectorSummary} from '../../src/app/features/task-inspector/components/InspectorSummary';
import {TaskDepartmentProvider,type Task} from '../../src/app/features/tasks';
afterEach(cleanup);
const task={id:'task',title:'Book venue',status:'todo',priority:'medium',orgId:'office',deadline:'2026-11-05',startDate:'2026-10-31',projectTitle:'Customer Service Seminar',description:'Confirm the venue and prepare the meeting room.',percentComplete:75} as Task;
function show(input=task){return render(<TaskDepartmentProvider organizations={[{id:'office',name:'LEDIPO'} as any]}><InspectorSummary task={input} readOnly={false} dependencies={[]} canManageSubtasks={false} overdue={false}/></TaskDepartmentProvider>);}
it('groups task facts with status, priority and office without obsolete percentage progress',()=>{
 show();expect(screen.getByRole('heading',{name:'Task overview'})).toBeTruthy();
 for(const label of ['Status','Priority','Office: LEDIPO','Deadline','Start date','Project','Customer Service Seminar'])expect(screen.getByText(label)).toBeTruthy();
 expect(screen.getByText('Nov 5, 2026')).toBeTruthy();expect(screen.getByText('Oct 31, 2026')).toBeTruthy();
 expect(screen.queryByText('Progress')).toBeNull();expect(screen.queryByText(/\d+%/)).toBeNull();expect(screen.queryByRole('progressbar')).toBeNull();
 expect(screen.getByRole('region',{name:'Task description'}).textContent).toContain(task.description!);
 expect(screen.getByText('Existing task funding')).toBeTruthy();
});
it('keeps missing dates and project explicit instead of showing blank facts',()=>{
 show({...task,deadline:undefined,startDate:undefined,projectTitle:undefined});
 expect(screen.getByText('No deadline')).toBeTruthy();expect(screen.getByText('Not set')).toBeTruthy();expect(screen.getByText('No linked project')).toBeTruthy();
});
