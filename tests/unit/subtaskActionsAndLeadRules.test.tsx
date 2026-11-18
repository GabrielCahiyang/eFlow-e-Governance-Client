// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../../src/app/features/tasks';
import type { WorkTreeSnapshot } from '../../src/app/features/nested-work';
import type { UserProfile } from '../../src/app/types';

const api = vi.hoisted(() => ({
  actor: 'head',
  role: 'head',
  tree: vi.fn(),
  save: vi.fn(),
  record: vi.fn(),
  proposals: vi.fn(),
  openProposalEvidence: vi.fn(),
  inspectorFiles: vi.fn(),
  openInspectorFile: vi.fn(),
  expenses: vi.fn(),
  clearance: vi.fn(),
}));

vi.mock('../../src/app/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: api.actor },
    userProfile: { id: api.actor, role: api.role, org_id: 'office', is_active: true, full_name: 'Actor' },
  }),
}));

vi.mock('../../src/app/features/nested-work/services/workTreeService', () => ({
  fetchWorkTree: api.tree,
  saveWorkTree: api.save,
  fetchWorkImpact: vi.fn(),
  fetchWorkEvents: vi.fn().mockResolvedValue({ events: [], more: false }),
  WorkTreeUnavailable: class extends Error {},
}));

vi.mock('../../src/app/features/subtasks/services/subtaskWorkflowService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/app/features/subtasks/services/subtaskWorkflowService')>();
  return {
    ...actual,
    fetchSubitemInspectorRecord: api.record,
  };
});

vi.mock('../../src/app/features/subtasks/services/subitemLeadReview', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/app/features/subtasks/services/subitemLeadReview')>();
  return {
    ...actual,
    fetchSubitemLeadReview: api.proposals,
    openSubitemReviewEvidence: api.openProposalEvidence,
  };
});

vi.mock('../../src/app/features/task-inspector/services/inspectorFileService', () => ({
  fetchInspectorFiles: api.inspectorFiles,
  openInspectorFile: api.openInspectorFile,
}));

vi.mock('../../src/app/features/budget', () => ({
  peso: new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }),
  fetchProjectExpenseTotals: api.expenses,
  fetchWorkFinancialClearance: api.clearance,
  assertWorkAcceptanceAvailable: vi.fn(),
  ProjectTaskBudgetCell: () => <span />,
  ProjectSubtaskBudgetCell: () => <span />,
  ProjectWorkExpensesCell: () => <span />,
  WorkBudgetCard: ({ task, subtask }: { task: Task; subtask?: { id: string; title: string } }) => (
    <div data-testid="work-budget-card" data-task={task.id} data-subtask={subtask?.id} />
  ),
  WorkFinancialClearancePanel: ({ root, node }: { root: string; node?: string | null }) => (
    <div data-testid="work-clearance-panel" data-root={root} data-node={node || ''} />
  ),
}));

vi.mock('../../src/app/features/project-files', () => ({
  ProjectFileLibrary: ({ projectId, taskId, readOnly }: { projectId: string; taskId?: string; readOnly?: boolean }) => (
    <div data-testid="project-file-library" data-project={projectId} data-task={taskId || ''} data-readonly={String(Boolean(readOnly))} />
  ),
}));

vi.mock('../../src/app/services/subtaskService', () => ({
  getCachedSubtasks: () => [],
  subscribeToSubtasks: () => () => {},
  createSubtask: vi.fn(),
  updateSubtask: vi.fn(),
  deleteSubtask: vi.fn(),
  reorderSubtasks: vi.fn(),
}));

import { TaskSubtasksWidget } from '../../src/app/features/subtasks/components/TaskSubtasksWidget';
import { WorkStaffingDialog } from '../../src/app/features/nested-work/components/WorkStaffingDialog';
import { ProjectTaskCell } from '../../src/app/features/project-table/components/ProjectTaskCells';
import { rememberWorkCapabilityContext } from '../../src/app/features/nested-work/selectors/capabilities';

const allow = { allowed: true, reason_code: null } as const;
const deny = { allowed: false, reason_code: 'branch_denied' } as const;

function snapshot(): WorkTreeSnapshot {
  const data: WorkTreeSnapshot = {
    root: {
      id: 'root',
      project: 'project',
      office: 'office',
      project_lead_id: 'project-lead',
      kind: 'office',
      open: true,
      lead: 'task-lead',
      due: '2026-12-31',
      people: ['task-lead', 'worker'],
      capabilities: { manage_contributors: allow, appoint_lead: allow, create_child: allow, order_children: allow },
    },
    revision: 5,
    can_manage: true,
    can_transfer: true,
    leaf_total: 1,
    leaf_completed: 0,
    people: [
      { id: 'project-lead', name: 'Patricia ProjectLead', eligible: true },
      { id: 'task-lead', name: 'Tomas TaskLead', eligible: true },
      { id: 'worker', name: 'Wendy Worker', eligible: true },
    ],
    nodes: [
      {
        id: 'sub-1',
        task_id: 'root',
        parent_subtask_id: null,
        lead_id: 'task-lead',
        assigned_to_ids: ['task-lead', 'worker'],
        title: 'Collect field forms',
        depth: 1,
        sibling_order: 0,
        due_date: '2026-12-10',
        is_standalone: true,
        status: 'in_progress',
        percent_complete: 0,
        can_manage: true,
        can_appoint: true,
        can_order: true,
        can_work: true,
        can_review: false,
        capabilities: {
          manage_contributors: allow,
          appoint_lead: allow,
          create_child: deny,
          order_children: deny,
          edit_details: allow,
          delete: allow,
          execute: allow,
          submit: allow,
        },
      },
    ],
  };
  rememberWorkCapabilityContext(data, api.actor);
  return data;
}

