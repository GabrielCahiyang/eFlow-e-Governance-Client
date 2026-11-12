import { useWorkStatus } from "../../work-status";
import { Label } from "@vibe/core";
import { getTaskStatusPresentation } from "./taskStatusPresentation";

export function TaskStatusLabel({ status, customStatusId }: { status: string; customStatusId?: string }) {
  const presentation = getTaskStatusPresentation(status);
  const display = useWorkStatus(status, presentation.label, customStatusId);
  return (
    <span style={display.color ? {borderInlineStart: `3px solid ${display.color}`} : undefined} role="status" aria-label={`${display.label}. ${presentation.description}`}>
      <Label color={presentation.color} text={display.label} />
    </span>
  );
}
