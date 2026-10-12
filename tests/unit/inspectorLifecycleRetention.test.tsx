// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {requestNavigation} from '../../src/app/shared/navigationGuard';
const update=vi.hoisted(()=>vi.fn());
vi.mock('../../src/app/features/tasks',()=>({updateTaskStatus:update,ProgressUpdateForm:()=>null}));
vi.mock('../../src/app/features/reviews',()=>({SubmitForReviewForm:()=>null}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'lead'},userProfile:{full_name:'Recorded Lead'}})}));
import {InspectorExecution} from '../../src/app/features/task-inspector/components/InspectorExecution';
import {useInspectorLifecycle} from '../../src/app/features/task-inspector/hooks/useInspectorLifecycle';
import type {Task} from '../../src/app/features/tasks';
afterEach(()=>{cleanup();vi.clearAllMocks();});
describe('NW7.3 retained start/resume lifecycle',()=>{
 for(const status of ['todo','changes_requested'] as const)it('keeps '+status+' pending protection, denial recovery and saved refresh',async()=>{
  const changed=vi.fn(),close=vi.fn(),navigation=vi.fn();let reject!:(reason:Error)=>void;
  update.mockImplementationOnce(()=>new Promise((_resolve,no)=>{reject=no;})).mockResolvedValueOnce(undefined);
  const task={id:'root',title:'Assessment',status,createdAt:1,updatedAt:1} as Task;
  function Probe(){const lifecycle=useInspectorLifecycle(task,changed,close);return <>
   {lifecycle.error&&<p role="alert">{lifecycle.error}</p>}
   <InspectorExecution task={task} subtasks={[]} canStart={status==='todo'} canResume={status==='changes_requested'} canSubmit={false} canPostProgress={false} busy={lifecycle.busy} onStart={lifecycle.start} onSubmitted={vi.fn()}/>
  </>;}
  render(<Probe/>);const name=status==='todo'?'Start work':'Resume work',button=screen.getByRole('button',{name});
  await act(async()=>{fireEvent.click(button);fireEvent.click(button);});
  expect(update).toHaveBeenCalledOnce();expect(update).toHaveBeenCalledWith('root','in_progress',{id:'lead',name:'Recorded Lead'});
  expect(await requestNavigation(navigation)).toBe(false);expect(navigation).not.toHaveBeenCalled();
  await act(async()=>reject(new Error('Current task access denied')));
  expect(screen.getByRole('alert').textContent).toContain('Current task access denied');expect(changed).not.toHaveBeenCalled();expect(close).not.toHaveBeenCalled();
  await act(async()=>fireEvent.click(screen.getByRole('button',{name})));
  expect(update).toHaveBeenCalledTimes(2);expect(changed).toHaveBeenCalledOnce();expect(close).toHaveBeenCalledOnce();
 });
});
