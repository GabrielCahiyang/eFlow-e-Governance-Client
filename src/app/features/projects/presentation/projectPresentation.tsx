import { useWorkStatus } from '../../work-status';
import { Label as VibeLabel } from "@vibe/core";
import type {
  EffectiveProjectStatus,
  Project,
  ProjectApprovalStatus,
  ProjectFundingApprovalStatus,
  ProjectStatus,
} from "../services/types";
import {
  effectiveProjectLifecycleStatus,
  pendingFundingApprovalLabel,
} from "../services/projectMappers";
import type { ProjectScheduleHealth } from "../components/project-command/types";
import { getPhilippineCalendarDate, isCalendarDate } from "../../../shared/calendarDates";
import { formatManilaDate } from "../../../shared/calendarDisplay";
import { getDueSoonWindowDays } from "../../../shared/systemRuntimeConfig";

type LabelColor =
  | "primary"
  | "positive"
  | "working_orange"
  | "dark"
  | "negative";

type LabelTone = "info" | "positive" | "warning" | "neutral" | "negative" | "indigo";

function Label({
  text,
  color,
  tone: explicitTone,
}: {
  text: string;
  color: LabelColor;
  tone?: LabelTone;
}) {
  const tone =
    explicitTone ||
    ({
      primary: "info",
      positive: "positive",
      working_orange: "warning",
      dark: "neutral",
      negative: "negative",
    }[color] as LabelTone);
  return (
    <VibeLabel
      text={text}
      color={color}
      labelClassName={`eflow-project-label eflow-project-label--${tone}`}
    />
  );
}

const lifecycle: Record<
  EffectiveProjectStatus,
  { text: string; color: LabelColor; tone: LabelTone }
> = {
  planning: { text: "Planning", color: "primary", tone: "info" },
  pending: { text: "Pending approval", color: "working_orange", tone: "warning" },
  waiting_for_activation: {
    text: "Waiting for activation",
    color: "primary",
    tone: "indigo",
  },
  active: { text: "Active", color: "positive", tone: "positive" },
  pending_completion: {
    text: "Pending completion",
    color: "primary",
    tone: "indigo",
  },
  on_hold: { text: "On hold", color: "working_orange", tone: "warning" },
  completed: { text: "Completed", color: "dark", tone: "neutral" },
  archived: { text: "Archived", color: "negative", tone: "negative" },
};

const schedule: Record<
  ProjectScheduleHealth,
  { text: string; color: LabelColor; tone: LabelTone }
> = {
  on_track: { text: "On track", color: "positive", tone: "positive" },
  due_soon: { text: "Due soon", color: "working_orange", tone: "warning" },
  overdue: { text: "Overdue", color: "negative", tone: "negative" },
  at_risk: { text: "At risk", color: "negative", tone: "negative" },
  completed: { text: "Completed", color: "dark", tone: "neutral" },
};

export interface UnifiedProjectStatusInfo {
  effectiveStatus: EffectiveProjectStatus;
  label: string;
  color: LabelColor;
  tone: LabelTone;
  sublabel: string;
  sublabelTone: "neutral" | "positive" | "warning" | "negative" | "indigo";
  showDot: boolean;
}

