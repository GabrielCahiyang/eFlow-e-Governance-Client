// @vitest-environment jsdom
import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({actor:'worker',role:'member',attachments:vi.fn(),submissions:vi.fn()}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:api.actor},userProfile:{role:api.role}})}));
vi.mock('../../src/app/features/reviews/services/reviewService',()=>({fetchSubmissionAttachments:api.attachments,fetchTaskSubmissions:api.submissions}));
vi.mock('../../src/app/features/reviews/components/SubmissionSummary',()=>({SubmissionSummary:()=> <p>Recorded evidence</p>}));
vi.mock('../../src/app/features/reviews/components/SubmissionHistory',()=>({SubmissionHistory:()=> <p>Recorded decision history</p>}));
vi.mock('../../src/app/features/reviews/components/ReviewDecisionForm',()=>({ReviewDecisionForm:()=> <button>Record decision</button>}));
import {TaskReviewPanel} from '../../src/app/features/reviews/components/TaskReviewPanel';
import type {Task} from '../../src/app/features/tasks';
const task=(status:Task['status'])=>({id:'task',status,reviewerId:'head',latestSubmission:{id:'attempt',submitterId:'worker'}} as Task);
beforeEach(()=>{api.actor='worker';api.role='member';api.attachments.mockResolvedValue([]);api.submissions.mockResolvedValue([]);});
afterEach(cleanup);
describe('terminal review presentation',()=>{
 it.each(['completed','changes_requested'] as const)('preserves %s evidence without claiming a decision is still needed',async status=>{
  render(<TaskReviewPanel task={task(status)}/>);await screen.findByText('Recorded evidence');
  expect(screen.queryByText(/another assigned reviewer must decide/)).toBeNull();expect(screen.getByText('Recorded decision history')).toBeTruthy();
 });
 it('explains the independent decision only while the submitter is awaiting review',async()=>{
  render(<TaskReviewPanel task={task('for_review')}/>);await screen.findByText('Recorded evidence');expect(screen.getByText(/another assigned reviewer must decide/)).toBeTruthy();
 });
 it('keeps authorized Head decisions on pending work and locks completed history',async()=>{
  api.actor='head';api.role='head';const view=render(<TaskReviewPanel canReview task={task('for_review')}/>);await screen.findByRole('button',{name:'Record decision'});
  view.rerender(<TaskReviewPanel canReview task={task('completed')}/>);await screen.findByText('Recorded evidence');expect(screen.queryByRole('button',{name:'Record decision'})).toBeNull();
 });
});
