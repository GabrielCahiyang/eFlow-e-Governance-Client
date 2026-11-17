import { EmptyState } from '../../../components/ui/EmptyState';
import type { EmptyIllustration } from '../../../components/ui/EmptyStateIllustration';
import { Banknote, Clock3, History, TrendingUp } from "lucide-react";
import type { DepartmentBudgetBundle } from "../types";
import { peso, StatusPill } from "./budgetUi";
import { formatFundingRequestCode } from "../selectors/cashWorkflowRules";

export function BudgetOperationalSignals({ data }: { data: DepartmentBudgetBundle }) {
  const upcoming = data.releases.filter((item) => item.status === "scheduled").sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)).slice(0, 5);
  const unsettled = data.requests.filter((item) => (item.releasedAmount || 0) > 0 && item.status !== "settled").sort((a, b) => a.updatedAt - b.updatedAt).slice(0, 5);
  const actualByCommitment = new Map<string, number>();
  data.requests.filter((item) => item.status === "settled").forEach((item) => actualByCommitment.set(item.commitmentId, (actualByCommitment.get(item.commitmentId) || 0) + (item.actualSpent || 0)));
  const commitments = data.commitments.filter((item) => item.status === "active").slice(0, 6);

  return <div className="grid min-w-0 gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,22rem),1fr))]">
    <section className="rounded-[10px] border border-[var(--eflow-border)] bg-[var(--eflow-surface)] p-4">
      <header className="mb-4 flex items-center gap-2"><TrendingUp size={15} className="text-[var(--eflow-primary)]" /><div><h3 className="text-[15px] font-semibold text-[var(--eflow-text)]">Proposal commitment versus actual</h3><p className="mt-0.5 text-[12px] text-[var(--eflow-text-muted)]">Verified spending only; draft and unliquidated cash are excluded.</p></div></header>
      {commitments.length ? <div className="space-y-3">{commitments.map((commitment) => { const actual = actualByCommitment.get(commitment.id) || 0; const percent = commitment.amount > 0 ? Math.min(100, actual / commitment.amount * 100) : 0; return <div key={commitment.id}><div className="mb-1 flex items-center justify-between gap-3 text-[12px]"><span className="truncate text-[var(--eflow-text)]">{commitment.title}</span><span className="shrink-0 tabular-nums text-[var(--eflow-text-muted)]">{peso.format(actual)} / {peso.format(commitment.amount)}</span></div><div className="h-2 overflow-hidden rounded-[3px] bg-[var(--eflow-secondary)]"><div className="h-full rounded-[3px] bg-[var(--eflow-primary)]" style={{ width: `${percent}%` }} /></div></div>; })}</div> : <EmptyLine illustration="budget" text="Published proposal commitments will appear here." />}
    </section>
    <section className="rounded-[10px] border border-[var(--eflow-border)] bg-[var(--eflow-surface)] p-4">
      <header className="mb-3 flex items-center gap-2"><Banknote size={15} className="text-[var(--eflow-primary)]" /><h3 className="text-[15px] font-semibold text-[var(--eflow-text)]">Upcoming cash releases</h3></header>
      {upcoming.length ? <div className="divide-y divide-[var(--eflow-border)]">{upcoming.map((release) => { const request = data.requests.find((item) => item.id === release.requestId); return <div key={release.id} className="py-3"><div className="flex justify-between gap-2 text-[12px]"><strong>{formatFundingRequestCode(request?.requestNumber)}</strong><strong>{peso.format(release.amount)}</strong></div><div className="mt-1 flex justify-between gap-2 text-[12px] text-[var(--eflow-text-muted)]"><span className="truncate">{request?.cashRecipientName || request?.requesterName || "Assigned recipient"}</span><span>{release.scheduledDate}</span></div></div>; })}</div> : <EmptyLine illustration="tasks" text="No cash is currently scheduled for release." />}
    </section>
    <section className="rounded-[10px] border border-[var(--eflow-border)] bg-[var(--eflow-surface)] p-4">
      <header className="mb-3 flex items-center gap-2"><Clock3 size={15} className="text-[var(--eflow-primary)]" /><h3 className="text-[15px] font-semibold text-[var(--eflow-text)]">Oldest outstanding cash</h3></header>
      {unsettled.length ? <div className="space-y-2">{unsettled.map((request) => { const days = ageInDays(request.updatedAt); return <div key={request.id} className="flex items-center gap-2 border-b border-[var(--eflow-border)] pb-2 text-[12px] last:border-0"><div className="min-w-0 flex-1"><strong className="block truncate">{request.cashRecipientName || request.requesterName}</strong><span className="text-[var(--eflow-text-muted)]">{days} {days === 1 ? "day" : "days"} open · {peso.format(request.releasedAmount || 0)}</span></div><StatusPill status={request.status} /></div>; })}</div> : <EmptyLine illustration="complete" text="No released cash is awaiting settlement." />}
    </section>
    <section className="rounded-[10px] border border-[var(--eflow-border)] bg-[var(--eflow-surface)] p-4">
      <header className="mb-3 flex items-center gap-2"><History size={15} className="text-[var(--eflow-primary)]" /><h3 className="text-[15px] font-semibold text-[var(--eflow-text)]">Recent financial activity</h3></header>
      {data.ledger.length ? <div className="divide-y divide-[var(--eflow-border)]">{data.ledger.slice(0, 6).map((entry) => <div key={entry.id} className="flex gap-3 py-3"><div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] bg-[var(--eflow-subtle)] text-[var(--eflow-text-muted)]"><History size={11} /></div><div className="min-w-0"><div className="truncate text-[12px] font-medium capitalize">{entry.entryType.replace(/_/g, " ")}</div><div className="mt-0.5 truncate text-[12px] text-[var(--eflow-text-muted)]">{entry.description}</div><div className="mt-1 text-[12px] text-[var(--eflow-text-muted)]">{peso.format(entry.amount)} · {new Date(entry.createdAt).toLocaleString()}</div></div></div>)}</div> : <EmptyLine illustration="files" text="Audited financial actions will appear here." />}
    </section>
  </div>;
}

function EmptyLine({ text, illustration }: { text: string; illustration: EmptyIllustration }) { return <EmptyState illustration={illustration} size="compact" title={text}/>; }
function ageInDays(timestamp: number) { return Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000)); }
