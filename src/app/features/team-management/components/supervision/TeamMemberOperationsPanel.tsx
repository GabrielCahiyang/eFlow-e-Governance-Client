import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRightLeft, CalendarClock, CheckCircle2, ExternalLink, Loader2, ShieldAlert, Users } from "lucide-react";
import type { Employee } from "../../../employees";
import { isActive, type Task } from "../../../tasks";
import type { Subtask } from "../../../subtasks";
import type { TeamMemberMetrics } from "../../types";
import { TEAM_WORKLOAD_ELEVATED_THRESHOLD, TEAM_WORKLOAD_HIGH_THRESHOLD } from "../../constants";
import { replaceEmployeeOnTask } from "../../services/teamSupervisionActions";

export function TeamMemberOperationsPanel({
  employee,
  employees,
  metric,
  tasks,
  subtasks,
  onOpenTask,
}: {
  employee?: Employee;
  employees: Employee[];
  metric?: TeamMemberMetrics;
  tasks: Task[];
  subtasks: Subtask[];
  onOpenTask: (task: Task) => void;
}) {
  const [replacementTaskId, setReplacementTaskId] = useState("");
  const [replacementId, setReplacementId] = useState("");
  const [moving, setMoving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const activeTasks = useMemo(() => employee ? tasks.filter((task) => isActive(task) && (task.assigneeId === employee.id || task.teamMemberIds?.includes(employee.id))) : [], [employee, tasks]);
  const assignedSubtasks = useMemo(() => employee ? subtasks.filter((subtask) => subtask.assignedToIds.includes(employee.id) && subtask.status !== "completed") : [], [employee, subtasks]);

  if (!employee || !metric) {
    return (
      <aside className="flex min-h-[520px] flex-col items-center justify-center rounded-xl border border-neutral-200 bg-white p-6 text-center xl:sticky xl:top-4">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-neutral-100 text-neutral-400"><Users size={22} /></div>
        <h3 className="mt-3 text-[14px] font-semibold text-neutral-800">Select a team member</h3>
        <p className="mt-1 max-w-xs text-[12px] leading-5 text-neutral-500">Their tasks, delegated subtasks, review load, risks, and safe reassignment actions will appear here.</p>
      </aside>
    );
  }

  const confirmReplacement = async () => {
    const task = activeTasks.find((candidate) => candidate.id === replacementTaskId);
    const replacement = employees.find((candidate) => candidate.id === replacementId);
    if (!task || !replacement) return;
    setMoving(true);
    setMessage(null);
    try {
      const mode = await replaceEmployeeOnTask(task, employee.id, replacement);
      setMessage({ tone: "success", text: mode === "lead" ? `Task leadership moved to ${replacement.name}.` : `${replacement.name} replaced ${employee.name} as a team member.` });
      setReplacementTaskId("");
      setReplacementId("");
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "The assignment could not be changed." });
    } finally {
      setMoving(false);
    }
  };

  return (
    <aside className="rounded-xl border border-neutral-200 bg-white xl:sticky xl:top-4">
      <div className="border-b border-neutral-100 p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-[12px] font-semibold text-primary-foreground">{employee.initials || "??"}</div>
          <div className="min-w-0 flex-1"><h2 className="truncate text-[14px] font-semibold text-neutral-900">{employee.name}</h2><p className="truncate text-[12px] text-neutral-500">{employee.jobTitle} · {employee.departmentName || "Department team"}</p></div>
          <span className={`rounded-full px-2 py-1 text-[12px] font-medium ${metric.workloadSignal >= TEAM_WORKLOAD_HIGH_THRESHOLD ? "bg-red-50 text-red-700" : metric.workloadSignal >= TEAM_WORKLOAD_ELEVATED_THRESHOLD ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{metric.workloadSignal}/100 signal</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[ ["Leading", metric.leadingTasks], ["Subtasks", metric.activeSubtasks], ["Reviews", metric.awaitingReview] ].map(([label, value]) => <div key={label as string} className="rounded-lg bg-neutral-50 p-2 text-center"><div className="text-[15px] font-semibold text-neutral-900">{value as number}</div><div className="text-[12px] uppercase tracking-wide text-neutral-500">{label as string}</div></div>)}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {metric.overdue > 0 && <Signal icon={<AlertTriangle size={11} />} label={`${metric.overdue} overdue`} tone="red" />}
          {metric.blocked > 0 && <Signal icon={<ShieldAlert size={11} />} label={`${metric.blocked} blocked`} tone="red" />}
          {metric.dueSoon > 0 && <Signal icon={<CalendarClock size={11} />} label={`${metric.dueSoon} due soon`} tone="amber" />}
          {!metric.overdue && !metric.blocked && <Signal icon={<CheckCircle2 size={11} />} label="No immediate risk" tone="green" />}
        </div>
      </div>

      <div className="max-h-[calc(100vh-240px)] space-y-5 overflow-y-auto p-4">
        <section>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-[12px] font-semibold uppercase tracking-wide text-neutral-500">Active tasks</h3><span className="text-[12px] text-neutral-500">{activeTasks.length}</span></div>
          <div className="space-y-2">
            {activeTasks.map((task) => (
              <button key={task.id} type="button" onClick={() => onOpenTask(task)} className="flex w-full items-start gap-2 rounded-lg border border-neutral-200 p-2.5 text-left transition hover:bg-neutral-50">
                <div className="min-w-0 flex-1"><p className="truncate text-[12px] font-medium text-neutral-800">{task.title}</p><p className="mt-0.5 text-[12px] text-neutral-500">{task.assigneeId === employee.id ? "Team Lead" : "Team Member"} · {task.status.replace(/_/g, " ")} · {task.deadline || task.dueDate || "No deadline"}</p></div><ExternalLink size={12} className="mt-0.5 shrink-0 text-neutral-400" />
              </button>
            ))}
            {activeTasks.length === 0 && <p className="rounded-lg bg-neutral-50 px-3 py-5 text-center text-[12px] text-neutral-500">No active task participation.</p>}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-[12px] font-semibold uppercase tracking-wide text-neutral-500">Delegated subtasks</h3><span className="text-[12px] text-neutral-500">{assignedSubtasks.length}</span></div>
          <div className="space-y-2">
            {assignedSubtasks.map((subtask) => {
              const parent = tasks.find((task) => task.id === subtask.taskId);
              return <button key={subtask.id} type="button" onClick={() => parent && onOpenTask(parent)} className="w-full rounded-lg bg-neutral-50 p-2.5 text-left transition hover:bg-neutral-100"><div className="flex items-center justify-between gap-2"><p className="truncate text-[12px] font-medium text-neutral-700"><span className="mr-1.5 text-[12px] font-semibold uppercase text-neutral-500">Step {subtask.position + 1}</span>{subtask.title}</p><span className="text-[12px] text-neutral-500">{subtask.percentComplete}%</span></div><p className="mt-0.5 truncate text-[12px] text-neutral-500">{parent?.title || "Parent task"} · {subtask.status.replace(/_/g, " ")}</p></button>;
            })}
            {assignedSubtasks.length === 0 && <p className="rounded-lg bg-neutral-50 px-3 py-4 text-center text-[12px] text-neutral-500">No active delegated subtasks.</p>}
          </div>
        </section>

        {activeTasks.length > 0 && (
          <section className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-3">
            <div className="flex items-center gap-2"><ArrowRightLeft size={14} className="text-neutral-500" /><div><h3 className="text-[12px] font-semibold text-neutral-800">Change an assignment</h3><p className="text-[12px] leading-4 text-neutral-500">Lead changes and member replacements are handled separately.</p></div></div>
            <select value={replacementTaskId} onChange={(event) => { setReplacementTaskId(event.target.value); setMessage(null); }} className="mt-3 h-9 w-full rounded-lg border border-neutral-200 bg-white px-2 text-[12px] outline-none"><option value="">Choose active task…</option>{activeTasks.map((task) => <option key={task.id} value={task.id}>{task.assigneeId === employee.id ? "Change lead" : "Replace member"}: {task.title}</option>)}</select>
            <select value={replacementId} onChange={(event) => setReplacementId(event.target.value)} disabled={!replacementTaskId} className="mt-2 h-9 w-full rounded-lg border border-neutral-200 bg-white px-2 text-[12px] outline-none disabled:opacity-50"><option value="">Choose replacement…</option>{employees.filter((candidate) => candidate.id !== employee.id).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.jobTitle}</option>)}</select>
            <button type="button" onClick={confirmReplacement} disabled={!replacementTaskId || !replacementId || moving} className="mt-2 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-primary text-[12px] font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40">{moving ? <><Loader2 size={12} className="animate-spin" /> Updating…</> : "Confirm assignment change"}</button>
            {message && <p className={`mt-2 rounded-lg px-2.5 py-2 text-[12px] leading-4 ${message.tone === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{message.text}</p>}
          </section>
        )}
      </div>
    </aside>
  );
}

function Signal({ icon, label, tone }: { icon: React.ReactNode; label: string; tone: "red" | "amber" | "green" }) {
  const classes = tone === "red" ? "bg-red-50 text-red-700" : tone === "amber" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700";
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] ${classes}`}>{icon}{label}</span>;
}
