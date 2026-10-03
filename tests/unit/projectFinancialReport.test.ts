import { describe, expect, it } from "vitest";
import type { DepartmentBudgetBundle } from "../../src/app/features/budget";
import { buildProjectExecutionFinancialRows } from "../../src/app/features/projects/selectors/projectFinancialReportSelectors";
import type { Subtask } from "../../src/app/features/subtasks";
import type { Task } from "../../src/app/features/tasks";
import type { TeamWorkflowFacts } from "../../src/app/features/team-management";

describe("project financial report hierarchy", () => {
  it("joins task and subtask accountability, funding mode, reservations, receipts, and evidence", () => {
    const tasks = [{
      id: "task-1", title: "Run workshop", status: "in_progress", assigneeId: "leader-1",
      assigneeName: "Task Leader", teamMemberIds: ["member-1"], teamMemberNames: ["Member One"],
      percentComplete: 40, createdAt: 1, updatedAt: 1,
    }] as Task[];
    const subtasks = [{
      id: "subtask-1", taskId: "task-1", title: "Buy materials", assignedToIds: ["member-1"],
      status: "in_progress", percentComplete: 25, position: 0, isCompleted: false, isStandalone: false,
      source: "manual", createdAt: 1, updatedAt: 1,
    }] as Subtask[];
    const financial = {
      summary: null, lines: [], commitments: [], adjustments: [], releases: [], ledger: [], requestAttachments: [],
      allocations: [
        { id: "task-allocation", commitmentId: "commitment-1", taskId: "task-1", amount: 10_000, status: "approved", reason: "", requestedBy: "head", requestedAt: 1 },
        { id: "cap", commitmentId: "commitment-1", taskId: "task-1", subtaskId: "subtask-1", amount: 3_000, status: "approved", reason: "", requestedBy: "leader-1", requestedAt: 1 },
      ],
      allocationLines: [],
      requests: [{
        id: "request-1", requestNumber: 1, fiscalBudgetId: "budget-1", commitmentId: "commitment-1",
        allocationId: "cap", orgId: "org-1", taskId: "task-1", subtaskId: "subtask-1", requesterId: "member-1",
        purpose: "Pens", requestedAmount: 1_000, status: "approved", createdAt: 1, updatedAt: 1,
      }],
      liquidations: [{
        id: "liquidation-1", requestId: "request-1", version: 1, declaredSpent: 0, returnedAmount: 0,
        note: "", status: "pending", submittedBy: "member-1", submittedAt: 1,
        receipts: [{ id: "receipt-1", liquidationId: "liquidation-1", vendor: "Store", receiptDate: "2026-08-26", description: "Pens", amount: 1_000, fileName: "receipt.pdf", filePath: "receipt.pdf", mimeType: "application/pdf", fileSize: 1 }],
      }],
    } as DepartmentBudgetBundle;
    const facts = {
      subtasks, progress: [], statusHistory: [],
      submissions: [{ id: "submission-1", kind: "subtask", taskId: "task-1", subtaskId: "subtask-1", version: 1, submitterId: "member-1", submitterName: "Member One", status: "pending", submittedAt: 1 }],
      evidence: [{ id: "evidence-1", kind: "subtask", taskId: "task-1", submissionId: "submission-1", fileName: "photo.jpg", filePath: "photo.jpg", fileSize: 1, mimeType: "image/jpeg", createdAt: 1 }],
    } as TeamWorkflowFacts;

    const rows = buildProjectExecutionFinancialRows(tasks, subtasks, financial, facts);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ level: "task", workItem: "Run workshop", accountability: "Task Leader", budgetAmount: 10_000, reservedAmount: 1_000 });
    expect(rows[1]).toMatchObject({ level: "subtask", workItem: "Buy materials", accountability: "Member One", budgetMode: "cap", budgetAmount: 3_000, reservedAmount: 1_000, availableAmount: 2_000, receiptCount: 1, evidenceCount: 1 });
  });
});
