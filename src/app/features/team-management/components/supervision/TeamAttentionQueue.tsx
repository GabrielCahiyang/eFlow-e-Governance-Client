import { EmptyState } from '../../../../components/ui/EmptyState';
import { AlertTriangle, CalendarClock, CircleAlert, Clock3, ExternalLink, UserRound, UserRoundX } from "lucide-react";
import type { Employee } from "../../../members";
import type { TeamAttentionItem, TeamAttentionKind } from "../../types";

const kindLabel: Record<TeamAttentionKind, string> = {
  overdue: "Overdue",
  due_soon: "Due soon",
  blocked: "Blocked",
  stalled: "Stalled",
  changes_requested: "Revisions",
  awaiting_review: "Review waiting",
  unassigned: "Unassigned",
  vague_schedule: "Schedule",
};

const kindIcon: Record<TeamAttentionKind, React.ReactNode> = {
  overdue: <AlertTriangle size={15} />,
  due_soon: <CalendarClock size={15} />,
  blocked: <CircleAlert size={15} />,
  stalled: <Clock3 size={15} />,
  changes_requested: <CircleAlert size={15} />,
  awaiting_review: <Clock3 size={15} />,
  unassigned: <UserRoundX size={15} />,
  vague_schedule: <CalendarClock size={15} />,
};

export function TeamAttentionQueue({
  items,
  employees = [],
  onOpenTask,
  onSelectEmployee,
}: {
  items: TeamAttentionItem[];
  employees?: Employee[];
  onOpenTask: (taskId: string) => void;
  onSelectEmployee: (employeeId: string) => void;
}) {
  if (items.length === 0) {
    return (
      <EmptyState illustration="complete" title="All clear" description="No overdue, blocked, stalled, unassigned, or aging review items match the current view."/>
    );
  }

  const nameById = new Map(employees.map((employee) => [employee.id, employee.name]));

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const tone = item.severity === "critical"
          ? "border-[var(--eflow-negative-text)]/25 bg-[var(--eflow-negative-bg)] text-[var(--eflow-negative-text)]"
          : item.severity === "warning"
            ? "border-[var(--eflow-warning-text)]/25 bg-[var(--eflow-warning-bg)] text-[var(--eflow-warning-text)]"
            : "border-[var(--eflow-info-text)]/25 bg-[var(--eflow-info-bg)] text-[var(--eflow-info-text)]";
        const assigneeId = item.employeeIds[0];
        const assigneeName = assigneeId ? nameById.get(assigneeId) || "View person" : undefined;
        return (
          <article key={item.id} className="group rounded-xl border border-[var(--eflow-border)] bg-[var(--eflow-surface)] p-3.5 transition-colors hover:border-[var(--eflow-primary)]/45">
            <div className="flex flex-wrap items-start gap-3">
              <div className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[6px] border ${tone}`}>{kindIcon[item.kind]}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-[6px] border px-2 py-0.5 text-[11px] font-medium ${tone}`}>{kindLabel[item.kind]}</span>
                  {item.subtaskId && <span className="rounded-[6px] border border-[var(--eflow-border)] bg-[var(--eflow-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--eflow-text-muted)]">Subtask</span>}
                </div>
                <h3 className="mt-1.5 text-[13px] font-semibold text-[var(--eflow-text)]">{item.title}</h3>
                <p className="mt-0.5 text-[12px] leading-5 text-[var(--eflow-text-secondary)]">{item.detail}</p>
                <p className="mt-1 truncate text-[12px] text-[var(--eflow-text-muted)]">Parent task: {item.taskTitle}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {assigneeId && assigneeName && (
                  <button
                    type="button"
                    onClick={() => onSelectEmployee(assigneeId)}
                    title={`Open ${assigneeName} in People & skills`}
                    className="inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--eflow-border)] bg-[var(--eflow-surface)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--eflow-text)] transition-colors hover:bg-[var(--eflow-subtle)]"
                  >
                    <UserRound size={12} aria-hidden="true" />
                    <span>{assigneeName}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onOpenTask(item.taskId)}
                  className="inline-flex items-center gap-1 rounded-[6px] bg-[var(--eflow-primary)] px-3 py-1.5 text-[12px] font-medium text-[var(--eflow-on-primary)] transition-colors hover:bg-[var(--eflow-primary-hover)]"
                >
                  Open <ExternalLink size={12} aria-hidden="true" />
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
