import { expect, it, vi } from 'vitest';

const read = vi.hoisted(() => vi.fn());
vi.mock('../../src/app/features/budget/services/budgetReportReads', () => ({ budgetReportRead: read }));
import { fetchProjectExpenseTotals } from '../../src/app/features/budget/services/projectExpenseService';

it('rolls up direct and subtask expenses once, keeping only the latest pending report separate', async () => {
  const settled = { id: 'purchase', task_id: 'task', subtask_id: 'supplies', status: 'settled', actual_spent: '640.75' };
  read.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({ data: [
    settled, settled,
    { id: 'direct', task_id: 'task', status: 'settled', actual_spent: '40.25' },
    { id: 'pending', task_id: 'task', subtask_id: 'supplies', status: 'pending_department_settlement' },
    { id: 'correct', task_id: 'task', subtask_id: 'supplies', status: 'liquidation_submitted' },
  ] }).mockResolvedValueOnce({ data: [
    { request_id: 'pending', version: 1, declared_spent: 75, status: 'changes_requested' },
    { request_id: 'pending', version: 2, declared_spent: 90, status: 'pending_department_settlement' },
    { request_id: 'correct', version: 1, declared_spent: 15, status: 'changes_requested' },
  ] });

  const totals = await fetchProjectExpenseTotals(['task']);
  expect(totals.tasks.get('task')).toEqual({ settled: 68100, pending: 9000, pendingCount: 1 });
  expect(totals.subtasks.get('supplies')).toEqual({ settled: 64075, pending: 9000, pendingCount: 1 });
});

it('uses the complete Task Lead rollup and its cap without adding the visible cash rows again', async () => {
  read.mockResolvedValueOnce({ data: [
    { task_id: 'task', subtask_id: null, settled: 680, pending: 90, pending_count: 1, expense_count: 3 },
    { task_id: 'task', subtask_id: 'supplies', settled: 640, pending: 90, pending_count: 1, expense_count: 2, subtask_budget: 900 },
  ] }).mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({ data: [] });
  const totals = await fetchProjectExpenseTotals(['task']);
  expect(totals.tasks.get('task')).toMatchObject({ settled: 68000, complete: true });
  expect(totals.subtasks.get('supplies')).toMatchObject({ settled: 64000, pending: 9000, budget: 900 });
  expect(read.mock.lastCall?.[1]).toEqual([]);
});
