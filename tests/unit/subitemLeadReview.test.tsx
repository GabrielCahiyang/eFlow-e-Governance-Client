// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ load: vi.fn(), submit: vi.fn(), decide: vi.fn() }));
vi.mock('../../src/app/features/subtasks/services/subitemLeadReview', () => ({
  fetchSubitemLeadReview: api.load, proposeSubitemWork: api.submit, decideSubitemWork: api.decide,
}));
vi.mock('../../src/app/shared/workChanges', () => ({ subscribeWorkChanges: () => () => {} }));
vi.mock('@vibe/core',()=>({Button:({children,onClick,disabled}:any)=><button onClick={onClick} disabled={disabled}>{children}</button>}));
vi.mock('../../src/app/features/work-status',()=>({useWorkStatuses:()=>({definitions:[]}),resolveStatus:(_definitions:any,_status:string,label:string)=>({label}),CustomWorkStatusSelect:()=>null}));
import { SubitemLeadReview } from '../../src/app/features/subtasks/components/SubitemLeadReview';

afterEach(() => { cleanup(); vi.resetAllMocks(); });
const submission = { id: 'proposal', kind: 'completion', state: 'pending', author_id: 'cheryl', reviewer_id: 'cris', canDecide: false, terms: { note: 'Supplies delivered' } };
const base = { root: 'task', node: 'subtask', readOnly: false, pending: false, onChanged: async () => {} };

it('uses task work fields for a contributor blocker and submits them for lead review',async()=>{
 api.load.mockResolvedValue({canProposeProgress:true,items:[]});
 api.submit.mockResolvedValue({...submission,kind:'progress'});
 render(<SubitemLeadReview {...base} actor="contributor"/>);
 fireEvent.change(await screen.findByLabelText('Work status'),{target:{value:'stuck'}});
 fireEvent.change(screen.getByLabelText('Blocker reason'),{target:{value:'Waiting for supplies'}});
 fireEvent.change(screen.getByLabelText('Work update'),{target:{value:'Supplier contacted'}});
 fireEvent.change(screen.getByLabelText('Next step'),{target:{value:'Confirm delivery'}});
 expect(screen.getByLabelText('Update attachment')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Report blocker'}));
 await waitFor(()=>expect(api.submit).toHaveBeenCalledWith(expect.objectContaining({kind:'progress',blocker:'Waiting for supplies',note:'Supplier contacted',nextStep:'Confirm delivery'})));
});

it('requires a blocker reason and permits clearing a confirmed blocker',async()=>{
 api.load.mockResolvedValue({canProposeProgress:true,items:[]});
 api.submit.mockResolvedValue({...submission,kind:'progress'});
 render(<SubitemLeadReview {...base} actor="contributor" initialBlocker="Awaiting supplies"/>);
 expect((await screen.findByLabelText('Blocker reason') as HTMLTextAreaElement).value).toBe('Awaiting supplies');
 fireEvent.change(screen.getByLabelText('Blocker reason'),{target:{value:''}});
 fireEvent.click(screen.getByRole('button',{name:'Report blocker'}));
 await screen.findByText('Tell your lead what is blocking you.');expect(api.submit).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('Work status'),{target:{value:'in_progress'}});
 fireEvent.click(screen.getByRole('button',{name:'Save update'}));
 await waitFor(()=>expect(api.submit).toHaveBeenCalledWith(expect.objectContaining({blocker:'',nextStep:'',note:''})));
});

it('keeps uncertain contributor updates frozen and retries the same request',async()=>{
 api.load.mockResolvedValue({canProposeProgress:true,items:[]});
 api.submit.mockImplementationOnce(async input=>{input.attempt.sent=true;throw new Error('Connection lost');})
  .mockResolvedValue({...submission,kind:'progress'});
 render(<SubitemLeadReview {...base} actor="contributor"/>);
 fireEvent.change(await screen.findByLabelText('Next step'),{target:{value:'Call supplier'}});
 fireEvent.click(screen.getByRole('button',{name:'Save update'}));
 await screen.findByText('Connection lost');
 expect((screen.getByLabelText('Next step') as HTMLInputElement).disabled).toBe(true);
 const request=api.submit.mock.calls[0][0].attempt.id;
 fireEvent.click(screen.getByRole('button',{name:'Save update'}));
 await waitFor(()=>expect(api.submit).toHaveBeenCalledTimes(2));
 expect(api.submit.mock.calls[1][0]).toEqual(expect.objectContaining({nextStep:'Call supplier',attempt:expect.objectContaining({id:request})}));
});

it('lets the subtask lead submit a completion note and shows the pending review', async () => {
  api.load.mockResolvedValueOnce({ canProposeCompletion: true, items: [] })
    .mockResolvedValue({ canProposeCompletion: true, items: [submission] });
  api.submit.mockResolvedValue(submission);
  render(<SubitemLeadReview {...base} actor="cheryl" reviewerName="Crisostomo Ibarra"/>);
  expect(await screen.findByText(/Crisostomo Ibarra/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Submit for Task Lead review' }));
  fireEvent.change(screen.getByLabelText('Work note'), { target: { value: 'Supplies delivered' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit for Task Lead review' }));
  await screen.findByText(/Awaiting Lead review/);
  expect(api.submit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ root: 'task', node: 'subtask', kind: 'completion', note: 'Supplies delivered' }));
});

it('lets the assigned Task Lead approve completion through the review action', async () => {
  api.load.mockResolvedValue({ items: [{ ...submission, canDecide: true }] });
  api.decide.mockResolvedValue({ ...submission, state: 'approved' });
  render(<SubitemLeadReview {...base} actor="cris"/>);
  fireEvent.click(await screen.findByRole('button', { name: 'Approve and complete subtask' }));
  await waitFor(() => expect(api.decide).toHaveBeenCalledExactlyOnceWith('proposal', expect.any(String), true, ''));
  await screen.findByText('Completion · Approved');
});
it('keeps self and unassigned review decisions unavailable and resubmits against returned history',async()=>{
 const returned={...submission,state:'changes_requested',decision_note:'Attach the delivery confirmation'};
 api.load.mockResolvedValue({canProposeCompletion:true,items:[returned]});
 api.submit.mockResolvedValue({...submission,id:'revised'});
 render(<SubitemLeadReview {...base} actor="cheryl"/>);
 await screen.findByText('Completion · Changes requested');
 expect(screen.queryByRole('button',{name:'Approve and complete subtask'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Submit for Task Lead review'}));
 fireEvent.change(screen.getByLabelText('Work note'),{target:{value:'Delivery confirmation added'}});
 fireEvent.click(screen.getByRole('button',{name:'Submit for Task Lead review'}));
 await waitFor(()=>expect(api.submit).toHaveBeenCalledWith(expect.objectContaining({supersedes:'proposal',note:'Delivery confirmation added'})));
});
