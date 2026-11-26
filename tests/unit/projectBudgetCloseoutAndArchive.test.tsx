// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '../../src/app/features/projects/services/types';
import type { ProjectFinancialCloseoutSummary, ProjectFlow } from '../../src/app/features/project-setup/types';

const authState = vi.hoisted(() => ({
  userProfile: {
    id: 'head-1',
    full_name: 'James Adrian Denoy',
    email: 'head@ledipo.gov.ph',
    role: 'head',
    org_id: 'org-ledipo',
    is_active: true,
  } as any,
}));

const lifecycleApi = vi.hoisted(() => ({
  fetchProjectCompletionReadiness: vi.fn(),
  fetchProjectFinancialCloseoutSummary: vi.fn(),
  completeProject: vi.fn(),
  requestProjectCompletionReview: vi.fn(),
  returnProjectCompletionReview: vi.fn(),
  archiveProject: vi.fn(),
  restoreProject: vi.fn(),
}));

vi.mock('../../src/app/contexts/AuthContext', () => ({
  useAuth: () => ({ userProfile: authState.userProfile }),
}));
vi.mock('../../src/app/shared/actionActor', () => ({
  assertActionActor: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/app/features/projects/services/projectLifecycleService', () => ({
  fetchProjectCompletionReadiness: lifecycleApi.fetchProjectCompletionReadiness,
  fetchProjectFinancialCloseoutSummary: lifecycleApi.fetchProjectFinancialCloseoutSummary,
  completeProject: lifecycleApi.completeProject,
  requestProjectCompletionReview: lifecycleApi.requestProjectCompletionReview,
  returnProjectCompletionReview: lifecycleApi.returnProjectCompletionReview,
}));
vi.mock('../../src/app/features/projects/services/projectService', () => ({
  archiveProject: lifecycleApi.archiveProject,
  restoreProject: lifecycleApi.restoreProject,
  fetchProjectFinancialCloseoutSummary: lifecycleApi.fetchProjectFinancialCloseoutSummary,
}));
vi.mock('../../src/app/features/project-readiness', () => ({
  subscribeProjectChecks: () => () => {},
  ProjectReadinessPanel: () => null,
}));
vi.mock('../../src/app/shared/navigationGuard', () => ({
  useNavigationBlocker: vi.fn(),
  requestNavigation: (fn: () => void) => fn(),
}));

import { ProjectCompleteDialog } from '../../src/app/features/projects/components/ProjectCompleteDialog';
import { ProjectArchiveDialog } from '../../src/app/features/projects/components/ProjectArchiveDialog';
import { ProjectFundingPanel } from '../../src/app/features/project-setup/components/ProjectFundingPanel';

const mooeszProject: Project = {
  id: 'proj-mooesz',
  orgId: 'org-ledipo',
  title: 'MOOESZ',
  description: 'LEDIPO project',
  status: 'active',
  priority: 'medium',
  projectLeadId: 'head-1',
  createdAt: 1,
  updatedAt: 1,
};

