// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatCashStatusLabel,
  formatLedgerEntryLabel,
  getCashWorkflowProgress,
} from '../../src/app/features/budget/selectors/cashWorkflowRules';
import { StatusPill } from '../../src/app/features/budget/components/budgetUi';
import { CashRequestTimeline } from '../../src/app/features/budget/components/CashRequestTimeline';
import { WorkBudgetCard } from '../../src/app/features/budget/components/WorkBudgetCard';
import type { DepartmentBudgetBundle, PettyCashRequest, TaskFundingContext } from '../../src/app/features/budget/types';
import type { Task } from '../../src/app/services/taskService';

const budgetMocks = vi.hoisted(() => ({
  fundingContext: vi.fn(),
  bundle: vi.fn(),
}));

vi.mock('../../src/app/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    userProfile: { id: 'user-1', role: 'member', org_id: 'org-1', departmentId: 'org-1', full_name: 'koko' },
    can: () => false,
  }),
}));

vi.mock('../../src/app/features/office-petty-cash', () => ({
  OfficePettyCashLauncher: () => <button type="button">Office petty cash · separate fund</button>,
}));

vi.mock('../../src/app/features/budget/services/budgetService', () => ({
  acknowledgeCashRelease: vi.fn(),
  allocateSubtaskBudget: vi.fn(),
  cancelPettyCashRequest: vi.fn(),
  createPettyCashRequest: vi.fn(),
  fetchDepartmentBudgetBundle: budgetMocks.bundle,
  fetchSubtaskAllocationContext: vi.fn().mockResolvedValue({ canAllocate: false, lines: [] }),
  fetchTaskFundingContext: budgetMocks.fundingContext,
  getBudgetAttachmentUrl: vi.fn(),
  requestAdditionalCash: vi.fn(),
  resubmitPettyCashRequest: vi.fn(),
  returnSubtaskBudget: vi.fn(),
  SUBTASK_BUDGET_CHANGED_EVENT: 'eflow:subtask-budget-changed',
  subscribeToBudget: () => () => {},
  submitLiquidation: vi.fn(),
}));

afterEach(cleanup);

function makeRequest(overrides: Partial<PettyCashRequest> = {}): PettyCashRequest {
  return {
    id: 'req-1',
    requestNumber: 2,
    fiscalBudgetId: 'budget-1',
    commitmentId: 'commit-1',
    allocationId: 'alloc-1',
    allocationLineId: 'line-1',
    orgId: 'org-1',
    fundingOrgId: 'org-1',
    requesterOrgId: 'org-1',
    taskId: 'task-1',
    taskTitle: 'Task with budget',
    requesterId: 'user-1',
    requesterName: 'koko',
    cashRecipientId: 'user-1',
    cashRecipientName: 'koko',
    purpose: 'Food Budget',
    requestedAmount: 500,
    neededBy: '2026-12-01',
    status: 'pending_department_approval',
    createdAt: Date.UTC(2026, 10, 18),
    updatedAt: Date.UTC(2026, 10, 18),
    ...overrides,
  };
}

const emptyBundle: DepartmentBudgetBundle = {
  summary: null,
  lines: [],
  commitments: [],
  allocations: [],
  allocationLines: [],
  requests: [],
  requestAttachments: [],
  releases: [],
  liquidations: [],
  ledger: [],
  adjustments: [],
};

