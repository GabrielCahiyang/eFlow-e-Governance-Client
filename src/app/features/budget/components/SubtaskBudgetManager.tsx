import { useRef, useState, type FormEvent } from "react";
import { Plus, WalletCards } from "lucide-react";
import { Modal, ModalButton } from "../../../components/ui/Modal";
import { MoneyInput } from "../../../components/ui/MoneyInput";
import { removeSubtaskBudgetCap, setSubtaskBudgetCap } from "../services/budgetService";
import type { SubtaskBudgetRow, TaskFundingContext } from "../types";
import { peso } from "./budgetUi";

export function SubtaskBudgetTotals({ context, subtask = false }: { context: TaskFundingContext; subtask?: boolean }) {
  const totals = context.distribution;
  if (!totals) return null;
  const amounts = subtask
    ? [...(context.cap ? [["Subtask budget", context.cap.amount]] as const : []),
       [context.cap ? "Available to request" : "Available from task budget", context.available],
       ["Cash released", totals.released], ["Actual spent", totals.spent]] as const
    : [["Approved task budget", context.taskBudget], ["Allocated to subtasks", totals.allocated],
       ["Unallocated", totals.unallocated], ["Available to allocate", totals.available],
       ["Cash released", totals.released], ["Actual spent", totals.spent]] as const;
  return <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-2">
    {amounts.map(([label, value]) => <div key={label} className="min-w-0 rounded-lg border border-border bg-muted/50 px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold tabular-nums">{peso.format(value)}</dd>
    </div>)}
  </dl>;
}

interface Draft {
  id: string;
  mode: "save" | "return";
  source: string;
  amount: string;
  reason: string;
}

