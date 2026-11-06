// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {useState} from 'react';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cashRequest} from './taskCashClearance.fixtures';
import type {DepartmentBudgetBundle} from '../../src/app/features/budget/types';
const mocks=vi.hoisted(()=>({role:'head',request:vi.fn(),leader:vi.fn(),allocation:vi.fn(),liquidation:vi.fn(),late:vi.fn(),release:vi.fn(),getReview:vi.fn(),decideReview:vi.fn(),routeReview:vi.fn(),approveEscalation:vi.fn(),toast:vi.fn()}));
vi.mock('../../src/app/components/ui/Modal',()=>({Modal:({title,children,footer,preventClose,onClose}:any)=><div role="dialog" aria-label={title} data-locked={preventClose}><button disabled={preventClose} onClick={onClose}>Close dialog</button>{children}{footer}</div>}));
vi.mock('@vibe/core',()=>({Button:({children,disabled,onClick}:any)=><button disabled={disabled} onClick={onClick}>{children}</button>}));
vi.mock('motion/react',()=>({AnimatePresence:({children}:any)=>children}));
vi.mock('motion/react-m',()=>({div:({children,id}:any)=><div id={id}>{children}</div>}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({userProfile:{id:'reviewer',org_id:'org-1',role:mocks.role},can:()=>true})}));
vi.mock('../../src/app/components/ui/Toast',()=>({useToast:()=>({toast:mocks.toast})}));
vi.mock('../../src/app/shared/useExplicitDraft',()=>({useExplicitDraft:()=>({pendingRef:{current:false},markClean:vi.fn()})}));
vi.mock('../../src/app/shared/navigationGuard',()=>({requestNavigation:(fn:()=>void)=>fn()}));
vi.mock('../../src/app/components/ui/useConfirmation',()=>({useConfirmation:()=>{
 const [options,setOptions]=useState<any>(null);
 const confirm=(next:any)=>new Promise<boolean>(resolve=>setOptions({...next,resolve}));
 return {confirm,dialog:options&&<div role="dialog" aria-label={options.title}><p>{options.description}</p><button onClick={()=>{options.resolve(false);setOptions(null);}}>Cancel</button><button onClick={()=>{options.resolve(true);setOptions(null);}}>{options.actionLabel}</button></div>};
}}));
vi.mock('../../src/app/features/budget/components/ApprovalThresholdDialog',()=>({ApprovalThresholdDialog:()=>null}));
vi.mock('../../src/app/features/budget/services/budgetService',()=>({decidePettyCashRequest:mocks.request,decidePettyCashLeaderReview:mocks.leader,decideWorkBudgetAllocation:mocks.allocation,decidePettyCashLiquidation:mocks.liquidation,authorizeLateLiquidation:mocks.late,decidePettyCashLiquidationLeaderReview:vi.fn(),markPettyCashReleased:mocks.release,createReceiptSignedUrl:vi.fn()}));
vi.mock('../../src/app/features/budget/services/independentReviewService',()=>({getIndependentReview:mocks.getReview,decideIndependentReview:mocks.decideReview,routeIndependentReview:mocks.routeReview,approveStaffingEscalation:mocks.approveEscalation}));
import {DecisionModal,DecisionResultModal} from '../../src/app/components/ui/DecisionModal';
import {BudgetApprovalQueue} from '../../src/app/features/budget/components/BudgetApprovalQueue';
import {IndependentReviewCard} from '../../src/app/features/budget/components/IndependentReviewCard';
let testId=0;
const data=()=>({allocations:[],requests:[cashRequest({id:`approval-request-${testId}`,status:'pending_department_approval',requestedAmount:500,taskLeaderId:'other'})],liquidations:[],releases:[],commitments:[],allocationLines:[],requestAttachments:[]} as unknown as DepartmentBudgetBundle);
const review=()=>({liquidationId:'review-1',version:1,required:true,current:true,canReview:true,canSettle:false,review:{id:'review',reviewer_id:'reviewer',status:'pending' as const,route_reason:'Independent Head',decision_reason:null,decided_at:null},candidates:[],eligibleSettlers:1,escalationRequired:false});
beforeEach(()=>{vi.clearAllMocks();sessionStorage.clear();mocks.role='head';testId++;mocks.request.mockResolvedValue(undefined);mocks.leader.mockResolvedValue(undefined);mocks.decideReview.mockResolvedValue(undefined);mocks.getReview.mockResolvedValue(review());});
afterEach(cleanup);
it('asks before writing and Cancel makes no financial decision',async()=>{
 render(<BudgetApprovalQueue data={data()} onChanged={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'Quick Authorize'}));
 expect(mocks.request).not.toHaveBeenCalled();
 const dialog=screen.getByRole('dialog',{name:'Approve this request?'});
 fireEvent.click(within(dialog).getByRole('button',{name:'Cancel'}));
 await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
 expect(mocks.request).not.toHaveBeenCalled();
});
it('shows a green result even when approval clears the last queue item',async()=>{
 const view=render(<BudgetApprovalQueue data={data()} onChanged={vi.fn().mockResolvedValue(undefined)}/>);
 fireEvent.click(screen.getByRole('button',{name:'Quick Authorize'}));
 fireEvent.click(screen.getByRole('button',{name:'Yes, approve'}));
 await screen.findByRole('dialog',{name:'Decision saved'});
 view.rerender(<BudgetApprovalQueue data={{...data(),requests:[]}} onChanged={vi.fn()}/>);
 expect(screen.getByRole('status').getAttribute('data-tone')).toBe('approve');
 expect(mocks.request).toHaveBeenCalledOnce();
});
it('returns a request in amber with a required reason and keeps backend errors red',async()=>{
 mocks.request.mockRejectedValueOnce(new Error('Amount exceeds the limit.'));
 render(<BudgetApprovalQueue data={data()} onChanged={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'Decline'}));
 const dialog=screen.getByRole('dialog',{name:'Decline cash request'});
 expect(within(dialog).getByRole('button',{name:'Yes, reject'})).toBeDisabled();
 fireEvent.change(within(dialog).getByRole('textbox'),{target:{value:'Please correct the amount'}});
 fireEvent.click(within(dialog).getByRole('button',{name:'Yes, reject'}));
 expect(await within(dialog).findByRole('alert')).toHaveTextContent('Amount exceeds');
 expect(within(dialog).getByRole('textbox')).toHaveValue('Please correct the amount');
 fireEvent.click(within(dialog).getByRole('button',{name:'Yes, reject'}));
 const result=await screen.findByRole('dialog',{name:'Returned to requester'});
 expect(within(result).getByRole('status').getAttribute('data-tone')).toBe('return');
 expect(mocks.request).toHaveBeenLastCalledWith(`approval-request-${testId}`,false,'Please correct the amount');
});
it('does not call a saved approval a failure when the queue refresh fails',async()=>{
 render(<BudgetApprovalQueue data={data()} onChanged={vi.fn().mockRejectedValue(new Error('Read failed'))}/>);
 fireEvent.click(screen.getByRole('button',{name:'Quick Authorize'}));fireEvent.click(screen.getByRole('button',{name:'Yes, approve'}));
 const result=await screen.findByRole('dialog',{name:'Decision saved'});
 await waitFor(()=>expect(within(result).getByRole('status')).toHaveTextContent('Your decision was saved'));
 expect(within(result).queryByRole('alert')).toBeNull();
});
it('gives a task leader the same confirmation without granting Head approval',async()=>{
 mocks.role='member';const bundle=data();bundle.requests[0].status='pending_leader_review';bundle.requests[0].taskLeaderId='reviewer';
 render(<BudgetApprovalQueue data={bundle} onChanged={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'Endorse (Fast-Track)'}));expect(mocks.leader).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Yes, endorse'}));await waitFor(()=>expect(mocks.leader).toHaveBeenCalledOnce());expect(mocks.request).not.toHaveBeenCalled();
});
it('keeps financial approval hidden from an unrelated member',()=>{
 mocks.role='member';render(<BudgetApprovalQueue data={data()} onChanged={vi.fn()}/>);
 expect(screen.queryByRole('button',{name:'Quick Authorize'})).toBeNull();expect(screen.queryByRole('button',{name:'Decline'})).toBeNull();
});
it('requires findings in the independent review modal and writes only after Yes',async()=>{
 render(<IndependentReviewCard id="review-1" version={1} context={review()} onChanged={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'Approve review'}));
 const dialog=screen.getByRole('dialog',{name:'Approve this independent review?'});
 expect(within(dialog).getByRole('button',{name:'Yes, approve'})).toBeDisabled();expect(mocks.decideReview).not.toHaveBeenCalled();
 fireEvent.change(within(dialog).getByRole('textbox'),{target:{value:'Receipts checked'}});fireEvent.click(within(dialog).getByRole('button',{name:'Yes, approve'}));
 await waitFor(()=>expect(mocks.decideReview).toHaveBeenCalledWith('review-1',1,'approved','Receipts checked',expect.any(String)));
 expect(mocks.toast).toHaveBeenCalledWith(expect.stringContaining('Accounting settlement remains separate'),'success');
});
it('still blocks a stale independent review after confirmation',async()=>{
 mocks.getReview.mockResolvedValue({...review(),version:2});render(<IndependentReviewCard id="review-1" version={1} context={review()} onChanged={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'Reject package'}));fireEvent.change(screen.getByRole('textbox'),{target:{value:'Missing receipt'}});fireEvent.click(screen.getByRole('button',{name:'Yes, reject'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('review changed');expect(mocks.decideReview).not.toHaveBeenCalled();
});
it('locks decision controls during saving and preserves required reasons',()=>{
 const cancel=vi.fn(),save=vi.fn();render(<DecisionModal title="Approve?" description="Are you sure?" busy onCancel={cancel} onConfirm={save}/>);
 expect(screen.getByRole('button',{name:'Cancel'})).toBeDisabled();expect(screen.getByRole('button',{name:'Saving…'})).toBeDisabled();expect(screen.getByRole('button',{name:'Close dialog'})).toBeDisabled();
});
it.each([['success','approve'],['returned','return'],['error','error']] as const)('styles %s results distinctly', (tone,attribute)=>{
 render(<DecisionResultModal title="Result" message="Recorded outcome" tone={tone} onClose={vi.fn()}/>);
 expect(screen.getByText('Recorded outcome').parentElement?.getAttribute('data-tone')).toBe(attribute);
});

it('shows the recorded Head notification even when leadership review is not required',()=>{
 render(<IndependentReviewCard id="review-1" version={1} context={{...review(),required:false,eligibleSettlers:0,escalationRequired:true,canReview:false,canSettle:false,review:null,headAlertStatus:'notified'}} onChanged={vi.fn()}/>);
 expect(screen.getByRole('status',{name:'Settlement blocked'})).toHaveTextContent('Automatically escalated to the Head');
 expect(screen.queryByRole('button',{name:'Approve review'})).toBeNull();
});
it.each([['pending','Head notification pending'],['no_head','No office Head appointed']] as const)('shows the %s state before an alert is recorded',(headAlertStatus, heading)=>{
 render(<IndependentReviewCard id="review-1" version={1} context={{...review(),eligibleSettlers:0,escalationRequired:true,canReview:false,canSettle:false,review:null,candidates:[],headAlertStatus}} onChanged={vi.fn()}/>);
 expect(screen.getByRole('status',{name:'Settlement blocked'})).toHaveTextContent(heading);
 expect(screen.queryByText('Automatically escalated to the Head')).toBeNull();
 expect(mocks.decideReview).not.toHaveBeenCalled();
});

it('retains an assigned leadership review while an independent Accounting appointment is still needed',()=>{
 render(<IndependentReviewCard id="review-1" version={1} context={{...review(),eligibleSettlers:0,escalationRequired:true}} onChanged={vi.fn()}/>);
 expect(screen.getByRole('status',{name:'Settlement blocked'})).toBeTruthy();
 expect(screen.getByRole('button',{name:'Approve review'})).toBeTruthy();
 expect(mocks.decideReview).not.toHaveBeenCalled();
});

it('lets an eligible Head take the notified review and then approve it', async () => {
 const context = { ...review(), canReview: false, review: null, headAlertStatus: 'notified' as const,
  eligibleSettlers: 0, candidates: [{ id: 'reviewer', name: 'Office Head', appointment: 'Head' }] };
 mocks.getReview.mockResolvedValue(context);
 const view = render(<IndependentReviewCard id="review-1" version={1} context={context} onChanged={vi.fn().mockResolvedValue(undefined)} />);
 fireEvent.click(screen.getByRole('button', { name: 'Take review', exact: true }));
 fireEvent.click(screen.getByRole('button', { name: 'Yes, take review' }));
 await waitFor(() => expect(mocks.routeReview).toHaveBeenCalledWith('review-1', 1, 'reviewer', expect.any(String), expect.any(String)));
 const assigned = { ...context, ...review(), eligibleSettlers: 0 };
 mocks.getReview.mockResolvedValue(assigned);
 view.rerender(<IndependentReviewCard id="review-1" version={1} context={assigned} onChanged={vi.fn().mockResolvedValue(undefined)} />);
 await waitFor(() => expect(screen.getByRole('button', { name: 'Approve review' })).toBeEnabled());
 fireEvent.click(screen.getByRole('button', { name: 'Approve review' }));
 fireEvent.change(screen.getByLabelText('Review findings'), { target: { value: 'Receipts checked.' } });
 fireEvent.click(screen.getByRole('button', { name: 'Yes, approve' }));
 await waitFor(() => expect(mocks.decideReview).toHaveBeenCalledWith('review-1', 1, 'approved', 'Receipts checked.', expect.any(String)));
});

it('offers Approve directly to the Head for the notified staffing escalation', async () => {
 const context = { ...review(), canReview: false, review: null, headAlertStatus: 'notified' as const,
  eligibleSettlers: 0, headEscalationFingerprint: 'current-version' };
 mocks.getReview.mockResolvedValue(context);
 const view = render(<IndependentReviewCard id="review-1" version={1} context={context} submittedByAccountingRequester onChanged={vi.fn().mockResolvedValue(undefined)} />);
 expect(screen.getByRole('status', { name: 'Settlement blocked' })).toHaveTextContent('The Accounting Officer who submitted this liquidation can’t settle their own request. No other eligible officer is available.');
 expect(screen.queryByText('Head approval', { exact: true })).toBeNull();
 fireEvent.click(screen.getByRole('button', { name: 'Approve', exact: true }));
 const dialog = screen.getByRole('dialog', { name: 'Approve this liquidation review?' });
 fireEvent.change(within(dialog).getByLabelText('Review findings'), { target: { value: 'Receipts verified.' } });
 fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, approve' }));
 await waitFor(() => expect(mocks.approveEscalation).toHaveBeenCalledWith('review-1', 1, 'current-version', 'Receipts verified.', expect.any(String)));
 view.rerender(<IndependentReviewCard id="review-1" version={1} context={{ ...context, headEscalationFingerprint: null, headEscalationApproved: true }} onChanged={vi.fn()} />);
 expect(await screen.findByText('Head review approved · settlement pending')).toBeVisible();
 expect(mocks.decideReview).not.toHaveBeenCalled();
 expect(mocks.liquidation).not.toHaveBeenCalled();
});

it('lets the Head post a settlement when no independent Accounting Officer is available', async () => {
 const context = { ...review(), canReview: false, review: null, headAlertStatus: 'notified' as const,
  eligibleSettlers: 0, headCanPostSettlement: true, headEscalationApproved: true, headEscalationFingerprint: 'current-version' };
 mocks.getReview.mockResolvedValue(context);
 const onChanged = vi.fn().mockResolvedValue(undefined);
 render(<IndependentReviewCard id="review-1" version={1} context={context} onChanged={onChanged} />);
 fireEvent.click(screen.getByRole('button', { name: 'Approve & post settlement', exact: true }));
 const dialog = screen.getByRole('dialog', { name: 'Approve and post this settlement?' });
 expect(dialog).toHaveTextContent('Your approval settles the cash advance and posts the journal.');
 fireEvent.change(within(dialog).getByLabelText('Review findings'), { target: { value: 'Receipts verified.' } });
 fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, approve' }));
 await waitFor(() => expect(mocks.approveEscalation).toHaveBeenCalledWith('review-1', 1, 'current-version', 'Receipts verified.', expect.any(String)));
 await waitFor(() => expect(onChanged).toHaveBeenCalled());
 expect(mocks.liquidation).not.toHaveBeenCalled();
});
