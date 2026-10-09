// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../../src/app/features/tasks';
import type { Subtask } from '../../src/app/features/subtasks';
import type { UserProfile } from '../../src/app/types';

const mocks = vi.hoisted(() => ({
  create: vi.fn(), update: vi.fn(), refresh: vi.fn(), open: vi.fn(), openSubitem: vi.fn(),
  officeState: { offices: [] as Record<string, unknown>[], members: [], error: '' },
}));
vi.mock('../../src/app/contexts/AuthContext', () => ({ useAuth: () => ({ userProfile: { id: 'viewer', role: 'head', org_id: 'office' } }) }));
vi.mock('../../src/app/features/subtasks', async () => {
  const { parentTaskDueDate } = await import('../../src/app/features/subtasks/selectors/deadlines');
  return { createSubtask: mocks.create, updateSubtask: mocks.update, parentTaskDueDate };
});
vi.mock('../../src/app/features/tasks', async () => {
  const { getTaskLeadId, getTaskTeamMemberIds } = await import('../../src/app/features/tasks/selectors/teamMembership');
  const { isTaskLead } = await import('../../src/app/features/tasks/selectors/leadership');
  return { getTaskLeadId, getTaskTeamMemberIds, isTaskLead, assignTask: vi.fn(), updateTaskStatus: vi.fn(), TASK_STATUS_LABELS: { todo: 'To Do', in_progress: 'In Progress', for_review: 'For Review', completed: 'Completed', cancelled: 'Cancelled' } };
});
vi.mock('../../src/app/features/project-offices', () => ({ useProjectOfficeContext: () => mocks.officeState, canHandoverTask: () => false, projectOfficePeople: () => [], setResponsibleOffice: vi.fn(), moveProjectOfficeTask: vi.fn() }));
vi.mock('../../src/app/features/project-table/services/workspaceService', () => ({ patchWorkspaceTask: vi.fn() }));
vi.mock('../../src/app/features/project-table/components/PlanningCells', () => ({ TimelineCell: () => null, DependencyCell: () => null, NumberCell: () => null }));
vi.mock('../../src/app/features/staffing', () => ({ StaffingDialog: () => null }));

import { ProjectTaskRow } from '../../src/app/features/project-table/components/ProjectTaskRow';

const task: Task = { id: 'task', title: 'Prepare assessment', orgId: 'office', assigneeId: 'viewer', status: 'todo', deadline: '2026-10-12', createdAt: 1, updatedAt: 1 };
const subtask = (patch: Partial<Subtask> = {}): Subtask => ({ id: 'subitem', taskId: task.id, title: 'Gather evidence', status: 'todo', isCompleted: false, percentComplete: 0, assignedToIds: ['lead'], position: 3, isStandalone: false, source: 'manual', createdAt: 1, updatedAt: 1, ...patch });
const profiles = [{ id: 'viewer', full_name: 'Office Head' }, { id: 'lead', full_name: 'Maria Clara' }] as UserProfile[];

function show(patch: Partial<Task> = {}, subtasks: Subtask[] = []) {
  const result = render(<table><tbody><ProjectTaskRow task={{ ...task, ...patch }} tasks={[]} groups={[]} profiles={profiles} orgs={[]} columns={[]} editable userId="viewer" subtasks={subtasks} onOpen={mocks.open} onOpenSubitem={mocks.openSubitem} refreshSubitems={mocks.refresh} reorderable={false} onMove={vi.fn()} run={async fn => { await fn(); }}/></tbody></table>);
  fireEvent.click(screen.getByRole('button', { name: 'Subitems for Prepare assessment' }));
  return result;
}

beforeEach(() => { vi.clearAllMocks(); mocks.officeState.offices = []; mocks.officeState.error = ''; mocks.create.mockResolvedValue(subtask()); mocks.refresh.mockResolvedValue(undefined); });
afterEach(cleanup);

