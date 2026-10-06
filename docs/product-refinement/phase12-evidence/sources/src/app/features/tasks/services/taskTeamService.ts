import { createNotification } from "../../../services/notificationService";
import type { UserProfile } from "../../../types";
import type { Subtask } from "../../../services/subtaskService";
import { getTaskTeamMemberIds, validateTaskTeamMembers } from "../selectors/teamMembership";
import type { Task } from "../taskTypes";
import { updateTask } from "./taskMutationService";

function existingNameMap(task: Task): Map<string, string> {
  const names = new Map<string, string>();
  (task.teamMemberIds || []).forEach((id, index) => names.set(id, task.teamMemberNames?.[index] || "Team Member"));
  if (task.assigneeId && task.assigneeName) names.set(task.assigneeId, task.assigneeName);
  if (task.recommendationLeadId && task.assigneeName) names.set(task.recommendationLeadId, task.assigneeName);
  return names;
}

export async function updateTaskTeamMembers({
  task,
  nextMemberIds,
  profiles,
  subtasks,
}: {
  task: Task;
  nextMemberIds: string[];
  profiles: UserProfile[];
  subtasks: Subtask[];
}): Promise<void> {
  const normalizedIds = Array.from(new Set(nextMemberIds.filter(Boolean)));
  validateTaskTeamMembers(task, normalizedIds, subtasks);

  const previousIds = getTaskTeamMemberIds(task);
  const profileNames = new Map(profiles.map((profile) => [profile.id, profile.full_name]));
  const fallbackNames = existingNameMap(task);
  const nextNames = normalizedIds.map((id) => profileNames.get(id) || fallbackNames.get(id) || "Team Member");
  await updateTask(task.id, { teamMemberIds: normalizedIds, teamMemberNames: nextNames });

  const previous = new Set(previousIds);
  const next = new Set(normalizedIds);
  const addedIds = normalizedIds.filter((id) => !previous.has(id));
  const removedIds = previousIds.filter((id) => !next.has(id));
  await Promise.allSettled([
    ...addedIds.map((userId) => createNotification(userId, {
      type: "assignment",
      title: "Added to task team",
      message: `You were added to “${task.title}”.`,
      taskId: task.id,
      taskTitle: task.title,
    })),
    ...removedIds.map((userId) => createNotification(userId, {
      type: "reassignment",
      title: "Task team updated",
      message: `You were removed from “${task.title}”.`,
      taskId: task.id,
      taskTitle: task.title,
    })),
  ]);
}
