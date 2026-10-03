import type { Employee } from "../../members";
import type { Project } from "../../projects";
import { parseDueDate, type Task } from "../../tasks";

export const displayStatus = (value?: string) => (value?.trim() || "—").replace(/_/g, " ");

export function employeeName(id: string | undefined, employees: Employee[], task?: Task): string {
  if (!id) return "Unassigned";
  const directoryName = employees.find((employee) => employee.id === id)?.name;
  if (directoryName) return directoryName;
  if (task?.assigneeId === id && task.assigneeName) return task.assigneeName;
  const teamIndex = task?.teamMemberIds?.indexOf(id) ?? -1;
  return teamIndex >= 0 ? task?.teamMemberNames?.[teamIndex] || "Team member" : "Unknown user";
}

export function taskProject(task: Task, projects: Project[]) {
  const project = projects.find((candidate) => candidate.id === task.linkedProjectId);
  return { id: project?.id || task.linkedProjectId, title: project?.title || task.projectTitle || "Unlinked work" };
}

export function taskDue(task: Task): number | undefined {
  return parseDueDate(task) ?? undefined;
}
