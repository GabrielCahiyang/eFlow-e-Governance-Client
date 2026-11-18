import type { Task } from "../taskTypes";
import { isActive, parseDueDate } from "./lifecycle";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const MANILA = 8 * HOUR;
export type WorkloadLevel = "light" | "moderate" | "high" | "very_high" | "unknown";
export interface DeadlineWorkload {
  level: WorkloadLevel; label: string; pressurePercent: number; signal: number;
  activeTasks:number; missingDeadlines: number; overdue: number; explanation: string;
}

/** Weekday office capacity: 08:00-12:00 and 13:00-17:00, Asia/Manila. */
export function workingHoursBetween(start: number, end: number): number {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  let hours = 0;
  const firstDay = Math.floor((start + MANILA) / DAY) * DAY - MANILA;
  for (let day = firstDay; day < end; day += DAY) {
    const weekday = new Date(day + MANILA).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    for (const [from, until] of [[8, 12], [13, 17]]) {
      hours += Math.max(0, Math.min(end, day + until * HOUR) - Math.max(start, day + from * HOUR)) / HOUR;
    }
  }
  return hours;
}

export function workloadDeadline(task: Task): number | null {
  const raw = (/^\d{4}-\d{2}-\d{2}T/.test(task.deadline || "") ? task.deadline! : task.dueDate || task.deadline || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const value = Date.parse(`${raw}T23:59:59.999+08:00`);
    return Number.isFinite(value) ? value : null;
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    const value = Date.parse(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : `${raw}+08:00`);
    return Number.isFinite(value) ? value : null;
  }
  return parseDueDate(task);
}

export function calculateDeadlineWorkload(tasks: Task[], now = Date.now(), employeeId?: string): DeadlineWorkload {
  const active = tasks.filter(task => isActive(task)&&task.status!=='for_review'&&(!employeeId||task.assigneeId===employeeId||task.teamMemberIds?.includes(employeeId)));
  const items=active.map(task=>({due:workloadDeadline(task)}));
  const missingDeadlines = items.filter((item) => item.due === null).length;
  const overdue = items.filter((item) => item.due !== null && item.due < now).length;
  // Deadline risk remains factual. Without duration estimates, do not imply capacity.
  const level:WorkloadLevel=overdue?'very_high':active.length?'unknown':'light';
  const label=overdue?'Overdue work':active.length?'Active work':'No active work';
  return {level,label,pressurePercent:0,signal:overdue?100:active.length?55:0,activeTasks:active.length,missingDeadlines,overdue,
    explanation:`${active.length} active task(s), ${overdue} overdue, ${missingDeadlines} without a due date.`};
}
