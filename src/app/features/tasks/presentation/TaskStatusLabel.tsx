import { Label as VibeLabel } from "@vibe/core";
import { useWorkStatus } from "../../work-status";
import { getTaskStatusPresentation, type TaskStatusPresentation } from "./taskStatusPresentation";

const STATUS_TONE: Record<TaskStatusPresentation["color"], "neutral" | "info" | "positive" | "warning" | "negative"> = {
  dark: "neutral",
  purple: "info",
  primary: "info",
  working_orange: "warning",
  negative: "negative",
  positive: "positive",
};

export function TaskStatusLabel({ status, customStatusId }: { status: string; customStatusId?: string }) {
  const presentation = getTaskStatusPresentation(status);
  const display = useWorkStatus(status, presentation.label, customStatusId);
  const tone = STATUS_TONE[presentation.color] ?? "neutral";

  return (
    <span
      className="eflow-project-status-label"
      role="status"
      aria-label={`${display.label}. ${presentation.description}`}
      style={display.color ? { borderInlineStart: `3px solid ${display.color}` } : undefined}
    >
      <VibeLabel
        text={display.label}
        color={presentation.color}
        labelClassName={`eflow-project-label eflow-project-label--${tone}`}
      />
    </span>
  );
}
