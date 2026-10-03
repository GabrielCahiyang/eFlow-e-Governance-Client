import type { Employee } from "../../members";
import type { Project } from "../../projects";
import type { Task } from "../../tasks";
import { isOverdue, projectStats } from "../../tasks";
import { taskParticipantIds, type TeamWorkflowFacts } from "../../team-management";
import type { DepartmentReportRow } from "../types";
import { displayStatus, employeeName, taskDue, taskProject } from "./reportRowHelpers";

const DAY = 86_400_000;

export function buildProjectRows(projects: Project[], tasks: Task[], employees: Employee[], now: number): DepartmentReportRow[] {
  return projects.map((project) => {
    const stats = projectStats(project, tasks, now);
    return {
      id: `project:${project.id}`,
      kind: "projects",
      title: project.title,
      parent: project.description || "No description",
      project: project.title,
      projectId: project.id,
      person: employeeName(project.ownerId, employees),
      personId: project.ownerId,
      role: "Project owner",
      status: displayStatus(project.status),
      priority: project.priority,
      progress: stats.percentComplete,
      eventAt: project.updatedAt,
      dueAt: project.targetDate ? new Date(project.targetDate).getTime() : undefined,
      metric: `${stats.completed}/${stats.total} tasks complete`,
      detail: `${displayStatus(stats.health)} · ${stats.overdue} overdue · ${stats.active} active`,
    };
  });
}

export function buildContributionRows(tasks: Task[], projects: Project[], employees: Employee[], facts: TeamWorkflowFacts): DepartmentReportRow[] {
  const rows: DepartmentReportRow[] = [];
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  tasks.forEach((task) => {
    const linked = taskProject(task, projects);
    taskParticipantIds(task).forEach((personId) => rows.push({
      id: `task-contribution:${task.id}:${personId}`,
      kind: "contributions",
      title: task.title,
      parent: "Task contribution",
      project: linked.title,
      projectId: linked.id,
      person: employeeName(personId, employees, task),
      personId,
      role: personId === task.assigneeId ? "Team Lead" : "Task member",
      status: displayStatus(task.status),
      priority: task.priority || "medium",
      progress: task.percentComplete || 0,
      eventAt: task.lastActivityAt || task.updatedAt,
      dueAt: taskDue(task),
      metric: `${task.percentComplete || 0}% task progress`,
      detail: personId === task.assigneeId ? "Accountable for task delivery" : "Participating team member",
      taskId: task.id,
    }));
  });
  facts.subtasks.forEach((subtask) => {
    const task = taskById.get(subtask.taskId);
    if (!task) return;
    const linked = taskProject(task, projects);
    subtask.assignedToIds.forEach((personId) => rows.push({
      id: `subtask-contribution:${subtask.id}:${personId}`,
      kind: "contributions",
      title: subtask.title,
      parent: task.title,
      project: linked.title,
      projectId: linked.id,
      person: employeeName(personId, employees, task),
      personId,
      role: "Subtask contributor",
      status: displayStatus(subtask.status),
      priority: task.priority || "medium",
      progress: subtask.percentComplete,
      eventAt: subtask.updatedAt,
      dueAt: taskDue(task),
      metric: `${subtask.percentComplete}% subtask progress`,
      detail: `Contribution under “${task.title}”`,
      taskId: task.id,
    }));
  });
  return rows;
}

export function buildOperationRows(tasks: Task[], projects: Project[], employees: Employee[], now: number): DepartmentReportRow[] {
  return tasks.filter((task) => !task.archivedAt).map((task) => {
    const linked = taskProject(task, projects);
    const due = taskDue(task);
    const days = due ? Math.ceil((due - now) / DAY) : undefined;
    return {
      id: `operation:${task.id}`,
      kind: "operations",
      title: task.title,
      parent: task.description || "No description",
      project: linked.title,
      projectId: linked.id,
      person: employeeName(task.assigneeId, employees, task),
      personId: task.assigneeId,
      role: "Team Lead",
      status: displayStatus(task.status),
      priority: task.priority || "medium",
      progress: task.percentComplete || 0,
      eventAt: task.lastActivityAt || task.updatedAt,
      dueAt: due,
      metric: due
        ? (isOverdue(task, now)
          ? `Overdue by ${Math.max(1, Math.abs(days || 0))}d`
          : days === 0 ? "Due today" : `${days}d remaining`)
        : "Schedule not measurable",
      detail: `${task.subtaskCompletedCount || 0}/${task.subtaskCount || 0} subtasks approved`,
      taskId: task.id,
    };
  });
}
