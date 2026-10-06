import type { Task } from "../../../services/taskService";
import { getTaskLeadId } from "./teamMembership";

export function isTaskLead(
  task: Pick<Task, "assigneeId" | "recommendationLeadId" | "teamMemberIds">,
  userId: string | null | undefined,
): boolean {
  if (!userId) return false;
  return getTaskLeadId(task) === userId;
}
