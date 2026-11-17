// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AssignedSubtaskReviews } from '../../src/app/features/personal-work/components/AssignedSubtaskReviews';

const api = vi.hoisted(() => ({ load: vi.fn(), open: vi.fn() }));
vi.mock('../../src/app/features/personal-work/services/assignedSubtaskReviews', () => ({ fetchAssignedSubtaskReviews: api.load }));
vi.mock('../../src/app/features/notifications', () => ({ fetchNotificationSubitem: api.open, useNotificationNavigationIntent: vi.fn() }));
vi.mock('../../src/app/shared/workChanges', () => ({ subscribeWorkChanges: () => () => {} }));
vi.mock('../../src/app/features/subtasks', () => ({
  SubtaskWorkDrawer: ({ subtask, presentation }: { subtask: { title: string }; presentation?: string }) => (
    <h2 data-presentation={presentation}>Reviewing {subtask.title}</h2>
  ),
}));

afterEach(() => { cleanup(); vi.resetAllMocks(); });

it('opens an assigned submission in dialog mode and filters by submission type', async () => {
  api.load.mockResolvedValue([
    { id: 'submission', root_id: 'root', node_id: 'node', task_title: 'Prepare logistics',
      subtask_title: 'Purchase supplies', kind: 'completion', cash_blocked: true },
    { id: 'prog-1', root_id: 'root', node_id: 'node-2', task_title: 'Prepare logistics',
      subtask_title: 'Weekly inventory check', kind: 'progress', cash_blocked: false },
  ]);
  api.open.mockResolvedValue({ id: 'node', title: 'Purchase supplies', parentTask: { id: 'root' } });
  render(<AssignedSubtaskReviews actor="reviewer"/>);
  expect(screen.getByLabelText('Search reviews')).toBeTruthy();
  expect(await screen.findByText('Completion is waiting for cash settlement.')).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Progress updates' }));
  expect(screen.queryByText('Purchase supplies')).toBeNull();
  expect(screen.getByText('Weekly inventory check')).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'All' }));
  fireEvent.click(screen.getByRole('button', { name: 'Open review for Purchase supplies' }));
  const heading = await screen.findByRole('heading', { name: 'Reviewing Purchase supplies' });
  expect(heading.getAttribute('data-presentation')).toBe('dialog');
  expect(api.open).toHaveBeenCalledWith(expect.objectContaining({ taskId: 'root', entityId: 'node' }), 'reviewer');
});

it('keeps the consistent search toolbar and page empty state when zero reviews are waiting', async () => {
  api.load.mockResolvedValue([]);
  render(<AssignedSubtaskReviews actor="reviewer"/>);
  expect(await screen.findByText('No reviews waiting')).toBeTruthy();
  expect(screen.getByLabelText('Search reviews')).toBeTruthy();
  expect(screen.getByRole('status').textContent).toBe('0 reviews');
});
