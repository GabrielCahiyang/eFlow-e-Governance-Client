import { EmptyState } from '../../../../components/ui/EmptyState';
import { useMemo } from "react";
import { CalendarDays, Clock3 } from "lucide-react";
import type { Task } from "../../../../services/taskService";
import { getDeadlineInfo, parseTaskDeadline, statusMeta } from "./model";

export function CalendarBoardView({
  tasks,
  onOpenTaskEditor,
}: {
  tasks: Task[];
  onOpenTaskEditor?: (task: Task) => void;
}) {
  const { dated, undated } = useMemo(() => {
    const next = tasks
      .map((task) => ({ task, date: parseTaskDeadline(task.deadline || task.dueDate || "") }))
      .filter((item): item is { task: Task; date: Date } => Boolean(item.date))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    return { dated: next, undated: tasks.filter((task) => !next.some((item) => item.task.id === task.id)) };
  }, [tasks]);

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm" aria-label="Task calendar view">
      <header className="border-b border-neutral-200 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400"><CalendarDays size={13} /> Calendar</div>
        <h2 className="mt-1 text-base font-semibold text-neutral-900">Scheduled work</h2>
        <p className="mt-1 text-xs leading-relaxed text-neutral-500">Calendar dates are shown only when a real due date is available; relative schedules remain visible below.</p>
      </header>
      {dated.length === 0 ? <EmptyState fill illustration="tasks" size="compact" title="No scheduled tasks in the current scope."/> : (
        <ol className="divide-y divide-neutral-100">
          {dated.map(({ task, date }) => {
            const deadline = getDeadlineInfo(task);
            const status = statusMeta[task.status];
            const taskContent = <span className="break-words text-left text-[12px] font-semibold leading-snug text-neutral-900">{task.title}</span>;
            return (
              <li key={task.id} className="grid gap-2 px-4 py-3.5 sm:grid-cols-[126px_minmax(0,1fr)_auto] sm:items-center sm:px-5">
                <time dateTime={date.toISOString()} className="text-[12px] font-medium text-neutral-700">{date.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</time>
                {onOpenTaskEditor ? <button type="button" onClick={() => onOpenTaskEditor(task)} className="min-w-0 text-left hover:text-violet-700">{taskContent}</button> : taskContent}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] sm:justify-end">
                  <span className={`rounded-full border px-2 py-0.5 ${status.color}`}>{status.label}</span>
                  {deadline && <span className={`rounded-full border px-2 py-0.5 ${deadline.cls}`}>{deadline.label}</span>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {undated.length > 0 && <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-3 sm:px-5"><div className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-700"><Clock3 size={12} /> Relative or unscheduled work ({undated.length})</div><div className="mt-2 flex flex-wrap gap-2">{undated.map((task) => <span key={task.id} className="max-w-full break-words rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] text-neutral-600">{task.title}</span>)}</div></div>}
    </section>
  );
}
