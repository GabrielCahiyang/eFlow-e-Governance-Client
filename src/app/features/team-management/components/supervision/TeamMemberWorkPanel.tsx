import { CalendarDays, CheckCircle2, ExternalLink, ListChecks } from "lucide-react";
import { isActive, type Task } from "../../../tasks";
import type { Employee } from "../../../members";
import type { Subtask } from "../../../subtasks";
import type { TeamMemberMetrics } from "../../types";

export function TeamMemberWorkPanel({
  employee,
  metric,
  tasks,
  subtasks,
  onOpenTask,
}: {
  employee?: Employee;
  metric?: TeamMemberMetrics;
  tasks: Task[];
  subtasks: Subtask[];
  onOpenTask: (task: Task) => void;
}) {
  if (!employee || !metric) {
    return (
      <main className="flex min-h-[520px] items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-white p-6 text-center">
        <div>
          <ListChecks className="mx-auto text-neutral-300" size={28} />
          <h2 className="mt-3 text-[15px] font-semibold text-neutral-800">Choose a team member</h2>
          <p className="mt-1 max-w-sm text-[12px] leading-5 text-neutral-500">Select a person from the member list to review their current work before changing assignments.</p>
        </div>
      </main>
    );
  }

  const memberTasks = tasks.filter((task) => isActive(task) && (task.assigneeId === employee.id || task.teamMemberIds?.includes(employee.id)));
  const memberSubtasks = subtasks.filter((subtask) => subtask.assignedToIds.includes(employee.id) && subtask.status !== "completed");

  return (
    <main className="min-w-0 overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <header className="border-b border-neutral-100 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-medium uppercase tracking-wide text-neutral-500">Member work</p>
            <h2 className="mt-1 break-words text-[17px] font-semibold text-neutral-900">{employee.name}</h2>
            <p className="mt-1 break-words text-[12px] text-neutral-500">{employee.jobTitle} · Current delivery responsibilities</p>
          </div>
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[12px] font-medium text-neutral-700">{metric.activeTasks + metric.activeSubtasks} open items</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Metric label="Leading" value={metric.leadingTasks} />
          <Metric label="Due soon" value={metric.dueSoon} />
          <Metric label="Awaiting review" value={metric.awaitingReview} />
        </div>
      </header>

      <div className="space-y-5 p-4">
        <section>
          <div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-[12px] font-semibold uppercase tracking-wide text-neutral-500">Active task participation</h3><span className="text-[12px] text-neutral-500">{memberTasks.length}</span></div>
          <div className="space-y-2">
            {memberTasks.slice(0, 6).map((task) => (
              <button key={task.id} type="button" onClick={() => onOpenTask(task)} className="flex w-full items-start gap-2 rounded-lg border border-neutral-200 p-3 text-left transition hover:bg-neutral-50">
                <CheckCircle2 className="mt-0.5 shrink-0 text-neutral-400" size={14} />
                <span className="min-w-0 flex-1"><span className="block break-words text-[13px] font-medium leading-5 text-neutral-800">{task.title}</span><span className="mt-1 block break-words text-[12px] text-neutral-500">{task.assigneeId === employee.id ? "Team Lead" : "Team member"} · {task.status.replace(/_/g, " ")} · {task.deadline || task.dueDate || "No deadline"}</span></span>
                <ExternalLink className="mt-0.5 shrink-0 text-neutral-400" size={13} />
              </button>
            ))}
            {!memberTasks.length && <p className="rounded-lg bg-neutral-50 px-3 py-6 text-center text-[12px] text-neutral-500">No active task participation.</p>}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-[12px] font-semibold uppercase tracking-wide text-neutral-500">Delegated subtasks</h3><span className="text-[12px] text-neutral-500">{memberSubtasks.length}</span></div>
          <div className="space-y-2">
            {memberSubtasks.slice(0, 6).map((subtask) => {
              const parent = tasks.find((task) => task.id === subtask.taskId);
              return <button key={subtask.id} type="button" disabled={!parent} onClick={() => parent && onOpenTask(parent)} className="flex w-full items-start gap-2 rounded-lg bg-neutral-50 p-3 text-left transition hover:bg-neutral-100 disabled:cursor-default"><CalendarDays className="mt-0.5 shrink-0 text-neutral-400" size={14} /><span className="min-w-0 flex-1"><span className="block break-words text-[13px] font-medium leading-5 text-neutral-800">{subtask.title}</span><span className="mt-1 block break-words text-[12px] text-neutral-500">{parent?.title || "Parent task unavailable"} · {subtask.percentComplete}% complete</span></span></button>;
            })}
            {!memberSubtasks.length && <p className="rounded-lg bg-neutral-50 px-3 py-5 text-center text-[12px] text-neutral-500">No active delegated subtasks.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg bg-neutral-50 px-2 py-2 text-center"><span className="eflow-tabular block text-[15px] font-semibold text-neutral-900">{value}</span><span className="mt-0.5 block text-[11px] leading-4 text-neutral-500">{label}</span></div>;
}
