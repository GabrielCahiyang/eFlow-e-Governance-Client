// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { Task } from '../../src/app/features/tasks';
import type { Subtask } from '../../src/app/features/subtasks';
import { InspectorExecution } from '../../src/app/features/task-inspector/components/InspectorExecution';

const api = vi.hoisted(() => ({ actor: 'contributor', proposal: vi.fn() }));
vi.mock('../../src/app/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: api.actor } }) }));
vi.mock('../../src/app/services/taskDiscussionService', () => ({
  subscribeToProgressUpdates: (_id: string, update: (items: unknown[]) => void) => { update([]); return () => {}; },
  submitProgressUpdate: vi.fn(),
}));
vi.mock('../../src/app/features/tasks', async () => ({
  ...await import('../../src/app/features/tasks/selectors/submissionReadiness'),
  isTaskLead: (task: Task, actor: string) => task.assigneeId === actor,
  submitTaskForReview: vi.fn(),
}));
vi.mock('../../src/app/features/subtasks', () => ({
  SubitemLeadReview: (props: unknown) => { api.proposal(props); return <div>Lead proposals</div>; },
}));
vi.mock('../../src/app/features/budget', () => ({ assertWorkAcceptanceAvailable: vi.fn(), WorkFinancialClearancePanel: () => null }));
vi.mock('../../src/app/features/work-state', () => ({ WorkExecutionForm: () => <div>Direct work form</div> }));

afterEach(() => { cleanup(); api.actor = 'contributor'; });
const task = { id:'root', linkedProjectId:'project', assigneeId:'lead', status:'in_progress' } as Task;
const unfinished = [{ id:'child', status:'in_progress' } as Subtask];

it('routes project contributors to proposals without requiring the parent to be ready', () => {
  render(<InspectorExecution task={task} subtasks={unfinished} canStart={false} canResume={false}
    canSubmit={false} canPostProgress busy={false} onStart={vi.fn()} onSubmitted={vi.fn()}/>);
  expect(screen.getByText('Lead proposals')).toBeTruthy();
  expect(screen.queryByText('Direct work form')).toBeNull();
  const props = api.proposal.mock.lastCall?.[0];
  expect(props).toMatchObject({ root:'root', node:null, actor:'contributor', readOnly:false });
  expect(props.completionBlocked).toBeUndefined();
});

it('retains direct execution for the appointed Task Lead', () => {
  api.actor = 'lead';
  render(<InspectorExecution task={task} subtasks={unfinished} canStart={false} canResume={false}
    canSubmit canPostProgress busy={false} onStart={vi.fn()} onSubmitted={vi.fn()}/>);
  expect(screen.getByText('Direct work form')).toBeTruthy();
});
