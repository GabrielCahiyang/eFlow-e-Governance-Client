import { useWorkStatus } from "../../features/work-status";

// ─── Shared workflow status badges & tokens ──────────────────────
// One source of truth for status → color mapping across Dept Head, Admin, and
// Employee screens, so a "for_review" task looks identical everywhere.

export type WorkflowTaskStatus =
  | "pending_assignment"
  | "todo"
  | "in_progress"
  | "for_review"
  | "changes_requested"
  | "rejected"
  | "completed"
  | "cancelled"
  | "archived";

interface Tone {
  bg: string;
  text: string;
  border: string;
  dot: string;
  label: string;
}

// A task is "rejected" when it is back in progress carrying a rejection note;
// the badge accepts an explicit override for that display-only state.
const TASK_TONES: Record<string, Tone> = {
  pending_assignment: { bg: "bg-neutral-100", text: "text-neutral-600", border: "border-neutral-200", dot: "bg-neutral-400", label: "Unassigned" },
  todo:               { bg: "bg-slate-50",    text: "text-slate-700",   border: "border-slate-200",   dot: "bg-slate-400",   label: "To Do" },
  in_progress:        { bg: "bg-blue-50",     text: "text-blue-700",    border: "border-blue-200",    dot: "bg-blue-500",    label: "In Progress" },
  for_review:         { bg: "bg-amber-50",    text: "text-amber-700",   border: "border-amber-200",   dot: "bg-amber-500",   label: "For Review" },
  changes_requested:  { bg: "bg-rose-50",     text: "text-rose-700",    border: "border-rose-200",    dot: "bg-rose-500",    label: "Changes Requested" },
  rejected:           { bg: "bg-rose-50",     text: "text-rose-700",    border: "border-rose-200",    dot: "bg-rose-500",    label: "Needs Changes" },
  completed:          { bg: "bg-emerald-50",  text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500", label: "Completed" },
  cancelled:          { bg: "bg-neutral-100", text: "text-neutral-500", border: "border-neutral-200", dot: "bg-neutral-400", label: "Cancelled" },
  archived:           { bg: "bg-neutral-100", text: "text-neutral-500", border: "border-neutral-200", dot: "bg-neutral-300", label: "Archived" },
};

export function TaskStatusBadge({
  status,
  rejected,
  customStatusId,
  size = "md",
}: {
  status: string;
  rejected?: boolean;
  customStatusId?: string;
  size?: "sm" | "md";
}) {
  const key = rejected && status === "in_progress" ? "rejected" : status;
  const tone = TASK_TONES[key] || TASK_TONES.todo;
  const display = useWorkStatus(key, tone.label, customStatusId);
  const pad = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${pad} font-medium ${tone.bg} ${tone.text} ${tone.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} style={{backgroundColor:display.color}} />
      {display.label}
    </span>
  );
}

// ─── Project status badge ────────────────────────────────────────
const PROJECT_TONES: Record<string, Tone> = {
  planning:  { bg: "bg-violet-50",   text: "text-violet-700",  border: "border-violet-200",  dot: "bg-violet-500",  label: "Planning" },
  active:    { bg: "bg-blue-50",     text: "text-blue-700",    border: "border-blue-200",    dot: "bg-blue-500",    label: "Active" },
  on_hold:   { bg: "bg-amber-50",    text: "text-amber-700",   border: "border-amber-200",   dot: "bg-amber-500",   label: "On Hold" },
  completed: { bg: "bg-emerald-50",  text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500", label: "Completed" },
  archived:  { bg: "bg-neutral-100", text: "text-neutral-500", border: "border-neutral-200", dot: "bg-neutral-300", label: "Archived" },
};

export function ProjectStatusBadge({ status, size = "md" }: { status: string; size?: "sm" | "md" }) {
  const tone = PROJECT_TONES[status] || PROJECT_TONES.planning;
  const display = useWorkStatus(status, tone.label);
  const pad = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${pad} font-medium ${tone.bg} ${tone.text} ${tone.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} style={{backgroundColor:display.color}} />
      {display.label}
    </span>
  );
}

// ─── Priority pill ───────────────────────────────────────────────
export function PriorityPill({ priority }: { priority?: string }) {
  const map: Record<string, string> = {
    high: "bg-red-50 text-red-700 border-red-200",
    medium: "bg-amber-50 text-amber-700 border-amber-200",
    low: "bg-neutral-100 text-neutral-600 border-neutral-200",
  };
  const p = priority || "medium";
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${map[p] || map.medium}`}>
      {p}
    </span>
  );
}

// ─── Health dot (project health rollups) ─────────────────────────
export type Health = "on_track" | "at_risk" | "delayed" | "complete" | "no_data";

export const HEALTH_META: Record<Health, { label: string; color: string; text: string; bg: string }> = {
  on_track: { label: "On Track", color: "#10b981", text: "text-emerald-700", bg: "bg-emerald-50" },
  at_risk:  { label: "At Risk",  color: "#f59e0b", text: "text-amber-700",  bg: "bg-amber-50" },
  delayed:  { label: "Delayed",  color: "#dc2626", text: "text-red-700",    bg: "bg-red-50" },
  complete: { label: "Complete", color: "#6366f1", text: "text-indigo-700", bg: "bg-indigo-50" },
  no_data:  { label: "No Task Data", color: "#a3a3a3", text: "text-neutral-600", bg: "bg-neutral-100" },
};

export function HealthDot({ health }: { health: Health }) {
  const m = HEALTH_META[health];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${m.bg} ${m.text}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

// ─── Avatar bubble (initials) ────────────────────────────────────
export function InitialsAvatar({ name, size = 28 }: { name?: string; size?: number }) {
  const initials = (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <div
      className="rounded-full bg-gradient-to-br from-neutral-200 to-neutral-300 flex items-center justify-center text-neutral-700 font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
}
