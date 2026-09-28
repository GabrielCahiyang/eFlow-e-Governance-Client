import { useState } from "react";
import { Archive, History, PencilLine } from "lucide-react";
import type { DepartmentBudgetBundle } from "../types";
import { adjustDepartmentFiscalBudget, closeDepartmentFiscalBudget } from "../services/budgetService";
import { peso } from "./budgetUi";

export function LockedBudgetControls({ data, canManage, onChanged }: { data: DepartmentBudgetBundle; canManage: boolean; onChanged: () => Promise<void> }) {
  const summary = data.summary;
  const [mode, setMode] = useState<"" | "adjust" | "close">("");
  const [amount, setAmount] = useState(summary?.approvedAmount || 0);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  if (!summary || summary.status === "draft") return null;

  const submit = async () => {
    setBusy(true); setMessage("");
    try {
      if (mode === "adjust") await adjustDepartmentFiscalBudget({ budgetId: summary.id, adjustedAmount: amount, reason });
      if (mode === "close") await closeDepartmentFiscalBudget(summary.id, reason);
      setMode(""); setReason(""); await onChanged();
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "The fiscal action could not be completed."); }
    finally { setBusy(false); }
  };

  return <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-[12px] font-semibold text-neutral-900"><History size={14} /> Locked-budget controls</div><p className="mt-1 text-[10px] text-neutral-500">The original appropriation is immutable. Corrections create an audited before/after adjustment; fiscal close is blocked while cash remains unsettled.</p></div>{canManage && summary.status === "locked" && <div className="flex gap-2"><button onClick={() => { setMode("adjust"); setAmount(summary.approvedAmount); }} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 px-3 text-[10px]"><PencilLine size={11} /> Adjust appropriation</button><button onClick={() => setMode("close")} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 text-[10px] text-amber-800"><Archive size={11} /> Close fiscal year</button></div>}</div>
    {mode && <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4"><div className="text-[11px] font-medium">{mode === "adjust" ? "Audited appropriation adjustment" : "Close this fiscal year"}</div>{mode === "adjust" && <label className="mt-3 block"><span className="text-[9.5px] text-neutral-500">New annual appropriation</span><div className="relative mt-1"><span className="absolute left-3 top-2.5 text-[11px] text-neutral-400">₱</span><input type="number" min={summary.committedAmount} step="0.01" value={amount || ""} onChange={(event) => setAmount(Number(event.target.value))} className="h-9 w-full rounded-lg border border-neutral-200 pl-7 pr-3 text-[10.5px]" /></div><span className="mt-1 block text-[9px] text-neutral-400">Cannot be lower than active commitments: {peso.format(summary.committedAmount)}</span></label>}<label className="mt-3 block"><span className="text-[9.5px] text-neutral-500">Required reason</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder={mode === "adjust" ? "Reference the approved supplemental or correction authority." : "Record the fiscal close authority and confirmation."} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-[10px]" /></label><div className="mt-3 flex justify-end gap-2"><button onClick={() => { setMode(""); setReason(""); }} className="h-8 rounded-lg border border-neutral-200 bg-white px-3 text-[9.5px]">Cancel</button><button disabled={busy || !reason.trim() || (mode === "adjust" && amount < summary.committedAmount)} onClick={() => void submit()} className="h-8 rounded-lg bg-primary px-3 text-[9.5px] text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40">{mode === "adjust" ? "Record adjustment" : "Close fiscal year"}</button></div></div>}
    {message && <div className="mt-3 rounded-lg bg-rose-50 p-3 text-[10px] text-rose-700">{message}</div>}
    {data.adjustments.length > 0 && <div className="mt-4 overflow-hidden rounded-xl border border-neutral-100"><div className="bg-neutral-50 px-3 py-2 text-[9px] uppercase tracking-wide text-neutral-400">Adjustment history</div>{data.adjustments.map((item) => <div key={item.id} className="grid gap-2 border-t border-neutral-100 px-3 py-2.5 text-[9.5px] sm:grid-cols-[auto_auto_1fr_auto]"><span>{peso.format(item.previousAmount)}</span><span>→ {peso.format(item.adjustedAmount)}</span><span className="text-neutral-500">{item.reason}</span><span className="text-neutral-400">{new Date(item.createdAt).toLocaleString()}</span></div>)}</div>}
  </section>;
}
