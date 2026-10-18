// @vitest-environment jsdom
import React from 'react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {WorkExecutionForm} from '../../src/app/features/work-state/components/WorkExecutionForm';
import {approvedWorkProgress} from '../../src/app/features/work-state/selectors';
vi.mock('@vibe/core',()=>({Button:({children,onClick,disabled}:any)=><button onClick={onClick} disabled={disabled}>{children}</button>}));
vi.mock('../../src/app/shared/useExplicitDraft',()=>({useExplicitDraft:()=>({pendingRef:{current:false},markClean:vi.fn()})}));
afterEach(cleanup);
describe('status-based execution',()=>{
 it('starts work without asking for a percentage and retains the page',async()=>{
  const save=vi.fn().mockResolvedValue(undefined);render(<WorkExecutionForm status="todo" onSave={save}/>);
  expect(screen.queryByRole('slider')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Start work'}));
  await waitFor(()=>expect(save).toHaveBeenCalledWith(expect.objectContaining({state:'in_progress',files:[]})));
  expect(screen.getByRole('region',{name:'Work status and update'})).toBeTruthy();
 });
 it('requires a reason for Stuck and preserves failed updates',async()=>{
  const save=vi.fn().mockRejectedValue(new Error('Try again'));render(<WorkExecutionForm status="in_progress" onSave={save}/>);
  fireEvent.change(screen.getByLabelText('Work status'),{target:{value:'stuck'}});fireEvent.click(screen.getByRole('button',{name:'Report blocker'}));
  expect(save).not.toHaveBeenCalled();expect(screen.getByRole('alert').textContent).toContain('blocking');
  fireEvent.change(screen.getByLabelText('Blocker reason'),{target:{value:'Need confirmation'}});fireEvent.click(screen.getByRole('button',{name:'Report blocker'}));
  await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Try again'));expect((screen.getByLabelText('Blocker reason') as HTMLTextAreaElement).value).toBe('Need confirmation');
 });
 it('requires both a note and supported evidence before submission',async()=>{
  const submit=vi.fn().mockResolvedValue(undefined);render(<WorkExecutionForm status="in_progress" onSave={vi.fn()} onSubmit={submit}/>);
  fireEvent.change(screen.getByLabelText('Work status'),{target:{value:'submit'}});expect((screen.getByRole('button',{name:'Submit for review'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Completion note'),{target:{value:'Finished the agenda'}});
  fireEvent.change(screen.getByLabelText('Evidence files'),{target:{files:[new File(['proof'],'agenda.pdf',{type:'application/pdf'})]}});
  fireEvent.click(screen.getByRole('button',{name:'Submit for review'}));await waitFor(()=>expect(submit).toHaveBeenCalledTimes(1));
 });
 it('cannot bypass a prerequisite or an approval lock',()=>{
  const save=vi.fn();const view=render(<WorkExecutionForm status="todo" blockedBy="Draft agenda approval" onSave={save}/>);
  expect(screen.queryByLabelText('Work status')).toBeNull();view.rerender(<WorkExecutionForm status="for_review" onSave={save}/>);expect(screen.queryByRole('button')).toBeNull();expect(screen.getByRole('status').textContent).toContain('Awaiting approval');
 });
 it('counts approved leaves once and excludes parent containers',()=>{
  expect(approvedWorkProgress([{id:'parent',status:'in_progress'},{id:'a',parent_subtask_id:'parent',status:'completed'},{id:'b',parent_subtask_id:'parent',status:'for_review'}])).toEqual({approved:1,total:2,percent:50});
 });
});
