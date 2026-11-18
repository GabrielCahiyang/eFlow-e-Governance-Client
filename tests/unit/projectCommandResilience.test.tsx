// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { useEffect } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '../../src/app/features/projects/services/projectService';
import type { ProjectFlowState } from '../../src/app/features/project-setup/ProjectFlowContext';

const mocks = vi.hoisted(() => ({
  flow: {
    data: undefined,
    error: '',
    loading: false,
    denied: false,
    reload: vi.fn().mockResolvedValue(undefined),
  } as ProjectFlowState,
  tableMountCount: 0,
  tableUnmountCount: 0,
}));

vi.mock('../../src/app/features/project-setup', async () => {
  const { ProjectFlowProvider } = await import('../../src/app/features/project-setup/ProjectFlowContext');
  const { projectWorkAvailable } = await import('../../src/app/features/project-setup/projectWorkAvailable');
  return {
    ProjectDefinitionPanel: () => <div data-testid="definition-panel" />,
    ProjectFlowProvider,
    projectWorkAvailable,
    useProjectFlow: () => mocks.flow,
  };
});

vi.mock('../../src/app/features/project-table', () => ({
  ProjectTableWorkspace: () => {
    useEffect(() => {
      mocks.tableMountCount += 1;
      return () => {
        mocks.tableUnmountCount += 1;
      };
    }, []);
    return <div data-testid="project-table-workspace">Table content</div>;
  },
  ProjectTaskCreateAction: () => null,
}));

vi.mock('../../src/app/contexts/AuthContext', () => ({
  useAuth: () => ({
    userProfile: { id: 'member-1', org_id: 'org-1', role: 'member', is_active: true, full_name: 'Member' },
  }),
}));

vi.mock('../../src/app/hooks/useSupabaseData', () => ({
  useProfiles: () => ({ profiles: [], loading: false }),
}));

vi.mock('../../src/app/hooks/useFirebaseData', () => ({
  useTasks: () => ({ tasks: [], loading: false }),
}));

vi.mock('../../src/app/features/projects/hooks/useProjectCommandData', () => ({
  useProjectCommandData: (project: Project) => ({
    project,
    tasks: [],
    milestones: [],
    members: [],
    facts: { subtasks: [], progress: [], submissions: [], statusHistory: [], evidence: [] },
    attention: [],
    metrics: {
      totalTasks: 0,
      completedTasks: 0,
      overdueTasks: 0,
      completionRate: 0,
      dueSoonTasks: 0,
      inProgressTasks: 0,
      reviewTasks: 0,
    },
    activity: [],
    financial: {
      summary: null,
      commitments: [],
      allocations: [],
      allocationLines: [],
      requests: [],
      requestAttachments: [],
      releases: [],
      liquidations: [],
      ledger: [],
    },
    financialLoading: false,
    financialError: '',
    loading: false,
    error: '',
    hasLoadedFacts: true,
    activityError: '',
    refreshMembers: vi.fn(),
    retryWorkflowFacts: vi.fn(),
  }),
}));

vi.mock('../../src/app/features/project-offices', async () => {
  const { createContext } = await import('react');
  return {
    ProjectOfficeContext: createContext({ offices: [], members: [], loading: false, error: '' }),
    useProjectOffices: () => ({ offices: [], members: [], loading: false, error: '' }),
    canStaffProjectOffice: () => false,
  };
});

vi.mock('../../src/app/features/project-views', () => ({
  ProjectViewFilters: () => <div data-testid="view-filters" />,
  ProjectGanttView: () => null,
  useProjectViewPreferences: () => ({
    filters: { query: '', owner: '', status: '', office: '', dateFrom: '', dateTo: '' },
    setFilters: vi.fn(),
  }),
  filterProjectViewTasks: (tasks: unknown[]) => tasks,
}));

