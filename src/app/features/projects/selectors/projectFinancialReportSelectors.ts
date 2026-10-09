import type { DepartmentBudgetBundle } from "../../budget";
import { getAllocationCashPosition } from "../../budget";
import type { Subtask } from "../../subtasks";
import type { Task } from "../../tasks";
import type { TeamWorkflowFacts } from "../../team-management";

export interface ProjectExecutionFinancialRow {
  id: string;
  level: "task" | "subtask";
  parentTaskId?: string;
  workItem: string;
  accountability: string;
  status: string;
  progress: number;
  deadline: string;
  schedule: "completed" | "overdue" | "due_soon" | "scheduled" | "unscheduled";
  budgetMode: "task" | "cap" | "shared";
  budgetAmount: number;
  reservedAmount: number;
  spentAmount: number;
  returnedAmount: number;
  availableAmount: number;
  receiptCount: number;
  evidenceCount: number;
}

export function buildProjectExecutionFinancialRows(
  tasks: Task[],
  subtasks: Subtask[],
  financial: DepartmentBudgetBundle,
  facts?: TeamWorkflowFacts,
): ProjectExecutionFinancialRow[] {
  const rows: ProjectExecutionFinancialRow[] = [];
  for (const task of tasks) {
    const taskAllocation = financial.allocations.find(
      (item) =>
        item.taskId === task.id &&
        !item.subtaskId &&
        item.status === "approved",
    );
    const taskRequests = financial.requests.filter(
      (item) => item.taskId === task.id,
    );
    const taskPosition = getAllocationCashPosition(
      taskAllocation?.amount || 0,
      taskRequests,
    );
    rows.push({
      id: task.id,
      level: "task",
      workItem: task.title,
      accountability: task.assigneeName || "Unassigned Task Leader",
      status: task.status,
      progress: task.status === "completed" ? 100 : task.percentComplete || 0,
      deadline: task.deadline || task.dueDate || "",
      schedule: scheduleState(
        task.deadline || task.dueDate,
        task.status === "completed",
      ),
      budgetMode: "task",
      budgetAmount: taskAllocation?.amount || 0,
      reservedAmount: taskPosition.reserved,
      spentAmount: taskPosition.spent,
      returnedAmount: taskRequests.reduce(
        (sum, request) => sum + (request.returnedAmount || 0),
        0,
      ),
      availableAmount: taskPosition.remaining,
      receiptCount: receiptCount(
        taskRequests.map((item) => item.id),
        financial,
      ),
      evidenceCount:
        facts?.evidence.filter(
          (item) => item.taskId === task.id && item.kind === "task",
        ).length || 0,
    });

    for (const subtask of orderedSubtasks(
      subtasks.filter((item) => item.taskId === task.id),
    )) {
      const cap = financial.allocations.find(
        (item) => item.subtaskId === subtask.id && item.status === "approved",
      );
      const requests = financial.requests.filter(
        (item) => item.subtaskId === subtask.id,
      );
      const position = getAllocationCashPosition(cap?.amount || 0, requests);
      const memberNames = subtask.assignedToIds
        .map((memberId) => {
          const index = task.teamMemberIds?.indexOf(memberId) ?? -1;
          return index >= 0 ? task.teamMemberNames?.[index] : undefined;
        })
        .filter((name): name is string => Boolean(name));
      rows.push({
        id: subtask.id,
        parentTaskId: task.id,
        level: "subtask",
        workItem: subtaskReportPath(subtask, subtasks),
        accountability: memberNames.join(", ") || "Assigned contributor",
        status: subtask.status,
        progress:
          subtask.status === "completed" ? 100 : subtask.percentComplete,
        deadline: subtask.dueDate || task.deadline || task.dueDate || "",
        schedule: scheduleState(
          subtask.dueDate || task.deadline || task.dueDate,
          subtask.status === "completed",
        ),
        budgetMode: cap ? "cap" : "shared",
        budgetAmount: cap?.amount || 0,
        reservedAmount: position.reserved,
        spentAmount: position.spent,
        returnedAmount: requests.reduce(
          (sum, request) => sum + (request.returnedAmount || 0),
          0,
        ),
        availableAmount: cap ? position.remaining : 0,
        receiptCount: receiptCount(
          requests.map((item) => item.id),
          financial,
        ),
        evidenceCount: subtaskEvidenceCount(subtask.id, facts),
      });
    }
  }
  return rows;
}

function subtaskEvidenceCount(subtaskId: string, facts?: TeamWorkflowFacts) {
  if (!facts) return 0;
  const submissionIds = new Set(
    facts.submissions
      .filter((item) => item.kind === "subtask" && item.subtaskId === subtaskId)
      .map((item) => item.id),
  );
  return facts.evidence.filter((item) =>
    Boolean(item.submissionId && submissionIds.has(item.submissionId)),
  ).length;
}

function receiptCount(requestIds: string[], data: DepartmentBudgetBundle) {
  const ids = new Set(requestIds);
  return data.liquidations
    .filter((item) => ids.has(item.requestId))
    .reduce((sum, item) => sum + item.receipts.length, 0);
}

function scheduleState(
  date: string | undefined,
  complete: boolean,
): ProjectExecutionFinancialRow["schedule"] {
  if (complete) return "completed";
  if (!date) return "unscheduled";
  const due = new Date(`${date.slice(0, 10)}T23:59:59`).getTime();
  const now = Date.now();
  if (due < now) return "overdue";
  if (due - now <= 3 * 86_400_000) return "due_soon";
  return "scheduled";
}

function subtaskReportPath(item: Subtask, subtasks: Subtask[]): string {
  const byId = new Map(subtasks.map((s) => [s.id, s])),
    seen = new Set([item.id]),
    parts = [item.title];
  let parent = item.parentSubtaskId;
  while (parent && !seen.has(parent)) {
    seen.add(parent);
    const ancestor = byId.get(parent);
    if (!ancestor) {
      parts.unshift("Unavailable ancestor");
      break;
    }
    parts.unshift(ancestor.title);
    parent = ancestor.parentSubtaskId;
  }
  return parts.join(" / ");
}
function orderedSubtasks(items: Subtask[]): Subtask[] {
  const result: Subtask[] = [],
    visited = new Set<string>(),
    ids = new Set(items.map((s) => s.id));
  const visit = (item: Subtask) => {
    if (visited.has(item.id)) return;
    visited.add(item.id);
    result.push(item);
    items
      .filter((s) => s.parentSubtaskId === item.id)
      .sort(order)
      .forEach(visit);
  };
  const order = (a: Subtask, b: Subtask) =>
    (a.siblingOrder ?? a.position) - (b.siblingOrder ?? b.position) ||
    a.id.localeCompare(b.id);
  items
    .filter((s) => !s.parentSubtaskId || !ids.has(s.parentSubtaskId))
    .sort(order)
    .forEach(visit);
  items.sort(order).forEach(visit);
  return result;
}
