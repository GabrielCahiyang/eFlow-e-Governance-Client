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
  return <span className="eflow-project-status-label" role="status" aria-label={`Project lifecycle: ${item.text}`}><Label text={item.text} color={item.color} /></span>;
}
export function ProjectScheduleLabel({
  health,
  empty = false,
}: {
  health: ProjectScheduleHealth;
  empty?: boolean;
}) {
  if (empty)
    return <span className="eflow-project-status-label" role="status" aria-label="Project schedule: no scheduled work"><Label text="No scheduled work" color="dark" /></span>;
  const item = schedule[health];
  return <span className="eflow-project-status-label" role="status" aria-label={`Project schedule: ${item.text}`}><Label text={item.text} color={item.color} /></span>;
}

export function ProjectStatusBadge({
  status,
  health,
}: {
  status: ProjectStatus;
  health?: ProjectScheduleHealth;
}) {
  if (status !== "active") {
    const item = lifecycle[status] || { text: status, color: "primary" };
    return (
      <span className="eflow-project-status-label" role="status" aria-label={`Project status: ${item.text}`}>
        <Label text={item.text} color={item.color} />
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
      <span className="eflow-project-status-label" role="status" aria-label="Project status: Completed">
        <Label text="Completed" color="dark" />
      </span>
    );
  }
  return (
    <span className="eflow-project-status-label" role="status" aria-label="Project status: Active">
      <Label text="Active" color="positive" />
    </span>
  );
}
