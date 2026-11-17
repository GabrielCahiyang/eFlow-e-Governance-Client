// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BudgetLedgerEntry, DepartmentBudgetBundle, GeneralJournalEntry } from "../../src/app/features/budget/types";

const mocks = vi.hoisted(() => ({
  fetchLedgerPage: vi.fn(),
  journalEntries: [] as GeneralJournalEntry[],
}));

vi.mock("../../src/app/contexts/AuthContext", () => ({
  useAuth: () => ({
    userProfile: { id: "accountant-1", org_id: "org-1", role: "accounting_staff" },
    can: () => true,
  }),
}));
vi.mock("../../src/app/services/projectService", () => ({
  fetchAllProjects: vi.fn().mockResolvedValue([]),
  getCachedProjects: () => [],
}));
vi.mock("../../src/app/features/budget/services/budgetService", () => ({
  fetchBudgetLedgerPage: mocks.fetchLedgerPage,
  postGeneralJournalAdjustment: vi.fn(),
}));
vi.mock("../../src/app/features/budget/hooks/useGeneralJournal", () => ({
  useGeneralJournal: () => ({
    entries: mocks.journalEntries,
    accounts: [
      { code: "101", title: "Cash", classification: "asset", normalBalance: "debit" },
      { code: "501", title: "Expense", classification: "expense", normalBalance: "debit" },
    ],
    loading: false,
    refreshing: false,
    error: "",
    refresh: vi.fn(),
  }),
}));

import { DEFAULT_BUDGET_PAGE_SIZE, useBudgetPagination } from "../../src/app/features/budget/hooks/useBudgetPagination";
import { AccountingTrailPanel } from "../../src/app/features/budget/components/AccountingTrailPanel";
import { GeneralJournalWorkspace } from "../../src/app/features/budget/components/GeneralJournalWorkspace";

function makeLedgerEntry(index: number): BudgetLedgerEntry {
  return {
    id: `ledger-${index}`,
    entryType: "cash_release",
    amount: index * 100,
    description: `Audit event ${index}`,
    createdAt: 1700000000000 + index * 1000,
    actorRole: "accounting_staff",
  };
}

function makeJournalEntry(index: number): GeneralJournalEntry {
  return {
    id: `jev-${index}`,
    entryNumber: index,
    fiscalBudgetId: "budget-1",
    orgId: "org-1",
    entryDate: "2026-06-15",
    referenceNumber: `REF-${String(index).padStart(3, "0")}`,
    sourceType: "release",
    memo: `Memo ${index}`,
    lines: [
      { id: `l-${index}-1`, lineNumber: 1, accountCode: "101", accountTitle: "Cash", debit: 100, credit: 0 },
      { id: `l-${index}-2`, lineNumber: 2, accountCode: "501", accountTitle: "Expense", debit: 0, credit: 100 },
    ],
  };
}

function makeBundle(ledgerCount: number, totalCount = ledgerCount): DepartmentBudgetBundle {
  return {
    summary: {
      id: "budget-1",
      orgId: "org-1",
      fiscalYear: 2026,
      status: "locked",
      approvedAmount: 100000,
      committedAmount: 0,
      spentAmount: 0,
      availableAmount: 100000,
      dailyPettyCashReleaseLimit: 30000,
      perReceiptLimit: 5000,
      liquidationDueDays: 15,
      allowReceiptLimitOverride: false,
      underutilizationThreshold: 75,
    },
    lines: [],
    commitments: [],
    allocations: [],
    allocationLines: [],
    requests: [],
    requestAttachments: [],
    releases: [],
    liquidations: [],
    ledger: Array.from({ length: ledgerCount }, (_, index) => makeLedgerEntry(index + 1)),
    ledgerCount: totalCount,
    adjustments: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.journalEntries = [];
});

afterEach(() => cleanup());

describe("Accounting & budget 10-per-page pagination", () => {
  it("defaults useBudgetPagination to 10 items per page and resets to page 1 on filter changes", () => {
    expect(DEFAULT_BUDGET_PAGE_SIZE).toBe(10);
    const items = Array.from({ length: 23 }, (_, i) => i + 1);
    const hook = renderHook(
      ({ resetKey }: { resetKey: string }) => useBudgetPagination(items, resetKey),
      { initialProps: { resetKey: "initial" } },
    );
    expect(hook.result.current.pageSize).toBe(10);
    expect(hook.result.current.totalPages).toBe(3);
    expect(hook.result.current.pageItems).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    act(() => hook.result.current.setPage(2));
    expect(hook.result.current.pageItems).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);

    hook.rerender({ resetKey: "filtered" });
    expect(hook.result.current.page).toBe(1);
    expect(hook.result.current.pageItems).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("paginates Financial Audit Trail at 10 events and fetches server pages when total exceeds initial bundle", async () => {
    mocks.fetchLedgerPage.mockResolvedValue({
      rows: Array.from({ length: 10 }, (_, i) => makeLedgerEntry(i + 11)),
      total: 25,
    });
    render(<AccountingTrailPanel data={makeBundle(10, 25)} />);

    expect(screen.getByText("Showing 1–10 of 25 events")).toBeTruthy();
    expect(screen.getByText("Audit event 1")).toBeTruthy();
    expect(screen.queryByText("Audit event 11")).toBeNull();
    expect(mocks.fetchLedgerPage).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() =>
      expect(mocks.fetchLedgerPage).toHaveBeenCalledWith({
        fiscalBudgetId: "budget-1",
        page: 2,
        pageSize: 10,
        query: "",
      }),
    );
    expect(await screen.findByText("Audit event 11")).toBeTruthy();
    expect(screen.getByText("Showing 11–20 of 25 events")).toBeTruthy();
  });

  it("paginates General Journal entries at 10 per page while retaining full trial balance totals", () => {
    mocks.journalEntries = Array.from({ length: 14 }, (_, i) => makeJournalEntry(i + 1));
    render(<GeneralJournalWorkspace orgId="org-1" fiscalYear={2026} fiscalBudgetId="budget-1" />);

    expect(screen.getByText("Showing 1–10 of 14 entries")).toBeTruthy();
    expect(screen.getByText("Filtered trial balance (14 entries)")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Inspect journal REF-001" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Inspect journal REF-011" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Showing 11–14 of 14 entries")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Inspect journal REF-011" })).toBeTruthy();
  });
});
