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
const setSubtaskBudgetCapMock = vi.fn();

vi.mock("../../src/app/features/budget/services/workCashAssignmentService", () => ({
  assignWorkCash: (...args: unknown[]) => assignWorkCashMock(...args),
  recallWorkCash: (...args: unknown[]) => recallWorkCashMock(...args),
}));

vi.mock("../../src/app/features/budget/services/budgetService", () => ({
  setSubtaskBudgetCap: (...args: unknown[]) => setSubtaskBudgetCapMock(...args),
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
        { allocationLineId: "line-maint", amount: 500, sourceName: "Maintainance" },
        { allocationLineId: "line-moae", amount: 300, sourceName: "MOAE" },
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
      sourceLabel: "FR-00001 · ewqdw",
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
    setSubtaskBudgetCapMock.mockReset().mockResolvedValue("cap-new");
  });

  it("prioritizes released task cash over office petty cash and unrequested budget", () => {
    const groups = buildUnifiedFundingOptions(baseContext, "__new__", {
      includeUnrequestedBudgetCap: true,
    });
    expect(groups.taskCashOptions).toHaveLength(1);
    expect(groups.officePettyCashOptions).toHaveLength(1);
    expect(groups.budgetCapOptions).toHaveLength(2);

    const best = pickDefaultFundingOption(groups.allOptions);
    expect(best?.kind).toBe("task_cash_release");
    expect(best?.available).toBe(400);
    expect(best?.label).toContain("FR-00001");
  });

  it("allows direct task self-assignment from released task cash and office petty cash only", () => {
    const taskSelf = buildUnifiedFundingOptions(baseContext, null);
    expect(taskSelf.taskCashOptions).toHaveLength(1);
    expect(taskSelf.officePettyCashOptions).toHaveLength(1);
    expect(taskSelf.budgetCapOptions).toHaveLength(0);
    expect(taskSelf.taskCashOptions[0].maxForTarget).toBe(400);
    expect(taskSelf.officePettyCashOptions[0].maxForTarget).toBe(600);
  });

  it("enforces centavo bounds including floor of logged receipts when editing existing assignment", () => {
    const sub1 = buildUnifiedFundingOptions(baseContext, "sub-1");
    const frOption = sub1.taskCashOptions[0];
    // Existing ₱400 + ₱400 unassigned = ₱800 max; ₱100 already logged in receipts = ₱100 min
    expect(frOption.maxForTarget).toBe(800);
    expect(frOption.minForTarget).toBe(100);

    expect(validateCashAssignmentAmount("99.99", frOption)).toMatch(/Keep at least/);
    expect(validateCashAssignmentAmount("800.01", frOption)).toMatch(/exceeds/);
    expect(validateCashAssignmentAmount("100.123", frOption)).toMatch(/two decimal places/);
    expect(validateCashAssignmentAmount("550.50", frOption)).toBe("");
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

  it("AssignMoneyModal lets Task Lead assign remaining ₱400 directly to the task itself", async () => {
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

    expect(screen.getByText("Released task cash on hand")).toBeTruthy();
    expect(screen.getByText("Released office petty cash")).toBeTruthy();
    expect(screen.getByText("Unrequested task budget")).toBeTruthy();

    const amountInput = screen.getByLabelText(/Amount \(PHP\)/i);
    fireEvent.change(amountInput, { target: { value: "400" } });

    const submitBtn = screen.getByRole("button", { name: /Assign cash/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(assignWorkCashMock).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: "task-1",
          subtaskId: null,
          sourceKind: "task_cash_release",
          sourceRequestId: "req-fr-1",
          amount: 400,
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

  it("AssignMoneyModal supports B1 unrequested task budget cap on an existing subtask", async () => {
    const onChanged = vi.fn().mockResolvedValue(undefined);
    render(
      <AssignMoneyModal
        taskTitle="test Test"
        context={baseContext}
        pools={basePools}
        initialTarget={{ kind: "subtask", subtaskId: "sub-2" }}
        lockTarget
        onChanged={onChanged}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Funding source"), {
      target: { value: "budget_cap:line-moae" },
    });
    fireEvent.change(screen.getByLabelText(/Amount \(PHP\)/i), {
      target: { value: "150" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Why this subtask needs this budget cap/i), {
      target: { value: "Materials for step 2" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Allocate budget cap/i }));

    await waitFor(() => {
      expect(setSubtaskBudgetCapMock).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: "task-1",
          subtaskId: "sub-2",
          allocationLineId: "line-moae",
          amount: 150,
          reason: "Materials for step 2",
        }),
      );
    });
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
