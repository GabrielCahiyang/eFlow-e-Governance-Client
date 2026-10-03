import { AlertTriangle, CheckCircle2, Clock3, Gauge, ShieldAlert, TimerReset } from "lucide-react";
import type { TeamHealthSummary, TeamMemberMetrics } from "../../types";
import { TEAM_WORKLOAD_ELEVATED_THRESHOLD, TEAM_WORKLOAD_HIGH_THRESHOLD } from "../../constants";

export function TeamHealthOverview({ health, members }: { health: TeamHealthSummary; members: TeamMemberMetrics[] }) {
  const overloaded = members.filter((member) => member.workloadSignal >= TEAM_WORKLOAD_HIGH_THRESHOLD);
  const activeWork = health.activeTasks + health.activeSubtasks;
  const riskWork = health.overdue + health.blocked + health.stalled;
  const riskRate = activeWork ? Math.min(100, Math.round((riskWork / activeWork) * 100)) : 0;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <section className="rounded-xl border border-neutral-200 bg-white p-4 xl:col-span-2">
        <div className="flex items-start justify-between"><div><h2 className="text-[16px] font-semibold text-neutral-900">Delivery health</h2><p className="mt-0.5 text-[12px] text-neutral-500">Live tasks, delegated subtasks, and reviews in the office scope.</p></div><span className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${riskRate >= 35 ? "bg-red-50 text-red-700" : riskRate >= 15 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{riskRate}% work at risk</span></div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <HealthMetric icon={<Gauge size={15} />} label="Active work" value={activeWork} tone="neutral" />
          <HealthMetric icon={<AlertTriangle size={15} />} label="Overdue" value={health.overdue} tone={health.overdue ? "red" : "green"} />
          <HealthMetric icon={<ShieldAlert size={15} />} label="Blocked" value={health.blocked} tone={health.blocked ? "red" : "green"} />
          <HealthMetric icon={<Clock3 size={15} />} label="Stalled" value={health.stalled} tone={health.stalled ? "amber" : "green"} />
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Quality label="First-pass approval" value={health.firstPassApprovalRate == null ? "No decisions" : `${health.firstPassApprovalRate}%`} hint="Approved on submission version 1" />
          <Quality label="Average review time" value={health.averageReviewHours == null ? "No decisions" : `${health.averageReviewHours}h`} hint="Task and subtask decisions" />
          <Quality label="Review backlog" value={String(health.awaitingReview)} hint={`${health.changesRequested} returned for changes`} />
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="text-[13px] font-semibold text-neutral-900">Workload concentration</h2>
        <p className="mt-0.5 text-[12px] text-neutral-500">Derived signal—not a formal HR capacity rating.</p>
        <div className="mt-4 space-y-3">
          {members.slice(0, 5).map((member) => <div key={member.employeeId}><div className="flex items-center justify-between gap-2"><span className="truncate text-[12px] font-medium text-neutral-700">{member.employeeName}</span><span className={member.workloadSignal >= TEAM_WORKLOAD_HIGH_THRESHOLD ? "text-[12px] text-red-600" : member.workloadSignal >= TEAM_WORKLOAD_ELEVATED_THRESHOLD ? "text-[12px] text-amber-600" : "text-[12px] text-emerald-600"}>{member.workloadSignal}</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100"><div className={`h-full rounded-full ${member.workloadSignal >= TEAM_WORKLOAD_HIGH_THRESHOLD ? "bg-red-500" : member.workloadSignal >= TEAM_WORKLOAD_ELEVATED_THRESHOLD ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${member.workloadSignal}%` }} /></div></div>)}
          {members.length === 0 && <p className="py-8 text-center text-[12px] text-neutral-500">No team members available.</p>}
        </div>
        {overloaded.length > 0 ? <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-[12px] leading-4 text-red-700">{overloaded.length} person(s) have a high workload signal. Review actual assignments before taking action.</div> : <div className="mt-4 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700"><CheckCircle2 size={12} /> No high workload concentration detected.</div>}
      </section>
    </div>
  );
}

function HealthMetric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "neutral" | "red" | "amber" | "green" }) {
  const styles = tone === "red" ? "bg-red-50 text-red-700" : tone === "amber" ? "bg-amber-50 text-amber-700" : tone === "green" ? "bg-emerald-50 text-emerald-700" : "bg-neutral-50 text-neutral-700";
  return <div className={`rounded-xl p-3 ${styles}`}><div className="flex items-center justify-between"><span className="text-[12px] uppercase tracking-wide opacity-70">{label}</span>{icon}</div><div className="mt-1 text-[21px] font-semibold">{value}</div></div>;
}

function Quality({ label, value, hint }: { label: string; value: string; hint: string }) {
  return <div className="rounded-lg border border-neutral-100 bg-neutral-50/60 p-3"><div className="flex items-center gap-1 text-[12px] uppercase tracking-wide text-neutral-500"><TimerReset size={11} />{label}</div><div className="mt-1 text-[16px] font-semibold text-neutral-900">{value}</div><div className="mt-0.5 text-[12px] text-neutral-500">{hint}</div></div>;
}
