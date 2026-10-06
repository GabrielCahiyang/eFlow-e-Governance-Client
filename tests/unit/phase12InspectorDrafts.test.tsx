// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe,it,expect,vi,afterEach } from 'vitest';
import { requestNavigation, installNavigationConfirmation } from '../../src/app/shared/navigationGuard';
const feed=vi.hoisted(()=>({callback:undefined as undefined|((comments:unknown[])=>void),error:undefined as undefined|((message:string)=>void),post:vi.fn()}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'member'},userProfile:{role:'member',full_name:'Member'}})}));
vi.mock('../../src/app/components/ui/Toast',()=>({useToast:()=>({toast:vi.fn()})}));
vi.mock('../../src/app/services/taskDiscussionService',()=>({
 subscribeToComments:(_id:string, callback:(comments:unknown[])=>void,error:(message:string)=>void)=>{feed.callback=callback;feed.error=error;return ()=>{};},
 postComment:feed.post,moderateDeleteComment:vi.fn(),mergeTaskComments:(a:unknown[],b:unknown)=>[...a,b],
}));
import { TaskDiscussion } from '../../src/app/components/workflow/TaskDiscussion';
afterEach(()=>{cleanup();vi.clearAllMocks();});
describe('Phase 12 discussion safety',()=>{
 it('protects a discussion draft on section/route dismissal and discards after explicit acceptance',async()=>{
  const confirm=vi.fn().mockResolvedValue(false), uninstall=installNavigationConfirmation(confirm), action=vi.fn();
  render(<TaskDiscussion taskId="a"/>);fireEvent.change(screen.getByRole('textbox'),{target:{value:'Keep this'}});
  expect(await requestNavigation(action)).toBe(false);expect(action).not.toHaveBeenCalled();expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Keep this');
  confirm.mockResolvedValue(true);expect(await requestNavigation(action)).toBe(true);expect(action).toHaveBeenCalledOnce();uninstall();
 });
 it('blocks duplicate sends and pending dismissal, and retains a failed draft',async()=>{
  let reject:(error:Error)=>void=()=>{};feed.post.mockReturnValueOnce(new Promise((_resolve,r)=>{reject=r;}));
  render(<TaskDiscussion taskId="a"/>);fireEvent.change(screen.getByRole('textbox'),{target:{value:'Evidence discussion'}});
  fireEvent.click(screen.getByRole('button',{name:'Send',exact:true}));fireEvent.keyDown(screen.getByRole('textbox'),{key:'Enter',ctrlKey:true});
  expect(feed.post).toHaveBeenCalledTimes(1);expect(await requestNavigation(vi.fn())).toBe(false);
  reject(new Error('Denied'));await waitFor(()=>expect((screen.getByRole('button',{name:'Send'}) as HTMLButtonElement).disabled).toBe(false));expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Evidence discussion');
 });
 it('ignores a stale task feed and distinguishes failed loading from an empty discussion',async()=>{
  const {rerender}=render(<TaskDiscussion taskId="a"/>);const old=feed.callback;rerender(<TaskDiscussion taskId="b"/>);
  old?.([{id:'secret',authorName:'Other task',body:'Stale record',createdAt:1}]);expect(screen.queryByText('Stale record')).toBeNull();
  feed.error?.('Discussion access denied');await screen.findByText('Discussion access denied');expect(screen.queryByText('No comments yet. Start the discussion.')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Retry discussion'}));feed.callback?.([]);await screen.findByText('No comments yet. Start the discussion.');
 });
});
