import { EmptyState } from '../../../../components/ui/EmptyState';
import { Activity, CheckCircle2, Clock3, RotateCcw, ShieldAlert, Sparkles } from "lucide-react";
import type { Employee, EmployeeNote } from "../../../members";
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
    ...facts.progress.filter((entry) => entry.authorId === employee.id).map((entry) => ({ id: entry.id, at: entry.createdAt, title: entry.kind === "subtask" ? "Subtask work updated" : "Task work updated", detail: entry.blocker ? `Blocker: ${entry.blocker}` : entry.note || entry.nextStep || 'Work update recorded' })),
    ...facts.submissions.filter((entry) => entry.submitterId === employee.id).map((entry) => ({ id: entry.id, at: entry.decidedAt || entry.submittedAt, title: entry.status === "approved" ? "Work approved" : entry.status === "changes_requested" ? "Updates needed" : "Work submitted", detail: `${entry.kind === "subtask" ? "Subtask" : "Task"} attempt ${entry.version}${entry.feedback ? ` · ${entry.feedback}` : ""}` })),
  ].sort((first, second) => second.at - first.at).slice(0, 6);

  return (
    <div className="ea-360 space-y-4">
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="ea-360-heading flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="ea-360-person flex items-center gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-[13px] font-semibold text-primary-foreground">{employee.initials || "??"}</div><div><h2 className="text-[16px] font-semibold text-foreground">{employee.name}</h2><p className="mt-0.5 text-[12px] text-muted-foreground">{employee.jobTitle} · {employee.email || employee.departmentName || "Office team"}</p></div></div>
          <div className="text-left sm:text-right"><div className="text-[12px] font-medium text-muted-foreground">Workload signal</div><div className={`mt-0.5 text-[20px] font-semibold ${metric.workloadSignal >= TEAM_WORKLOAD_HIGH_THRESHOLD ? "text-red-600" : metric.workloadSignal >= TEAM_WORKLOAD_ELEVATED_THRESHOLD ? "text-amber-600" : "text-emerald-600"}`}>{metric.workload?.label || String(metric.workloadSignal)}</div><div className="text-[12px] text-muted-foreground">{metric.workload?.explanation || "Based on active tasks and overdue deadlines"}</div></div>
        </div>
        <div className="ea-360-metrics mt-4 grid grid-cols-2 gap-2 lg:grid-cols-6">
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

      <section className="ea-360-coaching grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <EmployeeCoachingEditor employee={employee} note={note} storedSkills={storedSkills} updatedBy={updatedBy} />
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3"><h3 className="text-[14px] font-semibold text-foreground">Recent delivery activity</h3><p className="mt-0.5 text-[12px] text-muted-foreground">Progress and review events attributable to this person.</p></div>
          <div className="p-4">
            <div className="space-y-4">
              {activity.map((entry) => <div key={entry.id} className="relative pl-5 before:absolute before:left-[4px] before:top-3.5 before:h-[calc(100%+8px)] before:w-px before:bg-border last:before:hidden"><span className="absolute left-0 top-1.5 h-2 w-2 rounded-[3px] border border-border bg-muted-foreground/50" /><div className="text-[12px] font-medium text-foreground">{entry.title}</div><div className="mt-0.5 text-[12px] leading-4 text-muted-foreground">{entry.detail}</div><div className="mt-0.5 text-[11px] text-muted-foreground">{new Date(entry.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div></div>)}
              {activity.length === 0 && <EmptyState illustration="tasks" size="compact" title="No attributable progress or review activity yet."/>}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-muted/50 px-3 py-2 text-[12px] leading-4 text-muted-foreground">Participates in {taskIds.size} task(s). Metrics show source-backed workflow activity and are not an HR rating.</div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ icon, label, value, bad }: { icon: React.ReactNode; label: string; value: string | number; bad?: boolean }) {
  return <div className={`rounded-lg border p-2.5 ${bad ? "border-[var(--eflow-negative-text)]/25 bg-[var(--eflow-negative-bg)]" : "border-border bg-muted/50"}`}><div className={`flex items-center gap-1 text-[11px] font-medium ${bad ? "text-[var(--eflow-negative-text)]" : "text-muted-foreground"}`}>{icon}{label}</div><div className={`mt-1 text-[15px] font-semibold tabular-nums ${bad ? "text-[var(--eflow-negative-text)]" : "text-foreground"}`}>{value}</div></div>;
}

function Quality({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "amber" | "red" }) {
  const style = tone === "red" ? "border-red-200 bg-red-50/70 text-red-700" : tone === "amber" ? "border-amber-200 bg-amber-50/70 text-amber-700" : "border-border bg-muted/50 text-foreground";
  return <div className={`flex items-center justify-between rounded-lg border px-3 py-2 ${style}`}><span className="text-[12px]">{label}</span><span className="text-[12px] font-semibold tabular-nums">{value}</span></div>;
}
