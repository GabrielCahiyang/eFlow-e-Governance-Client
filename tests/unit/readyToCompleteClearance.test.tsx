// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  actorId: 'lead-1',
  role: 'member',
  rpc: vi.fn(),
  tasks: [] as any[],
  projects: [] as any[],
  profiles: [] as any[],
  toast: vi.fn(),
  notifyTasks: vi.fn(),
  session: vi.fn(),
}));

vi.mock('../../src/lib/supabase', () => {
  const query = {
    select: () => query,
    eq: () => query,
    in: () => query,
    is: () => query,
    order: () => Promise.resolve({ data: [], error: null }),
    limit: () => Promise.resolve({ data: [], error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve),
  };
  return {
    supabase: {
      rpc: mocks.rpc,
      from: () => query,
      auth: { getSession: mocks.session },
      channel: () => {
        const ch = { on: () => ch, subscribe: () => ch };
        return ch;
      },
      removeChannel: vi.fn(),
    },
  };
});

vi.mock('../../src/app/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: mocks.actorId },
    userProfile: { id: mocks.actorId, role: mocks.role, full_name: mocks.actorId === 'lead-1' ? 'Gabriel Cahiyang' : 'Cheryl Gallo', org_id: 'org-1', departmentId: 'org-1' },
    can: () => true,
  }),
}));

vi.mock('../../src/app/components/ui/Toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock('../../src/app/shared/workChanges', () => ({
  subscribeWorkChanges: () => () => {},
}));

vi.mock('../../src/app/features/budget/services/cashRequestUpdates', () => ({
  subscribeCashRequestChanges: () => () => {},
}));

vi.mock('../../src/app/hooks/useFirebaseData', () => ({
  useTasks: () => ({ tasks: mocks.tasks, loading: false }),
}));

vi.mock('../../src/app/hooks/useSupabaseData', () => ({
  useProjectsData: () => ({ projects: mocks.projects, loading: false }),
  useProfiles: () => ({ profiles: mocks.profiles, loading: false }),
  useOrgs: () => ({ orgs: [{ id: 'org-1', name: 'LEDIPO', head_user_id: 'head-1', is_active: true }] }),
  useScopedOrgIds: () => ({ includeAllAccessibleWork: false }),
}));

vi.mock('../../src/app/services/taskDiscussionService', () => ({
  fetchProgressUpdates: vi.fn().mockResolvedValue([]),
  subscribeToProgressUpdates: () => () => {},
}));

vi.mock('../../src/app/features/reviews/services/reviewService', () => ({
  fetchDecidedSubmissionIds: vi.fn().mockResolvedValue(new Set<string>()),
  fetchSubmissionAttachments: vi.fn().mockResolvedValue([]),
  fetchTaskSubmissions: vi.fn().mockResolvedValue([{ id: 'sub-1', taskId: 'task-1', version: 1, submitterId: 'lead-1', submitterName: 'Gabriel Cahiyang', note: 'done', status: 'approved', submittedAt: 1 }]),
}));

vi.mock('../../src/app/features/tasks', async () => {
  const actual = await vi.importActual<typeof import('../../src/app/features/tasks')>('../../src/app/features/tasks');
  return {
    ...actual,
    notifyTaskListeners: mocks.notifyTasks,
  };
});

vi.mock('../../src/app/features/budget/components/WorkBudgetCard', () => ({
  WorkBudgetCard: () => null,
}));

vi.mock('../../src/app/features/subtasks', () => ({
  useTaskSubtasks: () => ({ subtasks: [], loading: false }),
  SubitemInspector: () => null,
  SubtaskWorkList: () => null,
  SubitemLeadReview: () => null,
}));

vi.mock('../../src/app/features/project-offices', () => ({
  ProjectOfficeContext: { Provider: ({ children }: any) => children },
  useProjectOffices: () => ({ offices: [], members: [], loading: false, error: '' }),
  useProjectOfficeContext: () => ({ offices: [], members: [], loading: false, error: '' }),
}));

vi.mock('../../src/app/features/nested-work', async () => {
  const actual = await vi.importActual<typeof import('../../src/app/features/nested-work')>('../../src/app/features/nested-work');
  return {
    ...actual,
    supportsNestedWork: () => false,
    useWorkTree: () => undefined,
    WorkActivity: () => null,
    WorkRootOwner: () => null,
    isTaskSubtaskPlanningBlocked: () => false,
  };
});

import { TaskInspector } from '../../src/app/features/task-inspector/components/TaskInspector';
import { ForReviewInbox } from '../../src/app/features/reviews/components/ForReviewInbox';
import { ProjectReviewsTab } from '../../src/app/features/projects/components/project-command/ProjectReviewsTab';

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mocks.actorId = 'lead-1';
  mocks.role = 'member';
  mocks.session.mockResolvedValue({ data: { session: { user: { id: 'lead-1' } } }, error: null });
  mocks.projects = [{ id: 'proj-1', title: 'Community Esports', status: 'active', orgId: 'org-1', projectLeadId: 'head-1' }];
  mocks.profiles = [
    { id: 'lead-1', full_name: 'Gabriel Cahiyang', role: 'member', org_id: 'org-1', is_active: true },
    { id: 'head-1', full_name: 'Cheryl Gallo', role: 'head', org_id: 'org-1', is_active: true },
  ];
  mocks.tasks = [
    {
      id: 'task-1',
      title: 'TASK WITH BUDGET NO SUBTASK',
      description: '',
      status: 'for_review',
      priority: 'medium',
      orgId: 'org-1',
      linkedProjectId: 'proj-1',
      projectTitle: 'Community Esports',
      assigneeId: 'lead-1',
      assigneeName: 'Gabriel Cahiyang',
      reviewerId: 'head-1',
      teamMemberIds: ['lead-1'],
      latestSubmission: { id: 'sub-1', version: 1, submitterId: 'lead-1', submitterName: 'Gabriel Cahiyang', note: 'done', submittedAt: 1, attachments: [] },
      createdAt: 1,
      updatedAt: 2,
    },
  ];
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});

