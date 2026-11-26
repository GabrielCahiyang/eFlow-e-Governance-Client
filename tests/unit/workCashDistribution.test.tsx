// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import {
  buildUnifiedFundingOptions,
  pickDefaultFundingOption,
  resolveCashPools,
  validateCashAssignmentAmount,
} from "../../src/app/features/budget/selectors/workCashPools";
import { validateCashLiquidation } from "../../src/app/features/budget/validation/liquidationValidation";
import { liquidationInputError } from "../../src/app/features/budget/validation/financialValidation";
import type { TaskCashPools, TaskFundingContext } from "../../src/app/features/budget/types";

const assignWorkCashMock = vi.fn();
const recallWorkCashMock = vi.fn();

vi.mock("../../src/app/features/budget/services/workCashAssignmentService", () => ({
  assignWorkCash: (...args: unknown[]) => assignWorkCashMock(...args),
  recallWorkCash: (...args: unknown[]) => recallWorkCashMock(...args),
}));

import { AssignMoneyModal } from "../../src/app/features/budget/components/AssignMoneyModal";

const basePools: TaskCashPools = {
  canAssignCash: true,
  taskCashReleases: [
    {
      requestId: "req-fr-1",
      requestNumber: 1,
      purpose: "ewqdw",
      status: "released",
      sourceLabels: ["Maintainance · FY 2026", "MOAE · FY 2026"],
      fundingLines: [
        {
          allocationLineId: "line-maint",
          amount: 500,
          sourceName: "Maintainance",
          allocatedAmount: 500,
          unrequestedAmount: 0,
          assignedToTask: 0,
          assignedToSubtasks: 400,
          unassignedAmount: 100,
          recordedReceiptsTotal: 100,
        },
        {
          allocationLineId: "line-moae",
          amount: 300,
          sourceName: "MOAE",
          allocatedAmount: 500,
          unrequestedAmount: 200,
          assignedToTask: 0,
          assignedToSubtasks: 0,
          unassignedAmount: 300,
          recordedReceiptsTotal: 0,
        },
      ],
      releasedAmount: 800,
      assignedToTask: 0,
      assignedToSubtasks: 400,
      unassignedAmount: 400,
      recordedReceiptsTotal: 100,
      liquidationDueAt: "2026-12-08T00:00:00Z",
      holderId: "user-gabriel",
      holderName: "Gabriel Cahiyang",
      isCurrentHolder: true,
      acknowledged: true,
    },
  ],
  officePettyCashReleases: [
    {
      officeCashRequestId: "opc-shalama",
      purpose: "shalama",
      releasedAmount: 600,
      assignedHere: 0,
      assignedElsewhere: 0,
      unassignedAmount: 600,
      recordedReceiptsTotal: 0,
      liquidationDueAt: "2026-12-08T00:00:00Z",
      holderId: "user-gabriel",
      holderName: "Gabriel Cahiyang",
      isCurrentHolder: true,
    },
  ],
  assignments: [
    {
      id: "assign-sub-1",
      sourceKind: "task_cash_release",
      sourceRequestId: "req-fr-1",
      allocationLineId: "line-maint",
      sourceLabel: "Maintainance · FR-00001",
      sourceOrgId: "org-ledipo",
      fundingLines: [
        { allocationLineId: "line-maint", amount: 500, sourceName: "Maintainance" },
      ],
      taskId: "task-1",
      subtaskId: "sub-1",
      subtaskTitle: "Subtask 1",
      amount: 400,
      recordedSpent: 100,
      unspentAmount: 300,
      status: "active",
      note: "Initial materials",
      assignedBy: "user-gabriel",
      assignedByName: "Gabriel Cahiyang",
      canLogReceipt: true,
      canRecall: true,
      receipts: [],
    },
  ],
  totals: {
    cashOnHandTask: 800,
    cashOnHandAssigned: 400,
    cashOnHandUnassigned: 400,
    officePettyCashOnHand: 600,
    officePettyCashAssigned: 0,
    subtaskTaskCashAssigned: 0,
    subtaskOfficePettyCashAssigned: 0,
    unrequestedBudget: 200,
  },
};

