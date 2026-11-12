import { AlertTriangle, CalendarDays, ChevronRight, CircleUserRound, ListChecks } from "lucide-react";
import { formatDate, ProgressBar, relativeDays } from "../../../components/workflow/primitives";
import { PriorityPill, TaskStatusBadge } from "../../../components/workflow/StatusBadges";
import type { Task } from "../taskTypes";

export function AdminTaskOversightRow({ task, onOpen }: { task: Task; onOpen: (task: Task) => void }) {
  const deadline = task.deadline || task.dueDate;
  const relative = relativeDays(deadline);
  const progress = Math.max(0, Math.min(100, task.percentComplete ?? 0));
  const people = task.teamMemberNames?.filter(Boolean).join(", ") || task.assigneeName || "Unassigned";
  const unassigned = !task.assigneeId || task.status === "pending_assignment";

  return (
    <button
      type="button"
      onClick={() => onOpen(task)}
      className="group grid w-full gap-3 px-4 py-3.5 text-left transition-colors hover:bg-neutral-50/90 sm:px-5 lg:grid-cols-[minmax(240px,1.6fr)_minmax(160px,1fr)_150px_20px] lg:items-center"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <TaskStatusBadge status={task.status} customStatusId={task.customStatusId} rejected={Boolean(task.rejectionNote && task.status === "in_progress")} size="sm" />
          <PriorityPill priority={task.priority} />
          {relative.overdue && <span className="inline-flex items-center gap-1 text-[9.5px] font-medium text-red-600"><AlertTriangle size={10} /> Overdue</span>}
        </div>
        <h4 className="mt-1.5 truncate text-[12.5px] font-semibold text-neutral-950">{task.title}</h4>
        <p className="mt-0.5 line-clamp-1 text-[10.5px] text-neutral-500">{task.description || "No task description provided"}</p>
        {task.activityTitle && <span className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-md bg-violet-50 px-1.5 py-0.5 text-[9px] font-medium text-violet-700"><ListChecks size={9} /><span className="truncate">{task.activityTitle}</span></span>}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-1 text-[9px] font-medium uppercase tracking-[0.1em] text-neutral-400"><CircleUserRound size={12} /> Responsible people</div>
        <div className={`mt-1 truncate text-[11px] font-medium ${unassigned ? "text-amber-700" : "text-neutral-700"}`}>{people}</div>
        {task.teamName && <div className="mt-0.5 truncate text-[9.5px] text-neutral-400">{task.teamName}</div>}
      </div>

      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2 text-[9.5px] text-neutral-500">
          <span className="inline-flex items-center gap-1"><CalendarDays size={11} /> {formatDate(deadline)}</span>
          <span className={relative.overdue ? "font-medium text-red-600" : "text-neutral-400"}>{relative.label}</span>
        </div>
        <div className="mt-1.5"><ProgressBar value={progress} tone={task.status === "completed" ? "good" : relative.overdue ? "bad" : "neutral"} /></div>
        <div className="mt-0.5 text-right text-[9.5px] font-medium tabular-nums text-neutral-500">{progress}%</div>
      </div>

      <ChevronRight size={15} className="hidden text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-600 lg:block" />
    </button>
  );
}
