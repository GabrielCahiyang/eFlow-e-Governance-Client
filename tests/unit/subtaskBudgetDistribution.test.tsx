// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "../../src/app/features/tasks";
import type { Subtask } from "../../src/app/services/subtaskService";
import type { SubtaskBudgetRow, TaskFundingContext } from "../../src/app/features/budget/types";
import {
  buildDistributionCommand,
  distributionLimits,
  subtaskAllocationProgressPercent,
} from "../../src/app/features/budget/selectors/subtaskDistribution";

const state = vi.hoisted(() => ({
  actor: "lead-1",
  context: null as TaskFundingContext | null,
  readLatest: vi.fn<() => Promise<TaskFundingContext | null>>(),
  setCap: vi.fn().mockResolvedValue("cap-new"),
  removeCap: vi.fn().mockResolvedValue(undefined),
  refresh: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/app/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: state.actor },
    userProfile: { id: state.actor, role: "member", org_id: "org-1", is_active: true },
  }),
}));
vi.mock("../../src/app/features/budget/hooks/useDepartmentBudget", () => ({
  useDepartmentBudget: () => ({
    summary: { status: "locked" },
    allocations: [],
    allocationLines: [],
    requests: [],
    requestAttachments: [],
    releases: [],
    liquidations: [],
    loading: false,
    error: "",
    refresh: state.refresh,
  }),
}));
vi.mock("../../src/app/features/budget/hooks/useTaskFundingContext", () => ({
  useTaskFundingContext: () => ({
    context: state.context,
    loading: false,
    error: "",
    refresh: state.refresh,
    readLatest: state.readLatest,
  }),
}));
vi.mock("../../src/app/features/budget/services/budgetService", () => ({
  SUBTASK_BUDGET_CHANGED_EVENT: "eflow:subtask-budget-changed",
  setSubtaskBudgetCap: state.setCap,
  removeSubtaskBudgetCap: state.removeCap,
  createContextualCashRequest: vi.fn(),
  resubmitContextualCashRequest: vi.fn(),
  uploadCashRequestAttachment: vi.fn(),
  createReceiptSignedUrl: vi.fn(),
  cancelContextualCashRequest: vi.fn(),
  acknowledgePettyCashRelease: vi.fn(),
}));

import { WorkBudgetCard } from "../../src/app/features/budget/components/WorkBudgetCard";

const task: Task = {
  id: "task-1",
  title: "Parent task",
  status: "in_progress",
  orgId: "org-1",
  assigneeId: "lead-1",
  createdAt: 1,
  updatedAt: 1,
};

const subtask: Subtask = {
  id: "sub-1",
  taskId: "task-1",
  title: "Print handouts",
  assignedToIds: ["worker-1"],
  status: "todo",
  percentComplete: 0,
};

const baseRow: SubtaskBudgetRow = {
  id: "sub-1",
  title: "Print handouts",
  capId: "cap-1",
  sourceId: "supplies",
  amount: 15000,
  returnable: 12000,
  reason: "Initial printing",
  finished: false,
  hasHistory: true,
  blocked: false,
};

const baseContext: TaskFundingContext = {
  taskId: "task-1",
  taskLeaderId: "lead-1",
  funded: true,
  taskBudget: 50000,
  available: 5000,
  lines: [],
  canManageDistribution: true,
  distribution: {
    allocated: 15000,
    unallocated: 35000,
    available: 35000,
    released: 3000,
    spent: 3000,
  },
  parentSources: [
    { id: "supplies", name: "Supplies · FY 2026", available: 5000 },
    { id: "travel", name: "Travel · FY 2026", available: 30000 },
  ],
  subtaskBudgets: [baseRow],
};

