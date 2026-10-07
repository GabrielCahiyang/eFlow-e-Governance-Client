import { useMemo, useRef, useState } from "react";
import { Paperclip, Send } from "lucide-react";
import type { CashFundingLine, PettyCashRequest, TaskFundingContext } from "../types";
import { createVoucherCashRequest } from "../services/pettyCashVoucherService";
import {
  createContextualCashRequest,
  resubmitContextualCashRequest,
  uploadCashRequestAttachment,
} from "../services/budgetService";
import {
  getPhilippineCalendarDate,
  isPastCashNeededBy,
} from "../selectors/cashWorkflowRules";
import { peso } from "./budgetUi";

export function CashRequestForm({
  context,
  orgId,
  taskId,
  subtaskId,
  currentUserId,
  correction,
  onCancel,
  onSaved,
}: {
  context: TaskFundingContext;
  orgId: string;
  taskId: string;
  subtaskId?: string;
  currentUserId: string;
  correction?: PettyCashRequest;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const defaultLineId = correction?.allocationLineId || context.cap?.allocationLineId || context.lines.find((line) => line.available > 0)?.id || context.lines[0]?.id || "";
  const [lineId, setLineId] = useState(defaultLineId);
  const [amount, setAmount] = useState(correction?.fundingLines?.find(l=>l.allocationLineId===defaultLineId)?.amount || correction?.requestedAmount || 0);
  const [extraLines,setExtraLines]=useState<CashFundingLine[]>(correction?.fundingLines?.filter(l=>l.allocationLineId!==defaultLineId)||[]);
  const [purpose, setPurpose] = useState(correction?.purpose || "");
  const [neededBy, setNeededBy] = useState(correction?.neededBy || "");
  const [attachment, setAttachment] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const idempotencyKey = useRef(crypto.randomUUID());
  const today = getPhilippineCalendarDate();
  const pastNeededBy = isPastCashNeededBy(neededBy, today);
  const selectedLine = context.lines.find((line) => line.id === lineId);
  const requestable = useMemo(
    () => Math.max(0, selectedLine?.available || 0),
    [correction, lineId, selectedLine?.available],
  );

  const submit = async () => {
    if (!selectedLine) return;
    if (pastNeededBy) {
      setError("Needed-by date cannot be earlier than today.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const requestId = context.supportsItemizedCash ? await createVoucherCashRequest({taskId,subtaskId,lines:[{allocationLineId:lineId,amount},...extraLines],purpose,neededBy,key:idempotencyKey.current,existingId:correction?.id}) : correction?.id || await createContextualCashRequest({
        taskId,
        subtaskId,
        allocationLineId: selectedLine.id,
        amount,
        purpose,
        neededBy,
        idempotencyKey: idempotencyKey.current,
      });
      if (correction && !context.supportsItemizedCash) {
        await resubmitContextualCashRequest({
          requestId: correction.id,
          allocationLineId: selectedLine.id,
          amount,
          purpose,
          neededBy,
        });
      }
      if (attachment) await uploadCashRequestAttachment({ orgId, requestId, file: attachment });
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The cash request could not be submitted.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-emerald-200 bg-white p-3">
      <div>
        <div className="text-[10.5px] font-semibold text-neutral-900">{correction ? "Correct cash request" : "What needs to be purchased?"}</div>
        <div className="mt-0.5 text-[9px] text-neutral-500">
          {currentUserId === context.taskLeaderId
            ? "Your task-level request skips self-endorsement and routes directly to fiscal authorization."
            : "Submitting reserves the amount immediately. Your Task Leader endorses it before fiscal authorization."}
        </div>
      </div>
      {context.supportsItemizedCash && <div className="space-y-2">
        {extraLines.map((line,i)=><div key={i} className="grid gap-2 sm:grid-cols-[1fr_120px_auto]"><select aria-label={`Additional funding source ${i+1}`} value={line.allocationLineId} onChange={e=>setExtraLines(rows=>rows.map((r,j)=>i===j?{...r,allocationLineId:e.target.value}:r))} className="h-9 rounded-lg border px-2 text-[12px]"><option value="">Choose another approved source</option>{context.lines.map(l=><option key={l.id} value={l.id}>{l.category} · {peso.format(l.available)} available</option>)}</select><input aria-label={`Additional funding amount ${i+1}`} type="number" min="0" step="0.01" value={line.amount||""} onChange={e=>setExtraLines(rows=>rows.map((r,j)=>i===j?{...r,amount:Number(e.target.value)}:r))} className="h-9 rounded-lg border px-2 text-right text-[12px]"/><button type="button" onClick={()=>setExtraLines(rows=>rows.filter((_,j)=>i!==j))} className="text-[12px]">Remove</button></div>)}
        {!context.cap&&<button type="button" onClick={()=>setExtraLines(rows=>[...rows,{allocationLineId:"",amount:0}])} className="rounded-lg border px-3 py-2 text-[12px]">Add another approved funding line</button>}
        <p className="text-[12px] font-semibold">Request total: {peso.format(amount+extraLines.reduce((sum,l)=>sum+l.amount,0))}</p>
      </div>}
      <label className="block">
        <span className="text-[9.5px] text-neutral-500">Proposal budget line and fund source</span>
        <select value={lineId} onChange={(event) => { setLineId(event.target.value); setAmount(0); }} className="mt-1 h-9 w-full rounded-lg border border-emerald-200 bg-white px-2.5 text-[10px]">
          <option value="">Select accounting source…</option>
          {context.lines.map((line) => (
            <option key={line.id} value={line.id} disabled={line.available <= 0 && correction?.allocationLineId !== line.id}>
              {line.category} · {line.particular} · {line.fundSource} · {peso.format(line.available)} available
            </option>
          ))}
        </select>
      </label>
      {selectedLine && <div className="rounded-lg bg-emerald-50 px-3 py-2 text-[9.5px] text-emerald-800">Requestable now: <strong>{peso.format(requestable)}</strong></div>}
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Amount" type="number" value={amount || ""} onChange={(value) => setAmount(Number(value))} />
        <Field
          label="Needed by"
          type="date"
          value={neededBy}
          min={today}
          invalid={pastNeededBy}
          onChange={setNeededBy}
        />
      </div>
      {pastNeededBy && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[9.5px] text-rose-700">
          Needed-by date cannot be earlier than today.
        </div>
      )}
      <label className="block">
        <span className="text-[9.5px] text-neutral-500">Purchase and purpose</span>
        <textarea value={purpose} onChange={(event) => setPurpose(event.target.value)} rows={3} placeholder="Example: Buy two boxes of ball pens for the registration desk" className="mt-1 w-full rounded-lg border border-neutral-200 px-2.5 py-2 text-[10px]" />
      </label>
      <label className="block rounded-lg border border-dashed border-neutral-200 p-2.5">
        <span className="flex items-center gap-1 text-[9.5px] text-neutral-500"><Paperclip size={11} /> Optional quote or supporting file</span>
        <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setAttachment(event.target.files?.[0])} className="mt-2 block w-full text-[9px] text-neutral-500 file:mr-2 file:rounded-md file:border-0 file:bg-neutral-100 file:px-2 file:py-1.5 file:text-[9px]" />
      </label>
      {correction && <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[9.5px] text-amber-800">Reviewer note: {correction.leaderDecisionReason || correction.departmentDecisionReason || correction.approvalReason || "Update the request and resubmit it."}</div>}
      {error && <div className="rounded-lg bg-rose-50 p-2.5 text-[9.5px] text-rose-700">{error}</div>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="h-8 rounded-lg border border-neutral-200 px-3 text-[9.5px]">Cancel</button>
        <button type="button" disabled={busy || pastNeededBy || !selectedLine || amount <= 0 || amount > requestable || !purpose.trim() || extraLines.some(l=>!l.allocationLineId||l.amount<=0||l.amount>(context.lines.find(s=>s.id===l.allocationLineId)?.available||0)) || new Set([lineId,...extraLines.map(l=>l.allocationLineId)]).size!==extraLines.length+1} onClick={() => void submit()} className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-700 px-3 text-[9.5px] text-white disabled:opacity-40"><Send size={10} /> {busy ? "Submitting…" : correction ? "Resubmit" : "Request cash"}</button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", min, invalid = false }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; min?: string; invalid?: boolean }) {
  return <label><span className="text-[9.5px] text-neutral-500">{label}</span><input aria-invalid={invalid || undefined} type={type} min={type === "number" ? 0 : min} step={type === "number" ? "0.01" : undefined} value={value} onChange={(event) => onChange(event.target.value)} className={`mt-1 h-9 w-full rounded-lg border px-2.5 text-[10px] ${invalid ? "border-rose-300 bg-rose-50" : "border-neutral-200"}`} /></label>;
}
