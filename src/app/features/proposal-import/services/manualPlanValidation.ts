import type { DraftTask } from "../components/draftModel";
import { getProposalBudgetReadiness } from "../../budget";
import { isValidCalendarDeadline, taskEstimateError } from "../../tasks";

export interface ManualPlanValidationIssue {
  id: string;
  message: string;
}

export function validateManualPlanDraft({
  planTitle,
  planDescription,
  tasks,
}: {
  planTitle: string;
  planDescription: string;
  tasks: DraftTask[];
}): ManualPlanValidationIssue[] {
  const enabledTasks = tasks.filter((task) => task.enabled);
  const issues: ManualPlanValidationIssue[] = [];

  if (!planTitle.trim()) {
    issues.push({ id: "plan-title", message: "Plan title is required." });
  }
  if (!planDescription.trim()) {
    issues.push({ id: "plan-description", message: "Plan description is required." });
  }
  if (enabledTasks.length === 0) {
    issues.push({ id: "tasks", message: "Add at least one task to create this work plan." });
  }

  enabledTasks.forEach((task) => {
    if (!task.programTitle.trim()) {
      issues.push({ id: `${task.key}-program`, message: "Program name is required." });
    }
    if (!task.projectTitle.trim()) {
      issues.push({ id: `${task.key}-project`, message: "Project name is required." });
    }
    if (!task.activityTitle.trim()) {
      issues.push({ id: `${task.key}-activity`, message: "Activity name is required." });
    }
    if (!task.title.trim()) {
      issues.push({ id: `${task.key}-title`, message: "Task title is required." });
    }
    if (!task.description.trim()) {
      issues.push({ id: `${task.key}-description`, message: "Task description is required." });
    }
    if (!task.deadline.trim()) {
      issues.push({ id: `${task.key}-deadline`, message: "Due date is required." });
    } else if (!isValidCalendarDeadline(task.deadline.trim())) {
      issues.push({ id: `${task.key}-deadline-format`, message: "Enter a valid calendar due date." });
    }
    const durationError = taskEstimateError(task.estimatedHours);
    if (durationError) issues.push({ id: `${task.key}-duration`, message: durationError });
  });

  const budgetReadiness = getProposalBudgetReadiness(enabledTasks);
  budgetReadiness.missingTaskKeys.forEach((key) => {
    issues.push({ id: `${key}-budget-decision`, message: "Choose funded or no cost for this task." });
  });
  budgetReadiness.invalidTaskKeys.forEach((key) => {
    issues.push({ id: `${key}-budget-lines`, message: "Complete the budget particulars and amounts for this task." });
  });

  return issues;
}
