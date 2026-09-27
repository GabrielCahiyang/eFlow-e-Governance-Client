import { useMemo, useRef, useState } from "react";
import { Banknote, Loader2, Pencil, Plus, ShieldCheck, Trash2, WalletCards } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import type { Task } from "../../tasks";
import { getTaskLeadId } from "../../tasks";
import type { Subtask } from "../../subtasks";
import { getCurrentFiscalYear } from "../constants";
import { useDepartmentBudget } from "../hooks/useDepartmentBudget";
import { useTaskFundingContext } from "../hooks/useTaskFundingContext";
import { removeSubtaskBudgetCap, setSubtaskBudgetCap } from "../services/budgetService";
import type { PettyCashRequest } from "../types";
import { peso } from "./budgetUi";
import { CashRequestForm } from "./CashRequestForm";
import { CashRequestTimeline } from "./CashRequestTimeline";

interface WorkBudgetCardProps {
  task: Task;
  subtask?: Subtask;
  canManage?: boolean;
}

const ACTIVE_REQUEST_STATES = new Set([
  "pending", "pending_leader_review", "leader_changes_requested", "pending_department_approval",
  "department_changes_requested", "approved", "scheduled_for_release", "partially_released", "released",
  "liquidation_draft", "liquidation_submitted", "pending_leader_liquidation_review",
  "pending_department_settlement", "changes_requested", "overdue_liquidation",
]);

const TEMPORARY_HOLD_STATES = new Set(["pending", "pending_leader_review", "pending_department_approval"]);
const APPROVED_CASH_STATES = new Set([
  "approved", "scheduled_for_release", "partially_released", "released", "liquidation_draft",
  "liquidation_submitted", "pending_leader_liquidation_review", "pending_department_settlement",
  "changes_requested", "overdue_liquidation",
]);

