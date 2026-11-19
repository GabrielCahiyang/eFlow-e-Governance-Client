// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../../src/app/features/tasks';

const state = vi.hoisted(() => ({
  returned: { task: 0, subtasks: new Map<string, number>() },
  totals: { tasks: new Map(), subtasks: new Map() } as {
    tasks: Map<string, { settled: number; pending: number; pendingCount: number; complete?: boolean }>;
    subtasks: Map<string, { settled: number; pending: number; pendingCount: number; complete?: boolean }>;
  },
  flow: {
    data: {
      project: { id: 'proj-1', status: 'active', funding_not_required: false },
      ready: true,
      canAllocate: true,
      canExtendTaskFunding: true,
      unallocated: 5000,
      funds: [{ id: 'src-1', name: 'MOOE', fiscal_year: 2026, available: 5000 }],
      taskFunding: [] as Array<{ id: string; sourceId: string; fiscalYear: number; taskId: string; task: string; source: string; amount: number; available: number }>,
    },
    reload: vi.fn().mockResolvedValue(undefined),
    error: '',
  },
}));

vi.mock('../../src/app/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'project-lead-1' },
    userProfile: { id: 'project-lead-1', role: 'member', org_id: 'org-1', is_active: true },
  }),
}));

vi.mock('../../src/app/features/budget/services/projectExpenseService', () => ({
  fetchProjectExpenseTotals: vi.fn(async () => state.totals),
}));

vi.mock('../../src/app/features/project-setup/useProjectFlow', () => ({
  useProjectFlow: () => state.flow,
}));

vi.mock('../../src/app/features/project-setup/services/returnedBudget', () => ({
  fetchReturnedBudget: vi.fn(async () => state.returned),
}));

vi.mock('../../src/app/hooks/useSupabaseData', () => ({
  useOrgs: () => ({ orgs: [] }),
}));

vi.mock('../../src/app/features/budget/hooks/useDepartmentBudget', () => ({
  useDepartmentBudget: () => ({
    loading: false,
    error: '',
    summary: { status: 'locked' },
    allocations: [],
    requests: [],
    refresh: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    channel: () => ({
      on: function () { return this; },
      subscribe: () => ({}),
    }),
    removeChannel: vi.fn(),
  },
}));

import { ProjectActualExpensesProvider } from '../../src/app/features/budget/components/ProjectActualExpenses';
import { ProjectSubtaskBudgetCell, ProjectWorkExpensesCell } from '../../src/app/features/budget/components/ProjectTaskBudget';
import { TaskFundingCell } from '../../src/app/features/project-setup/components/TaskFundingCell';

describe('Completed work with unused budget display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.totals = { tasks: new Map(), subtasks: new Map() };
    state.flow.data.taskFunding = [];
    state.returned = { task: 0, subtasks: new Map() };
  });

  afterEach(() => {
    cleanup();
  });

  it('shows ₱0.00 in Actual expenses for completed tasks and subtasks with zero expenses, while keeping — for open work', async () => {
    state.totals.tasks.set('task-spent', { settled: 50000, pending: 0, pendingCount: 0, complete: true });

    const completedNoSpend = { id: 'task-done-0', title: 'Done zero', status: 'completed' } as Task;
    const completedSpent = { id: 'task-spent', title: 'Done spent', status: 'completed' } as Task;
    const activeNoSpend = { id: 'task-open-0', title: 'Open zero', status: 'in_progress' } as Task;

    render(
      <ProjectActualExpensesProvider taskIds={['task-done-0', 'task-spent', 'task-open-0']}>
        <div data-testid="done-zero"><ProjectWorkExpensesCell task={completedNoSpend} /></div>
        <div data-testid="done-spent"><ProjectWorkExpensesCell task={completedSpent} /></div>
        <div data-testid="open-zero"><ProjectWorkExpensesCell task={activeNoSpend} /></div>
        <div data-testid="sub-done-zero"><ProjectWorkExpensesCell task={activeNoSpend} subtaskId="sub-done" subtaskStatus="completed" /></div>
        <div data-testid="sub-open-zero"><ProjectWorkExpensesCell task={activeNoSpend} subtaskId="sub-open" subtaskStatus="in_progress" /></div>
      </ProjectActualExpensesProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('done-zero')).toHaveTextContent('₱0.00');
    });
    expect(screen.getByTestId('done-spent')).toHaveTextContent('₱500.00');
    expect(screen.getByTestId('open-zero')).toHaveTextContent('—');
    expect(screen.getByTestId('sub-done-zero')).toHaveTextContent('₱0.00');
    expect(screen.getByTestId('sub-open-zero')).toHaveTextContent('—');
  });

  it('keeps the original budget on completed tasks and explains the unused part went back to the project', async () => {
    state.returned = { task: 400, subtasks: new Map([['sub-done', 250]]) };
    render(
      <>
        <TaskFundingCell projectId="proj-1" taskId="task-done" title="Completed task" taskStatus="completed" />
        <TaskFundingCell projectId="proj-1" taskId="task-open" title="Open task" taskStatus="in_progress" />
      </>,
    );

    const completedBtn = screen.getByRole('button', { name: 'Budget for Completed task' });
    await waitFor(() => expect(completedBtn).toHaveTextContent('₱400'));
    expect(completedBtn).not.toHaveTextContent('Allocate budget');

    const openBtn = screen.getByRole('button', { name: 'Budget for Open task' });
    expect(openBtn).toHaveTextContent('Allocate budget');

    fireEvent.click(completedBtn);
    expect(screen.getByText('Budget: ₱400')).toBeInTheDocument();
    expect(screen.getByText(/was not used and was returned to the project budget/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Allocate task budget' })).toBeNull();
  });

  it('shows the live allocation plus the returned part for completed tasks that kept spent funds', async () => {
    state.flow.data.taskFunding = [{ id: 'l1', sourceId: 'src-1', fiscalYear: 2026, taskId: 'task-part', task: 'Part', source: 'MOOE', amount: 200, available: 0 }];
    state.returned = { task: 300, subtasks: new Map() };
    render(<TaskFundingCell projectId="proj-1" taskId="task-part" title="Part" taskStatus="completed" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Budget for Part' })).toHaveTextContent('₱500'));
  });

  it('shows ₱0 for completed tasks that never had a budget', () => {
    render(<TaskFundingCell projectId="proj-1" taskId="task-none" title="No budget" taskStatus="completed" />);
    expect(screen.getByRole('button', { name: 'Budget for No budget' })).toHaveTextContent('₱0');
  });

  it('keeps the original cap on completed subtasks', async () => {
    state.returned = { task: 0, subtasks: new Map([['sub-1', 300]]) };
    const parentTask = { id: 'task-1', title: 'Parent', orgId: 'org-1', status: 'in_progress' } as Task;
    render(
      <ProjectSubtaskBudgetCell task={parentTask} subtaskId="sub-1" subtaskTitle="Done step" subtaskStatus="completed" />,
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Budget for Done step' })).toHaveTextContent('₱300.00'));
  });

  it('shows ₱0.00 for completed subtasks that never had a cap', () => {
    const parentTask = { id: 'task-1', title: 'Parent', orgId: 'org-1', status: 'in_progress' } as Task;
    render(
      <ProjectSubtaskBudgetCell task={parentTask} subtaskId="sub-9" subtaskTitle="Plain step" subtaskStatus="completed" />,
    );
    expect(screen.getByRole('button', { name: 'Budget for Plain step' })).toHaveTextContent('₱0.00');
  });
});
