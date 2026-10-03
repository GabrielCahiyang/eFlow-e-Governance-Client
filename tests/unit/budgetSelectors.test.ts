import { describe, expect, it } from "vitest";
import {
  buildBudgetExpenseReportRows,
  getAllocationCashPosition,
  getTaskBudgetDistribution,
  getBudgetScheduleTotals,
  groupProposalBudgetLines,
  getBudgetUtilizationSignal,
  getEligiblePettyCashAllocations,
  getTaskScopedBudgetBundle,
  type DepartmentBudgetSummary,
  type PettyCashRequest,
  type WorkBudgetAllocation,
} from "../../src/app/features/budget";

function request(
  status: PettyCashRequest["status"],
  approvedAmount: number,
  actualSpent?: number,
): PettyCashRequest {
  return {
    id: crypto.randomUUID(),
    requestNumber: 1,
    fiscalBudgetId: "budget-1",
    commitmentId: "commitment-1",
    allocationId: "allocation-1",
    orgId: "org-1",
    fundingOrgId: "org-1",
    requesterOrgId: "org-1",
    taskId: "task-1",
    requesterId: "user-1",
    purpose: "Operational expense",
    requestedAmount: approvedAmount,
    approvedAmount,
    actualSpent,
    status,
    createdAt: 1,
    updatedAt: 1,
  };
}