vi.mock('../../src/app/features/project-import', () => ({
  ProjectPdfImportPanel: () => null,
  hasPendingPdfImport: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../src/app/features/chat-calls', () => ({ ProjectChatLink: () => null }));
vi.mock('../../src/app/features/project-members', () => ({ ProjectMembers: () => null }));
vi.mock('../../src/app/features/analytics', () => ({ DeliveryAnalytics: () => null }));
vi.mock('../../src/app/features/task-inspector', () => ({
  TaskDetailDrawer: () => null,
  useTaskInspector: () => ({ taskId: null, origin: { view: 'tasks' }, openTask: vi.fn(), close: vi.fn() }),
}));
vi.mock('../../src/app/features/projects/services/projectMutationService', () => ({
  updateProject: vi.fn(),
  renameSelectedProject: vi.fn(),
}));
vi.mock('../../src/app/shared/navigationGuard', () => ({
  hasDirtyNavigation: () => false,
  requestNavigation: async (action: () => void) => {
    action();
    return true;
  },
}));
vi.mock('../../src/app/features/projects/components/project-command/ProjectHeader', () => ({
  ProjectHeader: ({ project }: { project: Project }) => <h1>{project.title}</h1>,
}));
vi.mock('../../src/app/features/projects/components/project-command/ProjectParticipants', () => ({
  ProjectParticipants: () => null,
}));
vi.mock('../../src/app/features/projects/components/project-command/ProjectUtilities', () => ({
  ProjectUtilities: () => null,
}));
vi.mock('../../src/app/features/projects/components/project-command/ProjectViewTabBar', () => ({
  ProjectViewTabBar: () => <div data-testid="tab-bar" />,
}));

import { ProjectCommandWorkspace } from '../../src/app/features/projects/components/project-command/ProjectCommandWorkspace';

function makeProject(status: Project['status'] = 'active'): Project {
  return {
    id: 'proj-1',
    title: 'OutReach',
    description: 'Community outreach',
    departmentId: 'org-1',
    orgId: 'org-1',
    status,
    progress: 0,
    startDate: '2026-11-18',
    endDate: '2027-02-18',
    createdAt: '2026-11-18T00:00:00Z',
    updatedAt: '2026-11-18T00:00:00Z',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tableMountCount = 0;
  mocks.tableUnmountCount = 0;
  mocks.flow = {
    data: undefined,
    error: '',
    loading: false,
    denied: false,
    reload: vi.fn().mockResolvedValue(undefined),
  };
  window.history.replaceState({}, '', '/projects?page=Projects&project=proj-1&view=tasks');
});

afterEach(() => {
  cleanup();
});

describe('ProjectCommandWorkspace transient error resilience', () => {
  it('keeps the active project table mounted instead of replacing it with Finish project setup first on transient flow errors', () => {
    const project = makeProject('active');
    const view = render(
      <ProjectCommandWorkspace
        project={project}
        orgs={[]}
        canArchive={false}
        canManage={false}
        canDelete={false}
        onDeleted={vi.fn()}
        canReviewTasks={false}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByTestId('project-table-workspace')).toBeInTheDocument();
    expect(mocks.tableMountCount).toBe(1);

    // Simulate a background refetch failing transiently while data is missing.
    mocks.flow = {
      ...mocks.flow,
      data: undefined,
      error: "Couldn't load project details. Please try again.",
      denied: false,
      loading: false,
    };
    view.rerender(
      <ProjectCommandWorkspace
        project={project}
        orgs={[]}
        canArchive={false}
        canManage={false}
        canDelete={false}
        onDeleted={vi.fn()}
        canReviewTasks={false}
        onBack={vi.fn()}
      />,
    );

    expect(screen.queryByRole('heading', { name: 'Finish project setup first' })).toBeNull();
    expect(screen.getByTestId('project-table-workspace')).toBeInTheDocument();
    expect(mocks.tableMountCount).toBe(1);
    expect(mocks.tableUnmountCount).toBe(0);
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load project details. Please try again.");

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mocks.flow.reload).toHaveBeenCalledTimes(1);

    // Recovering clears the alert cleanly without unmounting or remounting the table.
    mocks.flow = { ...mocks.flow, error: '', loading: false };
    view.rerender(
      <ProjectCommandWorkspace
        project={project}
        orgs={[]}
        canArchive={false}
        canManage={false}
        canDelete={false}
        onDeleted={vi.fn()}
        canReviewTasks={false}
        onBack={vi.fn()}
      />,
    );

    expect(screen.queryByRole('alert')).toBeNull();
    expect(mocks.tableMountCount).toBe(1);
    expect(mocks.tableUnmountCount).toBe(0);
  });

  it('distinguishes loading, load failures, access denials, and incomplete setup for planning and restricted views', () => {
    const planning = makeProject('planning');
    mocks.flow = { ...mocks.flow, data: undefined, error: '', loading: true, denied: false };

    const view = render(
      <ProjectCommandWorkspace
        project={planning}
        orgs={[]}
        canArchive={false}
        canManage={false}
        canDelete={false}
        onDeleted={vi.fn()}
        canReviewTasks={false}
        onBack={vi.fn()}
      />,
    );

    // Initial in-flight setup fetch renders skeleton instead of flashing Finish project setup first.
    expect(screen.queryByRole('heading', { name: 'Finish project setup first' })).toBeNull();
    expect(screen.getByRole('status')).toBeInTheDocument();

    // Initial setup load failure renders Retry rather than claiming setup is unfinished.
    mocks.flow = { ...mocks.flow, data: undefined, error: "Couldn't load project details. Please try again.", loading: false };
    view.rerender(
      <ProjectCommandWorkspace
        project={planning}
        orgs={[]}
        canArchive={false}
        canManage={false}
        canDelete={false}
        onDeleted={vi.fn()}
        canReviewTasks={false}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: "Couldn't load project setup" })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Finish project setup first' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mocks.flow.reload).toHaveBeenCalledTimes(1);

    // Genuine incomplete planning setup keeps Finish project setup first.
    mocks.flow = {
      ...mocks.flow,
      error: '',
      loading: false,
      data: {
        project: {
          id: 'proj-1',
          status: 'planning',
          title: 'OutReach',
          description: '',
          scope: '',
          project_lead_id: null,
          start_date: null,
          target_date: null,
          funding_not_required: false,
          updated_at: '2026-11-18T00:00:00Z',
        },
        ready: false,
        canAuthorize: false,
        canAllocate: false,
        funds: [],
        sources: [],
        total: 0,
        allocated: 0,
        unallocated: 0,
        released: 0,
        spent: 0,
        requests: [],
        taskFunding: [],
        liquidations: [],
        fundingRequests: [],
      },
    };
    view.rerender(
      <ProjectCommandWorkspace
        project={planning}
        orgs={[]}
        canArchive={false}
        canManage={false}
        canDelete={false}
        onDeleted={vi.fn()}
        canReviewTasks={false}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Finish project setup first' })).toBeInTheDocument();

    // Access denial fails closed even if project status is active.
    mocks.flow = {
      ...mocks.flow,
      data: undefined,
      error: "Couldn't verify access to this project.",
      denied: true,
      loading: false,
    };
    view.rerender(
      <ProjectCommandWorkspace
        project={makeProject('active')}
        orgs={[]}
        canArchive={false}
        canManage={false}
        canDelete={false}
        onDeleted={vi.fn()}
        canReviewTasks={false}
        onBack={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('project-table-workspace')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Project details unavailable' })).toBeInTheDocument();
  });
});
