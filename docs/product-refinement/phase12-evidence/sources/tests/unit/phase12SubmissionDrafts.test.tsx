// @vitest-environment jsdom
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {describe,it,expect,vi,afterEach} from 'vitest';
import {installNavigationConfirmation,requestNavigation} from '../../src/app/shared/navigationGuard';
const service=vi.hoisted(()=>({submit:vi.fn().mockResolvedValue(undefined)}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'lead'},userProfile:{full_name:'Lead'}})}));
vi.mock('../../src/app/components/ui/Toast',()=>({useToast:()=>({toast:vi.fn()})}));
vi.mock('../../src/app/services/taskService',()=>({submitTaskForReview:service.submit}));
vi.mock('../../src/app/services/taskDiscussionService',()=>({BLOCKER_CATEGORIES:['None'],submitProgressUpdate:vi.fn()}));
import {SubmitForReviewForm} from '../../src/app/components/workflow/SubmitForReviewForm';
import {ProgressUpdateForm} from '../../src/app/components/workflow/ProgressUpdateForm';
import type {Task} from '../../src/app/features/tasks';
afterEach(cleanup);
describe('Phase 12 successful saves and other drafts',()=>{
 it('marks committed evidence clean while protecting an unrelated progress draft on inspector closure',async()=>{
  const close=vi.fn(),confirm=vi.fn().mockResolvedValue(false),uninstall=installNavigationConfirmation(confirm);
  render(<><ProgressUpdateForm taskId="a"/><SubmitForReviewForm task={{id:'a',title:'Task',status:'in_progress',subtaskCount:0} as Task} onSubmitted={()=>{void requestNavigation(close);}}/></>);
  fireEvent.change(screen.getByRole('slider'),{target:{value:'20'}});fireEvent.change(screen.getByLabelText('Task completion note'),{target:{value:'Ready for review'}});
  fireEvent.click(screen.getByRole('button',{name:'Submit for review',exact:true}));
  await waitFor(()=>expect(confirm).toHaveBeenCalledWith(['Task progress update']));expect(service.submit).toHaveBeenCalledOnce();expect(close).not.toHaveBeenCalled();expect((screen.getByRole('slider') as HTMLInputElement).value).toBe('20');
  confirm.mockResolvedValue(true);expect(await requestNavigation(close)).toBe(true);expect(close).toHaveBeenCalledOnce();uninstall();
 });
});
