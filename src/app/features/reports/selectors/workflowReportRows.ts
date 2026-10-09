import type { Employee } from "../../members";
import type { Project } from "../../projects";
import type { Task } from "../../tasks";
import type { TeamAttentionItem, TeamWorkflowFacts } from "../../team-management";
import type { DepartmentReportRow } from "../types";
import { displayStatus, employeeName, taskDue, taskProject } from "./reportRowHelpers";

function subtaskPath(subtask: TeamWorkflowFacts['subtasks'][number], all: Map<string,TeamWorkflowFacts['subtasks'][number]>):string {
 const parts=[subtask.title],seen=new Set([subtask.id]);let parent=subtask.parentSubtaskId;
 while(parent&&!seen.has(parent)){seen.add(parent);const item=all.get(parent);if(!item){parts.unshift('Unavailable ancestor');break;}parts.unshift(item.title);parent=item.parentSubtaskId;}return parts.join(' / ');
}
type WorkflowContext = {
  tasks: Task[];
  projects: Project[];
  employees: Employee[];
  facts: TeamWorkflowFacts;
  now: number;
};

export function buildReviewRows(context: WorkflowContext): DepartmentReportRow[] {
  const { tasks, projects, employees, facts, now } = context;
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const subtaskById = new Map(facts.subtasks.map((subtask) => [subtask.id, subtask]));
  return facts.submissions.map((submission) => {
    const task = taskById.get(submission.taskId);
    const subtask = submission.subtaskId ? subtaskById.get(submission.subtaskId) : undefined;
    const linked = task ? taskProject(task, projects) : { title: "Unknown project", id: undefined };
    const reviewHours = Math.round((((submission.decidedAt || now) - submission.submittedAt) / 3_600_000) * 10) / 10;
    return {
      id: `review:${submission.id}`,
      kind: "reviews",
      title: (subtask?subtaskPath(subtask,subtaskById):undefined) || task?.title || "Unknown work item",
      parent: subtask ? task?.title || "Unknown task" : "Task submission",
      project: linked.title,
      projectId: linked.id,
      person: submission.submitterName || employeeName(submission.submitterId, employees, task),
      personId: submission.submitterId,
      role: submission.kind === "subtask" ? "Subtask submitter" : "Task submitter",
      status: displayStatus(submission.status),
      priority: task?.priority || "medium",
      eventAt: submission.submittedAt,
      dueAt: task ? taskDue(task) : undefined,
      metric: `Attempt ${submission.version} · ${reviewHours}h ${submission.decidedAt ? "to decision" : "waiting"}`,
      detail: submission.feedback || (submission.status === "pending" ? "Awaiting reviewer decision" : "No decision feedback recorded"),
      taskId: task?.id,
    };
  });
}

export function buildEvidenceRows(context: WorkflowContext): DepartmentReportRow[] {
  const { tasks, projects, facts } = context;
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const subtaskById = new Map(facts.subtasks.map((subtask) => [subtask.id, subtask]));
  const submissionById = new Map(facts.submissions.map((submission) => [submission.id, submission]));
  return facts.evidence.map((evidence) => {
    const task = taskById.get(evidence.taskId);
    const submission = evidence.submissionId ? submissionById.get(evidence.submissionId) : undefined;
    const subtask = submission?.subtaskId ? subtaskById.get(submission.subtaskId) : undefined;
    const linked = task ? taskProject(task, projects) : { title: "Unknown project", id: undefined };
    return {
      id: `evidence:${evidence.id}`,
      kind: "evidence",
      title: evidence.fileName,
      parent: (subtask?subtaskPath(subtask,subtaskById):undefined) || task?.title || "Unknown work item",
      project: linked.title,
      projectId: linked.id,
      person: submission?.submitterName || "Uploader",
      personId: submission?.submitterId,
      role: evidence.kind === "subtask" ? "Subtask evidence" : "Task evidence",
      status: displayStatus(submission?.status || "attached"),
      priority: task?.priority || "medium",
      eventAt: evidence.createdAt,
      dueAt: task ? taskDue(task) : undefined,
      metric: evidence.fileSize ? `${Math.max(1, Math.round(evidence.fileSize / 1024))} KB` : "File attached",
      detail: evidence.mimeType || "Unknown file type",
      taskId: task?.id,
    };
  });
}

export function buildRiskRows(context: WorkflowContext, attention: TeamAttentionItem[]): DepartmentReportRow[] {
  const { tasks, projects, employees } = context;
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const subtaskById = new Map(context.facts.subtasks.map((subtask) => [subtask.id, subtask]));
  return attention.map((item) => {
    const task = taskById.get(item.taskId);
    const linked = task ? taskProject(task, projects) : { title: "Unknown project", id: undefined };
    return {
      id: `risk:${item.id}`,
      kind: "risks",
      title: item.title,
      parent: item.subtaskId ? subtaskById.get(item.subtaskId)?.title || item.taskTitle : item.taskTitle,
      project: linked.title,
      projectId: linked.id,
      person: item.employeeIds.map((id) => employeeName(id, employees, task)).join(", ") || "Unassigned",
      personId: item.employeeIds.length === 1 ? item.employeeIds[0] : undefined,
      role: item.subtaskId ? "Subtask risk" : "Task risk",
      status: displayStatus(item.kind),
      priority: item.severity,
      eventAt: item.occurredAt || task?.updatedAt,
      dueAt: task ? taskDue(task) : undefined,
      metric: item.severity,
      detail: item.detail,
      taskId: item.taskId,
    };
  });
}

export function buildLifecycleRows(context: WorkflowContext): DepartmentReportRow[] {
  const { tasks, projects, employees, facts } = context;
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  return facts.statusHistory.map((event) => {
    const task = taskById.get(event.taskId);
    const linked = task ? taskProject(task, projects) : { title: "Unknown project", id: undefined };
    const transition = `${displayStatus(event.fromStatus || "created")} → ${displayStatus(event.toStatus)}`;
    return {
      id: `lifecycle:${event.id}`,
      kind: "lifecycle",
      title: task?.title || "Unknown task",
      parent: transition,
      project: linked.title,
      projectId: linked.id,
      person: event.actorName || employeeName(event.actorId, employees, task),
      personId: event.actorId,
      role: "Status actor",
      status: displayStatus(event.toStatus),
      priority: task?.priority || "medium",
      eventAt: event.createdAt,
      dueAt: task ? taskDue(task) : undefined,
      metric: transition,
      detail: event.note || "No transition note recorded",
      taskId: task?.id,
    };
  });
}

