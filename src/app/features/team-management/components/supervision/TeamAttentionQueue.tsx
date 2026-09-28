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
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 p-8 text-center">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-emerald-100 text-emerald-600"><CircleAlert size={20} /></div>
        <h3 className="mt-3 text-[14px] font-semibold text-emerald-900">No immediate intervention required</h3>
        <p className="mt-1 max-w-sm text-[12px] leading-5 text-emerald-700">The current filters contain no overdue, blocked, stalled, unassigned, or aging review items.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {items.map((item) => {
        const tone = item.severity === "critical"
          ? "border-red-200 bg-red-50/60 text-red-700"
          : item.severity === "warning"
            ? "border-amber-200 bg-amber-50/60 text-amber-700"
            : "border-blue-200 bg-blue-50/60 text-blue-700";
        return (
          <article key={item.id} className="group rounded-xl border border-neutral-200 bg-white p-3.5 transition-all duration-200 hover:border-neutral-300 hover:shadow-sm">
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${tone}`}>{kindIcon[item.kind]}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[12px] font-medium uppercase tracking-wide ${tone}`}>{kindLabel[item.kind]}</span>
                  {item.subtaskId && <span className="text-[12px] uppercase tracking-wide text-neutral-500">Subtask</span>}
                </div>
                <h3 className="mt-1.5 text-[12.5px] font-semibold text-neutral-900">{item.title}</h3>
                <p className="mt-0.5 text-[12px] leading-5 text-neutral-600">{item.detail}</p>
                <p className="mt-1 truncate text-[12px] text-neutral-500">Parent task: {item.taskTitle}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {item.employeeIds[0] && (
                  <button type="button" onClick={() => onSelectEmployee(item.employeeIds[0])} className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[12px] text-neutral-600 transition hover:bg-neutral-50">Person</button>
                )}
                <button type="button" onClick={() => onOpenTask(item.taskId)} className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[12px] font-medium text-primary-foreground transition hover:bg-primary/90">Open <ExternalLink size={11} /></button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
