import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Banknote, CalendarClock, LockKeyhole, ReceiptText, Save } from "lucide-react";
import { createBudgetLine, DEFAULT_DAILY_PETTY_CASH_RELEASE_LIMIT, DEFAULT_LIQUIDATION_DUE_DAYS, DEFAULT_PER_RECEIPT_LIMIT, DEFAULT_UNDERUTILIZATION_THRESHOLD } from "../constants";
import type { DepartmentBudgetBundle } from "../types";
import { lockDepartmentFiscalBudget, saveDepartmentFiscalBudget } from "../services/budgetService";
import { peso } from "./budgetUi";
import { LockedBudgetControls } from "./LockedBudgetControls";

export function AnnualBudgetSetup({ orgId, fiscalYear, data, canEdit, onChanged }: { orgId: string; fiscalYear: number; data: DepartmentBudgetBundle; canEdit: boolean; onChanged: () => Promise<void> }) {
  const [annualAmount, setAnnualAmount] = useState(0);
  const [pettyLimit, setPettyLimit] = useState(DEFAULT_DAILY_PETTY_CASH_RELEASE_LIMIT);
  const [requestLimit, setRequestLimit] = useState(DEFAULT_PER_RECEIPT_LIMIT);
  const [liquidationDueDays, setLiquidationDueDays] = useState(DEFAULT_LIQUIDATION_DUE_DAYS);
  const [allowReceiptOverride, setAllowReceiptOverride] = useState(false);
  const [threshold, setThreshold] = useState(DEFAULT_UNDERUTILIZATION_THRESHOLD);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!data.summary) return;
    setAnnualAmount(data.summary.approvedAmount);
    setPettyLimit(data.summary.dailyPettyCashReleaseLimit); setRequestLimit(data.summary.perReceiptLimit);
    setLiquidationDueDays(data.summary.liquidationDueDays); setAllowReceiptOverride(data.summary.allowReceiptLimitOverride);
    setThreshold(data.summary.underutilizationThreshold); setNotes(data.summary.notes || "");
  }, [data.lines, data.summary]);
  const total = useMemo(() => Math.max(0, Number(annualAmount) || 0), [annualAmount]);
  const locked = data.summary?.status === "locked";
  const persistDraft = () => saveDepartmentFiscalBudget({
    orgId,
    fiscalYear,
    pettyCashLimit: pettyLimit,
    requestLimit,
    liquidationDueDays,
    allowReceiptLimitOverride: allowReceiptOverride,
    threshold,
    notes,
    lines: [{
      ...createBudgetLine(0),
      id: data.lines[0]?.id || crypto.randomUUID(),
      expenseClass: "Annual Department Budget",
      category: "Available Appropriation",
      particular: `Fiscal year ${fiscalYear} department budget`,
      fundSource: "Department appropriation",
      amount: total,
    }],
  });
  const save = async () => { setBusy(true); setMessage(""); try { await persistDraft(); setMessage("Annual budget draft saved."); await onChanged(); } catch (error) { setMessage(error instanceof Error ? error.message : "Budget could not be saved."); } finally { setBusy(false); } };
  const lock = async () => { if (!window.confirm(`Lock the ${fiscalYear} department budget at ${peso.format(total)}? It cannot be edited afterward.`)) return; setBusy(true); setMessage(""); try { const budgetId = await persistDraft(); await lockDepartmentFiscalBudget(budgetId); setMessage("Annual budget saved and locked."); await onChanged(); } catch (error) { setMessage(error instanceof Error ? error.message : "Budget could not be locked."); } finally { setBusy(false); } };
  return <div className="space-y-4">
    <div className="rounded-[10px] border border-border bg-card p-5 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Fiscal year {fiscalYear}</div><h2 className="mt-1 text-[16px] font-semibold text-foreground">Annual department budget</h2><p className="mt-1 text-[12px] text-secondary-foreground">The Department Head defines the annual envelope once. Published proposals reserve funds from this locked total.</p></div><div className="text-right"><div className="text-[11px] uppercase tracking-wide text-muted-foreground">Annual total</div><div className="mt-1 text-[20px] font-semibold text-foreground tabular-nums">{peso.format(total)}</div></div></div>
      {locked && <div className="mt-4 flex gap-2 rounded-[14px] border border-emerald-200 bg-emerald-50 p-3 text-[12px] text-emerald-800"><LockKeyhole size={14} className="shrink-0" /><span>This annual budget is locked. New proposal commitments and expenses are recorded without changing the original appropriation.</span></div>}
      {!canEdit && !locked && <div className="mt-4 flex gap-2 rounded-[14px] border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800"><AlertTriangle size={14} className="shrink-0" />Only the assigned Department Head can prepare and lock the annual budget. Assistant Heads can monitor it and approve operational requests.</div>}
    </div>
    <div className="rounded-[10px] border border-border bg-card p-5 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Banknote size={17} /></div>
        <div className="min-w-0 flex-1"><h3 className="text-[14px] font-semibold text-neutral-900">Annual spending authority</h3><p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-neutral-600">Enter the department’s complete authorized budget for {fiscalYear}. Individual expense categories belong inside each proposal, where their detailed budget will reserve money from this amount.</p></div>
        <label className="w-full sm:w-72"><span className="text-[12px] text-neutral-600">Annual department budget</span><div className="relative mt-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-neutral-400">₱</span><input type="number" min={0} step="0.01" disabled={!canEdit || locked} value={annualAmount || ""} onChange={(event) => setAnnualAmount(Number(event.target.value))} placeholder="0.00" className="h-11 w-full rounded-xl border border-neutral-200 pl-8 pr-3 text-right text-[14px] font-semibold tabular-nums disabled:bg-neutral-50" /></div></label>
      </div>
    </div>
    <section className="rounded-[10px] border border-border bg-card p-5 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
      <div className="flex items-start gap-3"><div className="rounded-[14px] bg-primary/10 p-2.5 text-primary"><CalendarClock size={16} /></div><div><h3 className="text-[14px] font-semibold text-foreground">Cash release and liquidation controls</h3><p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-secondary-foreground">Petty cash is not a separate annual pool. Requests consume the funded task allocation. The daily ceiling controls how much physical cash the department may release per day; approved excess is scheduled on the next available date.</p></div></div>
      <div className="mt-4 grid gap-4 md:grid-cols-4"><NumberField label="Daily cash release ceiling" value={pettyLimit} onChange={setPettyLimit} disabled={!canEdit || locked} /><NumberField label="Per-receipt review threshold" value={requestLimit} onChange={setRequestLimit} disabled={!canEdit || locked} /><NumberField label="Liquidation due after release (days)" value={liquidationDueDays} onChange={setLiquidationDueDays} disabled={!canEdit || locked} /><NumberField label="Q4 utilization target (%)" value={threshold} onChange={setThreshold} disabled={!canEdit || locked} /></div>
      <label className="mt-4 flex items-start gap-3 rounded-[14px] border border-border bg-muted/50 p-3"><input type="checkbox" disabled={!canEdit || locked} checked={allowReceiptOverride} onChange={(event) => setAllowReceiptOverride(event.target.checked)} className="mt-0.5" /><ReceiptText size={14} className="mt-0.5 text-muted-foreground" /><span><span className="block text-[12px] font-medium text-foreground">Allow justified receipts above the review threshold</span><span className="mt-0.5 block text-[12px] text-secondary-foreground">The threshold is not a request cap. When enabled, a receipt above it requires a written exception reason and remains visible to both reviewers.</span></span></label>
      <label className="mt-4 block"><span className="text-[12px] text-neutral-600">Budget notes</span><textarea disabled={!canEdit || locked} value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-[12px] disabled:bg-neutral-50" /></label>
    </section>
    {message && <div className={`rounded-xl border px-4 py-3 text-[12px] ${/could not|invalid|only|enough/i.test(message) ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{message}</div>}
    {canEdit && !locked && <div className="flex justify-end gap-2"><button disabled={busy} onClick={save} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-[12px] font-medium text-foreground"><Save size={12} /> Save draft</button><button disabled={busy || total <= 0} onClick={lock} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-[12px] font-medium text-primary-foreground disabled:opacity-40"><LockKeyhole size={12} /> Save &amp; lock annual budget</button></div>}
    {locked && <LockedBudgetControls data={data} canManage={canEdit} onChanged={onChanged} />}
  </div>;
}

function NumberField({ label, value, onChange, disabled }: { label: string; value: number; onChange: (value: number) => void; disabled: boolean }) { return <label><span className="text-[12px] text-neutral-600">{label}</span><input type="number" min={0} step="0.01" disabled={disabled} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-1 h-10 w-full rounded-xl border border-neutral-200 px-3 text-[12px] tabular-nums disabled:bg-neutral-50" /></label>; }
