import type { Task } from "../../tasks";

/** Match the server's open-work boundary before offering funding authority. */
export function isOpenDirectFundingWork(task: Task): boolean {
  return task.archivedAt == null && !task.proposedOfficeIdentityId &&
    !["completed", "cancelled"].includes(task.status);
}
