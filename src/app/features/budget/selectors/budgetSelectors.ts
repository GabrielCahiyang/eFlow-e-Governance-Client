import type {
  BudgetLineInput,
  DepartmentBudgetBundle,
  DepartmentBudgetSummary,
  PettyCashRequest,
  ProposalBudgetExpenseGroup,
  ProposalBudgetDraft,
  ProposalTaskBudget,
  TaskBudgetDecision,
  WorkBudgetAllocation,
} from "../types";
import { moneyCents } from "./budgetSections";

export function getTaskScopedBudgetBundle(data: DepartmentBudgetBundle, taskIds: string[]): DepartmentBudgetBundle {
  const taskIdSet = new Set(taskIds);
  const allocations = data.allocations.filter((item) => taskIdSet.has(item.taskId));
  const allocationIds = new Set(allocations.map((item) => item.id));
  const requests = data.requests.filter((item) => taskIdSet.has(item.taskId));
  const requestIds = new Set(requests.map((item) => item.id));
  const liquidations = data.liquidations.filter((item) => requestIds.has(item.requestId));
  const commitmentIds = new Set([
    ...allocations.map((item) => item.commitmentId),
    ...requests.map((item) => item.commitmentId),
  ]);
  const fundedAmount = allocations.filter(a => !a.subtaskId && a.status === "approved")
    .reduce((sum,a) => sum + moneyCents(a.amount),0) / 100;
  const spentAmount = requests.filter(r => r.status === "settled").reduce((sum,r) => sum + moneyCents(r.actualSpent || 0),0) / 100;
  return {
    ...data,
    summary: data.summary ? { ...data.summary, approvedAmount: fundedAmount, committedAmount: fundedAmount,
      heldAmount: 0, budgetReleasedAmount: fundedAmount, spentAmount, availableAmount: getAllocationCashPosition(fundedAmount,requests).remaining, commitmentRemaining: fundedAmount - spentAmount,
      pettyCashSpent: spentAmount, pettyCashReserved: getAllocationCashPosition(fundedAmount,requests).reserved } : null,
    sections: undefined,
    lines: data.allocationLines.filter(l=>allocations.some(a=>a.id===l.allocationId&&!a.subtaskId&&a.status==="approved")).map(l=>({...l,fiscalBudgetId:data.summary?.id||""})),
    commitments: data.commitments.filter((item) => commitmentIds.has(item.id)),
    allocations,
    allocationLines: data.allocationLines.filter((item) => allocationIds.has(item.allocationId)),
    requests,
    requestAttachments: data.requestAttachments.filter((item) => requestIds.has(item.requestId)),
    releases: data.releases.filter((item) => requestIds.has(item.requestId)),
    liquidations,
    ledger: data.ledger.filter((item) => item.taskId ? taskIdSet.has(item.taskId) : requestIds.has(String(item.metadata?.requestId || ""))),
  };
}

export interface BudgetExpenseReportRow {
  id: string;
  requestNumber: number;
  proposal: string;
  task: string;
  subtask?: string;
  employee: string;
  purpose: string;
  expenseClasses: string[];
  categories: string[];
  actualAmount: number;
  returnedAmount: number;
  receiptCount: number;
  settledAt: number;
  monthKey: string;
}

export interface BudgetTaskMembership {
  id: string;
  recommendationLeadId?: string;
  assigneeId?: string;
  teamMemberIds?: string[];
}

export interface TaskBudgetSource {
  key: string;
  title: string;
  enabled?: boolean;
  budgetDecision?: TaskBudgetDecision;
  budgetNoCostReason?: string;
  budgetLines?: BudgetLineInput[];
}

export function getBudgetLineAmount(line: BudgetLineInput) {
  const quantity = Math.max(0, Number(line.quantity) || 0);
  const unitCost = Math.max(0, Number(line.unitCost) || 0);
  if (quantity > 0 && unitCost > 0) return quantity * unitCost;
  return Math.max(0, Number(line.amount) || 0);
}

export function normalizeTaskBudgetLines(taskKey: string, lines: BudgetLineInput[]) {
  return lines.map((line, position) => ({
    ...line,
    draftTaskKey: taskKey,
    amount: getBudgetLineAmount(line),
    position,
  }));
}

