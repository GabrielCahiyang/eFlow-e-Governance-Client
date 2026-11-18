import { readableUiError } from '../../../shared/userFacingError';
import { MoneyInput } from '../../../components/ui/MoneyInput';
import { DateInput } from '../../../components/ui/DateInput';
import { useRef, useState } from "react";
import { Paperclip, Send } from "lucide-react";
import type { PettyCashRequest, TaskFundingContext } from "../types";
import {requestFunding} from '../selectors/requestFunding';
import { uploadCashRequestAttachment } from '../services/budgetService';
import { getPhilippineCalendarDate } from '../selectors/cashWorkflowRules';
import { cashNeededByBounds, cashNeededByError } from '../selectors/cashNeededBy';
import { cashRequestActionKey, saveCashRequest, type CashRequestAttempt } from '../services/cashRequestRecovery';
import { isDeterministicClearanceRejection } from '../services/workFinancialClearanceService';
import { usePendingAction } from '../../../shared/usePendingAction';
import { isCommandId, withPendingActionLock } from '../../../shared/pendingActionStore';
import { assertActionActor } from '../../../shared/actionActor';
import { attachmentError } from '../../../shared/fileValidation';
import { peso } from "./budgetUi";

export function CashRequestForm({
  context,
  orgId,
  taskId,
  subtaskId,
  currentUserId,
  taskStart,
  taskDue,
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
  taskStart?: string;
  taskDue?: string;
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
  const [invalidDateText, setInvalidDateText] = useState(false);
  const [attachment, setAttachment] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const actionKey = cashRequestActionKey(currentUserId, orgId, taskId, subtaskId);
  const recovery = usePendingAction<CashRequestAttempt>(actionKey);
  const bounds = cashNeededByBounds(getPhilippineCalendarDate(), taskStart, taskDue);
  const dateIssue = invalidDateText ? 'Needed-by date must be a valid date.' : cashNeededByError(neededBy, bounds);
  const selectedLine = context.lines.find((line) => line.id === lineId);
  const plan=requestFunding(context,amount,correction?.fundingLines?.map(line=>line.allocationLineId));
  const requestable=context.supportsItemizedCash?plan.available:Math.max(0,Math.min(selectedLine?.available||0,context.available));
  const overAvailable=amount>requestable;
  const validAmount=Number.isFinite(amount)&&amount>0&&!overAvailable&&Math.abs(amount*100-Math.round(amount*100))<.00001;
  const canSubmit=validAmount&&(context.supportsItemizedCash?plan.covered:!!selectedLine)&&!!purpose.trim()&&!dateIssue;

  const submit = async () => {
    if (!currentUserId || saved || !recovery.ready || inFlight.current || (!recovery.value && (readOnly || !canSubmit))) return;
    if (!recovery.value && attachment) {
      const issue = attachmentError([attachment], { extensions: ['jpg', 'jpeg', 'png', 'webp', 'pdf'] });
      if (issue) { setError(issue); return; }
    }
    inFlight.current = true;
    setBusy(true);
    setError('');
    let requestId: string | undefined;
    let ownsSavedAttempt = false;
    let confirmed = false;
    try {
      await withPendingActionLock(actionKey, async () => {
        await assertActionActor(currentUserId);
        const attempt = recovery.value ?? {
          key: crypto.randomUUID(), itemized: !!context.supportsItemizedCash,
          lines: context.supportsItemizedCash ? plan.lines : [{ allocationLineId: selectedLine!.id, amount }],
          purpose: purpose.trim(), neededBy, existingId: correction?.id, attachment,
        };
        if (!recovery.value) {
          await recovery.save(attempt, true);
          ownsSavedAttempt = true;
        }
        requestId = attempt.requestId ?? await saveCashRequest(currentUserId, taskId, subtaskId, attempt, !!recovery.value, readOnly);
        if (!isCommandId(requestId)) throw new Error('The cash request could not be confirmed. Check the saved action.');
        await recovery.save({ ...attempt, requestId });
        if (attempt.attachment) {
          await uploadCashRequestAttachment({ orgId, requestId, file: attempt.attachment, actor: currentUserId, commandId: attempt.key, readOnly });
        }
        confirmed = true;
        setSaved(true);
        await recovery.clear();
      });
      await onSaved();
    } catch (caught) {
      if (!requestId && ownsSavedAttempt && isDeterministicClearanceRejection(caught)) await recovery.clear().catch(() => {});
      setError(confirmed ? 'The cash request was saved. Reload to see the current record.' : isCommandId(requestId)
        ? 'The cash request was recorded. Check the saved action to finish attaching its file.'
        : readableUiError(caught, 'The cash request could not be confirmed. Check the saved action before trying again.', 'write'));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-emerald-200 bg-white p-3">
      <fieldset disabled={readOnly || busy || saved || !recovery.ready || !!recovery.value} className="space-y-3">
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
          min={bounds.min}
          max={bounds.max}
          invalid={invalidDateText || !!dateIssue && !!neededBy}
          onInvalidTextChange={setInvalidDateText}
          onChange={setNeededBy}
        />
      </div>
      {dateIssue && (invalidDateText || neededBy || bounds.max && bounds.min > bounds.max) && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
          {dateIssue}
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
      </fieldset>
      {recovery.value && <p role="status">Check the saved cash request to continue with its original details.</p>}
      {recovery.error && <p role="alert">{recovery.error}</p>}
      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[13px] text-rose-700">{error}</div>}
      <div className="flex justify-end gap-2">
        <button type="button" disabled={busy} onClick={onCancel} className="h-10 rounded-lg border border-neutral-200 px-3 text-[13px]">Cancel</button>
        <button type="button" disabled={busy || saved || !recovery.ready || (!recovery.value && (readOnly || !canSubmit))} onClick={() => void submit()} className="inline-flex h-10 items-center gap-1 rounded-lg bg-emerald-700 px-3 text-[13px] text-white disabled:opacity-40"><Send size={14} /> {saved ? 'Cash request saved' : busy ? 'Submitting…' : recovery.value ? 'Check saved cash request' : correction ? 'Resubmit' : 'Request cash'}</button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", min, max, invalid = false, onInvalidTextChange }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; min?: string; max?: string; invalid?: boolean; onInvalidTextChange?: (invalid: boolean) => void }) {
  return <label><span className="text-[13px] text-neutral-500">{label}</span>{type === "number" ? <MoneyInput min={0.01} value={value} onValueChange={onChange} className="mt-1 h-9 w-full rounded-lg border border-neutral-200 px-2.5 text-[13px]" /> : type === "date" ? <DateInput aria-invalid={invalid || undefined} min={min} max={max} onInvalidTextChange={onInvalidTextChange} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} className={`mt-1 h-9 w-full rounded-lg border px-2.5 text-[13px] ${invalid ? "border-rose-300 bg-rose-50" : "border-neutral-200"}`} /> : <input aria-invalid={invalid || undefined} type={type} min={min} value={value} onChange={(event) => onChange(event.target.value)} className={`mt-1 h-9 w-full rounded-lg border px-2.5 text-[13px] ${invalid ? "border-rose-300 bg-rose-50" : "border-neutral-200"}`} />}</label>;
}
