// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AssignedSubtaskReviews } from '../../src/app/features/personal-work/components/AssignedSubtaskReviews';

const api = vi.hoisted(() => ({ load: vi.fn(), open: vi.fn() }));
vi.mock('../../src/app/features/personal-work/services/assignedSubtaskReviews', () => ({ fetchAssignedSubtaskReviews: api.load }));
vi.mock('../../src/app/features/notifications', () => ({ fetchNotificationSubitem: api.open, useNotificationNavigationIntent: vi.fn() }));
vi.mock('../../src/app/shared/workChanges', () => ({ subscribeWorkChanges: () => () => {} }));
vi.mock('../../src/app/features/subtasks', () => ({
  SubtaskWorkDrawer: ({ subtask }: { subtask: { title: string } }) => <h2>Reviewing {subtask.title}</h2>,
}));

afterEach(() => { cleanup(); vi.resetAllMocks(); });

it('opens an assigned submission from the queue without a notification', async () => {
  api.load.mockResolvedValue([{ id: 'submission', root_id: 'root', node_id: 'node', task_title: 'Prepare logistics',
    subtask_title: 'Purchase supplies', kind: 'completion', cash_blocked: true }]);
  api.open.mockResolvedValue({ id: 'node', title: 'Purchase supplies', parentTask: { id: 'root' } });
  render(<AssignedSubtaskReviews actor="reviewer"/>);
  expect(await screen.findByText('Completion is waiting for cash settlement.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Open review for Purchase supplies' }));
  await screen.findByRole('heading', { name: 'Reviewing Purchase supplies' });
  expect(api.open).toHaveBeenCalledWith(expect.objectContaining({ taskId: 'root', entityId: 'node' }), 'reviewer');
});
