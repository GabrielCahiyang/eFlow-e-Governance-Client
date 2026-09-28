import type { DepartmentBudgetBundle, PettyCashRequest } from "../../src/app/features/budget/types";

export function cashRequest(overrides: Partial<PettyCashRequest> = {}): PettyCashRequest {
  return {
    id: "request-1", requestNumber: 2, taskId: "task-1", taskTitle: "New Tasks",
    subtaskId: "subtask-1", subtaskTitle: "Order Food", fiscalBudgetId: "budget-1",
    commitmentId: "commitment-1", allocationId: "allocation-1", allocationLineId: "line-1", orgId: "org-1",
    fundingOrgId: "org-1", requesterOrgId: "org-1",
    requesterId: "employee-1", requesterName: "Crisostomo Ibarra", cashRecipientId: "employee-1",
    cashRecipientName: "Crisostomo Ibarra", taskLeaderId: "leader-1", taskLeaderName: "Gabriel Cahiyang",
    purpose: "Food down payment", requestedAmount: 10000, approvedAmount: 10000, releasedAmount: 10000,
    status: "pending_department_settlement", createdAt: 1, updatedAt: 1,
    ...overrides,
  };
}

export function cashData(requests = [cashRequest()]): Pick<DepartmentBudgetBundle, "requests" | "releases" | "liquidations" | "allocationLines"> {
  return {
    requests,
    releases: [],
    liquidations: [{
      id: "liquidation-2", requestId: "request-1", version: 2, declaredSpent: 8500,
      returnedAmount: 1500, note: "Food receipts", status: "pending_department_settlement",
      submittedBy: "employee-1", submittedAt: 2, receipts: [],
    }],
    allocationLines: [{
      id: "line-1", allocationId: "allocation-1", expenseClass: "Operating Expenses", category: "Food",
      particular: "Meals", fundSource: "Department Budget", amount: 15000, position: 0,
    }],
  };
}
