// @vitest-environment jsdom
import {cleanup,render} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({start:vi.fn(),submit:vi.fn().mockResolvedValue(undefined),form:{} as any}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'lead'},userProfile:{full_name:'Lead'}})}));
vi.mock('../../src/app/services/taskDiscussionService',()=>({subscribeToProgressUpdates:()=>()=>{},submitProgressUpdate:vi.fn()}));
vi.mock('../../src/app/features/tasks',()=>({updateTaskStatus:api.start,submitTaskForReview:api.submit}));
vi.mock('../../src/app/features/work-state',async()=>({...await import('../../src/app/features/work-state/selectors'),WorkExecutionForm:(props:any)=>{api.form=props;return null;}}));
import {InspectorExecution} from '../../src/app/features/task-inspector/components/InspectorExecution';
import type {Task} from '../../src/app/features/tasks';
afterEach(()=>{cleanup();vi.clearAllMocks();});
const input={state:'in_progress' as const,note:'Completed the venue work',files:[],blocker:'',nextStep:''};
function view(lead=true,status='todo') {
 render(<InspectorExecution task={{id:'task',status} as Task} subtasks={[]} canStart={lead&&status==='todo'} canResume={lead&&status==='changes_requested'} canSubmit={lead&&status==='in_progress'} canPostProgress busy={false} onStart={()=>{}} onSubmitted={()=>{}}/>);
}
it.each(['todo','changes_requested','in_progress'])('submits stale %s UI through one atomic command',async status=>{
 view(true,status);await api.form.onSubmit(input);
 expect(api.start).not.toHaveBeenCalled();expect(api.submit).toHaveBeenCalledWith('task',expect.objectContaining({note:input.note,submitterId:'lead'}));
});
it('does not give contributor updates permission to submit the parent task',async()=>{
 view(false,'in_progress');expect(api.form.canSubmit).toBe(false);
 await expect(api.form.onSubmit(input)).rejects.toThrow('Only the task lead');expect(api.submit).not.toHaveBeenCalled();
});
