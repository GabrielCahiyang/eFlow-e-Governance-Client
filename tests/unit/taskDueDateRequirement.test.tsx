// @vitest-environment jsdom
vi.mock('../../src/app/features/project-setup', () => ({ useProjectFlow: () => ({ data: null, error: '', reload: vi.fn() }) }));
const api = vi.hoisted(() => ({
  state: { version: 1, task_id: 'dates', node_id: null, updated_at: '2026-10-17T00:00:00Z', started: false, details: true, due: true, planning: true },
  rpc: vi.fn(),
}));
vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: 'head' } }, error: null }) },
    rpc: api.rpc,
  },
}));

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../../src/app/features/tasks';
import { TimelineCell } from '../../src/app/features/project-table/components/TimelineCell';
import { appendOfficeRows } from '../../src/app/features/personal-work/services/officeWorkRows';
import { selectWorkRows } from '../../src/app/features/personal-work/workSelectors';
import type { WorkSnapshot } from '../../src/app/features/personal-work/types';

const baseTask: Task = {
  id: 'dates',
  title: 'Prepare meeting',
  orgId: 'office',
  linkedProjectId: 'proj-1',
  assigneeId: 'lead-1',
  teamMemberIds: ['lead-1'],
  status: 'todo',
  createdAt: 1,
  updatedAt: 1,
};

beforeEach(() => {
  api.rpc.mockResolvedValue({ data: api.state, error: null });
});
afterEach(() => cleanup());

describe('task due-date prompt and assigned leader visibility', () => {
  it('asks the leader to set the date in the Due date column when an active task has no date', () => {
    render(<TimelineCell task={baseTask} disabled={false} save={vi.fn()} />);
    expect(screen.getByText('Required · hidden from lead')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Edit dates for Prepare meeting' }));
    expect(screen.getByText(/Until a date is set, it will not be shown to the assigned leader/i)).toBeTruthy();
  });

  it('does not show the required-date warning for completed or already-dated tasks', () => {
    const { rerender } = render(<TimelineCell task={{ ...baseTask, status: 'completed' }} disabled={false} save={vi.fn()} />);
    expect(screen.queryByText('Required · hidden from lead')).toBeNull();

    rerender(<TimelineCell task={{ ...baseTask, deadline: '2026-10-20' }} disabled={false} save={vi.fn()} />);
    expect(screen.queryByText('Required · hidden from lead')).toBeNull();
  });

  it('hides undated active office project tasks from the assigned leader in My Work until a date is set', () => {
    const undated: Task = { ...baseTask, id: 't-undated', deadline: undefined, dueDate: undefined };
    const dated: Task = { ...baseTask, id: 't-dated', deadline: '2026-10-20' };
    const completedUndated: Task = { ...baseTask, id: 't-done', status: 'completed', deadline: undefined };
    const out: WorkSnapshot = { rows: [], projects: [], workspaces: [], issues: [], unavailable: [], loadedAt: 0 };

    appendOfficeRows(
      out,
      'lead-1',
      [undated, dated, completedUndated],
      () => ({
        projectId: 'proj-1',
        projectTitle: 'Community Esports',
        workspaceId: 'ws-1',
        workspaceName: 'LEDIPO',
        officeName: 'LEDIPO',
        timezone: 'Asia/Singapore',
      }),
      new Map(),
      new Map(),
      new Map([['proj-1', { id: 'proj-1', status: 'active' }]]),
      new Set(),
    );

    expect(selectWorkRows(out.rows, 'Assigned work', 'All my work').map((row) => row.id)).toEqual(['t-dated']);
    expect(selectWorkRows(out.rows, 'Leading', 'All my work').map((row) => row.id)).toEqual(['t-dated']);
    expect(selectWorkRows(out.rows, 'History', 'All my work').map((row) => row.id)).toEqual(['t-done']);
  });
});