export function WorkBudgetCard({ task, subtask, canManage = false }: WorkBudgetCardProps) {
  const { userProfile } = useAuth();
  const orgId = task.orgId || userProfile?.org_id || userProfile?.departmentId || "";
  const budget = useDepartmentBudget(orgId, getCurrentFiscalYear());
  const version = useMemo(() => [
    ...budget.allocations.map((item) => `${item.id}:${item.status}:${item.amount}`),
    ...budget.requests.map((item) => `${item.id}:${item.status}:${item.requestedAmount}:${item.updatedAt}`),
  ].join("|"), [budget.allocations, budget.requests]);
  const funding = useTaskFundingContext(task.id, subtask?.id, version);
  const [requestOpen, setRequestOpen] = useState(false);
  const [correction, setCorrection] = useState<PettyCashRequest>();
  const [capOpen, setCapOpen] = useState(false);
  const [capLineId, setCapLineId] = useState("");
  const [capAmount, setCapAmount] = useState(0);
  const [capReason, setCapReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const capCommandKey = useRef(crypto.randomUUID());

  const currentUserId = userProfile?.id || "";
  const isTaskLeader = currentUserId === getTaskLeadId(task);
  const isAssignedContributor = Boolean(subtask?.assignedToIds.includes(currentUserId));
  const context = funding.context;
  const canRequest = Boolean(context?.funded && budget.summary?.status === "locked" && (subtask ? isAssignedContributor || isTaskLeader : isTaskLeader));
  const canManageCap = Boolean(subtask && canManage && isTaskLeader && context?.funded);
  const requests = budget.requests.filter((request) => request.taskId === task.id && (subtask ? request.subtaskId === subtask.id : !request.subtaskId));
  const capRequests = context?.cap ? budget.requests.filter((request) => request.allocationId === context.cap?.id) : [];
  const capHasActiveRequest = capRequests.some((request) => ACTIVE_REQUEST_STATES.has(request.status));
  const poolRequests = context
    ? budget.requests.filter((request) => request.allocationId === (context.cap?.id || context.taskAllocationId))
    : [];
  const temporaryHeld = poolRequests
    .filter((request) => TEMPORARY_HOLD_STATES.has(request.status))
    .reduce((sum, request) => sum + (request.approvedAmount ?? request.requestedAmount), 0);
  const approvedCash = poolRequests
    .filter((request) => APPROVED_CASH_STATES.has(request.status))
    .reduce((sum, request) => sum + (request.approvedAmount ?? request.requestedAmount), 0);
  const settledSpending = poolRequests
    .filter((request) => request.status === "settled")
    .reduce((sum, request) => sum + (request.actualSpent || 0), 0);
  const protectedCaps = context?.cap ? 0 : budget.allocations
    .filter((allocation) => allocation.taskId === task.id && allocation.subtaskId && allocation.status === "approved")
    .reduce((sum, allocation) => sum + allocation.amount, 0);
  const correctionWaiting = requests.some((request) => ["leader_changes_requested", "department_changes_requested"].includes(request.status));

  const refresh = async () => {
    await budget.refresh();
    await funding.refresh();
  };

  const openCap = () => {
    if (!context) return;
    setError("");
    setCapLineId(context.cap?.allocationLineId || context.lines.find((line) => line.available > 0)?.id || context.lines[0]?.id || "");
    setCapAmount(context.cap?.amount || 0);
    setCapReason(context.cap?.reason || "");
    setCapOpen(true);
    capCommandKey.current = crypto.randomUUID();
  };

  const saveCap = async () => {
    if (!subtask) return;
    setBusy(true);
    setError("");
    try {
      await setSubtaskBudgetCap({ taskId: task.id, subtaskId: subtask.id, allocationLineId: capLineId, amount: capAmount, reason: capReason, idempotencyKey: capCommandKey.current });
      setCapOpen(false);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The subtask cap could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const removeCap = async () => {
    if (!context?.cap) return;
    const reason = window.prompt("Why should the unused cap return to the shared task pool?");
    if (!reason?.trim()) return;
    setBusy(true);
    setError("");
    try {
      await removeSubtaskBudgetCap({ capId: context.cap.id, reason, idempotencyKey: crypto.randomUUID() });
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The subtask cap could not be removed.");
    } finally {
      setBusy(false);
    }
  };

  if (!budget.summary && !budget.loading) return null;
  const selectedCapLine = context?.lines.find((line) => line.id === capLineId);
  const capMaximum = (selectedCapLine?.available || 0) + (context?.cap?.allocationLineId === capLineId ? context.cap.amount : 0);

  return (
    <section className="rounded-[10px] border border-border bg-card p-3 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-2">
          <div className="rounded-lg bg-primary/10 p-2 text-primary"><Banknote size={14} /></div>
          <div className="min-w-0">
            <div className="text-[9px] uppercase tracking-wide text-emerald-700">{subtask ? "Subtask funding" : "Task funding"}</div>
            {funding.loading ? <div className="mt-1 flex items-center gap-1 text-[10px] text-neutral-500"><Loader2 size={10} className="animate-spin" /> Calculating availability…</div>
              : context?.funded ? <div className="mt-1 text-right"><strong className="text-[14px] tabular-nums text-foreground">{peso.format(context.available)}</strong><span className="ml-1 text-[9.5px] text-muted-foreground">requestable now {context.cap ? `inside ${peso.format(context.cap.amount)} cap` : "from shared task pool"}</span></div>
                : <div className="mt-1 text-[10.5px] text-neutral-600">No approved funding for this task</div>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {canManageCap && <button type="button" disabled={busy || capHasActiveRequest} onClick={openCap} title={capHasActiveRequest ? "Settle, reject, or cancel the active request before changing this cap." : undefined} className="inline-flex h-7 items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2 text-[8.8px] text-emerald-800 disabled:opacity-40">{context?.cap ? <Pencil size={9} /> : <Plus size={9} />}{context?.cap ? "Edit cap" : "Set cap"}</button>}
          {canManageCap && context?.cap && <button type="button" disabled={busy || capHasActiveRequest} onClick={() => void removeCap()} title={capHasActiveRequest ? "An active request depends on this cap." : undefined} className="inline-flex h-7 items-center gap-1 rounded-lg border border-rose-200 bg-white px-2 text-[8.8px] text-rose-700 disabled:opacity-40"><Trash2 size={9} /> Remove</button>}
          {canRequest && !requestOpen && !correction && context && context.available > 0 && <button type="button" onClick={() => setRequestOpen(true)} className="inline-flex h-7 items-center gap-1 rounded-lg bg-emerald-700 px-2.5 text-[8.8px] text-white"><WalletCards size={9} /> Request cash</button>}
        </div>
      </header>

      {context?.funded && <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-[9.5px] text-primary">
        {subtask
          ? context.cap
            ? `${peso.format(context.cap.available)} remains inside this protected subtask cap. Requests still require operational endorsement and fiscal authorization.`
            : `${peso.format(context.available)} is available from the shared parent-task pool. Request only the amount this subtask needs.`
          : `${peso.format(context.available)} remains on the approved task budget. Task Leader requests route directly to fiscal authorization.`}
      </div>}

      {context?.funded && <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <FundingMetric label={context.cap ? "Protected cap" : "Approved task budget"} value={context.cap?.amount || context.taskBudget} />
        <FundingMetric label="Temporary holds" value={temporaryHeld} tone={temporaryHeld > 0 ? "amber" : "neutral"} />
        <FundingMetric label="Approved cash" value={approvedCash} />
        <FundingMetric label="Settled spending" value={settledSpending} />
        {!context.cap && protectedCaps > 0 && <FundingMetric label="Protected in caps" value={protectedCaps} />}
      </div>}

      {temporaryHeld > 0 && <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[8.8px] text-amber-800">A pending request temporarily reduces what others may request, but it is not approved spending and has not been released.</div>}
      {correctionWaiting && <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-2 text-[8.8px] text-blue-800">A returned request holds no funds. Its amount is checked and temporarily held again only when the employee resubmits it.</div>}

      {context?.lines.length ? <div className="mt-2 space-y-1">{context.lines.filter((line) => line.available > 0 || context.cap?.allocationLineId === line.id).map((line) => <div key={line.id} className="flex items-center justify-between gap-3 rounded-md bg-muted/45 px-2.5 py-1.5 text-[8.8px]"><span className="min-w-0 truncate text-muted-foreground">{line.category} · {line.particular} · {line.fundSource}</span><span className="shrink-0 text-right"><strong className="block tabular-nums text-primary">{peso.format(line.available)} requestable</strong><span className="text-[7.8px] tabular-nums text-muted-foreground">of {peso.format(line.amount)} approved</span></span></div>)}</div> : null}

      {capOpen && context && subtask && <div className="mt-3 space-y-2 rounded-xl border border-emerald-200 bg-white p-3"><div><div className="text-[10px] font-semibold">{context.cap ? "Edit protected subtask cap" : "Protect part of the shared task pool"}</div><div className="mt-0.5 text-[8.8px] text-neutral-500">The cap reserves funds immediately. It cannot change while an active request depends on it.</div></div><select value={capLineId} onChange={(event) => { setCapLineId(event.target.value); setCapAmount(0); }} className="h-9 w-full rounded-lg border border-emerald-200 px-2.5 text-[10px]"><option value="">Select budget line and fund source…</option>{context.lines.map((line) => <option key={line.id} value={line.id}>{line.category} · {line.particular} · {line.fundSource} · {peso.format(line.available)} shared</option>)}</select>{selectedCapLine && <div className="text-[9px] text-emerald-800">Maximum protectable: <strong>{peso.format(capMaximum)}</strong></div>}<div className="grid gap-2 sm:grid-cols-[.45fr_1fr_auto]"><input type="number" min={0} max={capMaximum} step="0.01" value={capAmount || ""} onChange={(event) => setCapAmount(Number(event.target.value))} placeholder="Amount" className="h-9 rounded-lg border border-emerald-200 px-2.5 text-[10px]" /><input value={capReason} onChange={(event) => setCapReason(event.target.value)} placeholder="Why protect this amount?" className="h-9 rounded-lg border border-emerald-200 px-2.5 text-[10px]" /><button type="button" disabled={busy || !capLineId || capAmount <= 0 || capAmount > capMaximum || !capReason.trim()} onClick={() => void saveCap()} className="inline-flex h-9 items-center gap-1 rounded-lg bg-emerald-700 px-3 text-[9px] text-white disabled:opacity-40"><ShieldCheck size={10} /> Save cap</button></div><button type="button" onClick={() => setCapOpen(false)} className="text-[9px] text-neutral-500 underline">Cancel</button></div>}

      {(requestOpen || correction) && context && <CashRequestForm context={context} orgId={orgId} taskId={task.id} subtaskId={subtask?.id} currentUserId={currentUserId} correction={correction} onCancel={() => { setRequestOpen(false); setCorrection(undefined); }} onSaved={async () => { setRequestOpen(false); setCorrection(undefined); await refresh(); }} />}

      <CashRequestTimeline data={budget} requests={requests} currentUserId={currentUserId} orgId={orgId} onCorrect={(request) => { setCorrection(request); setRequestOpen(false); }} onChanged={refresh} />

      {(error || funding.error || budget.error) && <div className="mt-2 rounded-lg bg-rose-50 p-2 text-[9px] text-rose-700">{error || funding.error || budget.error}</div>}
    </section>
  );
}

function FundingMetric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "amber" }) {
  return <div className={`rounded-lg border px-2.5 py-2 ${tone === "amber" ? "border-amber-200 bg-amber-50" : "border-border bg-muted/35"}`}><div className="text-[7.8px] uppercase tracking-wide text-muted-foreground">{label}</div><strong className={`mt-0.5 block text-right text-[9.5px] tabular-nums ${tone === "amber" ? "text-amber-800" : "text-foreground"}`}>{peso.format(value)}</strong></div>;
}
