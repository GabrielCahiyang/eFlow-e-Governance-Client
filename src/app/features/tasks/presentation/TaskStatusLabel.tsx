import { useWorkStatus } from "../../work-status";
import { getTaskStatusPresentation, type TaskStatusPresentation } from "./taskStatusPresentation";

const STATUS_CELL_TONES: Record<TaskStatusPresentation["color"], string> = {
  dark: "border-border bg-muted text-secondary-foreground",
  purple: "border-violet-200 bg-violet-50 text-violet-700",
  primary: "border-sky-200 bg-sky-50 text-sky-800",
  working_orange: "border-amber-200 bg-amber-50 text-amber-800",
  negative: "border-red-200 bg-red-50 text-red-700",
  positive: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export function TaskStatusLabel({ status, customStatusId }: { status: string; customStatusId?: string }) {
  const presentation = getTaskStatusPresentation(status);
  const display = useWorkStatus(status, presentation.label, customStatusId);
  const toneClass = STATUS_CELL_TONES[presentation.color] ?? STATUS_CELL_TONES.dark;

  return (
    <span
      role="status"
      aria-label={`${display.label}. ${presentation.description}`}
      style={display.color ? { borderInlineStartWidth: "3px", borderInlineStartColor: display.color } : undefined}
      className={`inline-flex max-w-full items-center rounded-[6px] border px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap ${toneClass}`}
    >
      {display.label}
    </span>
  );
}
