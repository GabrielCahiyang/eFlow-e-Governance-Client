// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
const api=vi.hoisted(()=>({rpc:vi.fn(),session:vi.fn(),upload:vi.fn()}));
vi.mock('../../src/lib/supabase',()=>({supabase:{rpc:api.rpc,auth:{getSession:api.session}}}));
vi.mock('../../src/app/features/subtasks/services/subtaskWorkflowService',()=>({uploadSubtaskWorkFile:api.upload}));
vi.mock('@vibe/core',()=>({Button:({children,onClick,disabled}:any)=><button onClick={onClick} disabled={disabled}>{children}</button>}));
vi.mock('../../src/app/shared/useExplicitDraft',()=>({useExplicitDraft:()=>({pendingRef:{current:false},markClean:vi.fn()})}));
import {WorkExecutionForm} from '../../src/app/features/work-state/components/WorkExecutionForm';
import {completeSubitem,subitemCompletionAttempt} from '../../src/app/features/subtasks/services/subtaskCompletion';
beforeEach(()=>{vi.resetAllMocks();api.session.mockResolvedValue({data:{session:{user:{id:'lead'}}}});});
afterEach(cleanup);
it('completes a step directly without mandatory note or evidence',async()=>{
 const submit=vi.fn().mockResolvedValue(undefined);render(<WorkExecutionForm completionMode="direct" status="todo" onSave={vi.fn()} onSubmit={submit}/>);
 expect(screen.queryByText(/No separate approval is needed/)).toBeNull();
 fireEvent.change(screen.getByLabelText('Work status'),{target:{value:'submit'}});fireEvent.click(screen.getByRole('button',{name:'Mark complete'}));
 await waitFor(()=>expect(submit).toHaveBeenCalledWith(expect.objectContaining({note:'',files:[]})));
 expect(screen.queryByRole('button',{name:'Submit for review'})).toBeNull();
});
it('lets an earlier pending step finish while keeping an incomplete predecessor blocked',()=>{
 const view=render(<WorkExecutionForm completionMode="direct" status="for_review" initialAction="submit" onSave={vi.fn()} onSubmit={vi.fn()}/>);
 expect(screen.getByRole('button',{name:'Mark complete'})).toBeTruthy();
 view.rerender(<WorkExecutionForm completionMode="direct" status="for_review" blockedBy="Complete the first step." onSave={vi.fn()} onSubmit={vi.fn()}/>);
 expect(screen.queryByLabelText('Work status')).toBeNull();expect(screen.getByText('Complete the first step.')).toBeTruthy();
});
it('locks unverified completion terms but retains its retry action',()=>{
 render(<WorkExecutionForm completionMode="direct" status="in_progress" initialAction="submit" freezeFields onSave={vi.fn()} onSubmit={vi.fn()}/>);
 expect((screen.getByLabelText('Work status') as HTMLSelectElement).disabled).toBe(true);
 expect((screen.getByRole('button',{name:'Retry completion'}) as HTMLButtonElement).disabled).toBe(false);
});
it('retries a lost response with the same request and uploaded evidence',async()=>{
 const file=new File(['proof'],'proof.pdf',{type:'application/pdf'}),attempt=subitemCompletionAttempt('step','Done',[file]);
 api.upload.mockResolvedValue({filePath:'protected/proof.pdf',fileName:file.name,fileSize:file.size});
 api.rpc.mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce({data:{id:'step',status:'completed'}});
 await expect(completeSubitem(attempt)).rejects.toThrow('Connection lost');await completeSubitem(attempt);
 expect(api.upload).toHaveBeenCalledTimes(1);expect(api.rpc.mock.calls[1]).toEqual(api.rpc.mock.calls[0]);expect(api.rpc.mock.calls[0][0]).toBe('complete_subitem');
});
it('rejects a retry after the signed-in account changes',async()=>{
 const attempt=subitemCompletionAttempt('step','',[]);api.rpc.mockRejectedValueOnce(new Error('Lost'));await expect(completeSubitem(attempt)).rejects.toThrow('Lost');
 api.session.mockResolvedValue({data:{session:{user:{id:'someone-else'}}}});await expect(completeSubitem(attempt)).rejects.toThrow('same account');expect(api.rpc).toHaveBeenCalledTimes(1);
});
it('does not report success for an unverified server result',async()=>{
 api.rpc.mockResolvedValue({data:{id:'step',status:'for_review'}});await expect(completeSubitem(subitemCompletionAttempt('step','',[]))).rejects.toThrow('not verified');
});
it('rechecks current completion access before uploading, but preserves receipt recovery after a lost response',async()=>{
 const attempt=subitemCompletionAttempt('step','',[]),recheck=vi.fn().mockResolvedValue(undefined);
 api.rpc.mockRejectedValueOnce(new Error('Lost response')).mockResolvedValueOnce({data:{id:'step',status:'completed'}});
 await expect(completeSubitem(attempt,recheck)).rejects.toThrow('Lost response');
 recheck.mockRejectedValue(new Error('Already completed'));
 await completeSubitem(attempt,recheck);expect(recheck).toHaveBeenCalledTimes(1);
 expect(api.rpc.mock.calls[0]).toEqual(api.rpc.mock.calls[1]);
});
it('rejects a new completion after current authority is revoked, before any upload or write',async()=>{
 const attempt=subitemCompletionAttempt('step','',[new File(['proof'],'proof.pdf')]);
 await expect(completeSubitem(attempt,async()=>{throw new Error('Access changed');})).rejects.toThrow('Access changed');
 expect(api.upload).not.toHaveBeenCalled();expect(api.rpc).not.toHaveBeenCalled();
});
it('rechecks after a confirmed SQL rejection before retrying the same terms',async()=>{
 const attempt=subitemCompletionAttempt('step','',[]),recheck=vi.fn().mockResolvedValue(undefined);
 api.rpc.mockResolvedValueOnce({error:{code:'23514',message:'Prerequisite incomplete'}}).mockResolvedValueOnce({data:{id:'step',status:'completed'}});
 await expect(completeSubitem(attempt,recheck)).rejects.toThrow('Prerequisite');await completeSubitem(attempt,recheck);
 expect(recheck).toHaveBeenCalledTimes(2);expect(api.rpc.mock.calls[0]).toEqual(api.rpc.mock.calls[1]);
});
it('applies newly confirmed blockers and clearing while preserving an edited local blocker',()=>{
 const props={completionMode:'direct' as const,status:'in_progress',onSave:vi.fn(),onSubmit:vi.fn()};
 const view=render(<WorkExecutionForm {...props}/>);
 view.rerender(<WorkExecutionForm {...props} initialBlocker="Equipment missing"/>);
 expect((screen.getByLabelText('Blocker reason') as HTMLTextAreaElement).value).toBe('Equipment missing');
 view.rerender(<WorkExecutionForm {...props} initialBlocker=""/>);expect(screen.queryByLabelText('Blocker reason')).toBeNull();
 view.rerender(<WorkExecutionForm {...props} initialBlocker="Equipment missing"/>);
 fireEvent.change(screen.getByLabelText('Blocker reason'),{target:{value:'My unsaved blocker'}});
 view.rerender(<WorkExecutionForm {...props} initialBlocker=""/>);
 expect((screen.getByLabelText('Blocker reason') as HTMLTextAreaElement).value).toBe('My unsaved blocker');
});

it('shows failed completion in a red alert panel and retains the draft',async()=>{
 const submit=vi.fn().mockRejectedValue(new Error('Complete the previous step first.'));
 render(<WorkExecutionForm completionMode="direct" status="in_progress" initialAction="submit" onSave={vi.fn()} onSubmit={submit}/>);
 fireEvent.change(screen.getByLabelText('Completion note'),{target:{value:'My completion evidence'}});
 fireEvent.click(screen.getByRole('button',{name:'Mark complete'}));
 await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Complete the previous step first.'));
 expect(screen.getByRole('alert').className).toContain('work-state-error');
 expect(screen.getByText('Could not complete this subtask')).toBeTruthy();
 expect((screen.getByLabelText('Completion note') as HTMLTextAreaElement).value).toBe('My completion evidence');
});
