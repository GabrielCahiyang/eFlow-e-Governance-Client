import type { DepartmentBudgetBundle } from "../../budget";
import { getAllocationCashPosition } from "../../budget";
import {buildWorkRecordDisplayMetadata} from '../../nested-work';
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
  const metadata=buildWorkRecordDisplayMetadata(tasks,subtasks);
  const subtaskById=new Map(subtasks.map(item=>[item.id,item]));
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

    for (const context of metadata.values()) {
      if(context.rootId!==task.id)continue;
      const subtask=subtaskById.get(context.nodeId)!;
      const cap = financial.allocations.find(
        (item) => item.subtaskId === subtask.id && item.status === "approved",
      );
      const requests = financial.requests.filter(
        (item) => item.subtaskId === subtask.id,
      );
      const position = getAllocationCashPosition(cap?.amount || 0, requests);
      rows.push({
        id: subtask.id,
        parentTaskId: task.id,
        level: "subtask",
        workItem: context.pathLabel,
        accountability: `Lead: ${context.leadName || "Needs reassignment"} · Contributors (${context.contributors.length}): ${context.contributors.map(person=>person.name).join(', ') || "No contributors"}`,
        status: subtask.status,
        progress:
          subtask.status === "completed" ? 100 : subtask.percentComplete,
        deadline: subtask.dueDate || "",
        schedule: scheduleState(
          subtask.dueDate,
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
