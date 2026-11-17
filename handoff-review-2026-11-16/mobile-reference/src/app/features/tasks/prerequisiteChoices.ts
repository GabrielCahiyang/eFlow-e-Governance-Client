import type { Option } from "../../components/ui";
import { taskCalendarDate, taskDateLabel } from "./taskDates";

/** Formats prerequisite schedule hints shared by task and subtask dependency pickers. */
export function prerequisiteScheduleDescription({
  status,
  start,
  due,
  kindLabel,
}: {
  status?: string;
  start?: string | null;
  due?: string | null;
  dependentStart?: string | null;
  kindLabel: "task" | "subtask";
}) {
  const startDay = taskCalendarDate(start);
  const dueDay = taskCalendarDate(due);
  if (status === "completed") {
    if (startDay && dueDay) {
      return `Completed · ${taskDateLabel(startDay)} – ${taskDateLabel(dueDay)}`;
    }
    if (dueDay) return `Completed · Due ${taskDateLabel(dueDay)}`;
    return "Completed";
  }
  if (!dueDay) {
    return startDay
      ? `Starts ${taskDateLabel(startDay)} · No due date`
      : "No dates set";
  }

  return startDay
    ? `${taskDateLabel(startDay)} – ${taskDateLabel(dueDay)}`
    : `Due ${taskDateLabel(dueDay)} (no start date)`;
}

/** Dates are descriptive only. Legacy date-validation options are ignored. */
export function buildPrerequisiteChoiceOptions<T extends { id: string; title: string; status?: string }>({
  choices,
  allItems,
  selectedIds,
  getStart,
  getDue,
  dependentStart,
  requireScheduledIncomplete,
  kindLabel,
}: {
  choices: readonly T[];
  allItems: readonly T[];
  selectedIds: readonly string[];
  getStart: (item: T) => string | null | undefined;
  getDue: (item: T) => string | null | undefined;
  dependentStart?: string | null;
  requireScheduledIncomplete: boolean;
  kindLabel: "task" | "subtask";
}): Option[] {
  const byId = new Map(allItems.map((item) => [item.id, item]));
  const options: Option[] = choices.map((item) => {
    const start = getStart(item);
    const due = getDue(item);
    return {
      value: item.id,
      label: item.title,
      description: prerequisiteScheduleDescription({
        status: item.status,
        start,
        due,
        dependentStart,
        kindLabel,
      }),
      disabled: false,
    };
  });
  for (const id of selectedIds) {
    if (choices.some((item) => item.id === id)) continue;
    options.push({
      value: id,
      label: "Unavailable prerequisite — remove to continue",
      description: byId.get(id)?.title,
    });
  }
  return options;
}
