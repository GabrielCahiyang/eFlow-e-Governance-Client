// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../../src/app/features/tasks';

const state = vi.hoisted(() => ({
  allocations: [] as Array<{ id: string; taskId: string; subtaskId?: string; status: string; amount: number }>,
  refreshBudget: vi.fn().mockResolvedValue(undefined),
  fetchContext: vi.fn(),
  fetchAllocation: vi.fn(),
  setCap: vi.fn().mockResolvedValue('cap-1'),
  removeCap: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/app/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'lead-1' }, userProfile: { id: 'lead-1', role: 'member', org_id: 'org-1', is_active: true } }),
}));
vi.mock('../../src/app/hooks/useSupabaseData', () => ({ useOrgs: () => ({ orgs: [] }) }));
vi.mock('../../src/app/features/project-setup', () => ({
  TaskFundingCell: () => null,
  useProjectFlow: () => ({ data: undefined }),
}));
vi.mock('../../src/app/features/budget/hooks/useDepartmentBudget', () => ({
  useDepartmentBudget: () => ({
    loading: false,
    error: '',
    summary: { status: 'locked' },
    allocations: state.allocations,
    requests: [],
    refresh: state.refreshBudget,
  }),
}));
vi.mock('../../src/app/features/budget/services/budgetService', () => ({
  fetchTaskFundingContext: state.fetchContext,
  fetchSubtaskAllocationContext: state.fetchAllocation,
  setSubtaskBudgetCap: state.setCap,
  removeSubtaskBudgetCap: state.removeCap,
}));

import { ProjectSubtaskBudgetCell, ProjectTaskBudgetProvider } from '../../src/app/features/budget/components/ProjectTaskBudget';

const task: Task = {
  id: 'task-1',
  title: 'Parent delivery',
  orgId: 'org-1',
  assigneeId: 'lead-1',
  status: 'in_progress',
  createdAt: 1,
  updatedAt: 1,
};

describe('ProjectSubtaskBudgetCell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.allocations = [];
    state.fetchAllocation.mockResolvedValue({
      canAllocate: true,
      lines: [{ id: 'line-1', name: 'Supplies', available: 500 }],
    });
    state.fetchContext.mockResolvedValue({
      funded: true,
      available: 500,
      taskBudget: 500,
      taskAllocationId: 'alloc-1',
      taskLeaderId: 'lead-1',
      fiscalYear: 2026,
      fundingOrgId: 'org-1',
      lines: [
        { id: 'line-1', category: 'MOOE', particular: 'Supplies', fundSource: 'General Fund', amount: 500, available: 500 },
      ],
      cap: undefined,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('uses root-matching Allocate budget trigger and modal form to allocate a subtask cap', async () => {
    render(
      <ProjectSubtaskBudgetCell task={task} subtaskId="sub-1" subtaskTitle="Buy materials" />,
    );

    const trigger = screen.getByRole('button', { name: 'Budget for Buy materials' });
    expect(trigger.className).toBe('pt-date');
    expect(trigger.textContent).toContain('Open budget');

    fireEvent.click(trigger);
    expect(await screen.findByText('Subtask budget · Buy materials')).toBeTruthy();
    const accountSelect = await screen.findByLabelText('Subtask budget account') as HTMLSelectElement;
    expect(accountSelect.value).toBe('line-1');
    expect(state.fetchAllocation).toHaveBeenCalledWith('task-1', 'sub-1');

    fireEvent.change(screen.getByLabelText('Subtask budget amount'), { target: { value: '250' } });
    fireEvent.change(screen.getByLabelText('Subtask allocation reason'), { target: { value: 'Supplies purchase' } });
    fireEvent.click(screen.getByRole('button', { name: 'Allocate subtask budget' }));

    await waitFor(() =>
      expect(state.setCap).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-1',
          subtaskId: 'sub-1',
          allocationLineId: 'line-1',
          amount: 250,
          reason: 'Supplies purchase',
        }),
      ),
    );
  });

  it('uses the parent line limit when a cash cap exposes a different available amount', async () => {
    const current = await state.fetchContext();
    state.fetchContext.mockResolvedValue({
      ...current,
      cap: { id: 'cap-1', amount: 100, available: 100, allocationLineId: 'line-1', reason: 'Supplies' },
      lines: [{ ...current.lines[0], available: 100 }],
    });
    state.fetchAllocation.mockResolvedValue({ canAllocate: true, lines: [{ id: 'line-1', name: 'Supplies', available: 350 }] });
    render(<ProjectSubtaskBudgetCell task={task} subtaskId="sub-1" subtaskTitle="Buy materials" />);
    fireEvent.click(screen.getByRole('button', { name: 'Budget for Buy materials' }));
    expect(await screen.findByText('₱350.00 max from this account')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Subtask budget amount'), { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update subtask budget' }));
    await waitFor(() => expect(state.setCap).toHaveBeenCalledWith(expect.objectContaining({ amount: 300 })));
  });

  it('keeps allocation read-only when the server denies it', async () => {
    state.fetchAllocation.mockResolvedValue({ canAllocate: false, reason: 'planning_lead_required', lines: [] });
    render(<ProjectSubtaskBudgetCell task={task} subtaskId="sub-1" subtaskTitle="Buy materials" />);
    fireEvent.click(screen.getByRole('button', { name: 'Budget for Buy materials' }));
    expect(await screen.findByText(/During Planning, the appointed Project Lead/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retry funding' })).toBeNull();
    expect(screen.queryByLabelText('Subtask budget account')).toBeNull();
    expect(state.setCap).not.toHaveBeenCalled();
  });

  it('displays formatted peso amount when an approved subtask cap already exists', () => {
    state.allocations = [
      { id: 'cap-1', taskId: 'task-1', subtaskId: 'sub-1', status: 'approved', amount: 250 },
    ];
    render(
      <ProjectTaskBudgetProvider officeId="org-1">
        <ProjectSubtaskBudgetCell task={task} subtaskId="sub-1" subtaskTitle="Buy materials" />
      </ProjectTaskBudgetProvider>,
    );

    expect(screen.getByRole('button', { name: 'Budget for Buy materials' }).textContent).toContain('₱250');
  });
});
