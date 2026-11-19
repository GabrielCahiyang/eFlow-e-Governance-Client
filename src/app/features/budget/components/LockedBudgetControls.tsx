import { MoneyInput } from '../../../components/ui/MoneyInput';
import { FieldLengthHint } from '../../../components/ui/FieldLengthHint';
import { INPUT_LIMITS } from '../../../shared/inputLimits';
import { useRef, useState } from "react";
import { Archive, History, PencilLine } from "lucide-react";
import type { DepartmentBudgetBundle } from "../types";
import {
  adjustDepartmentFiscalBudget,
  closeDepartmentFiscalBudget,
} from "../services/budgetService";
import { peso } from "./budgetUi";

import { useExplicitDraft } from "../../../shared/useExplicitDraft";
import { requestNavigation } from "../../../shared/navigationGuard";
import { useConfirmation } from "../../../components/ui/useConfirmation";
import {
  financialOutcome,
  recordFinancialOutcome,
  financialFailureIsUncertain,
  financialWriteFeedback,
} from "../financialReceipts";
export function LockedBudgetControls({
  data,
  canManage,
  onChanged,
}: {
  data: DepartmentBudgetBundle;
  canManage: boolean;
  onChanged: () => Promise<void>;
}) {
  const summary = data.summary;
  const hasProjects = data.readjustmentBlockedByProjects === true;
  const [mode, setMode] = useState<"" | "adjust" | "close">("");
  const [amount, setAmount] = useState(summary?.approvedAmount || 0);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const confirmation = useConfirmation();
  const pending = useRef(false);
  const draft = useExplicitDraft(
    "Fiscal correction reason",
    Boolean(mode && (reason || amount !== summary?.approvedAmount)),
    busy,
    () => {
      setMode("");
      setReason("");
      setAmount(summary?.approvedAmount || 0);
    },
  );
  const key = `fiscal:${summary?.id}:${mode}:${amount}:${reason.trim()}`;
  if (!summary || summary.status === "draft") return null;

  const submit = async () => {
    if (
      pending.current ||
      !canManage ||
      (mode === "adjust" && hasProjects) ||
      !reason.trim() ||
      financialOutcome(key)
    )
      return;
    pending.current = true;
    draft.pendingRef.current = true;
    setBusy(true);
    setMessage("");
    let submitted = false;
    try {
      if (
        !(await confirmation.confirm({
          title:
            mode === "adjust"
              ? "Record audited budget adjustment?"
              : "Close fiscal year?",
          description: `FY ${summary.fiscalYear}. ${mode === "adjust" ? peso.format(summary.approvedAmount) + " → " + peso.format(amount) + ". Existing commitments remain protected." : "Financial history becomes closed; unsettled cash blocks this action."} Reason: ${reason}. This decision is recorded permanently.`,
          actionLabel:
            mode === "adjust" ? "Record adjustment" : "Close fiscal year",
        }))
      )
        return;
      submitted = true;
      if (mode === "adjust")
        await adjustDepartmentFiscalBudget({
          budgetId: summary.id,
          adjustedAmount: amount,
          reason,
        });
      if (mode === "close")
        await closeDepartmentFiscalBudget(summary.id, reason);
      recordFinancialOutcome(key, "saved");
      draft.markClean();
      setMessage(`Fiscal action saved for ${summary.id}.`);
      setMode("");
      setReason("");
      await onChanged();
    } catch (caught) {
      if (submitted && !financialOutcome(key) && financialFailureIsUncertain(caught))
        recordFinancialOutcome(key, "uncertain");
      setMessage(financialWriteFeedback(caught, { outcome: financialOutcome(key), submitted, action: mode === 'adjust' ? 'The appropriation adjustment' : 'The fiscal year closure', record: 'the annual budget', draft: 'Your entries are still in the form.' }));
    } finally {
      pending.current = false;
      draft.pendingRef.current = false;
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      {confirmation.dialog}
      {financialOutcome(key) === "uncertain" && (
        <button
          type="button"
          className="rounded-lg border p-3 text-sm"
          onClick={() => void onChanged()}
        >
          Refresh fiscal history
        </button>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[12px] font-semibold text-neutral-900">
            <History size={14} /> Year-end and locked budget actions
          </div>
          <p className="mt-1 text-[10px] text-neutral-500">
            Every change to a locked budget records the previous and new amounts in the audit history. All released cash must be settled with receipts before you can close the fiscal year.
          </p>
        </div>
        {canManage && summary.status === "locked" && (
          <div className="flex gap-2">
            {!data.sectionsAvailable && <button
              disabled={hasProjects}
              aria-describedby={hasProjects ? "legacy-office-budget-readjustment-reason" : undefined}
              onClick={() => {
                setMode("adjust");
                setAmount(summary.approvedAmount);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 px-3 text-[10px] disabled:opacity-40"
            >
              <PencilLine size={11} /> Adjust appropriation
            </button>}
            <button
              onClick={() => setMode("close")}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 text-[10px] text-amber-800"
            >
              <Archive size={11} /> Close fiscal year
            </button>
          </div>
        )}
      </div>
      {canManage && summary.status === "locked" && !data.sectionsAvailable && hasProjects && (
        <p id="legacy-office-budget-readjustment-reason" className="mt-3 text-xs text-muted-foreground">You can only readjust the Office Budget when the Office has no projects.</p>
      )}
      {mode && (
        <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="text-[11px] font-medium">
            {mode === "adjust"
              ? "Audited appropriation adjustment"
              : "Close this fiscal year"}
          </div>
          {mode === "adjust" && (
            <label className="mt-3 block">
              <span className="text-[9.5px] text-neutral-500">
                New annual appropriation
              </span>
              <div className="relative mt-1">
                <span className="absolute left-3 top-2.5 text-[11px] text-neutral-400">
                  ₱
                </span>
                <MoneyInput
                  min={summary.committedAmount}
                  max={INPUT_LIMITS.MONEY_MAX_BUDGET}
                  step="0.01"
                  value={amount || ""}
                  onValueChange={raw => setAmount(Number(raw))}
                  className="h-9 w-full rounded-lg border border-neutral-200 pl-7 pr-3 text-[10.5px]"
                />
              </div>
              <span className="mt-1 block text-[9px] text-neutral-400">
                Cannot be lower than active commitments:{" "}
                {peso.format(summary.committedAmount)}
              </span>
            </label>
          )}
          <label className="mt-3 block">
            <span className="flex items-center justify-between gap-2">
              <span className="text-[9.5px] text-neutral-500">
                Required reason
              </span>
              <FieldLengthHint length={reason.length} max={INPUT_LIMITS.FUNDING_REASON} />
            </span>
            <textarea
              maxLength={INPUT_LIMITS.FUNDING_REASON}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder={
                mode === "adjust"
                  ? "Reference the approved supplemental or correction authority."
                  : "Record the fiscal close authority and confirmation."
              }
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-[10px]"
            />
          </label>
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => {
                void requestNavigation(() => {
                  setMode("");
                  setReason("");
                });
              }}
              className="h-8 rounded-lg border border-neutral-200 bg-white px-3 text-[9.5px]"
            >
              Cancel
            </button>
            <button
              disabled={
                busy ||
                Boolean(financialOutcome(key)) ||
                !reason.trim() ||
                (mode === "adjust" && (hasProjects || amount < summary.committedAmount))
              }
              onClick={() => void submit()}
              className="h-8 rounded-lg bg-primary px-3 text-[9.5px] text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40"
            >
              {mode === "adjust" ? "Record adjustment" : "Close fiscal year"}
            </button>
          </div>
        </div>
      )}
      {message && (
        <div className="mt-3 rounded-lg bg-rose-50 p-3 text-[10px] text-rose-700">
          {message}
        </div>
      )}
      {data.adjustments.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-xl border border-neutral-100">
          <div className="bg-neutral-50 px-3 py-2 text-[9px] uppercase tracking-wide text-neutral-400">
            Adjustment history
          </div>
          {data.adjustments.map((item) => (
            <div
              key={item.id}
              className="grid gap-2 border-t border-neutral-100 px-3 py-2.5 text-[9.5px] sm:grid-cols-[auto_auto_1fr_auto]"
            >
              <span>{peso.format(item.previousAmount)}</span>
              <span>→ {peso.format(item.adjustedAmount)}</span>
              <span className="text-neutral-500">{item.reason}</span>
              <span className="text-neutral-400">
                {new Date(item.createdAt).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
