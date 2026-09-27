import { AlertTriangle, Banknote, Clock3, History, TrendingUp } from "lucide-react";
import type { DepartmentBudgetBundle } from "../types";
import { peso, StatusPill } from "./budgetUi";

export function BudgetOperationalSignals({ data }: { data: DepartmentBudgetBundle }) {
  const upcoming = data.releases.filter((item) => item.status === "scheduled").sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)).slice(0, 5);
  const unsettled = data.requests.filter((item) => (item.releasedAmount || 0) > 0 && item.status !== "settled").sort((a, b) => a.updatedAt - b.updatedAt).slice(0, 5);
  const actualByCommitment = new Map<string, number>();
  data.requests.filter((item) => item.status === "settled").forEach((item) => actualByCommitment.set(item.commitmentId, (actualByCommitment.get(item.commitmentId) || 0) + (item.actualSpent || 0)));
  const commitments = data.commitments.filter((item) => item.status === "active").slice(0, 6);

  return <div className="grid gap-4 xl:grid-cols-3">
    <section className="rounded-[10px] border border-border bg-card p-4 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)] xl:col-span-2">
      <header className="mb-4 flex items-center gap-2"><TrendingUp size={14} /><div><h3 className="text-[16px] font-semibold">Proposal commitment versus actual</h3><p className="mt-0.5 text-[12px] text-neutral-500">Verified spending only; draft and unliquidated cash are excluded.</p></div></header>
      {commitments.length ? <div className="space-y-3">{commitments.map((commitment) => { const actual = actualByCommitment.get(commitment.id) || 0; const percent = commitment.amount > 0 ? Math.min(100, actual / commitment.amount * 100) : 0; return <div key={commitment.id}><div className="mb-1 flex items-center justify-between gap-3 text-[12px]"><span className="truncate text-neutral-700">{commitment.title}</span><span className="shrink-0 text-neutral-500">{peso.format(actual)} / {peso.format(commitment.amount)}</span></div><div className="h-2 overflow-hidden rounded-full bg-violet-100"><div className="h-full rounded-full bg-violet-600" style={{ width: `${percent}%` }} /></div></div>; })}</div> : <EmptyLine text="Published proposal commitments will appear here." />}
    </section>
    <section className="rounded-[10px] border border-border bg-card p-4 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
      <header className="mb-3 flex items-center gap-2"><Banknote size={14} /><h3 className="text-[16px] font-semibold">Upcoming cash releases</h3></header>
      {upcoming.length ? <div className="space-y-2">{upcoming.map((release) => { const request = data.requests.find((item) => item.id === release.requestId); return <div key={release.id} className="rounded-xl border border-neutral-100 bg-neutral-50 p-3"><div className="flex justify-between gap-2 text-[12px]"><strong>PC-{String(request?.requestNumber || 0).padStart(5, "0")}</strong><strong>{peso.format(release.amount)}</strong></div><div className="mt-1 flex justify-between gap-2 text-[12px] text-neutral-500"><span className="truncate">{request?.cashRecipientName || request?.requesterName || "Assigned recipient"}</span><span>{release.scheduledDate}</span></div></div>; })}</div> : <EmptyLine text="No cash is currently scheduled for release." />}
    </section>
    <section className="rounded-[10px] border border-border bg-card p-4 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
      <header className="mb-3 flex items-center gap-2"><Clock3 size={14} /><h3 className="text-[16px] font-semibold">Oldest outstanding cash</h3></header>
      {unsettled.length ? <div className="space-y-2">{unsettled.map((request) => <div key={request.id} className="flex items-center gap-2 border-b border-neutral-100 pb-2 text-[12px] last:border-0"><div className="min-w-0 flex-1"><strong className="block truncate">{request.cashRecipientName || request.requesterName}</strong><span className="text-neutral-500">{ageInDays(request.updatedAt)} day(s) open · {peso.format(request.releasedAmount || 0)}</span></div><StatusPill status={request.status} /></div>)}</div> : <EmptyLine text="No released cash is awaiting settlement." />}
    </section>
    <section className="rounded-[10px] border border-border bg-card p-4 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)] xl:col-span-2">
      <header className="mb-3 flex items-center gap-2"><History size={14} /><h3 className="text-[16px] font-semibold">Recent financial activity</h3></header>
      {data.ledger.length ? <div className="grid gap-2 sm:grid-cols-2">{data.ledger.slice(0, 6).map((entry) => <div key={entry.id} className="flex gap-2 rounded-xl border border-neutral-100 bg-neutral-50 p-3"><div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-neutral-500"><History size={10} /></div><div className="min-w-0"><div className="truncate text-[12px] font-medium capitalize">{entry.entryType.replace(/_/g, " ")}</div><div className="mt-0.5 truncate text-[12px] text-neutral-500">{entry.description}</div><div className="mt-1 text-[12px] text-neutral-500">{peso.format(entry.amount)} · {new Date(entry.createdAt).toLocaleString()}</div></div></div>)}</div> : <EmptyLine text="Audited financial actions will appear here." />}
    </section>
  </div>;
}

function EmptyLine({ text }: { text: string }) { return <div className="flex items-center gap-2 rounded-xl border border-dashed border-neutral-200 p-4 text-[12px] text-neutral-500"><AlertTriangle size={12} />{text}</div>; }
function ageInDays(timestamp: number) { return Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000)); }
