import { MoneyInput } from '../../../components/ui/MoneyInput';
import { useRef, useState } from "react";
import { Paperclip, Send } from "lucide-react";
import type { PettyCashRequest, TaskFundingContext } from "../types";
import {requestFunding} from '../selectors/requestFunding';
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
  correction,
  onCancel,
  onSaved,
  readOnly = false,
}: {
  context: TaskFundingContext;
  orgId: string;
  taskId: string;
  subtaskId?: string;
  currentUserId: string;
  correction?: PettyCashRequest;
  onCancel: () => void;
  onSaved: () => Promise<void>;
  readOnly?: boolean;
}) {
  const defaultLineId = correction?.allocationLineId || context.cap?.allocationLineId || context.lines.find((line) => line.available > 0)?.id || context.lines[0]?.id || "";
  const [lineId, setLineId] = useState(defaultLineId);
  const [amount, setAmount] = useState(correction?.requestedAmount || 0);
  const [purpose, setPurpose] = useState(correction?.purpose || "");
  const [neededBy, setNeededBy] = useState(correction?.neededBy || "");
  const [attachment, setAttachment] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const idempotencyKey = useRef(crypto.randomUUID());
  const today = getPhilippineCalendarDate();
  const pastNeededBy = isPastCashNeededBy(neededBy, today);
  const selectedLine = context.lines.find((line) => line.id === lineId);
  const plan=requestFunding(context,amount,correction?.fundingLines?.map(line=>line.allocationLineId));
  const requestable=context.supportsItemizedCash?plan.available:Math.max(0,Math.min(selectedLine?.available||0,context.available));
  const overAvailable=amount>requestable;
  const validAmount=Number.isFinite(amount)&&amount>0&&!overAvailable&&Math.abs(amount*100-Math.round(amount*100))<.00001;
  const canSubmit=validAmount&&(context.supportsItemizedCash?plan.covered:!!selectedLine)&&!!purpose.trim()&&!pastNeededBy;

  const submit = async () => {
    if (readOnly || busy || !canSubmit) return;
    if (pastNeededBy) {
      setError("Needed-by date cannot be earlier than today.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const requestId = context.supportsItemizedCash ? await createVoucherCashRequest({taskId,subtaskId,lines:plan.lines,purpose,neededBy,key:idempotencyKey.current,existingId:correction?.id}) : correction?.id || await createContextualCashRequest({
        taskId,
        subtaskId,
        allocationLineId: selectedLine!.id,
        amount,
        purpose,
        neededBy,
        idempotencyKey: idempotencyKey.current,
      });
      if (correction && !context.supportsItemizedCash) {
        await resubmitContextualCashRequest({
          requestId: correction.id,
          allocationLineId: selectedLine!.id,
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
    <fieldset disabled={readOnly || busy} className="mt-3 space-y-3 rounded-xl border border-emerald-200 bg-white p-3">
      <div>
        <div className="text-[15px] font-semibold text-foreground">{correction ? "Correct cash request" : "Request task cash"}</div>
        <p className="mt-1 text-[13px] text-muted-foreground">Available from this task: <strong>{peso.format(requestable)}</strong></p>
      </div>
      {!context.supportsItemizedCash&&context.lines.length>1&&<label className="block">
        <span className="text-[13px] text-neutral-500">Task budget source</span>
        <select value={lineId} onChange={(event) => { setLineId(event.target.value); setAmount(0); }} className="mt-1 h-9 w-full rounded-lg border border-emerald-200 bg-white px-2.5 text-[13px]">
          <option value="">Select accounting source…</option>
          {context.lines.map((line) => (
            <option key={line.id} value={line.id} disabled={line.available <= 0 && correction?.allocationLineId !== line.id}>
              {line.category} · {line.particular} · {line.fundSource} · {peso.format(line.available)} available
            </option>
          ))}
        </select>
      </label>}
      {overAvailable && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-[13px] text-rose-700">Only {peso.format(requestable)} is available from this task. Enter a smaller amount.</p>}
      {context.supportsItemizedCash&&plan.lines.length>1&&<details className="text-[13px] text-muted-foreground"><summary>Budget breakdown</summary>{plan.lines.map(line=><p key={line.allocationLineId}>{context.lines.find(source=>source.id===line.allocationLineId)?.category}: {peso.format(line.amount)}</p>)}</details>}
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
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
          Needed-by date cannot be earlier than today.
        </div>
      )}
      <label className="block">
        <span className="text-[13px] text-neutral-500">Purpose</span>
        <textarea value={purpose} onChange={(event) => setPurpose(event.target.value)} rows={3} placeholder="Example: Buy two boxes of ball pens for the registration desk" className="mt-1 w-full rounded-lg border border-neutral-200 px-2.5 py-2 text-[13px]" />
      </label>
      <label className="block rounded-lg border border-dashed border-neutral-200 p-2.5">
        <span className="flex items-center gap-1 text-[13px] text-neutral-500"><Paperclip size={11} /> Optional quote or supporting file</span>
        <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setAttachment(event.target.files?.[0])} className="mt-2 block w-full text-[13px] text-neutral-500 file:mr-2 file:rounded-md file:border-0 file:bg-neutral-100 file:px-2 file:py-1.5 file:text-[13px]" />
      </label>
      {correction && <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[13px] text-amber-800">Reviewer note: {correction.leaderDecisionReason || correction.departmentDecisionReason || correction.approvalReason || "Update the request and resubmit it."}</div>}
      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[13px] text-rose-700">{error}</div>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="h-10 rounded-lg border border-neutral-200 px-3 text-[13px]">Cancel</button>
        <button type="button" disabled={readOnly || busy || !canSubmit} onClick={() => void submit()} className="inline-flex h-10 items-center gap-1 rounded-lg bg-emerald-700 px-3 text-[13px] text-white disabled:opacity-40"><Send size={14} /> {busy ? "Submitting…" : correction ? "Resubmit" : "Request cash"}</button>
      </div>
    </fieldset>
  );
}

function Field({ label, value, onChange, type = "text", min, invalid = false }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; min?: string; invalid?: boolean }) {
  return <label><span className="text-[13px] text-neutral-500">{label}</span>{type === "number" ? <MoneyInput min={0.01} value={value} onValueChange={onChange} className="mt-1 h-9 w-full rounded-lg border border-neutral-200 px-2.5 text-[13px]" /> : <input aria-invalid={invalid || undefined} type={type} min={min} value={value} onChange={(event) => onChange(event.target.value)} className={`mt-1 h-9 w-full rounded-lg border px-2.5 text-[13px] ${invalid ? "border-rose-300 bg-rose-50" : "border-neutral-200"}`} />}</label>;
}
