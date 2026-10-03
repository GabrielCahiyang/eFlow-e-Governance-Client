import type { Employee } from "../../members";
import type { Task } from "../../tasks";
import { parseDueDate } from "../../tasks";
import type { ContributionWorkflowFacts, ManilaMonthPeriod, MonthlyContributionRow } from "../types";

const MANILA_OFFSET = 8 * 60 * 60 * 1000;
const median = (values: number[]): number | null => { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; };
const rounded = (value: number, digits = 2) => Number(value.toFixed(digits));

export function getManilaMonthPeriod(date = new Date()): ManilaMonthPeriod {
  const shifted = new Date(date.getTime() + MANILA_OFFSET);
  const year = shifted.getUTCFullYear(); const month = shifted.getUTCMonth();
  const start = Date.UTC(year, month, 1) - MANILA_OFFSET; const end = Date.UTC(year, month + 1, 1) - MANILA_OFFSET;
  return { key: `${year}-${String(month + 1).padStart(2, "0")}`, label: new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "Asia/Manila" }).format(new Date(start)), start, end };
}

export function getRecentManilaMonthPeriods(count = 12, date = new Date()): ManilaMonthPeriod[] {
  const current = getManilaMonthPeriod(date);
  const [year, month] = current.key.split("-").map(Number);
  return Array.from({ length: Math.max(1, count) }, (_, index) =>
    getManilaMonthPeriod(new Date(Date.UTC(year, month - 1 - index, 15, 4))),
  );
}

export function buildMonthlyContributionLeaderboard(employees: Employee[], tasks: Task[], facts: ContributionWorkflowFacts, period = getManilaMonthPeriod()): MonthlyContributionRow[] {
  const tasksById = new Map(tasks.map((task) => [task.id, task])); const subtasksById = new Map(facts.subtasks.map((subtask) => [subtask.id, subtask]));
  const validApprovals = facts.submissions.filter((submission) => submission.status === "approved" && submission.decidedAt && submission.decidedAt >= period.start && submission.decidedAt < period.end && submission.reviewerId !== submission.submitterId).sort((a, b) => (b.decidedAt || 0) - (a.decidedAt || 0));
  const latest = new Map<string, typeof validApprovals[number]>(); validApprovals.forEach((submission) => { const key = `${submission.kind}:${submission.subtaskId || submission.taskId}`; if (!latest.has(key)) latest.set(key, submission); });

  const rows = employees.map((employee) => {
    const approvals = Array.from(latest.values()).filter((submission) => submission.submitterId === employee.id).filter((submission) => {
      const task = tasksById.get(submission.taskId); if (!task || task.status === "cancelled" || (task.reopenedAt && (submission.decidedAt || 0) <= task.reopenedAt)) return false;
      return submission.kind === "task" ? task.status === "completed" : subtasksById.get(submission.subtaskId || "")?.status === "completed";
    });
    const taskApprovals = approvals.filter((item) => item.kind === "task"); const subtaskApprovals = approvals.filter((item) => item.kind === "subtask");
    const onTime = approvals.filter((item) => { const task = tasksById.get(item.taskId); const due = task ? parseDueDate(task) : undefined; return due && item.decidedAt && item.decidedAt <= due + 86_399_999; }).length;
    const firstPass = approvals.filter((item) => item.version === 1).length;
    const cycleHours = approvals.map((item) => { const task = tasksById.get(item.taskId); const createdAt = item.kind === "subtask" ? subtasksById.get(item.subtaskId || "")?.createdAt : task?.createdAt; return createdAt && item.decidedAt ? (item.decidedAt - createdAt) / 3_600_000 : undefined; }).filter((value): value is number => typeof value === "number" && value >= 0);
    const delivery = taskApprovals.reduce((score, approval) => { const task = tasksById.get(approval.taskId); if (!task) return score; const priority = task.priority === "high" ? 2 : task.priority === "medium" ? 1.5 : 1; const effort = Math.min(3, Math.max(.75, (task.estimatedHours || 8) / 8)); return score + priority * effort * 10; }, 0);
    const quality = approvals.length ? (onTime / approvals.length) * 10 + (firstPass / approvals.length) * 10 : 0;
    const speedEligible = taskApprovals.map((approval) => { const task = tasksById.get(approval.taskId); if (!task?.estimatedHours || !approval.decidedAt) return null; return (approval.decidedAt - task.createdAt) / 3_600_000 <= task.estimatedHours * 2; }).filter((value): value is boolean => value !== null);
    const speed = speedEligible.length ? Math.min(10, speedEligible.filter(Boolean).length / speedEligible.length * 10) : 0;
    const collaboration = Math.min(30, subtaskApprovals.length * 3);
    return { rank: 0, userId: employee.id, employeeName: employee.name, departmentName: employee.departmentName, approvedTasks: taskApprovals.length, approvedSubtasks: subtaskApprovals.length, onTimeRate: approvals.length ? rounded(onTime / approvals.length * 100) : null, medianCycleHours: median(cycleHours) === null ? null : rounded(median(cycleHours)!), firstPassApprovalRate: approvals.length ? rounded(firstPass / approvals.length * 100) : null, contributionScore: rounded(delivery + quality + speed + collaboration), breakdown: { delivery: rounded(delivery), quality: rounded(quality), speed: rounded(speed), collaboration: rounded(collaboration) }, source: "live" as const };
  }).filter((row) => row.approvedTasks > 0 || row.approvedSubtasks > 0).sort((a, b) => b.contributionScore - a.contributionScore || b.approvedTasks - a.approvedTasks || a.employeeName.localeCompare(b.employeeName));
  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}
