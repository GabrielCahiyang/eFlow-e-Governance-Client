// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({actor:'a',task:vi.fn(),record:vi.fn(),rpc:vi.fn()}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:api.actor}})}));
vi.mock('../../src/lib/supabase',()=>({supabase:{rpc:api.rpc}}));
vi.mock('../../src/app/features/tasks',()=>({fetchTaskById:api.task,rowToTask:(row:any)=>row}));
vi.mock('../../src/app/features/subtasks',()=>({fetchSubitemInspectorRecord:api.record,SubtaskWorkDrawer:({subtask,readOnly,initialSection,onClose}:any)=><section aria-label="Current subtask"><h2>{subtask.title}</h2><p>{readOnly?'Read only':'Current work'} · {initialSection}</p><button onClick={onClose}>Close current work</button></section>}));
vi.mock('../../src/app/features/notifications',()=>({useNotificationNavigationIntent:vi.fn()}));
import {SubtaskReviewInbox} from '../../src/app/features/reviews/components/SubtaskReviewInbox';
import {fetchPendingSubtaskReviews,fetchPersonalSubtaskReviews,subscribeToPendingSubtaskReviews} from '../../src/app/features/subtasks/services/subtaskWorkflowService';
const focus:any={notificationId:'n',kind:'subtask_review',taskId:'task',entityId:'step'};
beforeEach(()=>{vi.resetAllMocks();api.actor='a';api.task.mockResolvedValue({id:'task',title:'Task'});api.record.mockResolvedValue({subtask:{id:'step',taskId:'task',title:'Current step'}});});afterEach(cleanup);
it('retired queue adapters return no approvals and perform no private queue reads',async()=>{
 expect(await fetchPendingSubtaskReviews('a')).toEqual([]);expect(await fetchPersonalSubtaskReviews('b')).toEqual([]);const next=vi.fn(),stop=subscribeToPendingSubtaskReviews('a',false,next);expect(next).toHaveBeenCalledWith([]);stop();expect(api.rpc).not.toHaveBeenCalled();
});
it('legacy queue destination explains direct completion and returns to parent task reviews',()=>{
 const back=vi.fn();render(<SubtaskReviewInbox embedded onShowTasks={back}/>);expect(screen.getByText('Subtasks complete directly')).toBeTruthy();expect(screen.queryByRole('button',{name:'Approve evidence'})).toBeNull();expect(api.record).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Go to task reviews'}));expect(back).toHaveBeenCalledOnce();
});
it('an old notification opens the current checked subtask in Work and preserves a read-only caller',async()=>{
 render(<SubtaskReviewInbox focus={focus} readOnly onShowTasks={()=>{}}/>);await screen.findByRole('heading',{name:'Current step'});expect(api.record).toHaveBeenCalledWith('task','step');expect(screen.getByText('Read only · work')).toBeTruthy();expect(screen.queryByRole('button',{name:'Approve evidence'})).toBeNull();
});
it('does not show a foreign root from an old review link',async()=>{
 api.task.mockResolvedValue({id:'foreign'});render(<SubtaskReviewInbox focus={focus} onShowTasks={()=>{}}/>);await screen.findByRole('alert');expect(screen.queryByRole('region',{name:'Current subtask'})).toBeNull();
});
it('fails visibly and allows retrying the same checked work link',async()=>{
 api.record.mockRejectedValueOnce(new Error('Current work access denied'));render(<SubtaskReviewInbox focus={focus} onShowTasks={()=>{}}/>);expect((await screen.findByRole('alert')).textContent).toContain('Current work access denied');fireEvent.click(screen.getByRole('button',{name:'Retry opening work'}));await screen.findByRole('heading',{name:'Current step'});expect(api.record).toHaveBeenCalledTimes(2);
});
it('drops late private results when the signed-in account changes',async()=>{
 let finish!:(value:any)=>void;api.record.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));const view=render(<SubtaskReviewInbox focus={focus} onShowTasks={()=>{}}/>);api.actor='b';api.record.mockRejectedValueOnce(new Error('New account cannot access work'));view.rerender(<SubtaskReviewInbox focus={focus} onShowTasks={()=>{}}/>);await screen.findByRole('alert');await act(async()=>finish({subtask:{id:'step',title:'Old account private work'}}));expect(screen.queryByText('Old account private work')).toBeNull();
});
