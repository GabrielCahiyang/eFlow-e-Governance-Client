// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

const mocks=vi.hoisted(()=>({actor:'new-lead',rpc:vi.fn(),reads:vi.fn(),signed:vi.fn(),toast:vi.fn(),remove:vi.fn(),unsubscribeAuth:vi.fn(),events:{} as Record<string,()=>void>}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:mocks.actor},userProfile:{id:mocks.actor,role:'member'}})}));
vi.mock('../../src/app/components/ui/Toast',()=>({useToast:()=>({toast:mocks.toast})}));
vi.mock('../../src/lib/supabase',()=>({supabase:{
 auth:{getSession:async()=>({data:{session:{user:{id:mocks.actor},access_token:'synthetic-token'}},error:null}),onAuthStateChange:(load:()=>void)=>{mocks.events.auth=load;return {data:{subscription:{unsubscribe:mocks.unsubscribeAuth}}};}},
 rpc:mocks.rpc,
 from:(table:string)=>{
  const query={select:()=>query,eq:()=>query,order:()=>query,in:()=>query,range:()=>query,
   then:(resolve:(value:unknown)=>unknown)=>Promise.resolve(mocks.reads(table)).then(resolve)};
  return query;
 },
 channel:()=>{const channel={on:(_event:string,filter:{table:string},load:()=>void)=>{mocks.events[filter.table]=load;return channel;},subscribe:()=>channel};return channel;},removeChannel:mocks.remove,
 storage:{from:()=>({createSignedUrl:mocks.signed})},
}}));
import {SubtaskReviewInbox} from '../../src/app/features/reviews/components/SubtaskReviewInbox';
import {fetchPendingSubtaskReviews,subscribeToPendingSubtaskReviews} from '../../src/app/features/subtasks/services/subtaskWorkflowService';

const submission={id:'attempt',task_id:'root',subtask_id:'child',version:1,status:'pending',submitter_id:'contributor',submitter_name:'Juan',reviewer_id:'old-lead',note:'Own child evidence',submitted_at:'2026-10-10T10:00:00Z'};
const path='subtasks/child/attempt/evidence.pdf';
function reply(response:unknown){const request=Promise.resolve(response) as Promise<unknown>&{setHeader:(name:string,value:string)=>unknown};request.setHeader=()=>request;return request;}
beforeEach(()=>{
 vi.resetAllMocks();mocks.actor='new-lead';mocks.events={};
 mocks.rpc.mockImplementation((name:string)=>reply({data:name==='r7_pending_subtask_reviews'&&mocks.actor==='new-lead'?[submission]:[],error:null}));
 mocks.reads.mockImplementation((table:string)=>({data:({
  subtasks:[{id:'child',task_id:'root',title:'Cheryl child',status:'for_review',lead_id:'new-lead',assigned_to_ids:['new-lead','contributor'],percent_complete:100,position:0}],
  subtask_submission_attachments:[{id:'file',submission_id:'attempt',file_name:'evidence.pdf',file_path:path,file_size:12,mime_type:'application/pdf'}],
  tasks:[{id:'root',title:'Office root',linked_project_id:'project'}],projects:[{id:'project',title:'Office project'}],
  subtask_submissions:[submission],
 } as Record<string,unknown[]>)[table]||[],error:null}));
 mocks.signed.mockResolvedValue({data:{signedUrl:'https://example.test/scoped-evidence'},error:null});
});
afterEach(()=>{cleanup();vi.useRealTimers();});

