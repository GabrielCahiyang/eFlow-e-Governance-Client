import type { Task } from "../taskTypes";
import { isActive, parseDueDate } from "./lifecycle";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const MANILA = 8 * HOUR;
export const HOURS_PER_TASK_DAY = 8;
export type WorkloadLevel = "light" | "moderate" | "high" | "very_high" | "unknown";
export interface DeadlineWorkload {
  level: WorkloadLevel; label: string; pressurePercent: number; signal: number;
  remainingHours: number; capacityHours: number; dueHours: number; limitingDeadline?: number;
  missingEstimates: number; missingDeadlines: number; overdue: number; explanation: string;
}

export function taskEstimateError(estimatedHours?: number) {
  return estimatedHours !== undefined && (!Number.isFinite(estimatedHours) || estimatedHours <= 0)
    ? "Estimated task days must be greater than zero." : undefined;
}

export function taskDurationHours(duration?: string, durationDays?: number): number | undefined {
  const match = duration?.trim().match(/^(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|days?|d|weeks?|w)$/i);
  if (match) {
    const amount = Number(match[1]);
    const hours = amount * (/^(day|d)/i.test(match[2]) ? 8 : /^(week|w)/i.test(match[2]) ? 40 : 1);
    return hours > 0 ? hours : undefined;
  }
  return durationDays && Number.isFinite(durationDays) && durationDays > 0 ? durationDays * 8 : undefined;
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
  const active = tasks.filter((task) => isActive(task) && task.status !== "for_review");
  const items = active.map((task) => {
    const members = Array.from(new Set([task.assigneeId, ...(task.teamMemberIds || [])].filter(Boolean)));
    const progress = Number.isFinite(task.percentComplete) ? Math.max(0, Math.min(100, task.percentComplete!)) : 0;
    const estimate = task.estimatedHours && Number.isFinite(task.estimatedHours) && task.estimatedHours > 0 ? task.estimatedHours : undefined;
    return { due: workloadDeadline(task), hours: estimate === undefined ? undefined : estimate * (1 - progress / 100) / (employeeId ? Math.max(1, members.length) : 1) };
  });
  const missingEstimates = items.filter((item) => item.hours === undefined).length;
  const missingDeadlines = items.filter((item) => item.due === null).length;
  const overdue = items.filter((item) => item.due !== null && item.due < now).length;
  let horizon = Math.floor((now + MANILA) / DAY) * DAY - MANILA;
  let days = 0;
  while (days < 5) {
    if (workingHoursBetween(Math.max(now, horizon), horizon + 17 * HOUR) > 0) days++;
    if (days < 5) horizon += DAY;
  }
  horizon += 17 * HOUR;
  const windows = [horizon, ...items.flatMap((item) => item.due === null ? [] : [item.due])];
  let pressurePercent = 0, dueHours = 0, capacityHours = workingHoursBetween(now, horizon), limitingDeadline = horizon;
  for (const deadline of windows) {
    const required = items.filter((item) => item.due !== null && item.due <= deadline).reduce((sum, item) => sum + (item.hours || 0), 0);
    const capacity = workingHoursBetween(now, deadline);
    const pressure = required > 0 ? capacity > 0 ? required / capacity * 100 : 200 : 0;
    if (pressure >= pressurePercent) { pressurePercent = pressure; dueHours = required; capacityHours = capacity; limitingDeadline = deadline; }
  }
  const incomplete = missingEstimates > 0 || missingDeadlines > 0;
  const level: WorkloadLevel = pressurePercent > 100 || overdue > 0 ? "very_high" : pressurePercent >= 85 ? "high" : incomplete ? "unknown" : pressurePercent >= 50 ? "moderate" : "light";
  const label = { light: "Light", moderate: "Moderate", high: "High", very_high: "Very high", unknown: "Estimate needed" }[level];
  // Preserve the established 0-100 AI input; the visible pressure may exceed 100%.
  const signal = level === "unknown" ? 55 : level === "very_high" ? Math.min(100, Math.max(85, Math.round(pressurePercent * .8))) : level === "high" ? Math.min(84, 80 + Math.round((pressurePercent - 85) / 15 * 4)) : level === "moderate" ? 55 + Math.round((pressurePercent - 50) / 35 * 24) : Math.round(pressurePercent / 50 * 54);
  const remainingHours = items.reduce((sum, item) => sum + (item.hours || 0), 0);
  const explanation = incomplete
    ? `${missingEstimates} task estimate(s) and ${missingDeadlines} deadline(s) need attention. ${dueHours.toFixed(1)} known work hours; ${capacityHours.toFixed(1)} working hours available before the busiest deadline.`
    : `${dueHours.toFixed(1)} work hours due; ${capacityHours.toFixed(1)} working hours available before the busiest deadline. Monday-Friday, 8 hours/day.`;
  return { level, label, pressurePercent: Math.round(pressurePercent), signal, remainingHours, dueHours, capacityHours, limitingDeadline, missingEstimates, missingDeadlines, overdue, explanation };
}
