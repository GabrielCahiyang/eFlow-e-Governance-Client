// @vitest-environment jsdom
import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'lead'},userProfile:{full_name:'Lead'}})}));
vi.mock('../../src/app/services/taskDiscussionService',()=>({subscribeToProgressUpdates:()=>()=>{},submitProgressUpdate:vi.fn()}));
vi.mock('../../src/app/features/tasks',()=>({updateTaskStatus:vi.fn(),submitTaskForReview:vi.fn()}));
vi.mock('../../src/app/features/work-state',async()=>({...await import('../../src/app/features/work-state/selectors'),WorkExecutionForm:()=>null}));
import {InspectorExecution} from '../../src/app/features/task-inspector/components/InspectorExecution';
import type {Task} from '../../src/app/features/tasks';
import type {Subtask} from '../../src/app/features/subtasks';
afterEach(cleanup);
describe('parent approval summary',()=>{
 it.each([
  ['in_progress','Ready for final review'],
  ['for_review','Final review in progress'],
  ['completed','Task approved'],
 ] as const)('keeps approved steps distinct from the parent %s state', (status,message)=>{
  render(<InspectorExecution task={{id:'root',status} as Task} subtasks={[{id:'step',status:'completed'} as Subtask]} canStart={false} canResume={false} canSubmit={false} canPostProgress={false} busy={false} onStart={()=>{}} onSubmitted={()=>{}}/>);
  expect(screen.getByText('1 of 1 steps approved')).toBeTruthy();expect(screen.getByText(message)).toBeTruthy();
  if(status!=='in_progress')expect(screen.queryByText('Ready for final review')).toBeNull();
 });
});