describe('NW4.2 current reviewer queue, adapter and inbox parity',()=>{
 it('revalidates staffing, expiry, focus and access changes without rewriting old reviewer attribution, and disposes every trigger',async()=>{
  vi.useFakeTimers();const next=vi.fn(),error=vi.fn();const stop=subscribeToPendingSubtaskReviews('new-lead',false,next,error);
  await vi.advanceTimersByTimeAsync(0);expect(next.mock.calls[0][0][0].submission.reviewerId).toBe('old-lead');
  mocks.actor='old-lead';await vi.advanceTimersByTimeAsync(15000);expect(next.mock.calls.at(-1)?.[0]).toEqual([]);
  for(const name of ['focus','eflow-project-access-changed']){window.dispatchEvent(new Event(name));await vi.advanceTimersByTimeAsync(0);}
  mocks.events.subtasks();await vi.advanceTimersByTimeAsync(0);
  mocks.events.auth();await vi.advanceTimersByTimeAsync(0);
  expect(mocks.rpc).toHaveBeenCalledTimes(6);expect(error).not.toHaveBeenCalled();expect(submission.reviewer_id).toBe('old-lead');
  stop();window.dispatchEvent(new Event('focus'));await vi.advanceTimersByTimeAsync(15000);
  expect(mocks.rpc).toHaveBeenCalledTimes(6);expect(mocks.remove).toHaveBeenCalledOnce();expect(mocks.unsubscribeAuth).toHaveBeenCalledOnce();
 });
 it('accepts server-selected pending work while retaining the old reviewer attribution',async()=>{
  const items=await fetchPendingSubtaskReviews('new-lead');
  expect(items).toHaveLength(1);expect(items[0].submission.reviewerId).toBe('old-lead');
  expect(items[0].submission.submitterId).toBe('contributor');
  expect(mocks.rpc).toHaveBeenCalledWith('r7_pending_subtask_reviews');
  expect(mocks.reads).not.toHaveBeenCalledWith('subtask_submissions');
 });
 it('renders the replacement reviewer queue and decides using the canonical subtask ID',async()=>{
  const view=render(<SubtaskReviewInbox embedded onShowTasks={vi.fn()}/>);
  // Queue hydration, selection and evidence rendering span separate effects.
  // Keep the permission/command assertions intact while allowing a cold Vibe render.
  const approve=await screen.findByRole('button',{name:'Approve evidence'}, {timeout:3000});
  await waitFor(()=>expect(screen.getByRole('link',{name:'evidence.pdf'}).getAttribute('href')).toBe('https://example.test/scoped-evidence'));
  expect(mocks.signed).toHaveBeenCalledWith(path,600);
  fireEvent.click(approve);
  await screen.findByText('No subtask evidence waiting');
  expect(mocks.rpc).toHaveBeenCalledWith('decide_subtask_review',{p_subtask_id:'child',p_approve:true,p_feedback:null});
  expect(mocks.toast).toHaveBeenCalledWith('Subtask evidence approved.','success');
  expect(submission.reviewer_id).toBe('old-lead');view.unmount();expect(mocks.remove).toHaveBeenCalledOnce();
 });
 it('does not reconstruct an old Lead queue from the recorded reviewer ID',async()=>{
  mocks.actor='old-lead';render(<SubtaskReviewInbox embedded onShowTasks={vi.fn()}/>);
  await screen.findByText('No subtask evidence waiting');
  expect(screen.queryByRole('button',{name:'Approve evidence'})).toBeNull();
  expect(mocks.reads).not.toHaveBeenCalledWith('subtask_submissions');
 });
 it('fails closed on denied current authority instead of falling back to recorded attribution',async()=>{
  mocks.rpc.mockResolvedValue({data:null,error:{code:'42501',message:'Current project access denied'}});
  render(<SubtaskReviewInbox embedded onShowTasks={vi.fn()}/>);
  await screen.findByText('Current project access denied');
  expect(screen.queryByRole('button',{name:'Approve evidence'})).toBeNull();
  expect(mocks.reads).not.toHaveBeenCalledWith('subtask_submissions');
 });
 it.each(['Current independent reviewer required','Settle all released or reserved cash before approving this funded subtask'])(
  'retains the pending evidence when the server denies a decision: %s',async message=>{
   mocks.rpc.mockImplementation((name:string)=>reply(name==='decide_subtask_review'
    ?{data:null,error:{code:'42501',message}}:{data:[submission],error:null}));
   render(<SubtaskReviewInbox embedded onShowTasks={vi.fn()}/>);
   fireEvent.click(await screen.findByRole('button',{name:'Approve evidence'}));
   await waitFor(()=>expect(mocks.toast).toHaveBeenCalledWith(message,'error'));
   expect(screen.getByText('Own child evidence')).toBeTruthy();
   expect(screen.getByRole('button',{name:'Approve evidence'})).toBeTruthy();
  });
});
