import type { Option } from "../../components/ui";
import { dependencyWouldCycle } from "../../../core/web/app/features/project-table/selectors";
import type { Task } from "../../../core/web/app/features/tasks/taskTypes";
import {
  buildPrerequisiteChoiceOptions,
  prerequisiteScheduleDescription,
} from "./prerequisiteChoices";
import { taskCalendarDate } from "./taskDates";

export { buildPrerequisiteChoiceOptions, prerequisiteScheduleDescription };

export function taskPrerequisiteDueDate(
  item: Pick<Task, "deadline" | "dueDate">,
) {
  return taskCalendarDate(item.deadline || item.dueDate);
}

export function buildTaskPrerequisiteOptions({
  choices,
  allTasks,
  selectedIds,
  dependentStart,
  requireScheduledIncomplete = true,
}: {
  choices: readonly Task[];
  allTasks: readonly Task[];
  selectedIds: readonly string[];
  dependentStart?: string;
  requireScheduledIncomplete?: boolean;
}): Option[] {
  return buildPrerequisiteChoiceOptions({
    choices,
    allItems: allTasks,
    selectedIds,
    getStart: (item) => item.startDate,
    getDue: (item) => item.deadline || item.dueDate,
    dependentStart,
    requireScheduledIncomplete,
    kindLabel: "task",
  });
}

export function taskPrerequisiteSelectionError({
  allTasks,
  visibleProjectIds,
  taskId,
  candidateIds,
  dependentStart,
  requireDueDates = !!dependentStart,
  requireNewDueDates = requireDueDates,
  originalIds = [],
}: {
  allTasks?: readonly Task[];
  visibleProjectIds?: ReadonlySet<string>;
  taskId?: string;
  candidateIds: readonly string[];
  dependentStart?: string;
  requireDueDates?: boolean;
  requireNewDueDates?: boolean;
  originalIds?: readonly string[];
}): string {
  if (!candidateIds.length) return "";
  if (!allTasks) return "Refresh the prerequisite tasks before saving.";
  const byId = new Map(allTasks.map((item) => [item.id, item]));
  if (new Set(candidateIds).size !== candidateIds.length || candidateIds.includes(taskId || ""))
    return "Choose each prerequisite once, without selecting this task itself.";
  if (candidateIds.some(id => !byId.has(id))) return "One prerequisite is no longer available in this project. Remove it to continue.";
  if (
    visibleProjectIds &&
    candidateIds.some((id) => id === taskId || !visibleProjectIds.has(id))
  ) {
    return "One prerequisite is no longer available in this project. Remove it to continue.";
  }
  if (taskId && dependencyWouldCycle([...allTasks], taskId, [...candidateIds])) {
    return "These prerequisites would create a circular dependency.";
  }

  return "";
}