export function SubtaskBudgetManager({ context, title, canManage, taskFinished, onChanged, onClose }: {
  context: TaskFundingContext;
  title: string;
  canManage: boolean;
  taskFinished: boolean;
  onChanged: () => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Draft>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const attempt = useRef<{ signature: string; key: string } | undefined>(undefined);
  const rows = context.subtaskBudgets ?? [];
  const sources = context.parentSources ?? [];
  const row = rows.find(item => item.id === draft?.id);
  const finished = taskFinished || row?.finished;
  const floor = Math.max(0, Math.round(((row?.amount ?? 0) - (row?.returnable ?? 0)) * 100) / 100);
  const available = sources.find(item => item.id === draft?.source)?.available ?? 0;
  const maximum = finished ? row?.amount ?? 0
    : Math.round((available + (row && row.sourceId === draft?.source ? row.amount : 0)) * 100) / 100;
  const amount = Number(draft?.amount);
  const amountError = draft?.amount && amount > maximum
    ? `This account has only ${peso.format(maximum)} for this subtask.`
    : draft?.amount && amount < floor ? `Keep at least ${peso.format(floor)} for recorded spending.` : "";

  function edit(item: SubtaskBudgetRow, mode: Draft["mode"]) {
    setNotice("");
    setError("");
    setDraft({ id: item.id, mode, source: item.sourceId || sources.find(source => source.available > 0)?.id || "",
      amount: item.amount > 0 ? String(item.amount) : "", reason: "" });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft || !row || busy || !canManage || row.blocked) return;
    const reason = draft.reason.trim();
    if (!reason) return setError("Enter a reason for this budget change.");
    if (draft.mode === "save" && (!draft.source || !Number.isFinite(amount) || amount <= 0 || amount < floor || amount > maximum))
      return setError(`Enter an amount between ${peso.format(Math.max(0.01, floor))} and ${peso.format(maximum)}.`);
    const signature = JSON.stringify([draft.mode, row.id, row.capId, draft.source, draft.amount, reason]);
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() };
    setBusy(true);
    setError("");
    try {
      if (draft.mode === "return" && row.capId) {
        await removeSubtaskBudgetCap({ capId: row.capId, reason, idempotencyKey: attempt.current.key });
      } else {
        await setSubtaskBudgetCap({ taskId: context.taskId, subtaskId: row.id, allocationLineId: draft.source,
          amount, reason, idempotencyKey: attempt.current.key });
      }
      attempt.current = undefined;
      setDraft(undefined);
      setNotice(draft.mode === "return" ? "Unused funding returned to the task." : "Subtask budget saved.");
      await onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save this budget change.");
    } finally {
      setBusy(false);
    }
  }

  return <Modal isOpen title="Manage subtask budgets" description={title} width="max-w-4xl" preventClose={busy}
    onClose={onClose} footer={<ModalButton disabled={busy} onClick={onClose}>Close</ModalButton>}>
    <div className="space-y-4">
      <SubtaskBudgetTotals context={context} />
      <p className="text-sm text-muted-foreground">Subtask budgets use the task’s approved funding. Cash requests and releases are handled separately.</p>
      {notice && <p role="status" className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{notice}</p>}
      <ul className="divide-y divide-border rounded-xl border border-border">
        {rows.map(item => <li key={item.id} className="px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="break-words text-sm font-semibold">{item.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{item.capId
                ? `${sources.find(source => source.id === item.sourceId)?.name || "Approved account"} · ${peso.format(item.returnable)} unused`
                : "Uses parent task budget"}</p>
              {item.blocked && <p className="mt-1 text-xs text-muted-foreground">Resolve the open cash request to change this budget.</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <strong className="mr-1 text-sm tabular-nums">{peso.format(item.amount)}</strong>
              {item.capId && item.returnable > 0 && <ModalButton disabled={!canManage || busy || item.blocked} onClick={() => edit(item, "return")}>Return unused</ModalButton>}
              {!(taskFinished || item.finished) && <ModalButton disabled={!canManage || busy || item.blocked || (!item.capId && !sources.some(source => source.available > 0))}
                onClick={() => edit(item, "save")}>{item.capId ? "Edit budget" : "Allocate"}</ModalButton>}
            </div>
          </div>
          {row?.id === item.id && draft && <form onSubmit={submit} className="mt-3 space-y-3 rounded-lg border border-border bg-muted/40 p-3">
            <fieldset disabled={busy || !canManage || row.blocked} className="space-y-3">
              {draft.mode === "save" ? <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
                <label className="grid gap-1 text-sm">Funding account
                  <select value={draft.source} disabled={row.hasHistory || !!finished} required onChange={event => setDraft({ ...draft, source: event.target.value })}
                    className="min-w-0 rounded-md border border-border bg-background px-3 py-2">
                    <option value="">Choose an account</option>
                    {sources.filter(source => source.available > 0 || source.id === row.sourceId).map(source =>
                      <option key={source.id} value={source.id}>{source.name} · {peso.format(source.available)} free</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-sm">New budget
                  <MoneyInput required value={draft.amount} min={Math.max(0.01, floor)} max={maximum} onValueChange={raw => setDraft({ ...draft, amount: raw })}
                    className="min-w-0 rounded-md border border-border bg-background px-3 py-2" />
                  <small className={amountError ? "text-destructive" : "text-muted-foreground"}>
                    {amountError || `Maximum ${peso.format(maximum)}`}
                  </small>
                </label>
              </div> : <p className="text-sm">Return {peso.format(item.returnable)} to the parent task’s available budget.</p>}
              <label className="grid gap-1 text-sm">Reason
                <input value={draft.reason} required maxLength={3000} onChange={event => setDraft({ ...draft, reason: event.target.value })}
                  className="rounded-md border border-border bg-background px-3 py-2" />
              </label>
              <div className="flex justify-end gap-2">
                <ModalButton onClick={() => { setDraft(undefined); setError(""); }}>Cancel</ModalButton>
                <ModalButton variant="primary" type="submit">{busy ? "Saving…" : draft.mode === "return" ? "Confirm return" : "Save budget"}</ModalButton>
              </div>
            </fieldset>
          </form>}
        </li>)}
        {!rows.length && <li className="px-4 py-6 text-center text-sm text-muted-foreground">There are no subtasks to fund yet.</li>}
      </ul>
      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
    </div>
  </Modal>;
}

export function SubtaskBudgetButton({ hasAllocation, subtask, onClick }: { hasAllocation: boolean; subtask: boolean; onClick: () => void }) {
  const Icon = subtask && !hasAllocation ? Plus : WalletCards;
  return <button type="button" className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground" onClick={onClick}>
    <Icon size={15} aria-hidden="true" />{subtask ? hasAllocation ? "Manage budget" : "Allocate budget" : "Manage subtask budgets"}
  </button>;
}
