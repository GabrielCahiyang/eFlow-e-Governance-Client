// @vitest-environment jsdom
import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it} from 'vitest';
import {SubmissionHistory} from '../../src/app/features/reviews/components/SubmissionHistory';
import type {ReviewSubmission} from '../../src/app/features/reviews/types';
const approved:ReviewSubmission={id:'attempt',taskId:'task',version:1,submitterId:'worker',submitterName:'Crisostomo',note:'Finished pack',status:'approved',decidedByName:'Cheryl',decidedAt:1,submittedAt:1};
afterEach(cleanup);
describe('visible submission history',()=>{
 it('shows the sole approved attempt and its decision instead of an empty disclosure',()=>{
  const view=render(<SubmissionHistory submissions={[approved]}/>);expect(screen.getByText('Approved')).toBeTruthy();expect(screen.getByText(/Decision by Cheryl/)).toBeTruthy();expect(screen.getByText('Finished pack')).toBeTruthy();expect(view.container.querySelector('details')).toBeNull();
 });
 it('preserves earlier feedback beside the later approval without another nested disclosure',()=>{
  render(<SubmissionHistory submissions={[{...approved,id:'second',version:2},{...approved,status:'changes_requested',decisionFeedback:'Add the missing agenda'}]}/>);expect(screen.getByText('Attempt 2 · Crisostomo')).toBeTruthy();expect(screen.getByText('Updates needed')).toBeTruthy();expect(screen.getByText('Cheryl: Add the missing agenda')).toBeTruthy();
 });
 it('explains an empty history',()=>{render(<SubmissionHistory submissions={[]}/>);expect(screen.getByText('No submissions recorded.')).toBeTruthy();});
});