const baseContext: TaskFundingContext = {
  funded: true,
  supportsItemizedCash: true,
  fiscalYear: 2026,
  fundingOrgId: "org-ledipo",
  taskId: "task-1",
  taskAllocationId: "alloc-1",
  taskBudget: 1000,
  available: 200,
  taskLeaderId: "user-gabriel",
  canManageDistribution: true,
  distribution: {
    allocated: 0,
    unallocated: 1000,
    available: 200,
    released: 800,
    spent: 0,
  },
  lines: [
    {
      id: "line-maint",
      expenseClass: "MOOE",
      category: "Maintainance",
      particular: "test Test",
      fundSource: "Project budget",
      amount: 500,
      available: 0,
    },
    {
      id: "line-moae",
      expenseClass: "MOOE",
      category: "MOAE",
      particular: "test Test",
      fundSource: "Project budget",
      amount: 500,
      available: 200,
    },
  ],
  parentSources: [
    { id: "line-maint", name: "Maintainance · FY 2026", available: 0 },
    { id: "line-moae", name: "MOAE · FY 2026", available: 200 },
  ],
  subtaskBudgets: [
    {
      id: "sub-1",
      title: "Subtask 1",
      amount: 0,
      returnable: 0,
      finished: false,
      hasHistory: false,
      blocked: false,
    },
    {
      id: "sub-2",
      title: "Subtask 2",
      amount: 0,
      returnable: 0,
      finished: false,
      hasHistory: false,
      blocked: false,
    },
  ],
  cashPools: basePools,
};

