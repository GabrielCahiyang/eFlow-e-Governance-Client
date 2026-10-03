import { calculateDeadlineWorkload } from "../../selectors/deadlineWorkload";
import { AlertCircle, CheckCircle2, Clock3, Users } from "lucide-react";
import type { Employee } from "../../../../services/employeeService";
import type { Task } from "../../../../services/taskService";
import { getTaskMemberIds, getTaskMemberNames, getInitials, getDeadlineInfo } from "./model";
import type { MondayBoardProps } from "./model";

export function WorkloadBoardView({
  tasks,
  employees,
  role,
  onOpenTaskEditor,
}: {
  tasks: Task[];
  employees: Employee[];
  role: MondayBoardProps["role"];
  onOpenTaskEditor?: (task: Task) => void;
}) {
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const employeeRecord = Object.fromEntries(employeeById);
  const groups = new Map<string, { name: string; tasks: Task[] }>();

  tasks.forEach((task) => {
    const memberIds = getTaskMemberIds(task);
    for (const primaryId of memberIds.length ? memberIds : ["unassigned"]) {
      const primary = primaryId === "unassigned" ? null : employeeById.get(primaryId);
      const name = primary?.name || task.assigneeName || getTaskMemberNames(task, employeeRecord)[0] || "Unassigned";
      const current = groups.get(primaryId) || { name, tasks: [] };
      current.tasks.push(task); groups.set(primaryId, current);
    }
  });

  const rows = Array.from(groups.entries()).sort(([, a], [, b]) => {
    if (a.name === "Unassigned") return 1;
    if (b.name === "Unassigned") return -1;
    return a.name.localeCompare(b.name);
  });

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm" aria-label="Task workload view">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 px-4 py-4 sm:px-5">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
            <Users size={13} /> Workload view
          </div>
          <h2 className="mt-1 text-base font-semibold text-neutral-900">Work by owner</h2>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">A compact view of current task ownership, review load, and deadlines.</p>
        </div>
        <div className="rounded-lg bg-neutral-50 px-3 py-2 text-right text-[11px] text-neutral-500">
          <strong className="block text-sm text-neutral-900">{tasks.length}</strong>
          task{tasks.length === 1 ? "" : "s"} in view
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="px-5 py-12 text-center text-xs text-neutral-500">No task records match this view.</div>
      ) : (
        <div className="divide-y divide-neutral-100">
          {rows.map(([id, row]) => {
            const completed = row.tasks.filter((task) => task.status === "completed").length;
            const review = row.tasks.filter((task) => task.status === "for_review").length;
            const overdue = row.tasks.filter((task) => getDeadlineInfo(task)?.label.includes("overdue")).length;
            const workload = calculateDeadlineWorkload(row.tasks, Date.now(), id === "unassigned" ? undefined : id);
            const initials = getInitials(row.name) || "?";

            return (
              <div key={id} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(180px,1.2fr)_minmax(180px,2fr)_auto] sm:items-center sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[11px] font-semibold text-white">{initials}</span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-neutral-900">{row.name}</div>
                    <div className="text-[11px] text-neutral-500">{row.tasks.length} assigned task{row.tasks.length === 1 ? "" : "s"}</div>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-neutral-500">
                    <span>{workload.label} workload</span>
                    <span>{workload.pressurePercent}% of available time</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                    <span className="block h-full rounded-full bg-primary transition-[width]" style={{ width: Math.min(100, workload.pressurePercent) + "%" }} />
                  </div>
                  <p className="mt-2 text-[11px] text-neutral-500">{workload.explanation}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-600 sm:justify-end">
                  <span className="inline-flex items-center gap-1 rounded-full bg-neutral-50 px-2 py-1"><Clock3 size={12} /> {row.tasks.length - completed} open</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-1 text-violet-700"><CheckCircle2 size={12} /> {review} review</span>
                  {overdue > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-rose-700"><AlertCircle size={12} /> {overdue} overdue</span>}
                </div>

                <div className="min-w-0 sm:col-span-3">
                  <div className="flex flex-wrap gap-2">
                    {row.tasks.slice(0, 6).map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => onOpenTaskEditor?.(task)}
                        disabled={!onOpenTaskEditor || role !== "head"}
                        className="max-w-full break-words whitespace-normal rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-left text-[11px] text-neutral-600 transition hover:border-violet-200 hover:text-violet-700 disabled:cursor-default disabled:hover:border-neutral-200 disabled:hover:text-neutral-600"
                      >
                        {task.title}
                      </button>
                    ))}
                    {row.tasks.length > 6 && <span className="px-1.5 py-1.5 text-[11px] text-neutral-400">+{row.tasks.length - 6} more</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