export function buildProposalBudgetFromTasks(
  tasks: TaskBudgetSource[],
  fiscalYear = new Date().getFullYear(),
): ProposalBudgetDraft {
  const taskBudgets: ProposalTaskBudget[] = tasks
    .filter((task) => task.enabled !== false)
    .map((task) => {
      const decision = task.budgetDecision || "missing";
      const lines = decision === "funded"
        ? normalizeTaskBudgetLines(task.key, task.budgetLines || [])
        : [];
      return {
        taskKey: task.key,
        taskTitle: task.title,
        decision,
        noCostReason: task.budgetNoCostReason,
        totalAmount: lines.reduce((sum, line) => sum + line.amount, 0),
        lines,
      };
    });
  const lines = taskBudgets.flatMap((task) => task.lines);
  return {
    fiscalYear,
    lines,
    taskBudgets,
    totalAmount: lines.reduce((sum, line) => sum + line.amount, 0),
  };
}

export function getProposalBudgetReadiness(tasks: TaskBudgetSource[]) {
  const enabled = tasks.filter((task) => task.enabled !== false);
  const missing = enabled.filter((task) => !task.budgetDecision || task.budgetDecision === "missing");
  const invalid = enabled.filter((task) => task.budgetDecision === "funded" && (
    !(task.budgetLines || []).length
    || (task.budgetLines || []).some((line) => !line.expenseClass.trim() || !line.category.trim() || !line.particular.trim() || getBudgetLineAmount(line) <= 0)
  ));
  return {
    ready: missing.length === 0 && invalid.length === 0,
    missingTaskKeys: missing.map((task) => task.key),
    invalidTaskKeys: invalid.map((task) => task.key),
    fundedCount: enabled.filter((task) => task.budgetDecision === "funded").length,
    noCostCount: enabled.filter((task) => task.budgetDecision === "no_cost").length,
  };
}

export function groupProposalBudgetLines(lines: BudgetLineInput[]): ProposalBudgetExpenseGroup[] {
  const expenseGroups = new Map<string, ProposalBudgetExpenseGroup>();

  for (const line of lines) {
    const expenseKey = line.expenseClass.trim().toLowerCase() || "__empty_expense_class__";
    let expenseGroup = expenseGroups.get(expenseKey);
    if (!expenseGroup) {
      expenseGroup = {
        id: line.id,
        expenseClass: line.expenseClass,
        amount: 0,
        categories: [],
      };
      expenseGroups.set(expenseKey, expenseGroup);
    }

    const categoryKey = line.category.trim().toLowerCase() || "__empty_category__";
    let categoryGroup = expenseGroup.categories.find(
      (category) => (category.category.trim().toLowerCase() || "__empty_category__") === categoryKey,
    );
    if (!categoryGroup) {
      categoryGroup = {
        id: line.id,
        category: line.category,
        fundSource: line.fundSource,
        amount: 0,
        particulars: [],
      };
      expenseGroup.categories.push(categoryGroup);
    }

    const amount = getBudgetLineAmount(line);
    categoryGroup.particulars.push(line);
    categoryGroup.amount += amount;
    expenseGroup.amount += amount;
  }

  return Array.from(expenseGroups.values());
}

export function getBudgetScheduleTotals(lines: BudgetLineInput[]) {
  const totals = new Map<string, Map<string, number>>();
  for (const line of lines) {
    const expenseClass = line.expenseClass.trim() || "Unclassified expenses";
    const category = line.category.trim() || "Uncategorized";
    const categoryTotals = totals.get(expenseClass) || new Map<string, number>();
    categoryTotals.set(
      category,
      (categoryTotals.get(category) || 0) + getBudgetLineAmount(line),
    );
    totals.set(expenseClass, categoryTotals);
  }
  return Array.from(totals, ([expenseClass, categoryTotals]) => ({
    expenseClass,
    amount: Array.from(categoryTotals.values()).reduce((sum, amount) => sum + amount, 0),
    categories: Array.from(categoryTotals, ([category, amount]) => ({ category, amount })),
  }));
}

const NON_RESERVING_REQUEST_STATES = new Set([
  "draft",
  "leader_changes_requested",
  "department_changes_requested",
  "rejected",
  "cancelled",
  "expired",
  "settled",
]);

export function getAllocationCashPosition(
  allocationAmount: number,
  requests: PettyCashRequest[],
) {
  const reserved = requests
    .filter((request) => !NON_RESERVING_REQUEST_STATES.has(request.status))
    .reduce((total, request) => total + (request.approvedAmount ?? request.requestedAmount), 0);
  const spent = requests
    .filter((request) => request.status === "settled")
    .reduce((total, request) => total + (request.actualSpent || 0), 0);

  return {
    reserved,
    spent,
    remaining: Math.max(0, allocationAmount - reserved - spent),
  };
}

