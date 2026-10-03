import type { Task } from "../../../../services/taskService";
import { getDeadlineInfo, parseTaskDeadline, priorityMeta, statusMeta } from "./model";

export function TimelineView({
  tasks,
  role,
  onOpenTaskEditor,
}: {
  tasks: Task[];
  role: "head" | "member";
  onOpenTaskEditor?: (task: Task) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find project start date dynamically
  let earliestTime = today.getTime();
  tasks.forEach((t) => {
    if (t.createdAt) {
      const time = new Date(t.createdAt).getTime();
      if (!Number.isNaN(time) && time < earliestTime) {
        earliestTime = time;
      }
    }
  });
  const projectStart = new Date(earliestTime);
  projectStart.setHours(0, 0, 0, 0);

  // First pass: parse all tasks that have deadlines
  const parsedItems = tasks
    .map((task) => {
      const parsedDeadline = parseTaskDeadline(
        task.deadline || task.dueDate || "",
      );
      return parsedDeadline ? { task, parsedDeadline } : null;
    })
    .filter(
      (item): item is { task: Task; parsedDeadline: Date } => item !== null,
    );
  const datedTaskIds = new Set(parsedItems.map(({ task }) => task.id));
  const undatedTasks = tasks.filter((task) => !datedTaskIds.has(task.id));

  // Find window boundaries based on task dates
  let latestTime = today.getTime() + 12 * 7 * 86400000; // default 12 weeks out
  parsedItems.forEach(({ parsedDeadline }) => {
    if (parsedDeadline.getTime() > latestTime) {
      latestTime = parsedDeadline.getTime();
    }
  });

  // Start 2 weeks before project start (or today, whichever is earlier)
  const windowStart = new Date(Math.min(today.getTime(), projectStart.getTime()));
  windowStart.setDate(windowStart.getDate() - 14);
  windowStart.setHours(0, 0, 0, 0);

  // End 2 weeks after the latest deadline
  const windowEnd = new Date(latestTime);
  windowEnd.setDate(windowEnd.getDate() + 14);
  windowEnd.setHours(0, 0, 0, 0);

  // Calculate total weeks dynamically
  const timeDiff = windowEnd.getTime() - windowStart.getTime();
  const WEEKS = Math.max(12, Math.ceil(timeDiff / (7 * 86400000)));
  const totalDays = WEEKS * 7;

  const weeks: Date[] = Array.from({ length: WEEKS }, (_, i) => {
    const d = new Date(windowStart);
    d.setDate(d.getDate() + i * 7);
    return d;
  });

  const dayOffset = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return Math.floor((d.getTime() - windowStart.getTime()) / 86400000);
  };

  const todayOffset = dayOffset(today);
  const todayPct = (todayOffset / totalDays) * 100;

  const tasksWithDates = parsedItems;

  return (
    <div className="w-full bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex border-b border-neutral-200 sticky top-0 bg-white z-10">
        <div className="w-[220px] shrink-0 px-4 py-2.5 border-r border-neutral-100">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
            Task
          </div>
        </div>
        <div className="flex-1 flex relative">
          {weeks.map((w, i) => (
            <div
              key={i}
              className="flex-1 px-1 py-2.5 border-r border-neutral-100 last:border-0 text-center"
            >
              <div className="text-[10px] font-semibold text-neutral-400">
                {w.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rows */}
      <div>
        {tasksWithDates.length === 0 && (
          <div className="py-14 text-center text-[12px] text-neutral-400 italic">
            No tasks with due dates to display on the timeline.
          </div>
        )}

        {tasksWithDates.map(({ task, parsedDeadline }) => {
          const startTaskDate = task.createdAt
            ? new Date(task.createdAt)
            : new Date();
          startTaskDate.setHours(0, 0, 0, 0);

          const startOff = Math.max(0, dayOffset(startTaskDate));
          const endOff = Math.min(totalDays, dayOffset(parsedDeadline));
          const barLeft = (startOff / totalDays) * 100;
          const barWidth = Math.max(
            0.8,
            ((endOff - startOff) / totalDays) * 100,
          );

          const pm =
            priorityMeta[task.priority || "medium"] || priorityMeta.medium;
          const sm = statusMeta[task.status];
          const dlInfo = getDeadlineInfo(task);
          const isOverdue = dlInfo?.label.includes("overdue");
          const isDueToday = dlInfo?.label === "Due today";

          const barColor =
            task.status === "completed"
              ? "bg-emerald-400"
              : isOverdue
                ? "bg-red-500"
                : isDueToday
                  ? "bg-amber-400"
                  : "bg-blue-400";


          return (
            <div
              key={task.id}
              className="flex border-b border-neutral-100 last:border-0 hover:bg-neutral-50/50 group transition"
            >
              {/* Label */}
              <div className="w-[220px] shrink-0 px-4 py-3 border-r border-neutral-100">
                <div className="flex items-start gap-2">
                  <div className={`w-1 h-8 rounded-full shrink-0 ${pm.bar}`} />
                  <div className="min-w-0">
                    {role === "head" && onOpenTaskEditor ? (
                      <button
                        onClick={() => onOpenTaskEditor(task)}
                        className="break-words text-left text-[12px] font-medium leading-snug text-neutral-900 hover:text-violet-700 transition"
                      >
                        {task.title}
                      </button>
                    ) : (
                      <div className="break-words text-[12px] font-medium leading-snug text-neutral-900">
                        {task.title}
                      </div>
                    )}
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full border ${sm.color}`}
                      >
                        <div className={`w-1 h-1 rounded-full ${sm.dot}`} />
                        {sm.label}
                      </span>
                      {task.assigneeName && (
                        <span className="text-[9px] text-neutral-400 truncate">
                          {task.assigneeName.split(" ")[0]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Gantt bar area */}
              <div className="flex-1 relative py-3">
                {/* Week grid lines */}
                {weeks.map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 w-px bg-neutral-100 pointer-events-none"
                    style={{ left: `${(i / WEEKS) * 100}%` }}
                  />
                ))}

                {/* Today line */}
                {todayPct >= 0 && todayPct <= 100 && (
                  <div
                    className="absolute top-0 bottom-0 z-10 pointer-events-none"
                    style={{ left: `${todayPct}%` }}
                  >
                    <div className="w-px h-full bg-blue-400/50" />
                    <div className="absolute top-0 left-0 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-blue-500" />
                  </div>
                )}

                {/* Task bar */}
                {endOff > 0 && startOff <= totalDays && (
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 h-5 rounded-full flex items-center px-2 text-[10px] text-white font-medium whitespace-nowrap overflow-hidden shadow-sm transition-all group-hover:shadow-md ${barColor}`}
                    style={{
                      left: `${barLeft}%`,
                      width: `${barWidth}%`,
                      minWidth: "16px",
                    }}
                    title={`${task.title} · Due: ${task.deadline || task.dueDate}`}
                  >
                    {barWidth > 5 ? task.title : ""}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {undatedTasks.length > 0 && (
        <div className="border-t border-neutral-200 bg-neutral-50/70 px-4 py-3">
          <div className="text-[11px] font-medium text-neutral-700">
            Relative or unscheduled work ({undatedTasks.length})
          </div>
          <div className="mt-0.5 text-[10px] text-neutral-400">
            Month/phase schedules stay visible here until a real calendar due date is assigned.
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {undatedTasks.map((task) => {
              const sm = statusMeta[task.status];
              const label = task.deadline || task.dueDate || "No due date";
              const content = (
                <>
                  <span className={`h-1.5 w-1.5 rounded-full ${sm.dot}`} />
                  <span className="max-w-[220px] truncate">{task.title}</span>
                  <span className="text-neutral-400">{label}</span>
                </>
              );
              return role === "head" && onOpenTaskEditor ? (
                <button
                  key={task.id}
                  onClick={() => onOpenTaskEditor(task)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[10px] text-neutral-600 hover:border-violet-200 hover:text-violet-700"
                >
                  {content}
                </button>
              ) : (
                <div
                  key={task.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[10px] text-neutral-600"
                >
                  {content}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-neutral-100 bg-neutral-50">
        <div className="flex items-center gap-1.5">
          <div className="w-px h-4 bg-blue-400/60" />
          <span className="text-[10px] text-neutral-400">Today</span>
        </div>
        {[
          { color: "bg-emerald-400", label: "Completed" },
          { color: "bg-red-500", label: "Overdue" },
          { color: "bg-amber-400", label: "Due Today" },
          { color: "bg-blue-400", label: "On Track" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-4 h-2 rounded-full ${color}`} />
            <span className="text-[10px] text-neutral-400">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main MondayBoard Component ───────────────────────────────────
