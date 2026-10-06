import type { Task } from "../taskTypes";

export interface TaskTeamSubtaskAssignment {
  title: string;
  status: string;
  isCompleted?: boolean;
  assignedToIds: string[];
}

export interface TaskTeamRemovalBlocker {
  memberId: string;
  reason: string;
  subtaskTitles: string[];
}

export function getTaskLeadId(task: Pick<Task, "recommendationLeadId" | "assigneeId">): string | undefined {
  // `assigned_to` is the live Task Lead chosen by the manager. The AI
  // recommendation is only a planning suggestion and may legitimately be
  // stale after an operational reassignment.
  return task.assigneeId || task.recommendationLeadId;
}

export function getTaskTeamMemberIds(task: Pick<Task, "recommendationLeadId" | "assigneeId" | "teamMemberIds">): string[] {
  return Array.from(new Set([
    getTaskLeadId(task),
    ...(task.teamMemberIds || []),
  ].filter((id): id is string => Boolean(id))));
}

export function getTaskTeamRemovalBlockers(
  task: Pick<Task, "recommendationLeadId" | "assigneeId" | "teamMemberIds">,
  subtasks: TaskTeamSubtaskAssignment[],
): Map<string, TaskTeamRemovalBlocker> {
  const blockers = new Map<string, TaskTeamRemovalBlocker>();
  const leadId = getTaskLeadId(task);
  if (leadId) {
    blockers.set(leadId, {
      memberId: leadId,
      reason: "The Task Lead must remain assigned. Change the Task Lead from the task editor first.",
      subtaskTitles: [],
    });
  }

  getTaskTeamMemberIds(task).forEach((memberId) => {
    const activeSubtasks = subtasks.filter((subtask) =>
      !subtask.isCompleted
      && subtask.status !== "completed"
      && subtask.assignedToIds.includes(memberId));
    if (!activeSubtasks.length) return;
    blockers.set(memberId, {
      memberId,
      reason: `This member still owns ${activeSubtasks.length} unfinished subtask${activeSubtasks.length === 1 ? "" : "s"}.`,
      subtaskTitles: activeSubtasks.map((subtask) => subtask.title),
    });
  });

  return blockers;
}

export function validateTaskTeamMembers(
  task: Pick<Task, "recommendationLeadId" | "assigneeId" | "teamMemberIds">,
  nextMemberIds: string[],
  subtasks: TaskTeamSubtaskAssignment[],
): void {
  const nextIds = new Set(nextMemberIds);
  const removedIds = getTaskTeamMemberIds(task).filter((memberId) => !nextIds.has(memberId));
  const blockers = getTaskTeamRemovalBlockers(task, subtasks);
  const blockedRemoval = removedIds.map((memberId) => blockers.get(memberId)).find(Boolean);
  if (blockedRemoval) {
    const work = blockedRemoval.subtaskTitles.length
      ? ` Active work: ${blockedRemoval.subtaskTitles.join(", ")}.`
      : "";
    throw new Error(`${blockedRemoval.reason}${work}`);
  }
}
