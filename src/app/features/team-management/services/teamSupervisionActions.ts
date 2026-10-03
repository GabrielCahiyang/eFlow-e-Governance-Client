import { createNotification } from "../../../services/notificationService";
import { assignTask, updateTask, type Task, type TaskAssignmentDetails } from "../../tasks";
import type { Employee } from "../../members";

export interface TaskReplacementPlan {
  mode: "lead" | "member";
  assigneeId: string;
  assigneeName: string;
  assignment: TaskAssignmentDetails;
}

export function buildTaskReplacementPlan(
  task: Task,
  outgoingEmployeeId: string,
  replacement: Pick<Employee, "id" | "name">,
): TaskReplacementPlan {
  const existingIds = task.teamMemberIds || (task.assigneeId ? [task.assigneeId] : []);
  const existingNames = task.teamMemberNames || existingIds.map((id) => id === task.assigneeId ? task.assigneeName || "Team Lead" : "Team Member");
  const nextIds = Array.from(new Set(existingIds.map((id) => id === outgoingEmployeeId ? replacement.id : id)));
  if (!nextIds.includes(replacement.id)) nextIds.push(replacement.id);
  const nameById = new Map(existingIds.map((id, index) => [id, existingNames[index] || "Team Member"]));
  nameById.set(replacement.id, replacement.name);
  const nextNames = nextIds.map((id) => nameById.get(id) || "Team Member");
  const replacingLead = task.assigneeId === outgoingEmployeeId;

  return {
    mode: replacingLead ? "lead" : "member",
    assigneeId: replacingLead ? replacement.id : task.assigneeId || replacement.id,
    assigneeName: replacingLead ? replacement.name : task.assigneeName || replacement.name,
    assignment: {
      teamId: task.teamId,
      teamName: task.teamName,
      teamMemberIds: nextIds,
      teamMemberNames: nextNames,
    },
  };
}

export async function replaceEmployeeOnTask(
  task: Task,
  outgoingEmployeeId: string,
  replacement: Pick<Employee, "id" | "name">,
): Promise<"lead" | "member"> {
  const plan = buildTaskReplacementPlan(task, outgoingEmployeeId, replacement);
  if (plan.mode === "lead") {
    await assignTask(task.id, plan.assigneeId, plan.assigneeName, plan.assignment);
  } else {
    await updateTask(task.id, {
      teamMemberIds: plan.assignment.teamMemberIds,
      teamMemberNames: plan.assignment.teamMemberNames,
    });
    await createNotification(replacement.id, {
      type: "assignment",
      title: "Team assignment updated",
      message: `You were added to “${task.title}”.`,
      taskId: task.id,
      taskTitle: task.title,
    });
  }
  return plan.mode;
}
