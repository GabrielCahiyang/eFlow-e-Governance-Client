import type { Task } from "../../tasks";
import { isActive, isOverdue, parseDueDate } from "../../tasks";
import type { TeamAttentionItem, TeamWorkflowFacts, WorkflowSubmissionFact } from "../types";
import { DAY, hasBlocker, latestProgressByWorkItem, taskParticipantIds } from "./analyticsHelpers";

export function buildTeamAttentionItems(tasks: Task[], facts: TeamWorkflowFacts, now: number = Date.now()): TeamAttentionItem[] {
  const items: TeamAttentionItem[] = [];
  const latestProgress = latestProgressByWorkItem(facts.progress);
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const latestPendingTaskSubmission = new Map<string, WorkflowSubmissionFact>();
  facts.submissions.filter((submission) => submission.kind === "task" && submission.status === "pending").forEach((submission) => {
    if (!latestPendingTaskSubmission.has(submission.taskId)) latestPendingTaskSubmission.set(submission.taskId, submission);
  });

  tasks.forEach((task) => {
    if (!isActive(task) && task.status !== "for_review") return;
    const employeeIds = taskParticipantIds(task);
    const due = parseDueDate(task);
    const latest = latestProgress.get(`task:${task.id}`);
    const lastActivity = latest?.createdAt || task.lastActivityAt || task.updatedAt;
    const base = { taskId: task.id, taskTitle: task.title, employeeIds };
    if (!task.assigneeId) items.push({ ...base, id: `unassigned:${task.id}`, kind: "unassigned", severity: "warning", title: "Task needs a lead", detail: `“${task.title}” has no assigned lead.` });
    if (due) {
      const today = new Date(now);
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      const days = Math.round((due - todayStart) / DAY);
      if (isOverdue(task, now)) {
        const lateDays = Math.max(1, Math.abs(days));
        items.push({ ...base, id: `overdue:${task.id}`, kind: "overdue", severity: "critical", title: "Task is overdue", detail: `“${task.title}” is ${lateDays} day(s) late.`, occurredAt: due });
      } else if (days >= 0 && days <= 7) {
        items.push({
          ...base,
          id: `due:${task.id}`,
          kind: "due_soon",
          severity: days <= 2 ? "critical" : "warning",
          title: days === 0 ? "Due today" : "Deadline approaching",
          detail: days === 0
            ? `“${task.title}” is due today.`
            : `“${task.title}” is due in ${days} day(s).`,
          occurredAt: due,
        });
      }
    } else {
      items.push({ ...base, id: `vague:${task.id}`, kind: "vague_schedule", severity: "info", title: "Schedule cannot be measured", detail: `“${task.title}” uses a relative or missing deadline.` });
    }
    if (hasBlocker(latest)) items.push({ ...base, id: `blocked:${task.id}`, kind: "blocked", severity: "critical", title: "Blocker reported", detail: latest?.blocker || "A blocker needs attention.", occurredAt: latest?.createdAt });
    if (task.status === "changes_requested") items.push({ ...base, id: `changes:${task.id}`, kind: "changes_requested", severity: "warning", title: "Updates needed", detail: task.rejectionNote || task.feedback || `“${task.title}” requires revision.`, occurredAt: task.rejectedAt });
    if (task.status === "for_review") {
      const pending = latestPendingTaskSubmission.get(task.id);
      const age = pending ? now - pending.submittedAt : 0;
      if (!pending || age >= DAY) items.push({ ...base, id: `review:${task.id}`, kind: "awaiting_review", severity: age >= 3 * DAY ? "critical" : "warning", title: "Task review waiting", detail: `“${task.title}” has been waiting ${pending ? `${Math.max(1, Math.floor(age / DAY))} day(s)` : "for a decision"}.`, occurredAt: pending?.submittedAt });
    }
    if ((task.status === "in_progress" || task.status === "todo") && lastActivity < now - 3 * DAY) items.push({ ...base, id: `stalled:${task.id}`, kind: "stalled", severity: "warning", title: "Task appears stalled", detail: `No recorded activity on “${task.title}” for ${Math.floor((now - lastActivity) / DAY)} day(s).`, occurredAt: lastActivity });
  });

  facts.subtasks.forEach((subtask) => {
    if (subtask.status === "completed") return;
    const task = taskById.get(subtask.taskId);
    if (!task || !isActive(task)) return;
    const base = { taskId: task.id, taskTitle: task.title, subtaskId: subtask.id, employeeIds: subtask.assignedToIds };
    const latest = latestProgress.get(`subtask:${subtask.id}`);
    if (hasBlocker(latest)) items.push({ ...base, id: `subtask-blocked:${subtask.id}`, kind: "blocked", severity: "critical", title: "Subtask blocker reported", detail: `“${subtask.title}”: ${latest?.blocker}`, occurredAt: latest?.createdAt });
    if (subtask.status === "changes_requested") items.push({ ...base, id: `subtask-changes:${subtask.id}`, kind: "changes_requested", severity: "warning", title: "Subtask needs revision", detail: `“${subtask.title}” was returned by its Team Lead.`, occurredAt: subtask.updatedAt });
    if (subtask.status === "for_review") {
      const pending = facts.submissions.find((submission) => submission.kind === "subtask" && submission.subtaskId === subtask.id && submission.status === "pending");
      const age = pending ? now - pending.submittedAt : 0;
      if (!pending || age >= DAY) items.push({ ...base, id: `subtask-review:${subtask.id}`, kind: "awaiting_review", severity: age >= 3 * DAY ? "critical" : "warning", title: "Subtask review waiting", detail: `“${subtask.title}” is waiting for Team Lead approval.`, occurredAt: pending?.submittedAt });
    }
    const lastActivity = latest?.createdAt || subtask.updatedAt;
    if ((subtask.status === "in_progress" || subtask.status === "todo") && lastActivity < now - 3 * DAY) items.push({ ...base, id: `subtask-stalled:${subtask.id}`, kind: "stalled", severity: "warning", title: "Subtask appears stalled", detail: `No update on “${subtask.title}” for ${Math.floor((now - lastActivity) / DAY)} day(s).`, occurredAt: lastActivity });
  });
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  return items.sort((first, second) => severityOrder[first.severity] - severityOrder[second.severity] || (first.occurredAt || 0) - (second.occurredAt || 0));
}

