// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const api=vi.hoisted(()=>({confirm:undefined as any,fail:undefined as any,form:{} as any,stop:vi.fn()}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'lead'}})}));
vi.mock('../../src/app/services/taskDiscussionService',()=>({subscribeToProgressUpdates:(_:string,confirm:any,fail:any)=>{api.confirm=confirm;api.fail=fail;return api.stop;},submitProgressUpdate:vi.fn()}));
vi.mock('../../src/app/features/tasks',async()=>({...await import('../../src/app/features/tasks/selectors/submissionReadiness'),submitTaskForReview:vi.fn()}));
vi.mock('../../src/app/features/work-state',async()=>({...await import('../../src/app/features/work-state/selectors'),WorkExecutionForm:(props:any)=>{api.form=props;return <p>{props.initialBlocker}</p>;}}));
import { InspectorExecution } from '../../src/app/features/task-inspector/components/InspectorExecution';
import type { Task } from '../../src/app/features/tasks';
afterEach(()=>{cleanup();vi.clearAllMocks();});
const props={task:{id:'task',status:'in_progress'} as Task,subtasks:[],canStart:false,canResume:false,canSubmit:true,canPostProgress:true,busy:false,onStart:()=>{},onSubmitted:()=>{}};

it('keeps a confirmed blocker on failure and clears the error only after a successful retry',()=>{
 render(<InspectorExecution {...props}/>); expect(api.form.disabled).toBe(true);
 act(()=>api.confirm([{blocker:'Equipment missing'}])); expect(screen.getByText('Equipment missing')).toBeTruthy();expect(api.form.disabled).toBe(false);
 act(()=>api.fail('Network unavailable')); expect(screen.getByRole('alert').textContent).toContain('last confirmed blocker');expect(api.form.initialBlocker).toBe('Equipment missing');expect(api.form.disabled).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'Retry work updates'}));expect(api.stop).toHaveBeenCalledOnce();expect(api.form.initialBlocker).toBe('Equipment missing');
 act(()=>api.confirm([]));expect(screen.queryByRole('alert')).toBeNull();expect(api.form.initialBlocker).toBe('');expect(api.form.disabled).toBe(false);
});
it('does not claim a clear blocker after an initial failure or carry it into another task',()=>{
 const view=render(<InspectorExecution {...props}/>);act(()=>api.fail('Read unavailable'));
 expect(screen.getByRole('alert').textContent).toContain('could not be verified');expect(api.form.disabled).toBe(true);
 act(()=>api.confirm([{blocker:'Equipment missing'}]));
 view.rerender(<InspectorExecution {...props} task={{...props.task,id:'other'}}/>);
 expect(api.form.initialBlocker).toBe('');expect(api.form.disabled).toBe(true);
});
it('blocks the Start affordance for a contributor even when they can post progress',()=>{
 render(<InspectorExecution {...props} task={{...props.task,status:'todo'}} pendingDependencies={1}/>);
 expect(screen.queryByRole('button',{name:'Start work'})).toBeNull();
 expect(screen.getByText(/Starting work and final submission both wait/)).toBeTruthy();
});