describe('Project table subitem expansion', () => {
  it('places task actions in the first cell and keeps detail access without drag controls', async () => {
    const { container } = show();
    const row = container.querySelector<HTMLTableRowElement>('.pt-task-row')!;
    const actions = within(row).getByRole('button', { name: 'Actions for Prepare assessment' });
    expect(row.cells[0].contains(actions)).toBe(true);
    expect(row.cells).toHaveLength(3);
    expect(within(row).queryByRole('button', { name: /^Drag / })).toBeNull();
    expect(row.querySelector('[draggable]')).toBeNull();
    fireEvent.keyDown(actions, { key: 'Enter' });
    expect((await screen.findByRole('menuitem', { name: 'Move up', exact: true })).getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Task details, evidence & review' }));
    await waitFor(()=>expect(mocks.open).toHaveBeenCalledOnce());
  });

  it('keeps the first-column Add subitem action disabled for someone who is not the task lead', async () => {
    show({ assigneeId: 'lead' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Actions for Prepare assessment' }), { key: 'Enter' });
    expect((await screen.findByRole('menuitem', { name: 'Add subitem', exact: true })).getAttribute('aria-disabled')).toBe('true');
    expect(screen.queryByRole('textbox', { name: 'Add subitem to Prepare assessment' })).toBeNull();
  });

  it('hands menu focus to the add field when subitems are already expanded', async () => {
    show();
    const actions = screen.getByRole('button', { name: 'Actions for Prepare assessment' });
    actions.focus();
    fireEvent.keyDown(actions, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Add subitem', exact: true }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Add subitem to Prepare assessment' })));
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('opens an empty nested table and saves the task lead’s subitem when focus leaves', async () => {
    show();
    const table = screen.getByRole('table', { name: 'Prepare assessment subitems' });
    expect(within(table).getAllByRole('columnheader').map(header => header.textContent)).toEqual(['Subitem', 'Owner', 'Status', 'Due date', 'Progress']);
    const input = screen.getByRole('textbox', { name: 'Add subitem to Prepare assessment' });
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: '  Prepare agenda  ' } });
    fireEvent.blur(input);
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(mocks.create).toHaveBeenCalledWith('task', 'Prepare agenda', { position: 0, dueDate: '2026-10-12' });
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('lets the task lead set a due date before focus leaves the add row', async () => {
    show();
    const input = screen.getByRole('textbox', { name: 'Add subitem to Prepare assessment' });
    const date = screen.getByLabelText('Due date for new subitem to Prepare assessment');
    fireEvent.change(input, { target: { value: 'Prepare agenda' } });
    fireEvent.blur(input, { relatedTarget: date });
    expect(mocks.create).not.toHaveBeenCalled();
    fireEvent.change(date, { target: { value: '2026-10-10' } });
    fireEvent.blur(date);
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(mocks.create).toHaveBeenCalledWith('task', 'Prepare agenda', { position: 0, dueDate: '2026-10-10' });
  });

  it('keeps order, owners, progress, dates, and evidence drawer access', () => {
    const first = subtask({ id: 'first', title: 'First step', position: 1, dueDate: '2026-10-10', percentComplete: 40 });
    show({}, [subtask(), first]);
    const table = screen.getByRole('table', { name: 'Prepare assessment subitems' });
    expect(within(table).getAllByRole('button', { name: /^Edit subitem/ }).map(button => button.textContent)).toEqual(['First step', 'Gather evidence']);
    expect(within(table).getAllByText('Maria Clara')).toHaveLength(2);
    expect(within(table).getByText('40%')).toBeTruthy();
    expect(within(table).getByText('2026-10-10')).toBeTruthy();
    fireEvent.click(within(table).getByRole('button', { name: 'Open subitem First step' }));
    expect(mocks.openSubitem).toHaveBeenCalledWith(first);
  });

  it('explains why an Office Head who is not the task lead cannot add', () => {
    show({ assigneeId: 'lead' });
    expect(screen.getByText('No subitems yet.')).toBeTruthy();
    expect(screen.getByText('Only the assigned task lead (Maria Clara) can add subitems.')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Add subitem to Prepare assessment' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Task details' }));
    expect(mocks.open).toHaveBeenCalledOnce();
  });

  it('explains the assignment step for tasks without a lead', () => {
    show({ assigneeId: undefined });
    expect(screen.getByText('Assign a task owner first. Only the assigned task lead can add subitems.')).toBeTruthy();
  });

  it.each(['for_review', 'completed', 'cancelled'] as const)('preserves the %s lock and keeps existing subitems readable', status => {
    show({ status }, [subtask()]);
    expect(screen.getByText(/Subitems are locked while this task is/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Edit subitem Gather evidence' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('textbox', { name: 'Add subitem to Prepare assessment' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Open subitem Gather evidence' })).toBeTruthy();
  });

  it('preserves observer access even when the viewer is the assigned lead', () => {
    mocks.officeState.offices = [{ office_id: 'office', relationship_type: 'observer', invitation_status: 'joined' }];
    show();
    expect(screen.getByText('This Office has read-only access to this task.')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Add subitem to Prepare assessment' })).toBeNull();
  });

  it('keeps a failed draft for retry and appends after the greatest saved position', async () => {
    mocks.create.mockRejectedValueOnce(new Error('Could not save.'));
    show({}, [subtask()]);
    const input = screen.getByRole('textbox', { name: 'Add subitem to Prepare assessment' });
    fireEvent.change(input, { target: { value: 'Next step' } });
    fireEvent.submit(input.closest('form')!);
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Could not save.');
    expect((input as HTMLInputElement).value).toBe('Next step');
    expect(mocks.refresh).not.toHaveBeenCalled();
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(mocks.create).toHaveBeenLastCalledWith('task', 'Next step', { position: 4, dueDate: '2026-10-12' });
  });
});
