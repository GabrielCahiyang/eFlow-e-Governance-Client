import { useWorkStatus } from '../../work-status';
import { Label as VibeLabel } from "@vibe/core";
import type { ProjectStatus } from "../services/types";
import type { ProjectScheduleHealth } from "../components/project-command/types";

type LabelColor =
  "primary" | "positive" | "working_orange" | "dark" | "negative";
function Label({text, color}: {text: string; color: LabelColor}) {
  const tone = { primary: "info", positive: "positive", working_orange: "warning", dark: "neutral", negative: "negative" }[color];
  return <VibeLabel text={text} color={color} labelClassName={`eflow-project-label eflow-project-label--${tone}`}/>;
}
const lifecycle: Record<ProjectStatus, { text: string; color: LabelColor }> = {
  planning: { text: "Planning", color: "primary" },
  active: { text: "Active", color: "positive" },
  on_hold: { text: "On hold", color: "working_orange" },
  completed: { text: "Completed", color: "dark" },
  archived: { text: "Archived", color: "negative" },
};
const schedule: Record<
  ProjectScheduleHealth,
  { text: string; color: LabelColor }
> = {
  on_track: { text: "On track", color: "positive" },
  due_soon: { text: "Due soon", color: "working_orange" },
  overdue: { text: "Overdue", color: "negative" },
  at_risk: { text: "At risk", color: "negative" },
  completed: { text: "Completed", color: "dark" },
};
export function ProjectLifecycleLabel({ status }: { status: ProjectStatus }) {
  const item = lifecycle[status];
  const display = useWorkStatus(status, item.text);
  return <span className="eflow-project-status-label" role="status" aria-label={`Project lifecycle: ${display.label}`} style={display.color ? {borderInlineStart: `3px solid ${display.color}`} : undefined}><Label text={display.label} color={item.color} /></span>;
}
export function ProjectScheduleLabel({
  health,
  empty = false,
}: {
  health: ProjectScheduleHealth;
  empty?: boolean;
}) {
  const display = useWorkStatus(health === 'completed' ? 'completed' : '', schedule[health].text);
  if (empty && health!=='completed')
    return <span className="eflow-project-status-label" role="status" aria-label="Project schedule: no scheduled work"><Label text="No scheduled work" color="dark" /></span>;
  const item = schedule[health];
  return <span className="eflow-project-status-label" role="status" aria-label={`Project schedule: ${display.label}`}><Label text={display.label} color={item.color} /></span>;
}

export function ProjectStatusBadge({
  status,
  health,
}: {
  status: ProjectStatus;
  health?: ProjectScheduleHealth;
}) {
  const display = useWorkStatus(status, lifecycle[status]?.text || status);
  const completed = useWorkStatus("completed", "Completed");
  if (status !== "active") {
    const item = lifecycle[status] || { text: status, color: "primary" };
    return (
      <span className="eflow-project-status-label" role="status" aria-label={`Project status: ${display.label}`} style={display.color ? {borderInlineStart: `3px solid ${display.color}`} : undefined}>
        <Label text={display.label} color={item.color} />
      </span>
    );
  }
  if (health === "overdue") {
    return (
      <span className="eflow-project-status-label" role="status" aria-label="Project status: Overdue">
        <Label text="Overdue" color="negative" />
      </span>
    );
  }
  if (health === "at_risk") {
    return (
      <span className="eflow-project-status-label" role="status" aria-label="Project status: At risk">
        <Label text="At risk" color="negative" />
      </span>
    );
  }
  if (health === "due_soon") {
    return (
      <span className="eflow-project-status-label" role="status" aria-label="Project status: Due soon">
        <Label text="Due soon" color="working_orange" />
      </span>
    );
  }
  if (health === "completed") {
    return (
      <span className="eflow-project-status-label" role="status" aria-label={`Project status: ${completed.label}`}>
        <Label text={completed.label} color="dark" />
      </span>
    );
  }
  return (
    <span className="eflow-project-status-label" role="status" aria-label={`Project status: ${display.label}`}>
      <Label text={display.label} color="positive" />
    </span>
  );
}