const reconciledSummary: ProjectFinancialCloseoutSummary = {
  projectId: 'proj-mooesz',
  projectTitle: 'MOOESZ',
  status: 'completed',
  fundingNotRequired: false,
  activatedAt: '2026-11-22T23:18:38.946525+00:00',
  completedAt: '2026-11-25T05:15:00+00:00',
  archivedAt: null,
  budgetBeforeActivation: 11000,
  supplementalBudgetAdded: 0,
  totalCertifiedBudget: 11000,
  actualSpent: 500,
  returnedToOfficeBudget: 10500,
  allocatedToTasks: 500,
  unreturnedBalance: 0,
  unusedTaskAllocations: 0,
  taskCashReleased: 800,
  taskCashReturned: 300,
  outstandingAdvances: 0,
  isFullyReconciled: true,
  sources: [
    {
      sourceId: 'src-maint',
      partitionId: 'part-maint',
      name: 'Maintainance',
      fiscalYear: 2026,
      budgetBeforeActivation: 5000,
      supplementalAdded: 0,
      totalCertified: 5000,
      currentCertified: 500,
      allocatedToTasks: 500,
      actualSpent: 500,
      returnedToOfficeBudget: 4500,
      unreturnedBalance: 0,
      unusedTaskAllocations: 0,
      lastReturnedAt: '2026-11-25T05:10:00+00:00',
      lastReturnedByName: 'James Adrian Denoy',
    },
    {
      sourceId: 'src-moae',
      partitionId: 'part-moae',
      name: 'MOAE',
      fiscalYear: 2026,
      budgetBeforeActivation: 6000,
      supplementalAdded: 0,
      totalCertified: 6000,
      currentCertified: 0,
      allocatedToTasks: 0,
      actualSpent: 0,
      returnedToOfficeBudget: 6000,
      unreturnedBalance: 0,
      unusedTaskAllocations: 0,
      lastReturnedAt: '2026-11-25T05:11:00+00:00',
      lastReturnedByName: 'James Adrian Denoy',
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  authState.userProfile = {
    id: 'head-1',
    full_name: 'James Adrian Denoy',
    email: 'head@ledipo.gov.ph',
    role: 'head',
    org_id: 'org-ledipo',
    is_active: true,
  };
});

afterEach(() => {
  cleanup();
});

describe('Project budget closeout validation gate & archive financial summary', () => {
  it('hard-blocks Mark project complete when unallocated project budget has not been returned to Office Budget', async () => {
    const onResolve = vi.fn();
    lifecycleApi.fetchProjectCompletionReadiness.mockResolvedValue({
      projectId: 'proj-mooesz',
      title: 'MOOESZ',
      status: 'active',
      canComplete: false,
      canApproveCompletion: false,
      workBlockersCount: 0,
      unreturnedProjectFunding: 10500,
      blockers: [
        {
          kind: 'funding',
          id: 'proj-mooesz',
          title: 'Unused project budget must be returned to Office Budget',
          status: 'unreturned_project_funding',
          amount: 10500,
          detail: 'The Office Head must manually return all remaining unallocated project funds (₱10,500.00) to the Office Budget via the Budget tab before marking this project complete.',
          unusedFunding: {
            unallocated: 10500,
            taskAllocations: [],
            unallocatedSources: [
              { id: 'src-maint', source: 'Maintainance', fiscalYear: 2026, available: 4500 },
              { id: 'src-moae', source: 'MOAE', fiscalYear: 2026, available: 6000 },
            ],
          },
        },
      ],
    });

    render(
      <ProjectCompleteDialog
        projectId="proj-mooesz"
        projectTitle="MOOESZ"
        project={mooeszProject}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        onOpenTask={vi.fn()}
        onOpenGovernance={vi.fn()}
        onResolve={onResolve}
      />,
    );

    expect(await screen.findByText('Unused project budget must be returned to Office Budget')).toBeVisible();
    expect(screen.getByText('Maintainance')).toBeVisible();
    expect(screen.getByText('₱4,500.00 unreturned')).toBeVisible();
    expect(screen.getByText('MOAE')).toBeVisible();
    expect(screen.getByText('₱6,000.00 unreturned')).toBeVisible();
    expect(screen.queryByText(/All completion checks passed/)).toBeNull();
    expect(screen.queryByText(/retained with this project/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Confirm completion' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Open Budget tab to return funds' }));
    expect(onResolve).toHaveBeenCalledWith('budget');
  });

  it('displays the full reconciled closeout summary inside Mark project complete once all unused funds are returned', async () => {
    lifecycleApi.fetchProjectCompletionReadiness.mockResolvedValue({
      projectId: 'proj-mooesz',
      title: 'MOOESZ',
      status: 'active',
      canComplete: true,
      canApproveCompletion: true,
      workBlockersCount: 0,
      unreturnedProjectFunding: 0,
      financialCloseoutSummary: reconciledSummary,
      blockers: [],
    });

    render(
      <ProjectCompleteDialog
        projectId="proj-mooesz"
        projectTitle="MOOESZ"
        project={mooeszProject}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        onOpenTask={vi.fn()}
        onOpenGovernance={vi.fn()}
      />,
    );

    expect(await screen.findByText(/All completion checks passed/)).toBeVisible();
    expect(screen.getByText('Budget before activation')).toBeVisible();
    expect(screen.getByText('₱11,000.00')).toBeVisible();
    expect(screen.getByText('Actual money spent')).toBeVisible();
    expect(screen.getByText('Returned before completion')).toBeVisible();
    expect(screen.getByText('₱10,500.00')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Confirm completion' })).not.toBeDisabled();
  });

  it('allows a non-Head Project Lead to submit delivery handover while flagging remaining funds for Office Head closeout', async () => {
    authState.userProfile = {
      id: 'lead-2',
      full_name: 'Maria Lead',
      email: 'lead@ledipo.gov.ph',
      role: 'member',
      org_id: 'org-ledipo',
      is_active: true,
    };
    lifecycleApi.fetchProjectCompletionReadiness.mockResolvedValue({
      projectId: 'proj-mooesz',
      title: 'MOOESZ',
      status: 'active',
      canComplete: false,
      canRequestCompletionReview: true,
      requiresHeadCompletionReview: true,
      completionReviewStatus: 'none',
      workBlockersCount: 0,
      unreturnedProjectFunding: 10500,
      blockers: [
        {
          kind: 'funding',
          id: 'proj-mooesz',
          title: 'Unused project budget must be returned to Office Budget',
          status: 'unreturned_project_funding',
          amount: 10500,
          detail: 'Return remaining funds.',
        },
        {
          kind: 'lead_review',
          id: 'proj-mooesz',
          title: 'Project Lead completion review required',
          status: 'none',
          detail: 'Submit for review.',
        },
      ],
    });

    render(
      <ProjectCompleteDialog
        projectId="proj-mooesz"
        projectTitle="MOOESZ"
        project={{ ...mooeszProject, projectLeadId: 'lead-2' }}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        onOpenTask={vi.fn()}
        onOpenGovernance={vi.fn()}
      />,
    );

    const submitBtn = await screen.findByRole('button', { name: 'Submit for Head completion review' });
    await waitFor(() => expect(submitBtn).not.toBeDisabled());
    expect(screen.getByText(/Office Budget return pending Office Head closeout/i)).toBeVisible();
  });

  it('displays Budget before activation, supplemental, actual spent, and returned funds inside Archive project dialog', async () => {
    lifecycleApi.fetchProjectFinancialCloseoutSummary.mockResolvedValue({
      ...reconciledSummary,
      supplementalBudgetAdded: 2000,
      totalCertifiedBudget: 13000,
      returnedToOfficeBudget: 12500,
    });
    lifecycleApi.archiveProject.mockResolvedValue(undefined);
    const onSuccess = vi.fn();

    render(
      <ProjectArchiveDialog
        projectId="proj-mooesz"
        projectTitle="MOOESZ"
        isArchived={false}
        open
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />,
    );

    expect(await screen.findByText('Financial closeout record (preserved in archive)')).toBeVisible();
    expect(screen.getByText('Budget before activation')).toBeVisible();
    expect(screen.getByText('₱11,000.00')).toBeVisible();
    expect(screen.getByText('Supplemental added')).toBeVisible();
    expect(screen.getByText('+₱2,000.00')).toBeVisible();
    expect(screen.getByText('Actual money spent')).toBeVisible();
    expect(screen.getByText('Returned before completion')).toBeVisible();
    expect(screen.getByText('₱12,500.00')).toBeVisible();
    expect(screen.getByText('Maintainance')).toBeVisible();
    expect(screen.getByText('MOAE')).toBeVisible();

    const archiveBtn = screen.getByRole('button', { name: 'Archive project' });
    expect(archiveBtn).not.toBeDisabled();
    fireEvent.click(archiveBtn);
    await waitFor(() => expect(lifecycleApi.archiveProject).toHaveBeenCalledWith('proj-mooesz', undefined));
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('disables Archive project dialog submission if unreturned balance is still greater than zero', async () => {
    lifecycleApi.fetchProjectFinancialCloseoutSummary.mockResolvedValue({
      ...reconciledSummary,
      returnedToOfficeBudget: 0,
      unreturnedBalance: 10500,
      isFullyReconciled: false,
    });

    render(
      <ProjectArchiveDialog
        projectId="proj-mooesz"
        projectTitle="MOOESZ"
        isArchived={false}
        open
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(await screen.findByText(/₱10,500.00 in unused project funding has not been returned/i)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Archive project' })).toBeDisabled();
  });

  it('preserves pre-activation budget, actual spent, returned funds, and fully returned sources on archived ProjectFundingPanel', () => {
    const archivedFlow: ProjectFlow = {
      project: {
        id: 'proj-mooesz',
        org_id: 'org-ledipo',
        status: 'archived',
        title: 'MOOESZ',
        description: 'LEDIPO project',
        scope: 'HOLLLMMM',
        project_lead_id: 'head-1',
        start_date: '2026-11-23',
        target_date: '2026-11-26',
        funding_not_required: false,
        updated_at: '2026-11-25T05:15:00+00:00',
      },
      ready: true,
      canAuthorize: true,
      canAllocate: true,
      funds: [
        {
          id: 'src-maint',
          name: 'Maintainance',
          fiscal_year: 2026,
          amount: 500,
          available: 0,
          budget_before_activation: 5000,
          supplemental_added: 0,
          total_certified: 5000,
          actual_spent: 500,
          returned_to_office: 4500,
          last_returned_at: '2026-11-25T05:10:00+00:00',
          last_returned_by_name: 'James Adrian Denoy',
        },
        {
          id: 'src-moae',
          name: 'MOAE',
          fiscal_year: 2026,
          amount: 0,
          available: 0,
          budget_before_activation: 6000,
          supplemental_added: 0,
          total_certified: 6000,
          actual_spent: 0,
          returned_to_office: 6000,
          last_returned_at: '2026-11-25T05:11:00+00:00',
          last_returned_by_name: 'James Adrian Denoy',
        },
      ],
      sources: [],
      total: 500,
      allocated: 500,
      unallocated: 0,
      released: 800,
      spent: 500,
      returned: 300,
      outstanding: 0,
      closeoutSummary: { ...reconciledSummary, status: 'archived', archivedAt: '2026-11-25T05:20:00+00:00' },
      requests: [],
      taskFunding: [],
      liquidations: [],
      fundingRequests: [],
    };

    render(<ProjectFundingPanel data={archivedFlow} reload={vi.fn().mockResolvedValue(undefined)} />);

    expect(screen.getByText('Project financial closeout')).toBeVisible();
    expect(screen.getByText('Closed · Reconciled')).toBeVisible();
    expect(screen.getAllByText('Budget before activation').length).toBeGreaterThan(0);
    expect(screen.getByText('₱11,000.00')).toBeVisible();
    expect(screen.getByText('₱10,500.00')).toBeVisible();
    expect(screen.getByText('Maintainance')).toBeVisible();
    expect(screen.getByText('MOAE')).toBeVisible();
    expect(screen.getAllByText('₱6,000.00').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole('button', { name: /Return to Office Budget/i })).toBeNull();
  });
});
