// @vitest-environment jsdom
import {render,screen,cleanup} from '@testing-library/react';
import {describe,it,expect,vi,afterEach} from 'vitest';
import type {Task} from '../../src/app/features/tasks';
vi.mock('../../src/app/features/reviews/components/SubmissionAttachments',()=>({SubmissionAttachments:()=>null}));
import {SubmissionSummary} from '../../src/app/features/reviews/components/SubmissionSummary';
afterEach(cleanup);
describe('Phase 12 shared submission display',()=>{
 it('renders rich evidence notes while removing executable content',()=>{
  const task={id:'a',title:'Task',latestSubmission:{submitterName:'Author',submittedAt:1,note:'<p>Result <strong>verified</strong></p><img src="x" onerror="alert(1)"><script>alert(2)</script>'}} as Task;
  const {container}=render(<SubmissionSummary task={task} attachments={[]}/>);
  expect(screen.getByText('verified').tagName).toBe('STRONG');expect(container.querySelector('script')).toBeNull();expect(container.querySelector('img')?.getAttribute('onerror')).toBeNull();expect(container.textContent).not.toContain('alert(2)');
 });
});
