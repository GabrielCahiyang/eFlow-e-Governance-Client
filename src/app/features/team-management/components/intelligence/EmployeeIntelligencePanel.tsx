import { Activity, CheckCircle2, Clock3, RotateCcw, ShieldAlert, Sparkles } from "lucide-react";
import type { Employee, EmployeeNote } from "../../../employees";
import type { Task } from "../../../tasks";
import type { TeamMemberMetrics, TeamWorkflowFacts } from "../../types";
import { TEAM_WORKLOAD_ELEVATED_THRESHOLD, TEAM_WORKLOAD_HIGH_THRESHOLD } from "../../constants";
import { EmployeeCoachingEditor } from "./EmployeeCoachingEditor";

export function EmployeeIntelligencePanel({
  employee,
  metric,
  note,
  storedSkills,
  facts,
  tasks,
  updatedBy,
}: {
  employee: Employee;
  metric: TeamMemberMetrics;
  note?: EmployeeNote;
  storedSkills: string[];
  facts: TeamWorkflowFacts;
  tasks: Task[];
  updatedBy?: string;
}) {
  const taskIds = new Set(tasks.filter((task) => task.assigneeId === employee.id || task.teamMemberIds?.includes(employee.id)).map((task) => task.id));
  const activity = [
    ...facts.progress.filter((entry) => entry.authorId === employee.id).map((entry) => ({ id: entry.id, at: entry.createdAt, title: entry.kind === "subtask" ? "Subtask progress updated" : "Task progress updated", detail: `${entry.percentComplete ?? 0}%${entry.blocker ? ` · Blocker: ${entry.blocker}` : entry.note ? ` · ${entry.note}` : ""}` })),
    ...facts.submissions.filter((entry) => entry.submitterId === employee.id).map((entry) => ({ id: entry.id, at: entry.decidedAt || entry.submittedAt, title: entry.status === "approved" ? "Work approved" : entry.status === "changes_requested" ? "Changes requested" : "Work submitted", detail: `${entry.kind === "subtask" ? "Subtask" : "Task"} attempt ${entry.version}${entry.feedback ? ` · ${entry.feedback}` : ""}` })),
  ].sort((first, second) => second.at - first.at).slice(0, 6);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-[13px] font-semibold text-primary-foreground">{employee.initials || "??"}</div><div><h2 className="text-[16px] font-semibold text-neutral-900">{employee.name}</h2><p className="mt-0.5 text-[12px] text-neutral-500">{employee.jobTitle} · {employee.email || employee.departmentName || "Department team"}</p></div></div>
          <div className="text-left sm:text-right"><div className="text-[12px] uppercase tracking-wide text-neutral-500">Workload signal</div><div className={`mt-0.5 text-[20px] font-semibold ${metric.workloadSignal >= TEAM_WORKLOAD_HIGH_THRESHOLD ? "text-red-600" : metric.workloadSignal >= TEAM_WORKLOAD_ELEVATED_THRESHOLD ? "text-amber-600" : "text-emerald-600"}`}>{metric.workloadSignal}/100</div><div className="text-[12px] text-neutral-500">Derived from current work</div></div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-6">
          <Metric icon={<Activity size={13} />} label="Active tasks" value={metric.activeTasks} />
          <Metric icon={<Sparkles size={13} />} label="Leading" value={metric.leadingTasks} />
          <Metric icon={<CheckCircle2 size={13} />} label="Completed" value={metric.completedContributions} />
          <Metric icon={<ShieldAlert size={13} />} label="Blocked" value={metric.blocked} bad={metric.blocked > 0} />
          <Metric icon={<RotateCcw size={13} />} label="Revisions" value={metric.revisionRequests} bad={metric.revisionRequests > 0} />
          <Metric icon={<Clock3 size={13} />} label="Review time" value={metric.averageReviewHours == null ? "—" : `${metric.averageReviewHours}h`} />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Quality label="First-pass approval" value={metric.firstPassApprovalRate == null ? "Not enough data" : `${metric.firstPassApprovalRate}%`} />
          <Quality label="Due within 7 days" value={String(metric.dueSoon)} tone={metric.dueSoon ? "amber" : "neutral"} />
          <Quality label="Overdue contribution" value={String(metric.overdue)} tone={metric.overdue ? "red" : "neutral"} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <EmployeeCoachingEditor employee={employee} note={note} storedSkills={storedSkills} updatedBy={updatedBy} />
        <div className="rounded-xl border border-neutral-200 bg-white">
          <div className="border-b border-neutral-100 px-4 py-3"><h3 className="text-[14px] font-semibold text-neutral-900">Recent delivery activity</h3><p className="mt-0.5 text-[12px] text-neutral-500">Progress and review events attributable to this person.</p></div>
          <div className="p-4">
            <div className="space-y-4">
              {activity.map((entry) => <div key={entry.id} className="relative pl-5 before:absolute before:left-[5px] before:top-3 before:h-[calc(100%+10px)] before:w-px before:bg-neutral-100 last:before:hidden"><span className="absolute left-0 top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-neutral-400 ring-1 ring-neutral-200" /><div className="text-[12px] font-medium text-neutral-700">{entry.title}</div><div className="mt-0.5 text-[12px] leading-4 text-neutral-500">{entry.detail}</div><div className="mt-0.5 text-[12px] text-neutral-500">{new Date(entry.at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div></div>)}
              {activity.length === 0 && <p className="py-12 text-center text-[12px] text-neutral-500">No attributable progress or review activity yet.</p>}
            </div>
            <div className="mt-4 rounded-lg bg-neutral-50 px-3 py-2 text-[12px] leading-4 text-neutral-500">Participates in {taskIds.size} task(s). Metrics show source-backed workflow activity and are not an HR rating.</div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ icon, label, value, bad }: { icon: React.ReactNode; label: string; value: string | number; bad?: boolean }) {
  return <div className="rounded-lg bg-neutral-50 p-2.5"><div className={`flex items-center gap-1 text-[12px] uppercase tracking-wide ${bad ? "text-red-500" : "text-neutral-500"}`}>{icon}{label}</div><div className={`mt-1 text-[15px] font-semibold ${bad ? "text-red-600" : "text-neutral-900"}`}>{value}</div></div>;
}

function Quality({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "amber" | "red" }) {
  const style = tone === "red" ? "bg-red-50 text-red-700" : tone === "amber" ? "bg-amber-50 text-amber-700" : "bg-neutral-50 text-neutral-700";
  return <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${style}`}><span className="text-[12px]">{label}</span><span className="text-[12px] font-medium">{value}</span></div>;
}
