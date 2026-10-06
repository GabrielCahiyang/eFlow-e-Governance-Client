// @vitest-environment jsdom
import { act,cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { installNavigationConfirmation,requestNavigation } from '../../src/app/shared/navigationGuard';
import type { Subtask } from '../../src/app/features/subtasks';
const calls=vi.hoisted(()=>({save:vi.fn(),submit:vi.fn()}));
vi.mock('../../src/app/features/subtasks/services/subtaskWorkflowService',()=>({saveSubtaskProgress:calls.save,submitSubtaskForReview:calls.submit}));
import { SubtaskProgressForm } from '../../src/app/features/subtasks/components/SubtaskProgressForm';
const subtask={id:'s',taskId:'t',title:'Evidence',status:'todo',percentComplete:0,assignedToIds:['me']} as Subtask;
let uninstall:(()=>void)|undefined;
beforeEach(()=>vi.clearAllMocks());afterEach(()=>{cleanup();uninstall?.();});
describe('delegated subtask evidence drafts',()=>{
 it('keeps typed evidence and discards only after an accepted navigation guard',async()=>{
  const confirm=vi.fn().mockResolvedValue(false);uninstall=installNavigationConfirmation(confirm);render(<SubtaskProgressForm subtask={subtask} onSaved={()=>{}}/>);
  fireEvent.change(screen.getByLabelText('Progress note (optional)'),{target:{value:'My work draft'}});const navigate=vi.fn();expect(await requestNavigation(navigate)).toBe(false);expect(navigate).not.toHaveBeenCalled();expect((screen.getByLabelText('Progress note (optional)') as HTMLTextAreaElement).value).toBe('My work draft');
  confirm.mockResolvedValue(true);await act(async()=>{expect(await requestNavigation(navigate)).toBe(true);});expect((screen.getByLabelText('Progress note (optional)') as HTMLTextAreaElement).value).toBe('');
 });
 it('deduplicates saves, blocks navigation while pending and retains failures',async()=>{
  let reject!:(error:Error)=>void;calls.save.mockImplementation(()=>new Promise((_,failed)=>{reject=failed;}));uninstall=installNavigationConfirmation(vi.fn());render(<SubtaskProgressForm subtask={subtask} onSaved={()=>{}}/>);
  fireEvent.change(screen.getByLabelText('Progress note (optional)'),{target:{value:'Retained'}});const button=screen.getByRole('button',{name:'Save update'});fireEvent.click(button);fireEvent.click(button);expect(calls.save).toHaveBeenCalledOnce();expect(await requestNavigation(vi.fn())).toBe(false);expect(screen.getByLabelText('Progress note (optional)').matches(':disabled')).toBe(true);
  await act(async()=>reject(new Error('Evidence denied')));expect(screen.getByRole('alert').textContent).toContain('Evidence denied');expect((screen.getByLabelText('Progress note (optional)') as HTMLTextAreaElement).value).toBe('Retained');expect(screen.getByLabelText('Progress note (optional)').matches(':disabled')).toBe(false);
 });
 it('marks successful saves clean and resets fields without duplicating workflow writes',async()=>{
  calls.save.mockResolvedValue(undefined);const saved=vi.fn(),confirm=vi.fn().mockResolvedValue(false);uninstall=installNavigationConfirmation(confirm);render(<SubtaskProgressForm subtask={subtask} onSaved={saved}/>);fireEvent.change(screen.getByLabelText('Progress note (optional)'),{target:{value:'Recorded'}});fireEvent.click(screen.getByRole('button',{name:'Save update'}));await waitFor(()=>expect(saved).toHaveBeenCalledOnce());expect(await requestNavigation(vi.fn())).toBe(true);expect(confirm).not.toHaveBeenCalled();
 });
});
