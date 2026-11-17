import { EmptyState } from '../../../../components/ui/EmptyState';
import { AlertTriangle, CheckCircle2, Clock3, Gauge, ShieldAlert, TimerReset } from "lucide-react";
import type { TeamHealthSummary, TeamMemberMetrics } from "../../types";
import { TEAM_WORKLOAD_ELEVATED_THRESHOLD, TEAM_WORKLOAD_HIGH_THRESHOLD } from "../../constants";

export function TeamHealthOverview({ health, members,atRiskCount }: { health: TeamHealthSummary; members: TeamMemberMetrics[];atRiskCount?:number }) {
  const overloaded = members.filter((member) => member.workloadSignal >= TEAM_WORKLOAD_HIGH_THRESHOLD);
  const activeWork = health.activeTasks + health.activeSubtasks;
  const riskWork = atRiskCount ?? health.overdue + health.blocked + health.stalled;
  const riskRate = activeWork ? Math.min(100, Math.round((riskWork / activeWork) * 100)) : 0;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <section className="rounded-xl border border-[var(--eflow-border)] bg-[var(--eflow-surface)] p-5 xl:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--eflow-text)]">Delivery health</h2>
            <p className="mt-0.5 text-[12px] text-[var(--eflow-text-muted)]">Live tasks, delegated subtasks, and reviews in your office.</p>
          </div>
          <span className={`rounded-[6px] border px-2.5 py-1 text-[12px] font-medium ${riskRate >= 35 ? "border-[var(--eflow-negative-text)]/25 bg-[var(--eflow-negative-bg)] text-[var(--eflow-negative-text)]" : riskRate >= 15 ? "border-[var(--eflow-warning-text)]/25 bg-[var(--eflow-warning-bg)] text-[var(--eflow-warning-text)]" : "border-[var(--eflow-positive-text)]/25 bg-[var(--eflow-positive-bg)] text-[var(--eflow-positive-text)]"}`}>
            {riskRate}% work at risk
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <HealthMetric icon={<Gauge size={15} />} label="Active work" value={activeWork} tone="neutral" />
          <HealthMetric icon={<AlertTriangle size={15} />} label="Overdue" value={health.overdue} tone={health.overdue ? "red" : "green"} />
          <HealthMetric icon={<ShieldAlert size={15} />} label="Blocked" value={health.blocked} tone={health.blocked ? "red" : "green"} />
          <HealthMetric icon={<Clock3 size={15} />} label="Stalled" value={health.stalled} tone={health.stalled ? "amber" : "green"} />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Quality label="First-pass approval" value={health.firstPassApprovalRate == null ? "No decisions" : `${health.firstPassApprovalRate}%`} hint="Approved on first submission" />
          <Quality label="Average review time" value={health.averageReviewHours == null ? "No decisions" : `${health.averageReviewHours}h`} hint="Task and subtask decisions" />
          <Quality label="Review backlog" value={String(health.awaitingReview)} hint={`${health.changesRequested} returned for changes`} />
        </div>
      </section>

      <section className="rounded-xl border border-[var(--eflow-border)] bg-[var(--eflow-surface)] p-5">
        <h2 className="text-[14px] font-semibold text-[var(--eflow-text)]">Workload concentration</h2>
        <p className="mt-0.5 text-[12px] text-[var(--eflow-text-muted)]">Relative delivery load across team members.</p>
        <div className="mt-4 space-y-3">
          {members.slice(0, 5).map((member) => <div key={member.employeeId}><div className="flex items-center justify-between gap-2"><span className="truncate text-[12px] font-medium text-[var(--eflow-text)]">{member.employeeName}</span><span className={member.workloadSignal >= TEAM_WORKLOAD_HIGH_THRESHOLD ? "text-[12px] font-semibold text-[var(--eflow-negative-text)]" : member.workloadSignal >= TEAM_WORKLOAD_ELEVATED_THRESHOLD ? "text-[12px] font-semibold text-[var(--eflow-warning-text)]" : "text-[12px] font-semibold text-[var(--eflow-positive-text)]"}>{member.workloadSignal}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-[3px] bg-[var(--eflow-secondary)]"><div className={`h-full rounded-[3px] ${member.workloadSignal >= TEAM_WORKLOAD_HIGH_THRESHOLD ? "bg-[var(--eflow-danger)]" : member.workloadSignal >= TEAM_WORKLOAD_ELEVATED_THRESHOLD ? "bg-[var(--eflow-chart-4)]" : "bg-[var(--eflow-primary)]"}`} style={{ width: `${member.workloadSignal}%` }} /></div></div>)}
          {members.length === 0 && <EmptyState illustration="people" size="compact" title="No team members available."/>}
        </div>
        {overloaded.length > 0 ? <div className="mt-4 rounded-lg border border-[var(--eflow-negative-text)]/20 bg-[var(--eflow-negative-bg)] px-3 py-2 text-[12px] leading-5 text-[var(--eflow-negative-text)]">{overloaded.length} {overloaded.length === 1 ? "person has" : "people have"} a high workload signal. Review assignments before adding new work.</div> : <div className="mt-4 flex items-center gap-1.5 rounded-lg border border-[var(--eflow-positive-text)]/20 bg-[var(--eflow-positive-bg)] px-3 py-2 text-[12px] text-[var(--eflow-positive-text)]"><CheckCircle2 size={13} /> Workload is balanced across the team.</div>}
      </section>
    </div>
  );
}

function HealthMetric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "neutral" | "red" | "amber" | "green" }) {
  const styles = tone === "red" ? "border-[var(--eflow-negative-text)]/20 bg-[var(--eflow-negative-bg)] text-[var(--eflow-negative-text)]" : tone === "amber" ? "border-[var(--eflow-warning-text)]/20 bg-[var(--eflow-warning-bg)] text-[var(--eflow-warning-text)]" : tone === "green" ? "border-[var(--eflow-positive-text)]/20 bg-[var(--eflow-positive-bg)] text-[var(--eflow-positive-text)]" : "border-[var(--eflow-border)] bg-[var(--eflow-subtle)] text-[var(--eflow-text)]";
  return <div className={`rounded-xl border p-3 ${styles}`}><div className="flex items-center justify-between"><span className="text-[12px] font-medium opacity-85">{label}</span>{icon}</div><div className="mt-1.5 text-[21px] font-semibold tabular-nums">{value}</div></div>;
}

function Quality({ label, value, hint }: { label: string; value: string; hint: string }) {
  return <div className="rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-subtle)] p-3"><div className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--eflow-text-muted)]"><TimerReset size={12} />{label}</div><div className="mt-1 text-[16px] font-semibold tabular-nums text-[var(--eflow-text)]">{value}</div><div className="mt-0.5 text-[12px] text-[var(--eflow-text-muted)]">{hint}</div></div>;
}
