// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BudgetPositionSummary } from "../../src/app/features/budget/components/BudgetPositionSummary";
import { BudgetFundingHierarchy } from "../../src/app/features/budget/components/BudgetFundingHierarchy";
import type { Task } from "../../src/app/features/tasks";
import type { DepartmentBudgetBundle, DepartmentBudgetSummary } from "../../src/app/features/budget/types";

const summary: DepartmentBudgetSummary = {
  id: "budget-1",
  orgId: "org-1",
  fiscalYear: 2026,
  status: "locked",
  approvedAmount: 1_000_000,
  committedAmount: 400_000,
  spentAmount: 175_000,
  availableAmount: 600_000,
  commitmentRemaining: 225_000,
  dailyPettyCashReleaseLimit: 50_000,
  perReceiptLimit: 10_000,
  liquidationDueDays: 10,
  allowReceiptLimitOverride: false,
  releasedToday: 0,
  scheduledToday: 20_000,
  dailyReleaseRemaining: 50_000,
  pettyCashLimit: 50_000,
  pettyCashRequestLimit: 10_000,
  pettyCashReserved: 40_000,
  pettyCashSpent: 0,
  pettyCashAvailable: 10_000,
  underutilizationThreshold: 85,
};

const data = {
  summary,
  lines: [],
  commitments: [{ id: "commitment-1", status: "active" }],
  allocations: [{ id: "allocation-1", status: "pending" }],
  allocationLines: [],
  requests: [{ id: "request-1", status: "pending_department_approval" }, { id: "request-2", status: "released", releasedAmount: 40_000 }],
  requestAttachments: [],
  releases: [{ id: "release-1", status: "scheduled", scheduledDate: "2000-01-01", amount: 20_000 }],
  liquidations: [{ id: "liquidation-1", status: "pending_department_settlement" }],
  ledger: [],
  adjustments: [],
} as unknown as DepartmentBudgetBundle;

describe("BudgetPositionSummary", () => {
  it("keeps direct-work names readable for Accounting without relabeling proposal tasks", () => {
    const funding = { ...data, commitments: [{ id: 'c', title: 'Authorized kit purchase', proposalDraftId: '', amount: 1800, status: 'active' }],
      allocations: [{ id: 'a', commitmentId: 'c', taskId: 't', amount: 1800 }], requests: [] } as unknown as DepartmentBudgetBundle;
    const view = render(<BudgetFundingHierarchy data={funding} tasks={[]} />);
    expect(screen.getAllByText('Authorized kit purchase')).toHaveLength(2);
    view.rerender(<BudgetFundingHierarchy data={{ ...funding, commitments: [{ ...funding.commitments[0], proposalDraftId: 'proposal' }] }} tasks={[]} />);
    expect(screen.getByText('Funded task')).toBeTruthy();
    view.rerender(<BudgetFundingHierarchy data={funding} tasks={[{ id: 't', title: 'Current operational title' } as Task]} />);
    expect(screen.getByText('Current operational title')).toBeTruthy();
    view.unmount();
  });
  it("shows the current fiscal position and routes each exposure to its existing workflow", () => {
    const onNavigate = vi.fn();
    render(<BudgetPositionSummary data={data} summary={summary} onNavigate={onNavigate} />);

    expect(screen.getByText("Available to fund")).toBeTruthy();
    expect(screen.getByText("₱600,000.00")).toBeTruthy();
    expect(screen.getByText("Pending approvals")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("Release deadlines")).toBeTruthy();
    expect(screen.getByText("Settlement exposure")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /open requests/i }));
    expect(onNavigate).toHaveBeenCalledWith("approvals");
    fireEvent.click(screen.getByRole("button", { name: /review settlement/i }));
    expect(onNavigate).toHaveBeenLastCalledWith("releases");
  });
});