const task: Task = {
  id: 'root',
  title: 'Parent deliverable',
  orgId: 'office',
  linkedProjectId: 'project',
  assigneeId: 'task-lead',
  status: 'in_progress',
  createdAt: 1,
  updatedAt: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  api.actor = 'task-lead';
  api.role = 'member';
  api.tree.mockImplementation(async () => snapshot());
  api.save.mockImplementation(async () => snapshot());
  api.record.mockResolvedValue({
    subtask: {
      id: 'sub-1',
      taskId: 'root',
      title: 'Collect field forms',
      status: 'in_progress',
      isCompleted: false,
      percentComplete: 0,
      assignedToIds: ['task-lead', 'worker'],
      position: 0,
      isStandalone: true,
      createdAt: 1,
      updatedAt: 1,
    },
    submissions: [
      {
        id: 'subm-1',
        subtaskId: 'sub-1',
        taskId: 'root',
        version: 1,
        status: 'approved',
        submitterId: 'worker',
        submitterName: 'Wendy Worker',
        note: 'Form batch #1 uploaded',
        attachments: [{ id: 'att-1', fileName: 'batch-1.pdf', filePath: 'subtasks/sub-1/batch-1.pdf' }],
        submittedAt: Date.parse('2026-12-01T10:00:00Z'),
      },
    ],
    progressUpdates: [
      {
        id: 'upd-1',
        subtaskId: 'sub-1',
        taskId: 'root',
        authorId: 'worker',
        authorName: 'Wendy Worker',
        percentComplete: 50,
        blockerCategory: 'None',
        note: 'Halfway collected',
        createdAt: Date.parse('2026-12-02T10:00:00Z'),
      },
    ],
  });
  api.proposals.mockResolvedValue({
    canProposeProgress: false,
    canProposeCompletion: false,
    items: [
      {
        id: 'prop-1',
        kind: 'progress',
        state: 'pending',
        author_id: 'worker',
        reviewer_id: 'task-lead',
        canDecide: true,
        terms: {
          note: 'Proposed field verification update',
          attachments: [
            {
              filePath: 'worker/root/sub-1/prop-1/0.pdf',
              fileName: 'verification.pdf',
              fileSize: 1200,
              mimeType: 'application/pdf',
            },
          ],
        },
      },
    ],
  });
  api.inspectorFiles.mockResolvedValue([
    {
      id: 'sub-att-1',
      name: 'batch-1.pdf',
      path: 'subtasks/sub-1/batch-1.pdf',
      bucket: 'task-attachments',
      source: 'Collect field forms · Submission 1 (approved)',
      uploader: 'Wendy Worker',
      at: '2026-12-01T10:00:00Z',
      restriction: 'Formal evidence · Existing review and immutability rules apply',
      subtaskId: 'sub-1',
    },
    {
      id: 'task-att-1',
      name: 'parent-charter.pdf',
      path: 'tasks/root/charter.pdf',
      bucket: 'task-attachments',
      source: 'Task · Submission 1 (approved)',
      uploader: 'Tomas TaskLead',
      at: '2026-12-01T08:00:00Z',
      restriction: 'Formal evidence · Existing review and immutability rules apply',
    },
  ]);
  api.expenses.mockResolvedValue({
    tasks: new Map([['root', { settled: 50000, pending: 25000, pendingCount: 1, complete: true }]]),
    subtasks: new Map([['sub-1', { settled: 15000, pending: 7500, pendingCount: 1, complete: true }]]),
  });
  api.openInspectorFile.mockResolvedValue('https://signed.example/workflow.pdf');
  api.openProposalEvidence.mockResolvedValue('https://signed.example/proposal.pdf');
});

afterEach(() => cleanup());

