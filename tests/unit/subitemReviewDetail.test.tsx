// Retired approval-queue coverage is replaced by nestedWorkReviewAuthority.test.tsx.
// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {SubtaskReviewItem} from '../../src/app/features/subtasks';
import type {WorkTreeSnapshot} from '../../src/app/features/nested-work';
import {installNavigationConfirmation,requestNavigation} from '../../src/app/shared/navigationGuard';
const api=vi.hoisted(()=>({actor:'current',subscribe:vi.fn(),sign:vi.fn(),decide:vi.fn(),toast:vi.fn(),next:undefined as undefined|((items:SubtaskReviewItem[])=>void),error:undefined as undefined|((error:Error)=>void)}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:api.actor},userProfile:{id:api.actor,full_name:'Current reviewer',role:'member'}})}));
vi.mock('../../src/app/components/ui/Toast',()=>({useToast:()=>({toast:api.toast})}));
vi.mock('../../src/app/features/subtasks/services/subtaskWorkflowService',()=>({subscribeToPendingSubtaskReviews:api.subscribe,getSubtaskEvidenceUrl:api.sign,decideSubtaskReview:api.decide}));
import {SubitemReviewDetail,SubtaskReviewInbox,type SubitemReviewDetailProps} from '../../src/app/features/reviews';
import {SubitemReviewGate} from '../../src/app/features/subtasks/components/SubitemReviewGate';
import {buildSubtaskDisplayMetadata,mergeWorkDisplayMetadata} from '../../src/app/features/nested-work';
import {discardSubtaskReviewDraft,recoverSubtaskReviewDraft} from '../../src/app/features/reviews/services/subtaskReviewDraftStore';
const item:SubtaskReviewItem={taskTitle:'Root',projectTitle:'Project',subtask:{id:'node',taskId:'root',title:'Deep work',parentSubtaskId:'parent',assignedToIds:[],percentComplete:100,status:'for_review',isStandalone:true,createdAt:1,updatedAt:1},submission:{id:'attempt',subtaskId:'node',taskId:'root',version:2,submitterId:'worker',submitterName:'Recorded worker',reviewerId:'old-reviewer',note:'Immutable note',status:'pending',submittedAt:1,attachments:[{fileName:'proof.pdf',filePath:'sealed/proof',fileSize:1,mimeType:'application/pdf'}]}};
const other:SubtaskReviewItem={...item,subtask:{...item.subtask,id:'other',title:'Other work'},submission:{...item.submission,id:'other-attempt',subtaskId:'other',note:'Other note'}};
const props=():SubitemReviewDetailProps=>({item,feedback:'',pending:false,readOnly:false,currentReviewerName:'Current reviewer',onFeedbackChange:vi.fn(),onApprove:vi.fn(),onRequestChanges:vi.fn()});
let uninstall:(()=>void)|undefined;
beforeEach(()=>{vi.clearAllMocks();api.actor='current';for(const actor of ['current','actor-a','actor-b'])for(const target of [item,other,{...item,submission:{...item.submission,id:'replacement',version:3}}])discardSubtaskReviewDraft(actor,target);api.sign.mockResolvedValue('https://example.test/scoped');api.decide.mockResolvedValue(undefined);api.subscribe.mockImplementation((_actor,_all,next,error)=>{api.next=next;api.error=error;next([item,other]);return vi.fn();});});
afterEach(()=>{cleanup();uninstall?.();uninstall=undefined;});
describe('NW8.3 shared review presentation',()=>{
 it('uses authorized queue metadata and hides signed links when a retained draft loses current access',async()=>{
  const parent={...item.subtask,id:'parent',parentSubtaskId:undefined,title:'Queue ancestor',position:0};
  const node={...item.subtask,leadId:'appointed',assignedToIds:['worker','appointed','worker'],position:0};
  const context=buildSubtaskDisplayMetadata([parent,node],{rootId:'root',rootTitle:'Root',people:[{id:'appointed',name:'Appointed Lead'},{id:'worker',name:'Worker'}]}).get('node');
  const queued={...item,subtask:mergeWorkDisplayMetadata(node,context)};
  const view=render(<SubitemReviewDetail {...props()} item={queued}/>);
  expect(screen.getByRole('navigation').textContent).toBe('Root / Queue ancestor / Deep work');
  expect(screen.getByRole('navigation').textContent).toContain('Queue ancestor');
  expect(screen.getByText('Lead: Appointed Lead · Contributors (1): Worker')).toBeTruthy();
  await screen.findByRole('link',{name:'proof.pdf'});
  view.rerender(<SubitemReviewDetail {...props()} item={queued} feedback="Private draft" readOnly evidenceAvailable={false}/>);
  expect(screen.queryByRole('link',{name:'proof.pdf'})).toBeNull();expect(screen.getByText('proof.pdf')).toBeTruthy();
  expect((screen.getByPlaceholderText('Explain what needs correction…') as HTMLTextAreaElement).value).toBe('Private draft');
 });
 it('separates current reviewer and historical author while keeping submitted evidence unchanged',async()=>{
  const historical={...item,submission:{...item.submission,status:'approved' as const,decidedByName:'Historical decider',decisionFeedback:'Recorded feedback'}};
  render(<SubitemReviewDetail {...props()} item={historical} context={{taskId:'root',subtaskId:'node',rootTitle:'Root',path:[{id:'parent',title:'Permitted parent'},{id:'node',title:'Deep work'}],parentTitle:'Permitted parent',currentReviewerName:'Replacement reviewer'}}/>);
  expect(screen.getByRole('navigation',{name:'Review work path'}).textContent).toBe('Root / Permitted parent / Deep work');expect(screen.getByRole('navigation').textContent).toContain('Permitted parent');expect(screen.queryByText('Progress: 100%')).toBeNull();expect(screen.getByText(/Submitted by Recorded worker/)).toBeTruthy();expect(screen.getByText('Reviewer: Replacement reviewer')).toBeTruthy();expect(screen.getByText('Historical decision by Historical decider · approved')).toBeTruthy();expect(item.submission.reviewerId).toBe('old-reviewer');
  await waitFor(()=>expect(screen.getByRole('link',{name:'proof.pdf'}).getAttribute('href')).toBe('https://example.test/scoped'));expect(api.sign).toHaveBeenCalledWith('sealed/proof');expect(api.decide).not.toHaveBeenCalled();
 });
 it('rejects another item or root context and shows missing parent without inventing labels',()=>{
  render(<SubitemReviewDetail {...props()} context={{taskId:'another-root',subtaskId:'node',rootTitle:'Protected root',path:[{id:'hidden',title:'Protected parent'}],parentTitle:'Protected parent',currentReviewerName:'Protected reviewer'}}/>);
  expect(screen.queryByText(/Protected/)).toBeNull();expect(screen.getByRole('navigation').textContent).toContain('Parent context unavailable');expect(screen.getByRole('navigation').textContent).toBe('Root / Parent context unavailable / Deep work');
 });
 it('does not expose a denied signed evidence URL',async()=>{
  api.sign.mockResolvedValue(null);render(<SubitemReviewDetail {...props()}/>);await waitFor(()=>expect(api.sign).toHaveBeenCalled());expect(screen.getByText('proof.pdf').closest('a')?.getAttribute('href')).toBeNull();expect(screen.getByText('proof.pdf').closest('a')?.getAttribute('aria-disabled')).toBe('true');
 });
 it.each(['readOnly','pending'] as const)('withholds controlled callbacks while %s without clearing feedback',key=>{
  const p={...props(),feedback:'Retained feedback',[key]:true};render(<SubitemReviewDetail {...p}/>);expect((screen.getByPlaceholderText('Explain what needs correction…') as HTMLTextAreaElement).value).toBe('Retained feedback');fireEvent.click(screen.getByRole('button',{name:key==='pending'?'Saving…':'Approve evidence'}));fireEvent.click(screen.getByRole('button',{name:'Request changes'}));expect(p.onApprove).not.toHaveBeenCalled();expect(p.onRequestChanges).not.toHaveBeenCalled();
 });
 it('requires feedback for request-change and forwards only controlled callbacks',()=>{
  const p=props(),view=render(<SubitemReviewDetail {...p}/>);fireEvent.click(screen.getByRole('button',{name:'Request changes'}));expect(p.onRequestChanges).not.toHaveBeenCalled();fireEvent.change(screen.getByPlaceholderText('Explain what needs correction…'),{target:{value:'Please revise'}});expect(p.onFeedbackChange).toHaveBeenCalledWith('Please revise');view.rerender(<SubitemReviewDetail {...p} feedback="Please revise"/>);fireEvent.click(screen.getByRole('button',{name:'Request changes'}));fireEvent.click(screen.getByRole('button',{name:'Approve evidence'}));expect(p.onRequestChanges).toHaveBeenCalledOnce();expect(p.onApprove).toHaveBeenCalledOnce();expect(api.decide).not.toHaveBeenCalled();
 });
});
describe('NW8.3 existing Inbox owner and Inspector composition',()=>{
 
 
 
 
 
 
 
 
 
});
