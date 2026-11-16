import { EmptyState } from '../../../../components/ui/EmptyState';
import { AlertTriangle, CalendarClock, CircleAlert, Clock3, ExternalLink, UserRoundX } from "lucide-react";
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
  onOpenTask,
  onSelectEmployee,
}: {
  items: TeamAttentionItem[];
  onOpenTask: (taskId: string) => void;
  onSelectEmployee: (employeeId: string) => void;
}) {
  if (items.length === 0) {
    return (
      <EmptyState illustration="complete" title="No immediate intervention required" description="The current filters contain no overdue, blocked, stalled, unassigned, or aging review items."/>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const tone = item.severity === "critical"
          ? "border-red-200 bg-red-50/70 text-red-700"
          : item.severity === "warning"
            ? "border-amber-200 bg-amber-50/70 text-amber-700"
            : "border-blue-200 bg-blue-50/70 text-blue-700";
        return (
          <article key={item.id} className="group rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/40">
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[6px] border ${tone}`}>{kindIcon[item.kind]}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-[6px] border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${tone}`}>{kindLabel[item.kind]}</span>
                  {item.subtaskId && <span className="rounded-[6px] border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Subtask</span>}
                </div>
                <h3 className="mt-1.5 text-[13px] font-semibold text-foreground">{item.title}</h3>
                <p className="mt-0.5 text-[12px] leading-5 text-muted-foreground">{item.detail}</p>
                <p className="mt-1 truncate text-[12px] text-muted-foreground">Parent task: {item.taskTitle}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {item.employeeIds[0] && (
                  <button type="button" onClick={() => onSelectEmployee(item.employeeIds[0])} className="rounded-[6px] border border-border bg-card px-2.5 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-muted">Person</button>
                )}
                <button type="button" onClick={() => onOpenTask(item.taskId)} className="inline-flex items-center gap-1 rounded-[6px] bg-primary px-2.5 py-1.5 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/90">Open <ExternalLink size={11} /></button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