describe('Subtask action menu Mobile parity and Task Lead exclusion', () => {
  it('opens Evidence, Funding, and Files directly from subtask actions with Mobile-equivalent data', async () => {
    const data = snapshot();
    const controller = {
      rootId: 'root',
      actorId: 'task-lead',
      data,
      loading: false,
      error: '',
      unavailable: false,
      authorityFresh: true,
      refreshPending: false,
      pending: false,
      reload: vi.fn().mockResolvedValue(undefined),
      save: api.save,
    };

    render(<TaskSubtasksWidget taskId="root" parentTask={task} controller={controller} presentation="project-table" canManage />);

    const openSubtaskMenu = async () => {
      fireEvent.keyDown(screen.getByRole('button', { name: 'Actions for Collect field forms' }), { key: 'Enter' });
      return screen.findByRole('menu');
    };

    const menu = await openSubtaskMenu();
    expect(within(menu).queryByRole('menuitem', { name: 'Open work / evidence' })).toBeNull();
    expect(within(menu).queryByRole('menuitem', { name: 'Choose people' })).toBeNull();
    expect(within(menu).getByRole('menuitem', { name: 'Evidence' })).toBeTruthy();
    expect(within(menu).getByRole('menuitem', { name: 'Funding' })).toBeTruthy();
    expect(within(menu).getByRole('menuitem', { name: 'Files' })).toBeTruthy();

    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Evidence' }));
    const evidenceDialog = await screen.findByRole('dialog');
    expect(evidenceDialog.textContent).toContain('Evidence · Collect field forms');
    expect(within(evidenceDialog).queryByRole('tab')).toBeNull();
    expect(await within(evidenceDialog).findByText('Proposed field verification update')).toBeTruthy();
    expect(within(evidenceDialog).getByText('Form batch #1 uploaded')).toBeTruthy();
    expect(within(evidenceDialog).getByText('Halfway collected')).toBeTruthy();
    fireEvent.click(within(evidenceDialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    const fundingMenu = await openSubtaskMenu();
    fireEvent.click(within(fundingMenu).getByRole('menuitem', { name: 'Funding' }));
    const fundingDialog = await screen.findByRole('dialog');
    expect(fundingDialog.textContent).toContain('Funding · Collect field forms');
    expect(within(fundingDialog).queryByRole('tab')).toBeNull();
    await waitFor(() => expect(within(fundingDialog).getByText('₱150.00')).toBeTruthy());
    expect(within(fundingDialog).getByText('₱75.00')).toBeTruthy();
    expect(within(fundingDialog).getByTestId('work-budget-card').getAttribute('data-subtask')).toBe('sub-1');
    expect(within(fundingDialog).queryByText('Form batch #1 uploaded')).toBeNull();
    fireEvent.click(within(fundingDialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    const filesMenu = await openSubtaskMenu();
    fireEvent.click(within(filesMenu).getByRole('menuitem', { name: 'Files' }));
    const filesDialog = await screen.findByRole('dialog');
    expect(filesDialog.textContent).toContain('Files · Collect field forms');
    expect(within(filesDialog).queryByRole('tab')).toBeNull();
    await waitFor(() => expect(within(filesDialog).getByRole('button', { name: 'verification.pdf' })).toBeTruthy());
    expect(within(filesDialog).getByRole('button', { name: 'batch-1.pdf' })).toBeTruthy();
    expect(within(filesDialog).getByTestId('project-file-library').getAttribute('data-project')).toBe('project');
    expect(within(filesDialog).getByText(/Parent task workflow files/)).toBeTruthy();
    expect(within(filesDialog).queryByTestId('work-budget-card')).toBeNull();
  }, 15_000);

  it('excludes the Project Lead from all Task Lead dropdowns while keeping them eligible for subtasks', () => {
    const data = snapshot();
    const ctrl = { rootId: 'root', actorId: 'task-lead', data, loading: false, save: api.save };
    const rootView = render(
      <WorkStaffingDialog controller={ctrl} nodeId={null} projectLeadId="project-lead" onClose={vi.fn()} onChanged={vi.fn()} />,
    );
    const rootLeadSelect = screen.getByRole('combobox', { name: 'Appointed Lead' });
    expect(within(rootLeadSelect).queryByRole('option', { name: /Patricia ProjectLead/ })).toBeNull();
    expect(within(rootLeadSelect).getByRole('option', { name: 'Tomas TaskLead' })).toBeTruthy();
    expect(within(rootLeadSelect).getByRole('option', { name: 'Wendy Worker' })).toBeTruthy();
    rootView.unmount();

    const subtaskView = render(
      <WorkStaffingDialog controller={ctrl} nodeId="sub-1" projectLeadId="project-lead" onClose={vi.fn()} onChanged={vi.fn()} />,
    );
    const subtaskLeadSelect = screen.getByRole('combobox', { name: 'Appointed Lead' });
    expect(within(subtaskLeadSelect).getByRole('option', { name: 'Patricia ProjectLead' })).toBeTruthy();
    subtaskView.unmount();

    const people: UserProfile[] = [
      { id: 'project-lead', full_name: 'Patricia ProjectLead' } as UserProfile,
      { id: 'task-lead', full_name: 'Tomas TaskLead' } as UserProfile,
    ];
    render(
      <ProjectTaskCell
        column="owner"
        task={{ ...task, linkedProjectId: undefined }}
        tasks={[task]}
        profiles={people}
        people={people}
        orgs={[]}
        projectLeadId="project-lead"
        editable
        busy={false}
        hasStaffedSubitems={false}
        save={vi.fn()}
        write={vi.fn()}
      />,
    );
    const legacyOwner = screen.getByRole('combobox', { name: 'Owner for Parent deliverable' });
    expect(within(legacyOwner).queryByRole('option', { name: 'Patricia ProjectLead' })).toBeNull();
    expect(within(legacyOwner).getByRole('option', { name: 'Tomas TaskLead' })).toBeTruthy();
  });
});
