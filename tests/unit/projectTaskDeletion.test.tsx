// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useProjectTaskDeletion } from '../../src/app/features/project-table/hooks/useProjectTaskDeletion';
import type { Task } from '../../src/app/features/tasks';

const mocks = vi.hoisted(() => ({ remove: vi.fn(), confirm: vi.fn() }));
vi.mock('../../src/app/features/tasks', () => ({ deleteTask: mocks.remove }));
vi.mock('../../src/app/components/ui/useConfirmation', () => ({ useConfirmation: () => ({ confirm: mocks.confirm, dialog: null }) }));
const task: Task = { id: 'task', title: 'Prepare meeting', orgId: 'office', status: 'todo', createdAt: 1, updatedAt: 1 };
beforeEach(() => { vi.clearAllMocks(); mocks.remove.mockResolvedValue(undefined); mocks.confirm.mockResolvedValue(true); });
afterEach(cleanup);

it('requires access and leaves cancelled task deletion untouched', async () => {
  const hook = renderHook(({ allowed }) => useProjectTaskDeletion(task, allowed), { initialProps: { allowed: false } });
  await act(async () => { await hook.result.current.remove(); });
  expect(mocks.confirm).not.toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled();
  hook.rerender({ allowed: true }); mocks.confirm.mockResolvedValue(false);
  await act(async () => { await hook.result.current.remove(); });
  expect(mocks.confirm).toHaveBeenCalledOnce(); expect(mocks.remove).not.toHaveBeenCalled();
});
it('deletes once through the existing task command without deleting the project', async () => {
  const hook = renderHook(() => useProjectTaskDeletion(task, true));
  await act(async () => { await hook.result.current.remove(); });
  await act(async () => { await hook.result.current.remove(); });
  expect(mocks.remove.mock.calls).toEqual([['task']]);
  expect(mocks.confirm.mock.calls[0][0]).toMatchObject({ title: 'Delete task?', actionLabel: 'Delete task', danger: true });
});
it('rechecks access when the confirmation is accepted', async () => {
  let accept!: (value: boolean) => void;
  mocks.confirm.mockImplementation(() => new Promise<boolean>(resolve => { accept = resolve; }));
  const hook = renderHook(({ allowed }) => useProjectTaskDeletion(task, allowed), { initialProps: { allowed: true } });
  let pending!: Promise<void>;
  act(() => { pending = hook.result.current.remove(); });
  hook.rerender({ allowed: false });
  await act(async () => { accept(true); await pending; });
  expect(mocks.remove).not.toHaveBeenCalled();
  expect(hook.result.current.message).toContain('This task changed');
});