describe('Task funding and cash workflow copy overhaul', () => {
  it('uses Project Lead and Accounting labels while keeping "Awaiting Accounting settlement" intact', () => {
    expect(formatCashStatusLabel('pending_department_approval')).toBe('Pending Project Lead approval');
    expect(formatCashStatusLabel('department_changes_requested')).toBe('Changes requested by Project Lead');
    expect(formatCashStatusLabel('approved')).toBe('Pending Accounting approval to release');
    expect(formatCashStatusLabel('scheduled_for_release')).toBe('Scheduled for Accounting release');
    expect(formatCashStatusLabel('partially_released')).toBe('Partially released by Accounting');
    expect(formatCashStatusLabel('pending_department_settlement')).toBe('Awaiting Accounting settlement');

    expect(formatLedgerEntryLabel('petty_cash_reserved')).toBe('Fund cash held for request');
    expect(formatLedgerEntryLabel('petty_cash_released')).toBe('Fund cash released');
  });

  it('builds structured workflow steps and plain-language next actions without Department/jargon terms', () => {
    const waitingProjectLead = getCashWorkflowProgress({ status: 'pending_department_approval' });
    expect(waitingProjectLead.steps.map((s) => `${s.label}:${s.state}`)).toEqual([
      'Project Lead approval:current',
      'Accounting release:upcoming',
      'Receipts & settlement:upcoming',
    ]);
    expect(waitingProjectLead.nextAction).toContain('Project Lead reviews and approves');

    const withTaskLead = getCashWorkflowProgress({
      status: 'approved',
      taskLeaderId: 'lead-1',
    });
    expect(withTaskLead.steps.map((s) => `${s.label}:${s.state}`)).toEqual([
      'Task Lead endorsement:complete',
      'Project Lead approval:complete',
      'Accounting release:current',
      'Receipts & settlement:upcoming',
    ]);
    expect(withTaskLead.nextAction).toContain('Accounting approves and releases the cash');
  });

  it('renders StatusPill without CSS capitalization mangling proper nouns', () => {
    render(<StatusPill status="pending_department_approval" />);
    const pill = screen.getByText('Pending Project Lead approval');
    expect(pill).toBeVisible();
    expect(pill.className).not.toContain('capitalize');
  });

  it('renders CashRequestTimeline with numbered steps and no "Department Approval" or "Operational endorsement"', () => {
    const req = makeRequest();
    const { container } = render(
      <CashRequestTimeline
        requests={[req]}
        data={{ ...emptyBundle, requests: [req] }}
        currentUserId="user-1"
        taskTitle="Task with budget"
        taskCompleted={false}
        liquidationDueDays={7}
        perReceiptLimit={5000}
        allowReceiptLimitOverride={false}
        onChanged={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText('Cash requests')).toBeVisible();
    expect(screen.getByText('FR-00002')).toBeVisible();
    expect(screen.getByText('Pending Project Lead approval')).toBeVisible();
    expect(screen.getByText('Project Lead approval')).toBeVisible();
    expect(screen.getByText('Accounting release')).toBeVisible();
    expect(screen.getByText('Receipts & settlement')).toBeVisible();
    expect(container.textContent).not.toMatch(/Department Approval/i);
    expect(container.textContent).not.toMatch(/Operational endorsement|fiscal authorization/i);
  });

  it('overhauls WorkBudgetCard navigation, keeps 0-subtask clutter hidden, and places Office petty cash in footer', async () => {
    const req = makeRequest();
    const funding: TaskFundingContext = {
      funded: true,
      fiscalYear: 2026,
      fundingOrgId: 'org-1',
      taskId: 'task-1',
      taskBudget: 10000,
      available: 9500,
      lines: [
        {
          id: 'line-1',
          expenseClass: 'Operating Expenses',
          category: 'Food',
          particular: 'Meals',
          fundSource: 'Project budget',
          amount: 10000,
          available: 9500,
        },
      ],
      distribution: { allocated: 0, unallocated: 10000, available: 9500, released: 0, spent: 0 },
      canManageDistribution: true,
      subtaskBudgets: [],
    };
    const bundle: DepartmentBudgetBundle = {
      ...emptyBundle,
      summary: {
        id: 'budget-1',
        orgId: 'org-1',
        fiscalYear: 2026,
        status: 'locked',
        approvedAmount: 50000,
        committedAmount: 10000,
        spentAmount: 0,
        availableAmount: 40000,
        commitmentRemaining: 40000,
        dailyPettyCashReleaseLimit: 5000,
        perReceiptLimit: 5000,
        liquidationDueDays: 7,
        allowReceiptLimitOverride: false,
        releasedToday: 0,
        scheduledToday: 0,
        dailyReleaseRemaining: 5000,
        pettyCashLimit: 5000,
        pettyCashRequestLimit: 5000,
        pettyCashReserved: 500,
        pettyCashSpent: 0,
        pettyCashAvailable: 4500,
        underutilizationThreshold: 0.5,
      },
      requests: [req],
    };

    budgetMocks.fundingContext.mockResolvedValue(funding);
    budgetMocks.bundle.mockResolvedValue(bundle);

    const task: Task = {
      id: 'task-1',
      title: 'Task with budget',
      status: 'in_progress',
      orgId: 'org-1',
      assigneeId: 'user-1',
      linkedProjectId: 'proj-1',
      createdAt: Date.UTC(2026, 10, 1),
      updatedAt: Date.UTC(2026, 10, 18),
    };

    render(<WorkBudgetCard task={task} canManage />);

    expect(await screen.findByText('₱9,500.00')).toBeVisible();
    expect(screen.getByText(/available from the task budget/i)).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeVisible();
    expect(screen.getByRole('tab', { name: /Requests/ })).toHaveTextContent('Requests (1)');
    expect(screen.getByRole('tab', { name: /Sources/ })).toHaveTextContent('Sources (1)');

    // 0-subtask clutter removed when zero subtasks exist
    expect(screen.queryByRole('button', { name: 'Manage subtask budgets' })).toBeNull();
    expect(screen.queryByText(/There are no subtasks to fund yet/i)).toBeNull();
    expect(screen.queryByText('Budget details')).toBeNull();

    // Concise 4-cell Budget summary strip
    const summaryStrip = screen.getByLabelText('Budget summary');
    expect(summaryStrip).toHaveTextContent('Approved budget');
    expect(summaryStrip).toHaveTextContent('Pending holds');
    expect(summaryStrip).toHaveTextContent('Cash released');
    expect(summaryStrip).toHaveTextContent('Actual spent');

    // Separate office petty cash fund sits in dedicated footer strip below Task funding
    const separateFundFooter = screen.getByLabelText('Separate office petty cash fund');
    expect(separateFundFooter).toHaveTextContent('Office petty cash · separate fund');

    // Can switch tabs between Requests and Sources
    fireEvent.click(screen.getByRole('tab', { name: /Sources/ }));
    expect(screen.getByLabelText('Approved funding sources')).toBeVisible();
    expect(screen.queryByText('Cash requests')).toBeNull();
  });
});
