import { calculateDeadlineWorkload, type DeadlineWorkload } from './deadlineWorkload';
import type { Milestone, Project } from '../../../services/projectService';
import type { Task } from '../../../services/taskService';
import { isActive, isArchived, isCompleted, isForReview, isOverdue, parseDueDate } from './lifecycle';
import { activeTasks, completedTasks, forReviewTasks, inProgressTasks, overdueTasks, tasksForProject, unassignedTasks } from './scope';

export type Health = 'on_track' | 'at_risk' | 'delayed' | 'complete' | 'no_data';

export function completionRate(tasks: Task[]): { completed: number; total: number; rate: number } {
  const active = tasks.filter((t) => !isArchived(t));
  const completed = active.filter(isCompleted).length;
  const total = active.length;
  return { completed, total, rate: total ? Math.round((completed / total) * 100) : 0 };
}

/** Completion rate limited to tasks touched within the last `days`. */
export function completionRateSince(
  tasks: Task[],
  days: number,
  now: number = Date.now(),
): { completed: number; total: number; rate: number } {
  const since = now - days * 86400000;
  const window = tasks.filter((t) => !isArchived(t) && t.updatedAt >= since);
  const completed = window.filter(isCompleted).length;
  const total = window.length;
  return { completed, total, rate: total ? Math.round((completed / total) * 100) : 0 };
}

export interface WorkloadRow {
  id: string;
  name: string;
  active: number;
  overdue: number;
  review: number;
  workload?: DeadlineWorkload;
}

/**
 * Keep existing active-task counts and attach task-duration/deadline pressure.
 */
export function workloadByEmployee(tasks: Task[], now: number = Date.now()): WorkloadRow[] {
  const map = new Map<string, WorkloadRow>();
  for (const t of tasks) {
    if (!t.assigneeId || !isActive(t)) continue;
    const row =
      map.get(t.assigneeId) ||
      { id: t.assigneeId, name: t.assigneeName || 'Unknown', active: 0, overdue: 0, review: 0 };
    row.active++;
    if (isOverdue(t, now)) row.overdue++;
    if (isForReview(t)) row.review++;
    map.set(t.assigneeId, row);
  }
  return Array.from(map.values()).map((row) => ({ ...row, workload: calculateDeadlineWorkload(tasks.filter((task) => task.assigneeId === row.id || task.teamMemberIds?.includes(row.id)), now, row.id) })).sort((a, b) => b.workload.pressurePercent - a.workload.pressurePercent);
}

/** Active tasks with a real due date at or before `now + days`, soonest first. */
export function upcomingDeadlines(tasks: Task[], days: number, now: number = Date.now()): Task[] {
  const until = now + days * 86400000;
  return tasks
    .filter((t) => {
      if (!isActive(t)) return false;
      const due = parseDueDate(t);
      return due !== null && due <= until;
    })
    .sort((a, b) => (parseDueDate(a) ?? 0) - (parseDueDate(b) ?? 0));
}

// ─── Project health & completion ─────────────────────────────────

export interface ProjectStats {
  total: number;
  completed: number;
  overdue: number;
  active: number;
  percentComplete: number; // 0..100, based on completed / total linked tasks
  health: Health;
}

/**
 * Project health derived from canonically linked tasks. A project with no
 * linked task returns `no_data` — it must say "No task data", never "healthy".
 * An explicitly completed/archived project reflects that status directly.
 */
export function projectStats(
  project: Pick<Project, 'id' | 'status'>,
  tasks: Task[],
  now: number = Date.now(),
): ProjectStats {
  const linked = tasksForProject(tasks, project.id);
  const total = linked.length;
  const completed = linked.filter(isCompleted).length;
  const overdue = linked.filter((t) => isOverdue(t, now)).length;
  const active = linked.filter(isActive).length;
  const percentComplete = total ? Math.round((completed / total) * 100) : 0;

  let health: Health;
  if (project.status === 'completed') {
    health = 'complete';
  } else if (total === 0) {
    health = 'no_data';
  } else if (completed === total) {
    health = 'complete';
  } else if (overdue > 0) {
    health = 'delayed';
  } else {
    const nearDue = linked.some((t) => {
      if (!isActive(t)) return false;
      const due = parseDueDate(t);
      if (due === null) return false;
      const inDays = (due - now) / 86400000;
      return inDays >= 0 && inDays <= 3;
    });
    health = nearDue ? 'at_risk' : 'on_track';
  }

  return { total, completed, overdue, active, percentComplete, health };
}

// ─── Milestone status (auto rollup) ──────────────────────────────
// Kept here so milestone progress uses the same task classification as
// everything else. Manual override wins when set.

export function milestoneAutoStatus(
  milestone: Pick<Milestone, 'manualStatus'>,
  tasks: Task[],
  now: number = Date.now(),
): { status: Exclude<Milestone['status'], 'auto'>; source: 'manual' | 'auto' } {
  if (milestone.manualStatus && milestone.manualStatus !== 'auto') {
    return { status: milestone.manualStatus, source: 'manual' };
  }
  const linked = tasks.filter((t) => !isArchived(t));
  if (linked.length === 0) return { status: 'not_started', source: 'auto' };
  const done = linked.filter(isCompleted).length;
  if (done === linked.length) return { status: 'completed', source: 'auto' };
  if (linked.some((t) => isOverdue(t, now))) return { status: 'at_risk', source: 'auto' };
  const started = linked.some((t) => t.status !== 'pending_assignment' && t.status !== 'todo');
  return { status: started ? 'in_progress' : 'not_started', source: 'auto' };
}

// ─── System-wide metric bundle (dashboards) ──────────────────────

export interface OperationalMetrics {
  activeProjects: number;
  activeTasks: number;
  unassignedTasks: number;
  inProgressTasks: number;
  pendingReview: number;
  completedTasks: number;
  overdueTasks: number;
  completionRate: number;
}

/**
 * One bundle every dashboard can render from. Caller passes tasks/projects
 * already scoped to what that viewer may see.
 */
export function operationalMetrics(
  tasks: Task[],
  projects: Project[],
  now: number = Date.now(),
): OperationalMetrics {
  const active = activeTasks(tasks);
  return {
    activeProjects: projects.filter((p) => p.status !== 'archived' && p.status !== 'completed').length,
    activeTasks: active.length,
    unassignedTasks: unassignedTasks(tasks).length,
    inProgressTasks: inProgressTasks(tasks).length,
    pendingReview: forReviewTasks(tasks).length,
    completedTasks: completedTasks(tasks).length,
    overdueTasks: overdueTasks(tasks, now).length,
    completionRate: completionRate(tasks).rate,
  };
}

// ─── Data-health integrity checks (plan §5) ──────────────────────
// Each row is an EXCEPTION the reconciliation/repair backlog cares about. All
// derived from the same live task/project data the dashboards use, so the panel
// can never disagree with the numbers shown elsewhere. Pure: caller passes
// already-scoped lists.
