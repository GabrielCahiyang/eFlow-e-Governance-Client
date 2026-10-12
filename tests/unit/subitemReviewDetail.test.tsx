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
  expect(screen.getByText('Parent: Queue ancestor')).toBeTruthy();
  expect(screen.getByText('Lead: Appointed Lead · Contributors (1): Worker')).toBeTruthy();
  await screen.findByRole('link',{name:'proof.pdf'});
  view.rerender(<SubitemReviewDetail {...props()} item={queued} feedback="Private draft" readOnly evidenceAvailable={false}/>);
  expect(screen.queryByRole('link',{name:'proof.pdf'})).toBeNull();expect(screen.getByText('proof.pdf')).toBeTruthy();
  expect((screen.getByPlaceholderText('Explain what needs correction…') as HTMLTextAreaElement).value).toBe('Private draft');
 });
 it('separates current reviewer and historical author while keeping submitted evidence unchanged',async()=>{
  const historical={...item,submission:{...item.submission,status:'approved' as const,decidedByName:'Historical decider',decisionFeedback:'Recorded feedback'}};
  render(<SubitemReviewDetail {...props()} item={historical} context={{taskId:'root',subtaskId:'node',rootTitle:'Root',path:[{id:'parent',title:'Permitted parent'},{id:'node',title:'Deep work'}],parentTitle:'Permitted parent',currentReviewerName:'Replacement reviewer'}}/>);
  expect(screen.getByRole('navigation',{name:'Review work path'}).textContent).toBe('Root / Permitted parent / Deep work');expect(screen.getByText('Parent: Permitted parent')).toBeTruthy();expect(screen.getByText('Progress: 100%')).toBeTruthy();expect(screen.getByText('Submitted by Recorded worker')).toBeTruthy();expect(screen.getByText('Current reviewer: Replacement reviewer')).toBeTruthy();expect(screen.getByText('Historical decision by Historical decider · approved')).toBeTruthy();expect(item.submission.reviewerId).toBe('old-reviewer');
  await waitFor(()=>expect(screen.getByRole('link',{name:'proof.pdf'}).getAttribute('href')).toBe('https://example.test/scoped'));expect(api.sign).toHaveBeenCalledWith('sealed/proof');expect(api.decide).not.toHaveBeenCalled();
 });
 it('rejects another item or root context and shows missing parent without inventing labels',()=>{
  render(<SubitemReviewDetail {...props()} context={{taskId:'another-root',subtaskId:'node',rootTitle:'Protected root',path:[{id:'hidden',title:'Protected parent'}],parentTitle:'Protected parent',currentReviewerName:'Protected reviewer'}}/>);
  expect(screen.queryByText(/Protected/)).toBeNull();expect(screen.getByText('Parent: Parent unavailable')).toBeTruthy();expect(screen.getByRole('navigation').textContent).toBe('Root / Parent context unavailable / Deep work');
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
 it('immediately isolates accounts and restores only feedback after a fresh matching authorized queue, with freshly signed evidence',async()=>{
  api.actor='actor-a';const view=render(<SubtaskReviewInbox embedded onShowTasks={()=>{}}/>);
  fireEvent.change(await screen.findByPlaceholderText('Explain what needs correction…'),{target:{value:'Actor A private feedback'}});
  const oldNext=api.next!;
  api.subscribe.mockImplementationOnce((_actor,_all,next,error)=>{api.next=next;api.error=error;return vi.fn();});
  api.actor='actor-b';view.rerender(<SubtaskReviewInbox embedded onShowTasks={()=>{}}/>);
  expect(screen.queryByText('Immutable note')).toBeNull();expect(screen.queryByRole('link',{name:'proof.pdf'})).toBeNull();expect(screen.queryByDisplayValue('Actor A private feedback')).toBeNull();
  act(()=>oldNext([item]));expect(screen.queryByText('Immutable note')).toBeNull();
  act(()=>api.next!([other]));fireEvent.change(await screen.findByPlaceholderText('Explain what needs correction…'),{target:{value:'Actor B private feedback'}});
  api.subscribe.mockImplementationOnce((_actor,_all,next,error)=>{api.next=next;api.error=error;return vi.fn();});
  api.actor='actor-a';view.rerender(<SubtaskReviewInbox embedded onShowTasks={()=>{}}/>);
  expect(screen.queryByDisplayValue('Actor B private feedback')).toBeNull();expect(screen.queryByText('Other note')).toBeNull();expect(screen.queryByDisplayValue('Actor A private feedback')).toBeNull();
  api.sign.mockClear();api.sign.mockResolvedValue('https://example.test/freshly-authorized');
  act(()=>api.next!([{...item,taskTitle:'Fresh authorized root'},other]));
  await waitFor(()=>expect((screen.getByPlaceholderText('Explain what needs correction…') as HTMLTextAreaElement).value).toBe('Actor A private feedback'));
  await waitFor(()=>expect(screen.getByRole('link',{name:'proof.pdf'}).getAttribute('href')).toBe('https://example.test/freshly-authorized'));
  expect(api.sign).toHaveBeenCalledWith('sealed/proof');expect(screen.getByText(/Parent task: Fresh authorized root/)).toBeTruthy();expect(api.decide).not.toHaveBeenCalled();
  expect(recoverSubtaskReviewDraft('actor-b',[other])?.feedback).toBe('Actor B private feedback');
 });
 it('keeps a draft quarantined through denial, newer versions and absent review capability instead of applying it to a new target',async()=>{
  api.actor='actor-a';const view=render(<SubtaskReviewInbox embedded onShowTasks={()=>{}}/>);
  fireEvent.change(await screen.findByPlaceholderText('Explain what needs correction…'),{target:{value:'Original attempt feedback'}});
  api.actor='actor-b';view.rerender(<SubtaskReviewInbox embedded onShowTasks={()=>{}}/>);
  api.subscribe.mockImplementationOnce((_actor,_all,next,error)=>{api.next=next;api.error=error;error(new Error('Current access denied'));return vi.fn();});
  api.actor='actor-a';view.rerender(<SubtaskReviewInbox embedded onShowTasks={()=>{}}/>);
  await screen.findByText('Current access denied');expect(screen.queryByDisplayValue('Original attempt feedback')).toBeNull();
  const replacement={...item,submission:{...item.submission,id:'replacement',version:3,note:'New evidence attempt'}};
  act(()=>api.next!([replacement]));const field=await screen.findByPlaceholderText('Explain what needs correction…');expect((field as HTMLTextAreaElement).value).toBe('');
  expect(recoverSubtaskReviewDraft('actor-a',[item])?.feedback).toBe('Original attempt feedback');
  view.unmount();render(<SubtaskReviewInbox embedded readOnly onShowTasks={()=>{}}/>);
  await screen.findByPlaceholderText('Explain what needs correction…');expect((screen.getByPlaceholderText('Explain what needs correction…') as HTMLTextAreaElement).value).toBe('');
  expect(recoverSubtaskReviewDraft('actor-a',[{...item,submission:{...item.submission,status:'approved'}}])).toBeUndefined();expect(api.decide).not.toHaveBeenCalled();
 });
 it('survives a component remount and waits for fresh capability/queue verification before restoring',async()=>{
  api.actor='actor-a';const view=render(<SubtaskReviewInbox embedded onShowTasks={()=>{}}/>);
  fireEvent.change(await screen.findByPlaceholderText('Explain what needs correction…'),{target:{value:'Retain through navigation'}});view.unmount();
  const nextView=render(<SubtaskReviewInbox embedded readOnly onShowTasks={()=>{}}/>);
  await screen.findByPlaceholderText('Explain what needs correction…');expect(screen.queryByDisplayValue('Retain through navigation')).toBeNull();
  api.subscribe.mockImplementationOnce((_actor,_all,next,error)=>{api.next=next;api.error=error;return vi.fn();});
  nextView.rerender(<SubtaskReviewInbox embedded onShowTasks={()=>{}}/>);expect(screen.queryByDisplayValue('Retain through navigation')).toBeNull();
  act(()=>api.next!([item,other]));await screen.findByDisplayValue('Retain through navigation');expect(api.decide).not.toHaveBeenCalled();
 });
 it('does not let an old actor decision response clear the new actor draft or publish its outcome to the new actor',async()=>{
  let resolve!:()=>void;api.decide.mockImplementation(()=>new Promise<void>(yes=>{resolve=yes;}));
  api.actor='actor-a';const view=render(<SubtaskReviewInbox embedded onShowTasks={()=>{}}/>);
  fireEvent.change(await screen.findByPlaceholderText('Explain what needs correction…'),{target:{value:'Actor A decision feedback'}});fireEvent.click(screen.getByRole('button',{name:'Request changes'}));
  api.subscribe.mockImplementationOnce((_actor,_all,next,error)=>{api.next=next;api.error=error;next([other]);return vi.fn();});
  api.actor='actor-b';view.rerender(<SubtaskReviewInbox embedded onShowTasks={()=>{}}/>);
  fireEvent.change(await screen.findByPlaceholderText('Explain what needs correction…'),{target:{value:'Actor B unsaved work'}});
  await act(async()=>resolve());expect(screen.getByDisplayValue('Actor B unsaved work')).toBeTruthy();expect(api.toast).not.toHaveBeenCalled();
  expect(recoverSubtaskReviewDraft('actor-a',[item])).toBeUndefined();expect(recoverSubtaskReviewDraft('actor-b',[other])?.feedback).toBe('Actor B unsaved work');
  expect(api.decide).toHaveBeenCalledWith('node',false,'Actor A decision feedback','actor-a');
 });
 it('retains dirty selected evidence after removal from the current queue and blocks decisions',async()=>{
  render(<SubtaskReviewInbox embedded onShowTasks={()=>{}}/>);const field=await screen.findByPlaceholderText('Explain what needs correction…');fireEvent.change(field,{target:{value:'Keep review feedback'}});act(()=>api.next!([]));expect(screen.getByText('Immutable note')).toBeTruthy();expect((screen.getByPlaceholderText('Explain what needs correction…') as HTMLTextAreaElement).value).toBe('Keep review feedback');expect(screen.getByRole('button',{name:'Approve evidence'}).matches(':disabled')).toBe(true);fireEvent.click(screen.getByRole('button',{name:'Approve evidence'}));expect(api.decide).not.toHaveBeenCalled();
 });
 it('retains feedback through a source failure/retry and a replacement attempt until accepted navigation',async()=>{
  const confirm=vi.fn().mockResolvedValue(false);uninstall=installNavigationConfirmation(confirm);render(<SubtaskReviewInbox embedded onShowTasks={()=>{}}/>);fireEvent.change(await screen.findByPlaceholderText('Explain what needs correction…'),{target:{value:'Old attempt feedback'}});act(()=>api.error!(new Error('Current review access denied')));expect(screen.getByText('Current review access denied')).toBeTruthy();expect(screen.getByRole('button',{name:'Approve evidence'}).matches(':disabled')).toBe(true);
  api.subscribe.mockImplementationOnce((_actor,_all,next,error)=>{api.next=next;api.error=error;return vi.fn();});fireEvent.click(screen.getByRole('button',{name:'Retry',exact:true}));await waitFor(()=>expect(api.subscribe).toHaveBeenCalledTimes(2));expect((screen.getByPlaceholderText('Explain what needs correction…') as HTMLTextAreaElement).value).toBe('Old attempt feedback');expect(screen.getByRole('button',{name:'Approve evidence'}).matches(':disabled')).toBe(true);
  const replacement={...item,submission:{...item.submission,id:'replacement',version:3,note:'New evidence attempt'}};act(()=>api.next!([replacement,other]));expect(screen.getByText('Immutable note')).toBeTruthy();expect(screen.queryByText('New evidence attempt')).toBeNull();expect(screen.getByRole('button',{name:'Approve evidence'}).matches(':disabled')).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:/Deep work Recorded worker/}));await waitFor(()=>expect(confirm).toHaveBeenCalled());expect(screen.getByText('Immutable note')).toBeTruthy();confirm.mockResolvedValue(true);fireEvent.click(screen.getByRole('button',{name:/Deep work Recorded worker/}));await screen.findByText('New evidence attempt');expect((screen.getByPlaceholderText('Explain what needs correction…') as HTMLTextAreaElement).value).toBe('');
 });
 it('keeps failed decisions in the owner, deduplicates pending writes and blocks dirty navigation',async()=>{
  let reject!:(error:Error)=>void;api.decide.mockImplementation(()=>new Promise((_yes,no)=>{reject=no;}));render(<SubtaskReviewInbox embedded onShowTasks={()=>{}}/>);fireEvent.change(await screen.findByPlaceholderText('Explain what needs correction…'),{target:{value:'Correct the evidence'}});fireEvent.click(screen.getByRole('button',{name:'Request changes'}));fireEvent.click(screen.getByRole('button',{name:'Request changes'}));expect(api.decide).toHaveBeenCalledOnce();expect(api.decide).toHaveBeenCalledWith('node',false,'Correct the evidence','current');expect(await requestNavigation(vi.fn())).toBe(false);await act(async()=>reject(new Error('Settle funding first')));expect(api.toast).toHaveBeenCalledWith('Settle funding first','error');expect((screen.getByPlaceholderText('Explain what needs correction…') as HTMLTextAreaElement).value).toBe('Correct the evidence');expect(screen.getByText('Immutable note')).toBeTruthy();
 });
 it('does not let notification focus changes switch a dirty review to another item',async()=>{
  const view=render(<SubtaskReviewInbox embedded focus={{notificationId:'one',kind:'subtask_review',entityId:'node',taskId:'root'}} onShowTasks={()=>{}}/>);fireEvent.change(await screen.findByPlaceholderText('Explain what needs correction…'),{target:{value:'Node feedback'}});view.rerender(<SubtaskReviewInbox embedded focus={{notificationId:'two',kind:'subtask_review',entityId:'other',taskId:'root'}} onShowTasks={()=>{}}/>);expect(screen.getByText('Immutable note')).toBeTruthy();expect(screen.queryByText('Other note')).toBeNull();expect(api.subscribe).toHaveBeenCalledWith('current',false,expect.any(Function),expect.any(Function));
 });
 it('uses the public shared detail in Inspector with only its supplied authorized path and reviewer',async()=>{
  const node={id:'node',task_id:'root',title:'Deep work',parent_subtask_id:'parent',sibling_order:0,current_reviewer:'replacement'},parent={...node,id:'parent',title:'Authorized parent',parent_subtask_id:null};const tree={root:{id:'root'},nodes:[parent,node],people:[{id:'replacement',name:'New current reviewer'}]} as unknown as WorkTreeSnapshot;
  render(<SubitemReviewGate rootId="root" itemId="node" tree={tree} rootTitle="Root" readOnly onClose={()=>{}}/>);const detail=await screen.findByRole('region',{name:'Subitem review detail'});expect(within(detail).getByRole('navigation').textContent).toBe('Root / Authorized parent / Deep work');expect(within(detail).getByText('Current reviewer: New current reviewer')).toBeTruthy();expect(within(detail).getByRole('button',{name:'Approve evidence'}).matches(':disabled')).toBe(true);expect(api.decide).not.toHaveBeenCalled();
 });
});