/** Pure Philippine calendar day delta (target - today). */
export function manilaDayDiff(isoDate?: string | null, todayIso = getPhilippineCalendarDate()): number | null {
  if (!isoDate || !isCalendarDate(isoDate) || !isCalendarDate(todayIso)) return null;
  const a = Date.parse(`${isoDate}T12:00:00Z`);
  const b = Date.parse(`${todayIso}T12:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((a - b) / 86_400_000);
}

/**
 * Single authoritative source for project status badge + calm contextual sub-caption
 * across All Projects table, Project Header, Overview, and Project Cards.
 * Guarantees pre-active projects never show bogus `Due soon` or `No scheduled work` badges.
 */
export function resolveUnifiedProjectStatus(
  project: Pick<
    Project,
    | "status"
    | "startDate"
    | "targetDate"
    | "setupCompletedAt"
    | "fundingNotRequired"
    | "fundingApprovalStatus"
    | "projectApprovalStatus"
    | "activationScheduledAt"
    | "completionReviewStatus"
  >,
  health?: ProjectScheduleHealth,
  todayManila = getPhilippineCalendarDate(),
): UnifiedProjectStatusInfo {
  const effectiveStatus = effectiveProjectLifecycleStatus(project);
  const meta = lifecycle[effectiveStatus] || lifecycle.planning;

  if (effectiveStatus === "planning") {
    const rejected = project.projectApprovalStatus === "rejected";
    return {
      effectiveStatus,
      label: meta.text,
      color: meta.color,
      tone: meta.tone,
      sublabel: rejected ? "Revisions requested by Head" : "Setup incomplete",
      sublabelTone: rejected ? "warning" : "neutral",
      showDot: rejected,
    };
  }

  if (effectiveStatus === "pending") {
    return {
      effectiveStatus,
      label: meta.text,
      color: meta.color,
      tone: meta.tone,
      sublabel: pendingFundingApprovalLabel(
        project.fundingApprovalStatus,
        project.projectApprovalStatus,
      ),
      sublabelTone: "warning",
      showDot: true,
    };
  }

  if (effectiveStatus === "waiting_for_activation") {
    const startDiff = manilaDayDiff(project.startDate, todayManila);
    if (project.activationScheduledAt && startDiff !== null && startDiff > 0) {
      return {
        effectiveStatus,
        label: meta.text,
        color: meta.color,
        tone: meta.tone,
        sublabel: `Scheduled · ${formatManilaDate(project.startDate, project.startDate!)}`,
        sublabelTone: "indigo",
        showDot: true,
      };
    }
    if (startDiff !== null && startDiff > 0) {
      return {
        effectiveStatus,
        label: meta.text,
        color: meta.color,
        tone: meta.tone,
        sublabel: `Approved · Starts ${formatManilaDate(project.startDate, project.startDate!)}`,
        sublabelTone: "indigo",
        showDot: true,
      };
    }
    return {
      effectiveStatus,
      label: meta.text,
      color: meta.color,
      tone: meta.tone,
      sublabel: "Approved · Ready to activate",
      sublabelTone: "positive",
      showDot: true,
    };
  }

  if (effectiveStatus === "pending_completion") {
    return {
      effectiveStatus,
      label: meta.text,
      color: meta.color,
      tone: meta.tone,
      sublabel: "Awaiting Office Head review",
      sublabelTone: "indigo",
      showDot: true,
    };
  }

  if (effectiveStatus === "on_hold") {
    return {
      effectiveStatus,
      label: meta.text,
      color: meta.color,
      tone: meta.tone,
      sublabel: "Revision review needed",
      sublabelTone: "warning",
      showDot: true,
    };
  }

  if (effectiveStatus === "completed") {
    return {
      effectiveStatus,
      label: meta.text,
      color: meta.color,
      tone: meta.tone,
      sublabel: "",
      sublabelTone: "neutral",
      showDot: false,
    };
  }

  if (effectiveStatus === "archived") {
    return {
      effectiveStatus,
      label: meta.text,
      color: meta.color,
      tone: meta.tone,
      sublabel: "Read-only",
      sublabelTone: "neutral",
      showDot: false,
    };
  }

  // Active delivery state: surface schedule health calmly as sub-caption text (never a second badge)
  const resolvedHealth = health || "on_track";
  const sublabelMap: Record<
    ProjectScheduleHealth,
    { text: string; tone: UnifiedProjectStatusInfo["sublabelTone"] }
  > = {
    on_track: { text: "On track", tone: "positive" },
    due_soon: { text: "Due soon", tone: "warning" },
    at_risk: { text: "At risk", tone: "negative" },
    overdue: { text: "Overdue", tone: "negative" },
    completed: { text: "Ready to complete", tone: "positive" },
  };
  const h = sublabelMap[resolvedHealth];
  return {
    effectiveStatus,
    label: meta.text,
    color: meta.color,
    tone: meta.tone,
    sublabel: h.text,
    sublabelTone: h.tone,
    showDot: true,
  };
}

export function formatProjectTargetDateSubtext(
  project: Pick<
    Project,
    | "status"
    | "startDate"
    | "targetDate"
    | "setupCompletedAt"
    | "fundingNotRequired"
    | "fundingApprovalStatus"
    | "projectApprovalStatus"
    | "completionReviewStatus"
  >,
  fallbackDate?: string,
  todayManila = getPhilippineCalendarDate(),
): { text: string; tone: "neutral" | "warning" | "negative" | "indigo" } | null {
  const effective = effectiveProjectLifecycleStatus(project);
  if (effective === "completed" || effective === "archived") return null;

  if (effective === "planning" || effective === "pending" || effective === "waiting_for_activation") {
    const startDiff = manilaDayDiff(project.startDate, todayManila);
    if (project.startDate && startDiff !== null && startDiff > 0) {
      return {
        text: `Starts ${formatManilaDate(project.startDate, project.startDate)}`,
        tone: effective === "waiting_for_activation" ? "indigo" : "neutral",
      };
    }
    return null;
  }

  const targetIso = project.targetDate || fallbackDate;
  const targetDiff = manilaDayDiff(targetIso, todayManila);
  if (targetDiff === null) return null;
  const dueSoonDays = Math.max(1, getDueSoonWindowDays());
  if (targetDiff < 0) {
    const overdueDays = Math.abs(targetDiff);
    return {
      text: `${overdueDays} ${overdueDays === 1 ? "day" : "days"} overdue`,
      tone: "negative",
    };
  }
  if (targetDiff === 0) {
    return { text: "Due today", tone: "warning" };
  }
  if (targetDiff <= dueSoonDays) {
    return {
      text: `${targetDiff} ${targetDiff === 1 ? "day" : "days"} left`,
      tone: "warning",
    };
  }
  return {
    text: `${targetDiff} days left`,
    tone: "neutral",
  };
}

export function ProjectUnifiedStatus({
  project,
  health,
  layout = "stacked",
}: {
  project: Pick<
    Project,
    | "status"
    | "startDate"
    | "targetDate"
    | "setupCompletedAt"
    | "fundingNotRequired"
    | "fundingApprovalStatus"
    | "projectApprovalStatus"
    | "activationScheduledAt"
    | "completionReviewStatus"
  >;
  health?: ProjectScheduleHealth;
  layout?: "stacked" | "inline";
}) {
  const info = resolveUnifiedProjectStatus(project, health);
  const display = useWorkStatus(info.effectiveStatus, info.label);

  return (
    <div
      className={`eflow-unified-status${layout === "inline" ? " eflow-unified-status--inline" : ""}`}
    >
      <span
        className="eflow-project-status-label"
        role="status"
        title={info.sublabel ? `${display.label} — ${info.sublabel}` : display.label}
        aria-label={`Project status: ${display.label}${info.sublabel ? ` (${info.sublabel})` : ""}`}
        style={display.color ? { borderInlineStart: `3px solid ${display.color}` } : undefined}
      >
        <Label text={display.label} color={info.color} tone={info.tone} />
      </span>
      {info.sublabel && (
        <span
          className={`eflow-unified-status__meta${
            info.sublabelTone !== "neutral"
              ? ` eflow-unified-status__meta--${info.sublabelTone}`
              : ""
          }`}
        >
          {info.showDot && <span className="eflow-unified-status__dot" aria-hidden="true" />}
          <span>{info.sublabel}</span>
        </span>
      )}
    </div>
  );
}

export function ProjectLifecycleLabel({
  status,
  fundingApprovalStatus,
  projectApprovalStatus,
}: {
  status: EffectiveProjectStatus;
  fundingApprovalStatus?: ProjectFundingApprovalStatus;
  projectApprovalStatus?: ProjectApprovalStatus;
}) {
  const effectiveStatus: EffectiveProjectStatus =
    status === "planning" &&
    (fundingApprovalStatus === "pending_head" ||
      fundingApprovalStatus === "pending_accounting" ||
      projectApprovalStatus === "pending_head")
      ? "pending"
      : status;
  const item = lifecycle[effectiveStatus] || lifecycle.planning;
  const display = useWorkStatus(effectiveStatus, item.text);
  const tooltip =
    effectiveStatus === "pending"
      ? pendingFundingApprovalLabel(fundingApprovalStatus, projectApprovalStatus)
      : undefined;
  return (
    <span
      className="eflow-project-status-label"
      role="status"
      title={tooltip}
      aria-label={`Project lifecycle: ${tooltip || display.label}`}
      style={display.color ? { borderInlineStart: `3px solid ${display.color}` } : undefined}
    >
      <Label text={display.label} color={item.color} tone={item.tone} />
    </span>
  );
}

export function ProjectScheduleLabel({
  health,
  empty = false,
}: {
  health: ProjectScheduleHealth;
  empty?: boolean;
}) {
  const display = useWorkStatus(health === "completed" ? "completed" : "", schedule[health].text);
  if (empty && health !== "completed") {
    return (
      <span
        className="eflow-project-status-label"
        role="status"
        aria-label="Project schedule: no scheduled work"
      >
        <Label text="No scheduled work" color="dark" />
      </span>
    );
  }
  const item = schedule[health];
  return (
    <span
      className="eflow-project-status-label"
      role="status"
      aria-label={`Project schedule: ${display.label}`}
    >
      <Label text={display.label} color={item.color} tone={item.tone} />
    </span>
  );
}

export function ProjectStatusBadge({
  status,
  health,
  fundingApprovalStatus,
  projectApprovalStatus,
}: {
  status: ProjectStatus;
  health?: ProjectScheduleHealth;
  fundingApprovalStatus?: ProjectFundingApprovalStatus;
  projectApprovalStatus?: ProjectApprovalStatus;
}) {
  const effectiveStatus: EffectiveProjectStatus =
    status === "planning" &&
    (fundingApprovalStatus === "pending_head" ||
      fundingApprovalStatus === "pending_accounting" ||
      projectApprovalStatus === "pending_head")
      ? "pending"
      : status;
  const display = useWorkStatus(effectiveStatus, lifecycle[effectiveStatus]?.text || effectiveStatus);
  const completed = useWorkStatus("completed", "Completed");
  if (effectiveStatus !== "active") {
    const item = lifecycle[effectiveStatus] || { text: effectiveStatus, color: "primary" as const, tone: "info" as const };
    const tooltip =
      effectiveStatus === "pending"
        ? pendingFundingApprovalLabel(fundingApprovalStatus, projectApprovalStatus)
        : undefined;
    return (
      <span
        className="eflow-project-status-label"
        role="status"
        title={tooltip}
        aria-label={`Project status: ${tooltip || display.label}`}
        style={display.color ? { borderInlineStart: `3px solid ${display.color}` } : undefined}
      >
        <Label text={display.label} color={item.color} tone={item.tone} />
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