describe("subtaskDistribution rules and WorkBudgetCard inline allocation parity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.actor = "lead-1";
    state.context = baseContext;
    state.readLatest.mockResolvedValue(baseContext);
  });

  afterEach(cleanup);

  it("computes integer-cent bounds, account lock, and stale guards like Mobile", () => {
    const limits = distributionLimits(baseContext, baseRow, "supplies");
    expect(limits).toEqual({
      minimumCents: 300000,
      maximumCents: 2000000,
      sourceLocked: true,
    });
    expect(subtaskAllocationProgressPercent(baseContext)).toBe(30);

    expect(
      buildDistributionCommand(
        baseContext,
        "sub-1",
        "save",
        {
          source: "supplies",
          amount: "17500",
          reason: "  Add booklets ",
          expectedCapId: "cap-1",
          expectedAmount: 15000,
        },
        "cmd-1",
      ),
    ).toEqual({
      mode: "save",
      taskId: "task-1",
      subtaskId: "sub-1",
      allocationLineId: "supplies",
      amount: 17500,
      reason: "Add booklets",
      idempotencyKey: "cmd-1",
    });

    expect(() =>
      buildDistributionCommand(
        baseContext,
        "sub-1",
        "save",
        { source: "supplies", amount: "2999.99", reason: "Cut", expectedCapId: "cap-1" },
        "cmd-2",
      ),
    ).toThrow(/recorded spending/);

    expect(() =>
      buildDistributionCommand(
        baseContext,
        "sub-1",
        "save",
        { source: "travel", amount: "15000", reason: "Switch", expectedCapId: "cap-1" },
        "cmd-3",
      ),
    ).toThrow(/eligible account/);

    expect(() =>
      buildDistributionCommand(
        baseContext,
        "sub-1",
        "return",
        { source: "supplies", amount: "15000", reason: "Return", expectedCapId: "stale-cap" },
        "cmd-4",
      ),
    ).toThrow(/changed before your update/);
  });

  it("renders inline allocation progress & rows on the parent task and jumps directly into edit/return", async () => {
    render(<WorkBudgetCard task={task} canManage />);

    const progress = screen.getByRole("progressbar", { name: "Subtask allocation progress" });
    expect(progress.getAttribute("aria-valuenow")).toBe("30");
    expect(screen.getByText("Subtask allocations")).toBeTruthy();
    expect(screen.getByText("Print handouts")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Return unused funds" }));
    const dialog = screen.getByRole("dialog", { name: "Manage subtask budgets" });
    expect(dialog.textContent).toContain("Return ₱12,000.00 to the parent task’s available budget.");

    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Print order completed" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm return" }));

    await waitFor(() =>
      expect(state.removeCap).toHaveBeenCalledWith(
        expect.objectContaining({ capId: "cap-1", reason: "Print order completed" }),
      ),
    );
    expect(state.readLatest).toHaveBeenCalled();
  });

  it("blocks Save when fresh server verification detects a concurrent allocation change", async () => {
    state.readLatest.mockResolvedValue({
      ...baseContext,
      subtaskBudgets: [{ ...baseRow, capId: "cap-changed" }],
    });
    render(<WorkBudgetCard task={task} canManage />);
    fireEvent.click(screen.getByRole("button", { name: "Adjust budget" }));
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Adjust print budget" } });
    fireEvent.click(screen.getByRole("button", { name: "Save budget" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("changed before your update");
    expect(state.setCap).not.toHaveBeenCalled();
  });

  it("requires a subtask budget cap before requesting cash when distribution is active", () => {
    state.actor = "worker-1";
    state.context = {
      ...baseContext,
      subtaskId: "sub-1",
      canManageDistribution: false,
      cap: undefined,
      subtaskBudgets: [{ ...baseRow, capId: undefined, sourceId: undefined, amount: 0, returnable: 0, hasHistory: false }],
    };

    const view = render(<WorkBudgetCard task={task} subtask={subtask} />);
    expect(screen.queryByRole("button", { name: "Request cash" })).toBeNull();
    expect(screen.getByText("Ask the task lead to allocate a budget to this subtask before requesting cash.")).toBeTruthy();

    state.context = {
      ...state.context,
      available: 5000,
      cap: { id: "cap-1", amount: 5000, available: 5000, allocationLineId: "supplies", reason: "Printing" },
      lines: [{ id: "supplies", expenseClass: "MOOE", category: "Supplies", particular: "Printing", fundSource: "General", amount: 5000, available: 5000 }],
    };
    view.rerender(<WorkBudgetCard task={task} subtask={subtask} />);
    expect(screen.getByRole("button", { name: "Request cash" })).toBeTruthy();
  });
});