/**
 * A task-level allocation may be used directly by its Task Leader or delegated
 * to subtasks, but never both for the same peso. This keeps the UI aligned with
 * the database guard that prevents double allocation.
 */
export function getTaskBudgetDistribution(
  taskAllocationAmount: number,
  taskLevelRequests: PettyCashRequest[],
  subtaskAllocations: WorkBudgetAllocation[],
) {
  const taskCash = getAllocationCashPosition(taskAllocationAmount, taskLevelRequests);
  const taskCashCommitted = taskLevelRequests
    .filter((request) => ![
      "draft",
      "rejected",
      "cancelled",
      "expired",
    ].includes(request.status))
    .reduce(
      (total, request) => total + (request.status === "settled"
        ? request.actualSpent || 0
        : request.approvedAmount || request.requestedAmount || 0),
      0,
    );
  const allocatedToSubtasks = subtaskAllocations
    .filter((allocation) => ["pending", "approved"].includes(allocation.status))
    .reduce((total, allocation) => total + allocation.amount, 0);

  return {
    taskCash,
    taskCashCommitted,
    allocatedToSubtasks,
    distributable: Math.max(0, taskAllocationAmount - taskCashCommitted - allocatedToSubtasks),
  };
}

export function getBudgetUtilizationSignal(
  summary: DepartmentBudgetSummary,
  monthIndex = new Date().getMonth(),
) {
  const utilization = summary.approvedAmount > 0
    ? (summary.spentAmount / summary.approvedAmount) * 100
    : 0;
  const isQ4 = monthIndex >= 9;

  return {
    utilization,
    isQ4,
    underTarget: isQ4 && utilization < summary.underutilizationThreshold,
  };
}

export function getEligiblePettyCashAllocations(
  allocations: WorkBudgetAllocation[],
  tasks: BudgetTaskMembership[],
  userId: string,
) {
  if (!userId) return [];
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  return allocations.filter((allocation) => {
    if (allocation.status !== "approved") return false;
    const task = taskById.get(allocation.taskId);
    if (!task) return false;
    const leaderId = task.assigneeId || task.recommendationLeadId;
    if (allocation.subtaskId) {
      return leaderId === userId || Boolean(allocation.subtaskAssigneeIds?.includes(userId));
    }
    return leaderId === userId;
  });
}

export function buildBudgetExpenseReportRows(data: DepartmentBudgetBundle): BudgetExpenseReportRow[] {
  const commitmentById = new Map(data.commitments.map((item) => [item.id, item]));
  const allocationById = new Map(data.allocations.map((item) => [item.id, item]));

  return data.requests
    .filter((request) => request.status === "settled")
    .map((request) => {
      const allocation = allocationById.get(request.allocationId);
      const latest = data.liquidations
        .filter((item) => item.requestId === request.id)
        .sort((a, b) => b.version - a.version)[0];
      const lines = request.allocationLineId
        ? data.allocationLines.filter((line) => line.id === request.allocationLineId)
        : data.allocationLines.filter((line) => line.allocationId === request.allocationId);
      const settledAt = Math.max(request.updatedAt, latest?.submittedAt || 0);
      return {
        id: request.id,
        requestNumber: request.requestNumber,
        proposal: commitmentById.get(request.commitmentId)?.title || "Funded proposal",
        task: request.taskTitle || "Assigned task",
        subtask: request.subtaskTitle || allocation?.subtaskTitle,
        employee: request.cashRecipientName || request.requesterName || "Assigned member",
        purpose: request.purpose,
        expenseClasses: Array.from(new Set(lines.map((line) => line.expenseClass).filter(Boolean))),
        categories: Array.from(new Set(lines.map((line) => line.category).filter(Boolean))),
        actualAmount: request.actualSpent ?? latest?.declaredSpent ?? 0,
        returnedAmount: request.returnedAmount ?? latest?.returnedAmount ?? 0,
        receiptCount: latest?.receipts.length || 0,
        settledAt,
        monthKey: new Date(settledAt).toISOString().slice(0, 7),
      };
    })
    .sort((a, b) => b.settledAt - a.settledAt);
}