describe("work cash distribution & 3-bucket funding pools", () => {
  afterEach(cleanup);
  beforeEach(() => {
    assignWorkCashMock.mockReset().mockResolvedValue("assign-new");
    recallWorkCashMock.mockReset().mockResolvedValue("assign-sub-1");
  });

  it("splits released task cash cleanly per funding source line instead of lumping into one total", () => {
    const groups = buildUnifiedFundingOptions(baseContext, "__new__", {
      includeUnrequestedBudgetCap: false,
    });
    expect(groups.taskCashOptions).toHaveLength(2);
    expect(groups.officePettyCashOptions).toHaveLength(1);
    expect(groups.budgetCapOptions).toHaveLength(0);

    expect(groups.taskCashOptions[0]).toMatchObject({
      key: "task_cash_release:req-fr-1:line-maint",
      allocationLineId: "line-maint",
      sourceName: "Maintainance",
      releasedAmount: 500,
      available: 100,
      maxForTarget: 100,
    });
    expect(groups.taskCashOptions[1]).toMatchObject({
      key: "task_cash_release:req-fr-1:line-moae",
      allocationLineId: "line-moae",
      sourceName: "MOAE",
      releasedAmount: 300,
      available: 300,
      maxForTarget: 300,
    });

    const best = pickDefaultFundingOption(groups.allOptions);
    expect(best?.kind).toBe("task_cash_release");
    expect(best?.allocationLineId).toBe("line-maint");
    expect(best?.label).toBe("Maintainance · FR-00001");
  });

  it("allows direct task self-assignment per released funding source and office petty cash only", () => {
    const taskSelf = buildUnifiedFundingOptions(baseContext, null);
    expect(taskSelf.taskCashOptions).toHaveLength(2);
    expect(taskSelf.officePettyCashOptions).toHaveLength(1);
    expect(taskSelf.budgetCapOptions).toHaveLength(0);
    expect(taskSelf.taskCashOptions[0].maxForTarget).toBe(100);
    expect(taskSelf.taskCashOptions[1].maxForTarget).toBe(300);
    expect(taskSelf.officePettyCashOptions[0].maxForTarget).toBe(600);
  });

  it("enforces per-line centavo bounds including floor of logged receipts when editing existing assignment", () => {
    const sub1 = buildUnifiedFundingOptions(baseContext, "sub-1");
    const maintOption = sub1.taskCashOptions[0];
    const moaeOption = sub1.taskCashOptions[1];
    // Maintainance: ₱400 existing + ₱100 unassigned = ₱500 max (NOT ₱800); ₱100 logged receipts = ₱100 min
    expect(maintOption.maxForTarget).toBe(500);
    expect(maintOption.minForTarget).toBe(100);
    // MOAE: completely separate ₱300 released pool
    expect(moaeOption.maxForTarget).toBe(300);
    expect(moaeOption.minForTarget).toBe(0);

    expect(validateCashAssignmentAmount("99.99", maintOption)).toMatch(/Keep at least/);
    expect(validateCashAssignmentAmount("500.01", maintOption)).toMatch(/exceeds/);
    expect(validateCashAssignmentAmount("300.01", moaeOption)).toMatch(/exceeds/);
    expect(validateCashAssignmentAmount("100.123", maintOption)).toMatch(/two decimal places/);
    expect(validateCashAssignmentAmount("450.50", maintOption)).toBe("");
  });

  it("derives fallback cash-on-hand totals when cashPools is absent from older server payload", () => {
    const legacyCtx: TaskFundingContext = { ...baseContext, cashPools: undefined };
    const fallback = resolveCashPools(legacyCtx, {
      taskId: "task-1",
      currentUserId: "user-gabriel",
      requests: [
        {
          id: "req-fr-1",
          requestNumber: 1,
          fiscalBudgetId: "fb-1",
          commitmentId: "c-1",
          allocationId: "alloc-1",
          orgId: "org-ledipo",
          fundingOrgId: "org-ledipo",
          requesterOrgId: "org-ledipo",
          taskId: "task-1",
          requesterId: "user-gabriel",
          cashRecipientId: "user-gabriel",
          purpose: "ewqdw",
          requestedAmount: 800,
          approvedAmount: 800,
          releasedAmount: 800,
          status: "released",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      releases: [
        {
          id: "rel-1",
          requestId: "req-fr-1",
          orgId: "org-ledipo",
          scheduledDate: "2026-11-23",
          amount: 800,
          status: "released",
          recipientId: "user-gabriel",
          acknowledgedAt: 10,
          createdAt: 1,
        },
      ],
    });
    expect(fallback.totals.cashOnHandTask).toBe(800);
    expect(fallback.totals.cashOnHandUnassigned).toBe(800);
    expect(fallback.totals.unrequestedBudget).toBe(200);
  });

  it("AssignMoneyModal lets Task Lead assign per-source released cash directly to the task itself with clean target label", async () => {
    const onChanged = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <AssignMoneyModal
        taskTitle="test Test"
        context={baseContext}
        pools={basePools}
        initialTarget={{ kind: "task" }}
        onChanged={onChanged}
        onClose={onClose}
      />,
    );

    expect(screen.getByText("Released task cash")).toBeTruthy();
    expect(screen.getByText("Office petty cash")).toBeTruthy();
    expect(screen.queryByText(/Unrequested task budget/i)).toBeNull();
    expect(screen.getByRole("option", { name: "test Test (This task)" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Maintainance · FR-00001 — ₱100.00" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "MOAE · FR-00001 — ₱300.00" })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Funding source"), {
      target: { value: "task_cash_release:req-fr-1:line-moae" },
    });

    const amountInput = screen.getByLabelText(/Amount \(PHP\)/i);
    fireEvent.change(amountInput, { target: { value: "250" } });

    const submitBtn = screen.getByRole("button", { name: /Assign cash/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(assignWorkCashMock).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: "task-1",
          subtaskId: null,
          sourceKind: "task_cash_release",
          sourceRequestId: "req-fr-1",
          allocationLineId: "line-moae",
          amount: 250,
        }),
      );
    });
    expect(onChanged).toHaveBeenCalled();
  });

  it("AssignMoneyModal lets Task Lead assign Office Petty Cash to an existing subtask and recall unused funds", async () => {
    const onChanged = vi.fn().mockResolvedValue(undefined);
    render(
      <AssignMoneyModal
        taskTitle="test Test"
        context={baseContext}
        pools={basePools}
        initialTarget={{ kind: "subtask", subtaskId: "sub-2" }}
        onChanged={onChanged}
        onClose={vi.fn()}
      />,
    );

    const sourceSelect = screen.getByLabelText("Funding source");
    fireEvent.change(sourceSelect, { target: { value: "office_petty_cash:opc-shalama" } });

    const amountInput = screen.getByLabelText(/Amount \(PHP\)/i);
    fireEvent.change(amountInput, { target: { value: "250" } });

    fireEvent.click(screen.getByRole("button", { name: /Assign cash/i }));

    await waitFor(() => {
      expect(assignWorkCashMock).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: "task-1",
          subtaskId: "sub-2",
          sourceKind: "office_petty_cash",
          sourceRequestId: "opc-shalama",
          allocationLineId: null,
          amount: 250,
        }),
      );
    });

    const recallBtn = screen.getByRole("button", { name: /Return unused/i });
    fireEvent.click(recallBtn);

    await waitFor(() => {
      expect(recallWorkCashMock).toHaveBeenCalledWith(
        expect.objectContaining({ assignmentId: "assign-sub-1" }),
      );
    });
  });

  it("AssignMoneyModal excludes unrequested task budget and blocks amounts higher than the selected funding source's released cash", () => {
    render(
      <AssignMoneyModal
        taskTitle="test Test"
        context={baseContext}
        pools={basePools}
        initialTarget={{ kind: "subtask", subtaskId: "sub-2" }}
        lockTarget
        onChanged={vi.fn().mockResolvedValue(undefined)}
        onClose={vi.fn()}
      />,
    );

    const sourceSelect = screen.getByLabelText("Funding source") as HTMLSelectElement;
    const optionValues = Array.from(sourceSelect.options).map((o) => o.value);
    expect(optionValues).toEqual([
      "task_cash_release:req-fr-1:line-maint",
      "task_cash_release:req-fr-1:line-moae",
      "office_petty_cash:opc-shalama",
    ]);

    // Switch to MOAE (₱300.00 released) and try entering ₱350.00
    fireEvent.change(sourceSelect, {
      target: { value: "task_cash_release:req-fr-1:line-moae" },
    });

    const amountInput = screen.getByLabelText(/Amount \(PHP\)/i);
    fireEvent.change(amountInput, { target: { value: "350" } });

    expect(amountInput).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/Exceeds ₱300\.00 by ₱50\.00/i)).toBeTruthy();
    const submitBtn = screen.getByRole("button", { name: /Assign cash/i });
    expect(submitBtn).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(submitBtn);
    fireEvent.submit(amountInput.closest("form")!);
    expect(assignWorkCashMock).not.toHaveBeenCalled();
  });

  it("A1 rolled-up receipts with existingFile pass liquidation validation without re-upload", () => {
    const rolledReceipt = {
      id: "r-1",
      vendor: "National Book Store",
      receiptNumber: "OR-123",
      receiptDate: "2026-11-20",
      description: "Bond paper",
      amount: 300,
      existingFile: {
        fileName: "nbs.pdf",
        filePath: "org-ledipo/req-fr-1/assignments/assign-sub-1/k-nbs.pdf",
        mimeType: "application/pdf",
        fileSize: 12000,
      },
      items: [
        {
          id: "it-1",
          allocationLineId: "line-maint",
          quantity: 1,
          unit: "lot",
          particular: "Bond paper",
          purpose: "Subtask 1 supplies",
          amount: 300,
        },
      ],
    };

    const validation = validateCashLiquidation({
      approved: 800,
      itemized: true,
      sources: [
        { allocationLineId: "line-maint", amount: 500, sourceName: "Maintainance" },
        { allocationLineId: "line-moae", amount: 300, sourceName: "MOAE" },
      ],
      spent: 300,
      receipts: [rolledReceipt],
      refundReceiptNumber: "OR-REF-99",
      refundDate: "2026-11-22",
      note: "Liquidating task and subtask expenses",
    });

    expect(validation.isValid).toBe(true);
    expect(validation.requiresCashReturn).toBe(true);
    expect(validation.unusedCents).toBe(50000);

    const inputErr = liquidationInputError({
      spent: 300,
      note: "Liquidating task and subtask expenses",
      receipts: [rolledReceipt],
      refundReceiptNumber: "OR-REF-99",
      refundDate: "2026-11-22",
      releasedAmount: 800,
      sources: [
        { allocationLineId: "line-maint", amount: 500, sourceName: "Maintainance" },
        { allocationLineId: "line-moae", amount: 300, sourceName: "MOAE" },
      ],
    });
    expect(inputErr).toBe("");
  });

  it("SQL migration defines all required tables, locks, PHT rules, and auto-return triggers", () => {
    const sqlPath = path.resolve(
      process.cwd(),
      "supabase/migrations/20261123100000_work_cash_distribution_and_petty_cash_assignments.sql",
    );
    const sql = fs.readFileSync(sqlPath, "utf8");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.work_cash_assignments");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.work_cash_assignment_receipts");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.assign_work_cash");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.recall_work_cash");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.record_assignment_receipt");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.delete_assignment_receipt");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.get_request_assignment_receipts");
    expect(sql).toContain("PERFORM eflow_r7.lock_impact");
    expect(sql).toContain("AT TIME ZONE 'Asia/Manila'");
    expect(sql).toContain("p_amount > 5000");
    expect(sql).toContain("work_cash_release_on_subtask_complete");
  });
});