describe('Financial clearance Overview visibility, Lead Mark as complete, and Ready to Complete tab', () => {
  it('shows Financial clearance and Mark as complete right on the Overview tab even when opened readOnly from My Work -> Work I lead', async () => {
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === 'work_financial_clearance') {
        return {
          data: { version: 1, rootId: 'task-1', nodeId: null, workAccepted: true, cashOutstanding: false, completed: false, canFinalize: true },
          error: null,
        };
      }
      if (name === 'finalize_cleared_work') {
        return {
          data: { version: 1, rootId: 'task-1', nodeId: null, workAccepted: true, cashOutstanding: false, completed: true, canFinalize: false },
          error: null,
        };
      }
      return { data: null, error: null };
    });

    const onChanged = vi.fn();
    render(
      <TaskInspector
        presentation="dialog"
        task={mocks.tasks[0]}
        taskId="task-1"
        readOnly={true}
        origin={{ view: 'My Work' }}
        onClose={vi.fn()}
        onChanged={onChanged}
      />,
    );

    expect(await screen.findByText(/Click Mark as complete to finalize this work/i)).toBeVisible();
    expect(screen.queryByText('Read-only oversight')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Mark as complete' }));
    const confirmDialog = await screen.findByRole('alertdialog', { name: 'Mark this work complete?' });
    fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Mark as complete' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(mocks.notifyTasks).toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith('finalize_cleared_work', { p_root: 'task-1', p_node: null });
  });

  it('tells an oversight/head viewer which lead can mark the work complete when canFinalize is false', async () => {
    mocks.actorId = 'head-1';
    mocks.role = 'head';
    mocks.session.mockResolvedValue({ data: { session: { user: { id: 'head-1' } } }, error: null });
    mocks.rpc.mockResolvedValue({
      data: { version: 1, rootId: 'task-1', nodeId: null, workAccepted: true, cashOutstanding: false, completed: false, canFinalize: false },
      error: null,
    });

    render(
      <TaskInspector
        presentation="dialog"
        task={mocks.tasks[0]}
        taskId="task-1"
        readOnly={false}
        onClose={vi.fn()}
      />,
    );

    expect(
      await screen.findByText(/Waiting for Gabriel Cahiyang \(the authorized lead\) to mark this work complete/i),
    ).toBeVisible();
  });

  it('removes Completion checks from For Review and exposes accepted tasks inside Ready to Complete', async () => {
    mocks.actorId = 'head-1';
    mocks.role = 'head';
    mocks.session.mockResolvedValue({ data: { session: { user: { id: 'head-1' } } }, error: null });
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === 'work_financial_clearance') {
        return {
          data: { version: 1, rootId: 'task-1', nodeId: null, workAccepted: true, cashOutstanding: false, completed: false, canFinalize: true },
          error: null,
        };
      }
      return { data: null, error: null };
    });

    window.history.replaceState({}, '', '/reviews?page=For+Review&view=tasks');
    render(<ForReviewInbox scope="department" />);

    expect(screen.queryByText('Completion checks')).toBeNull();
    expect(screen.queryByText('Completion standards')).toBeNull();

    const readyTab = screen.getByRole('tab', { name: /Ready to Complete/ });
    fireEvent.click(readyTab);

    expect(await screen.findByRole('heading', { name: 'TASK WITH BUDGET NO SUBTASK' })).toBeVisible();
    expect(await screen.findByRole('button', { name: 'Mark as complete' })).toBeVisible();
    expect(screen.queryByText('Completion standards')).toBeNull();
  });

  it('lists approved for_review tasks inside Project Reviews Tab awaiting final completion', () => {
    const onOpenTask = vi.fn();
    render(
      <ProjectReviewsTab
        data={{
          project: mocks.projects[0],
          tasks: mocks.tasks,
          members: [],
          metrics: { totalTasks: 1, completedTasks: 0, inProgressTasks: 0, overdueTasks: 0, blockedTasks: 0, completionRate: 0 },
          loading: false,
          hasLoadedFacts: true,
          error: '',
          retryWorkflowFacts: vi.fn(),
          facts: {
            subtasks: [],
            progress: [],
            submissions: [{ id: 'sub-1', kind: 'task', taskId: 'task-1', version: 1, status: 'approved', submitterId: 'lead-1', submitterName: 'Gabriel Cahiyang', submittedAt: Date.now() }],
            statusHistory: [],
            evidence: [],
          },
        } as any}
        onOpenTask={onOpenTask}
      />,
    );

    expect(screen.getByText('Approved · awaiting completion')).toBeVisible();
    expect(screen.getByText('TASK WITH BUDGET NO SUBTASK')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Open task' }));
    expect(onOpenTask).toHaveBeenCalledWith('task-1');
  });
});
