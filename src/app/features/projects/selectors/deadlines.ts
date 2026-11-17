import type { Project } from "../services/types";
import { getDueSoonWindowDays } from "../../../shared/systemRuntimeConfig";

const DAY = 86_400_000;

export interface PortfolioDeadlineState {
  tone: "none" | "on_track" | "due_soon" | "overdue" | "completed";
  label: string;
  targetAt?: number;
}

export function latestProjectTarget(projects: readonly Project[]): string | undefined {
  return projects
    .map((project) => project.targetDate)
    .filter((value): value is string => Boolean(value && Number.isFinite(new Date(value).getTime())))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];
}

export function deriveProposalTargetDate<T extends { projects: Project[] }>(programs: readonly T[]): string | undefined {
  const finalProgram = programs[programs.length - 1];
  return latestProjectTarget(finalProgram?.projects || [])
    || latestProjectTarget(programs.flatMap((program) => program.projects));
}

export function getPortfolioDeadlineState(targetDate: string | undefined, completed: boolean, now = Date.now()): PortfolioDeadlineState {
  if (completed) return { tone: "completed", label: "Completed" };
  if (!targetDate) return { tone: "none", label: "No target date" };
  const targetAt = new Date(`${targetDate.slice(0, 10)}T00:00:00`).getTime();
  if (!Number.isFinite(targetAt)) return { tone: "none", label: "No target date" };
  const today = new Date(now);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const days = Math.round((targetAt - todayStart) / DAY);
  if (days < 0) return { tone: "overdue", label: `${Math.abs(days)}d overdue`, targetAt };
  if (days === 0) return { tone: "due_soon", label: "Due today", targetAt };
  if (days <= getDueSoonWindowDays()) return { tone: "due_soon", label: days === 1 ? "Due tomorrow" : `${days}d left`, targetAt };
  return { tone: "on_track", label: `${days}d left`, targetAt };
}