describe("budget selectors", () => {
  it("keeps multiple particulars inside their shared category", () => {
    expect(groupProposalBudgetLines([
      { id: "1", expenseClass: "Professional Services", category: "Honoraria", particular: "Lead consultant", amount: 325_000, fundSource: "Office Budget", position: 0 },
      { id: "2", expenseClass: "Professional Services", category: "Honoraria", particular: "Research assistants", amount: 120_000, fundSource: "Office Budget", position: 1 },
    ])).toMatchObject([{
      expenseClass: "Professional Services",
      amount: 445_000,
      categories: [{
        category: "Honoraria",
        amount: 445_000,
        particulars: [{ id: "1" }, { id: "2" }],
      }],
    }]);
  });

  it("calculates PDF-style subtotals by expense class and category", () => {
    expect(getBudgetScheduleTotals([
      { id: "1", expenseClass: "Professional Services", category: "Honoraria", particular: "Consultant", amount: 500, fundSource: "LEDIPO", position: 0 },
      { id: "2", expenseClass: "Other Expenses", category: "Meals", particular: "Workshop meals", amount: 300, fundSource: "LEDIPO", position: 1 },
      { id: "3", expenseClass: "Professional Services", category: "Honoraria", particular: "Facilitator", amount: 250, fundSource: "LEDIPO", position: 2 },
      { id: "4", expenseClass: "Professional Services", category: "Documentation", particular: "Writer", amount: 125, fundSource: "LEDIPO", position: 3 },
    ])).toEqual([
      {
        expenseClass: "Professional Services",
        amount: 875,
        categories: [
          { category: "Honoraria", amount: 750 },
          { category: "Documentation", amount: 125 },
        ],
      },
      {
        expenseClass: "Other Expenses",
        amount: 300,
        categories: [{ category: "Meals", amount: 300 }],
      },
    ]);
  });

  it("keeps reserved cash and verified spending separate", () => {
    expect(getAllocationCashPosition(10_000, [
      request("approved", 2_000),
      request("liquidation_submitted", 1_000),
      request("settled", 3_000, 2_500),
      request("rejected", 900),
    ])).toEqual({
      reserved: 3_000,
      spent: 2_500,
      remaining: 4_500,
    });
  });

  it("holds funds at approval boundaries but releases the hold while corrections are requested", () => {
    expect(getAllocationCashPosition(5_000, [
      request("pending_leader_review", 1_200),
      request("pending_department_approval", 800),
      request("department_changes_requested", 500),
      request("expired", 900),
    ])).toEqual({
      reserved: 2_000,
      spent: 0,
      remaining: 3_000,
    });
  });

  it("does not expose parent-task cash twice after it is delegated or reserved", () => {
    const taskCash = request("approved", 1_000);
    const distribution = getTaskBudgetDistribution(
      1_000,
      [taskCash],
      [{ id: "subtask", taskId: "task-1", subtaskId: "sub-1", amount: 0, status: "approved" } as WorkBudgetAllocation],
    );

    expect(distribution).toMatchObject({
      taskCashCommitted: 1_000,
      allocatedToSubtasks: 0,
      distributable: 0,
    });
  });

  it("only raises the underutilization warning during Q4", () => {
    const summary = {
      approvedAmount: 100_000,
      spentAmount: 60_000,
      underutilizationThreshold: 75,
    } as DepartmentBudgetSummary;

    expect(getBudgetUtilizationSignal(summary, 8)).toMatchObject({
      utilization: 60,
      isQ4: false,
      underTarget: false,
    });
    expect(getBudgetUtilizationSignal(summary, 9)).toMatchObject({
      utilization: 60,
      isQ4: true,
      underTarget: true,
    });
  });

  it("lets contributors request only from their assigned subtask allocation", () => {
    const allocations = [
      { id: "task", taskId: "task-1", status: "approved", subtaskAssigneeIds: [] },
      { id: "mine", taskId: "task-1", subtaskId: "sub-1", status: "approved", subtaskAssigneeIds: ["member"] },
      { id: "other", taskId: "task-1", subtaskId: "sub-2", status: "approved", subtaskAssigneeIds: ["other"] },
    ] as WorkBudgetAllocation[];
    const tasks = [{ id: "task-1", recommendationLeadId: "leader", teamMemberIds: ["member", "other"] }];

    expect(getEligiblePettyCashAllocations(allocations, tasks, "member").map((item) => item.id)).toEqual(["mine"]);
    expect(getEligiblePettyCashAllocations(allocations, tasks, "leader").map((item) => item.id)).toEqual(["task", "mine", "other"]);
  });

  it("reports only settled spending with its proposal and budget classification", () => {
    const settled = request("settled", 1_000, 850);
    settled.id = "request-1";
    settled.requestNumber = 7;
    settled.requesterName = "Member One";
    settled.taskTitle = "Prepare meeting";
    settled.subtaskTitle = "Buy materials";
    settled.returnedAmount = 150;
    settled.updatedAt = Date.UTC(2026, 7, 24);
    const pending = request("pending_department_approval", 500);
    expect(buildBudgetExpenseReportRows({
      summary: null, lines: [], adjustments: [], releases: [], ledger: [],
      commitments: [{ id: "commitment-1", fiscalBudgetId: "budget-1", proposalDraftId: "draft-1", title: "Annual Investment Plan", amount: 10_000, status: "active", createdAt: 1 }],
      allocations: [{ id: "allocation-1", commitmentId: "commitment-1", taskId: "task-1", amount: 10_000, status: "approved", reason: "Published", requestedBy: "head", requestedAt: 1 }],
      allocationLines: [{ id: "line-1", allocationId: "allocation-1", expenseClass: "Other Expenses", category: "Meeting supplies", particular: "Materials", amount: 10_000, fundSource: "Office Budget", position: 0 }],
      requests: [settled, pending],
      liquidations: [{ id: "liquidation-1", requestId: "request-1", version: 1, declaredSpent: 850, returnedAmount: 150, note: "Complete", status: "approved", submittedBy: "member", submittedAt: settled.updatedAt, receipts: [{ id: "receipt-1", liquidationId: "liquidation-1", vendor: "Vendor", receiptDate: "2026-08-24", description: "Materials", amount: 850, fileName: "receipt.pdf", filePath: "receipt.pdf", mimeType: "application/pdf", fileSize: 10 }] }],
    })).toMatchObject([{
      requestNumber: 7,
      proposal: "Annual Investment Plan",
      task: "Prepare meeting",
      subtask: "Buy materials",
      employee: "Member One",
      expenseClasses: ["Other Expenses"],
      categories: ["Meeting supplies"],
      actualAmount: 850,
      returnedAmount: 150,
      receiptCount: 1,
      monthKey: "2026-08",
    }]);
  });

  it("scopes every financial child record to project task ids", () => {
    const keep = request("approved", 500);
    keep.id = "request-keep";
    keep.taskId = "task-keep";
    keep.allocationId = "allocation-keep";
    keep.commitmentId = "commitment-keep";
    const drop = request("approved", 700);
    drop.id = "request-drop";
    drop.taskId = "task-drop";
    drop.allocationId = "allocation-drop";
    drop.commitmentId = "commitment-drop";
    const scoped = getTaskScopedBudgetBundle({
      summary: null,
      lines: [],
      adjustments: [],
      commitments: [
        { id: "commitment-keep", fiscalBudgetId: "budget-1", proposalDraftId: "proposal-1", title: "Keep", amount: 1_000, status: "active", createdAt: 1 },
        { id: "commitment-drop", fiscalBudgetId: "budget-1", proposalDraftId: "proposal-2", title: "Drop", amount: 1_000, status: "active", createdAt: 1 },
      ],
      allocations: [
        { id: "allocation-keep", commitmentId: "commitment-keep", taskId: "task-keep", amount: 1_000, status: "approved", reason: "", requestedBy: "head", requestedAt: 1 },
        { id: "allocation-drop", commitmentId: "commitment-drop", taskId: "task-drop", amount: 1_000, status: "approved", reason: "", requestedBy: "head", requestedAt: 1 },
      ],
      allocationLines: [
        { id: "line-keep", allocationId: "allocation-keep", expenseClass: "Supplies", category: "Office", particular: "Pens", amount: 1_000, fundSource: "General Fund", position: 0 },
        { id: "line-drop", allocationId: "allocation-drop", expenseClass: "Travel", category: "Local", particular: "Fare", amount: 1_000, fundSource: "General Fund", position: 0 },
      ],
      requests: [keep, drop],
      requestAttachments: [
        { id: "quote-keep", requestId: keep.id, fileName: "quote.pdf", filePath: "quote.pdf", mimeType: "application/pdf", fileSize: 1, createdAt: 1 },
        { id: "quote-drop", requestId: drop.id, fileName: "quote.pdf", filePath: "quote.pdf", mimeType: "application/pdf", fileSize: 1, createdAt: 1 },
      ],
      releases: [
        { id: "release-keep", requestId: keep.id, orgId: "org-1", scheduledDate: "2026-08-26", amount: 500, status: "scheduled", createdAt: 1 },
        { id: "release-drop", requestId: drop.id, orgId: "org-1", scheduledDate: "2026-08-26", amount: 700, status: "scheduled", createdAt: 1 },
      ],
      liquidations: [
        { id: "liquidation-keep", requestId: keep.id, version: 1, declaredSpent: 0, returnedAmount: 0, note: "", status: "pending", submittedBy: "user-1", submittedAt: 1, receipts: [] },
        { id: "liquidation-drop", requestId: drop.id, version: 1, declaredSpent: 0, returnedAmount: 0, note: "", status: "pending", submittedBy: "user-1", submittedAt: 1, receipts: [] },
      ],
      ledger: [
        { id: "ledger-keep", entryType: "request_created", amount: 500, description: "", taskId: "task-keep", createdAt: 1 },
        { id: "ledger-drop", entryType: "request_created", amount: 700, description: "", taskId: "task-drop", createdAt: 1 },
      ],
    }, ["task-keep"]);

    expect(scoped.allocations.map((item) => item.id)).toEqual(["allocation-keep"]);
    expect(scoped.requests.map((item) => item.id)).toEqual(["request-keep"]);
    expect(scoped.requestAttachments.map((item) => item.id)).toEqual(["quote-keep"]);
    expect(scoped.releases.map((item) => item.id)).toEqual(["release-keep"]);
    expect(scoped.liquidations.map((item) => item.id)).toEqual(["liquidation-keep"]);
    expect(scoped.ledger.map((item) => item.id)).toEqual(["ledger-keep"]);
  });
});
