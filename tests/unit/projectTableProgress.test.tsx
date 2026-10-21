// @vitest-environment jsdom
import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import type {Task} from '../../src/app/features/tasks';
vi.mock('../../src/app/features/budget',()=>({ProjectTaskBudgetCell:()=>null}));
vi.mock('../../src/app/features/tasks',()=>({assignTask:vi.fn(),getTaskLeadId:()=>null}));
vi.mock('../../src/app/features/project-offices',()=>({TaskOfficeControl:()=>null}));
vi.mock('../../src/app/features/nested-work',()=>({supportsNestedWork:()=>false,WorkRootOwner:()=>null}));
vi.mock('../../src/app/features/project-table/components/PlanningCells',()=>({TimelineCell:()=>null,DependencyCell:()=>null,NumberCell:()=>null}));
import {ProjectTaskCell} from '../../src/app/features/project-table/components/ProjectTaskCells';
afterEach(cleanup);
it.each([['todo','Not started'],['in_progress','In progress'],['for_review','Awaiting approval'],['cancelled','Cancelled'],['completed','Approved']] as const)('describes %s work accurately when it has no subitems', (status,label)=>{
 const task={id:'task',title:'QA work',status} as Task;
 render(<ProjectTaskCell column="progress" task={task} tasks={[task]} profiles={[]} people={[]} orgs={[]} editable={false} busy={false} canSetOffice={false} hasStaffedSubitems={false} statuses={[]} save={vi.fn()} write={vi.fn()}/>);
 expect(screen.getByLabelText('Progress for QA work').textContent).toBe(label);
 expect(screen.getByRole('progressbar').getAttribute('value')).toBe(status==='completed'?'100':'0');
});
