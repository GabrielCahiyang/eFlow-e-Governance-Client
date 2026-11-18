import { WorkspaceTooltip } from "../../../components/ui/workspace/WorkspaceTooltip";
import { MoneyInput } from "../../../components/ui/MoneyInput";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AttentionBox, Button } from "@vibe/core";
import { AlertCircle, CheckCircle2, FileText, Plus, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import type { PettyCashRequest, ReceiptDraft } from "../types";
import { findSavedLiquidation, submitPettyCashLiquidation, type LiquidationAttempt } from "../services/budgetService";
import { useAuth } from "../../../contexts/AuthContext";
import { usePendingAction } from "../../../shared/usePendingAction";
import { isCommandId, pendingActionKey, withPendingActionLock } from "../../../shared/pendingActionStore";
import {
  fetchReceiptSubmissionClearance,
  isDeterministicClearanceRejection,
  type ReceiptSubmissionClearance,
} from "../services/workFinancialClearanceService";
import { peso } from "./budgetUi";
import { financialFailureIsUncertain, financialWriteFeedback } from "../financialReceipts";
import { ReceiptItemEditor } from "./ReceiptItemEditor";
import { moneyCents } from "../selectors/budgetSections";
import { liquidationInputError } from "../validation/financialValidation";
import { validateCashLiquidation } from "../validation/liquidationValidation";
import {
  getPhilippineCalendarDate,
  isLiquidationCurrentlyOverdue,
} from "../selectors/cashWorkflowRules";
import { readableUiError } from "../../../shared/userFacingError";

const FIELD_CLASS =
  "mt-1 h-9 w-full rounded-lg border border-[var(--eflow-border,#cbd5e1)] bg-background px-3 text-[12.5px] text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-colors outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60";
const FIELD_ERROR_CLASS =
  "mt-1 h-9 w-full rounded-lg border border-destructive bg-destructive/5 px-3 text-[12.5px] text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-colors outline-none focus:border-destructive focus:ring-2 focus:ring-destructive/20 disabled:opacity-60";

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CashLiquidationDialog({
  request,
  orgId,
  perReceiptLimit: _perReceiptLimit,
  liquidationDueDays,
  allowReceiptOverride: _allowReceiptOverride,
  onClose,
  onSaved,
}: {
  request: PettyCashRequest;
  orgId: string;
  perReceiptLimit: number;
  liquidationDueDays: number;
  allowReceiptOverride: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { user } = useAuth();
  const actor = user?.id ?? "";
  const actionKey = pendingActionKey(actor, "cash-liquidation", orgId, request.id);
  const recovery = usePendingAction<LiquidationAttempt>(actionKey);
  const approved = request.releasedAmount || 0;
  const sources = request.fundingLines || [];
  const itemized = sources.length > 0;
  const [enteredSpent, setSpent] = useState(approved);
  const [note, setNote] = useState("");
  const [receipts, setReceipts] = useState<ReceiptDraft[]>([
    { ...blankReceipt(itemized ? 0 : approved), ...(itemized ? { items: [] } : {}) },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [refundReceiptNumber, setRefundReceiptNumber] = useState("");
  const [refundDate, setRefundDate] = useState(getPhilippineCalendarDate());
  const [clearance, setClearance] = useState<ReceiptSubmissionClearance>();
  const [clearanceLoading, setClearanceLoading] = useState(true);
  const [clearanceError, setClearanceError] = useState("");
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const clearanceRun = useRef(0);
  const inFlight = useRef(false);

  const markTouched = (key: string) =>
    setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  const showFieldError = (key: string) => attemptedSubmit || Boolean(touched[key]);

  const loadClearance = useCallback(async () => {
    const run = ++clearanceRun.current;
    setClearanceLoading(true);
    try {
      const next = await fetchReceiptSubmissionClearance(request.id);
      if (run === clearanceRun.current) {
        setClearance(next);
        setClearanceError("");
      }
    } catch (caught) {
      if (run === clearanceRun.current) {
        setClearance(undefined);
        setClearanceError(
          readableUiError(
            caught,
            "Receipt submission access could not be verified.",
            "read",
          ),
        );
      }
    } finally {
      if (run === clearanceRun.current) {
        setClearanceLoading(false);
      }
    }
  }, [request.id]);

  useEffect(() => {
    void loadClearance();
    return () => {
      clearanceRun.current++;
    };
  }, [loadClearance]);

  const editable =
    !!actor &&
    recovery.ready &&
    !recovery.value &&
    !busy &&
    !saved &&
    !clearanceLoading &&
    !clearanceError &&
    clearance?.canSubmit === true;

  const receiptTotal = receipts.reduce((sum, receipt) => sum + (Number(receipt.amount) || 0), 0);
  const spent = itemized ? receiptTotal : enteredSpent;
  const overdue = isLiquidationCurrentlyOverdue(request);

  const validation = useMemo(
    () =>
      validateCashLiquidation({
        approved,
        itemized,
        sources,
        spent,
        receipts,
        refundReceiptNumber,
        refundDate,
        note,
      }),
    [approved, itemized, sources, spent, receipts, refundReceiptNumber, refundDate, note],
  );

  const update = (id: string, patch: Partial<ReceiptDraft>) => {
    if (!editable) return;
    setError("");
    setReceipts((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const submit = async () => {
    if (!actor || !recovery.ready || inFlight.current || saved) return;
    if (!recovery.value) {
      if (!editable) return;
      setAttemptedSubmit(true);
      if (!validation.isValid) {
        setError(validation.blockingErrors[0] || "Fix the highlighted fields before submitting.");
        return;
      }
      const issue = liquidationInputError({
        spent,
        note,
        receipts,
        refundDate: validation.requiresCashReturn ? refundDate : undefined,
        refundReceiptNumber: validation.requiresCashReturn ? refundReceiptNumber : undefined,
        releasedAmount: approved,
        sources,
      });
      if (issue) {
        setError(issue);
        return;
      }
    }
    inFlight.current = true;
    setBusy(true);
    setError("");
    let began = false;
    let confirmed = false;
    try {
      await withPendingActionLock(actionKey, async () => {
        const attempt = recovery.value ?? {
          actor,
          orgId,
          requestId: request.id,
          spent,
          note,
          receipts,
          refundReceiptNumber: validation.requiresCashReturn ? refundReceiptNumber : "",
          refundDate: validation.requiresCashReturn ? refundDate : "",
          idempotencyKey: crypto.randomUUID(),
        };
        if (
          attempt.actor !== actor ||
          attempt.orgId !== orgId ||
          attempt.requestId !== request.id ||
          !isCommandId(attempt.idempotencyKey)
        ) {
          throw new Error("The saved liquidation does not match this request.");
        }
        let result = recovery.value ? await findSavedLiquidation(attempt) : undefined;
        if (!result) {
          const fresh = await fetchReceiptSubmissionClearance(request.id);
          setClearance(fresh);
          if (!fresh.canSubmit) {
            throw new Error("Receipt submission is unavailable. Check the original package and current work clearance.");
          }
          if (!recovery.value) {
            await recovery.save(attempt, true);
            began = true;
          }
          result = await submitPettyCashLiquidation(attempt);
        }
        if (!isCommandId(result)) {
          throw new Error("The liquidation response could not be verified. Check the saved package.");
        }
        confirmed = true;
        setSaved(true);
        await recovery.clear();
      });
      window.dispatchEvent(new Event("eflow:expenses-updated"));
      await onSaved();
    } catch (caught) {
      if (!confirmed && began && isDeterministicClearanceRejection(caught)) {
        await recovery.clear().catch(() => {});
      }
      setError(
        financialWriteFeedback(caught, {
          outcome: confirmed
            ? "saved"
            : (began || recovery.value) && financialFailureIsUncertain(caught)
              ? "uncertain"
              : undefined,
          submitted: began,
          action: "Your liquidation submission",
          record: "the cash request",
          draft: "Your receipts are still in the form.",
        }),
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const deadlineLabel = request.liquidationDueAt
    ? new Date(request.liquidationDueAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : `${liquidationDueDays} days after full release`;

  const unusedCash = Math.max(0, approved - spent);
  const submitDisabled =
    saved ||
    busy ||
    !recovery.ready ||
    (!recovery.value && (!editable || validation.overLimitBlocked));

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-[640px]">
        <DialogHeader className="border-b border-border px-5 py-4 pr-12">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            Cash liquidation
          </div>
          <DialogTitle className="text-[18px]">Upload receipts and return balance</DialogTitle>
          <DialogDescription>
            Account for your released cash with receipts and proof of any unused balance returned.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-4">
          {clearanceError && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-[12px] text-destructive"
            >
              <span>{clearanceError}</span>
              <button
                type="button"
                disabled={clearanceLoading || busy}
                onClick={() => void loadClearance()}
                className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-background px-2.5 py-1 text-xs font-medium"
              >
                <RefreshCw size={12} aria-hidden="true" /> Retry
              </button>
            </div>
          )}

          {!clearanceLoading && !clearanceError && !clearance?.workAccepted && (
            <div className="space-y-2">
              <AttentionBox
                type="warning"
                title="Work acceptance required"
                text="Receipts become available after the work is accepted."
              />
              <div
                role="status"
                className="flex items-start gap-2 rounded-xl border border-amber-300/80 bg-amber-50/80 px-3.5 py-2.5 text-[12px] text-amber-950"
              >
                <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
                <span>
                  {request.subtaskId
                    ? "To start liquidating, first complete this subtask and have it approved by your Lead."
                    : "To start liquidating, first complete this task and have it approved by the Project Lead."}
                </span>
              </div>
            </div>
          )}

          {overdue ? (
            <AttentionBox
              type="warning"
              title="Late liquidation · Head approval required"
              text={`The receipt deadline was ${deadlineLabel}. You can still submit — late packages require Office Head authorization before Accounting settles them.`}
            />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-[12px] text-muted-foreground">
              <span>
                <strong className="font-semibold text-foreground">Due {deadlineLabel}</strong> · Attach a photo or PDF receipt for each claimed expense.
              </span>
            </div>
          )}

          {/* Bottom-line cash reconciliation strip */}
          <section
            aria-label="Cash liquidation summary"
            className={`rounded-xl border p-3.5 ${
              validation.overLimitBlocked
                ? "border-destructive/50 bg-destructive/5"
                : "border-border bg-muted/25"
            }`}
          >
            <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-card px-3 py-2.5">
                <dt className="text-[11px] font-medium text-muted-foreground">Released cash</dt>
                <dd className="mt-1 text-[16px] font-semibold tabular-nums text-foreground">
                  {peso.format(approved)}
                </dd>
              </div>
              <div
                className={`rounded-lg border px-3 py-2.5 ${
                  validation.exceedsReleased || validation.receiptMismatchError
                    ? "border-destructive/60 bg-card"
                    : "border-border bg-card"
                }`}
              >
                <dt className="text-[11px] font-medium text-muted-foreground">
                  {itemized ? "Total spent (from items)" : "Total receipts"}
                </dt>
                <dd
                  className={`mt-1 text-[16px] font-semibold tabular-nums ${
                    validation.exceedsReleased || validation.receiptMismatchError
                      ? "text-destructive"
                      : "text-primary"
                  }`}
                >
                  {peso.format(receiptTotal)}
                </dd>
                {validation.exceedsReleased && (
                  <p className="mt-0.5 text-[11px] font-medium tabular-nums text-destructive">
                    Over by {peso.format(validation.overReleasedCents / 100)}
                  </p>
                )}
              </div>
              <div className="rounded-lg border border-border bg-card px-3 py-2.5">
                <dt className="text-[11px] font-medium text-muted-foreground">Cash to return</dt>
                <dd
                  className={`mt-1 text-[16px] font-semibold tabular-nums ${
                    validation.exceedsReleased ? "text-destructive" : "text-foreground"
                  }`}
                >
                  {validation.exceedsReleased ? "Exceeds limit" : peso.format(unusedCash)}
                </dd>
              </div>
            </dl>

            {!itemized && (
              <div className="mt-3 border-t border-border/80 pt-3">
                <Field
                  label="Actual amount spent (₱)"
                  required
                  type="number"
                  disabled={!editable}
                  value={enteredSpent}
                  onBlur={() => markTouched("spent")}
                  onChange={(value) => {
                    markTouched("spent");
                    setSpent(Number(value));
                  }}
                  error={
                    validation.exceedsReleased
                      ? validation.releasedError
                      : showFieldError("spent")
                        ? validation.releasedError || validation.receiptMismatchError
                        : ""
                  }
                  inputClassName="text-right tabular-nums"
                />
              </div>
            )}

            {itemized && validation.sourceUsage.length > 0 && (
              <div className="mt-3 space-y-1.5 border-t border-border/80 pt-3" aria-label="Approved funding sources usage">
                <div className="text-[11px] font-semibold text-muted-foreground">Approved funding limits</div>
                {validation.sourceUsage.map((source) => (
                  <div
                    key={source.allocationLineId}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-[12px] ${
                      source.exceeded
                        ? "border-destructive/50 bg-destructive/10 text-destructive"
                        : "border-border bg-card text-foreground"
                    }`}
                  >
                    <span className="font-medium">{source.label}</span>
                    <span className="tabular-nums">
                      <strong>{peso.format(source.usedAmount)}</strong> / {peso.format(source.approvedAmount)}
                      {source.exceeded
                        ? ` · Over by ${peso.format(source.overByAmount)}`
                        : ` · ${peso.format(source.remainingAmount)} left`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Immediate blocking alert when spending exceeds released cash or approved funding source */}
          {validation.overLimitBlocked && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-[12.5px] text-destructive"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <div className="space-y-1">
                <p className="font-semibold">Amount exceeds available cash — submission blocked</p>
                {validation.releasedError && <p>{validation.releasedError}</p>}
                {validation.exceededSources.map((source) => (
                  <p key={source.allocationLineId}>
                    {source.label} total ({peso.format(source.usedAmount)}) exceeds its approved funding of{" "}
                    {peso.format(source.approvedAmount)} by {peso.format(source.overByAmount)}.
                  </p>
                ))}
              </div>
            </div>
          )}

          {!itemized && validation.receiptMismatchError && !validation.overLimitBlocked && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[12px] text-amber-900"
            >
              <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{validation.receiptMismatchError}</span>
            </div>
          )}

          {/* Receipts */}
          <div className="space-y-3">
            {receipts.map((receipt, index) => {
              const rErr = validation.receipts[index];
              const vendorErr = showFieldError(`${receipt.id}:vendor`) ? rErr?.vendor || "" : "";
              const dateErr = showFieldError(`${receipt.id}:date`) ? rErr?.receiptDate || "" : "";
              const amountErr =
                (!itemized && rErr?.amount && receipt.amount > approved)
                  ? rErr.amount
                  : showFieldError(`${receipt.id}:amount`)
                    ? rErr?.amount || ""
                    : "";
              const descErr = showFieldError(`${receipt.id}:desc`) ? rErr?.description || "" : "";
              const fileErr = showFieldError(`${receipt.id}:file`) ? rErr?.file || "" : "";

              return (
                <article
                  key={receipt.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-[0_2px_4px_-3px_rgba(0,0,0,0.12)]"
                >
                  <div className="flex items-center justify-between border-b border-border/70 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-foreground">Receipt {index + 1}</span>
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[11.5px] font-semibold tabular-nums text-foreground">
                        {peso.format(receipt.amount || 0)}
                      </span>
                    </div>
                    <WorkspaceTooltip content={`Remove receipt ${index + 1}`}>
                      <button
                        type="button"
                        aria-label={`Remove receipt ${index + 1}`}
                        disabled={!editable || receipts.length === 1}
                        onClick={() => setReceipts((current) => current.filter((item) => item.id !== receipt.id))}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-30"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </WorkspaceTooltip>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field
                      label="Vendor / payee"
                      required
                      disabled={!editable}
                      value={receipt.vendor}
                      placeholder="e.g. Mercury Drug, National Book Store"
                      error={vendorErr}
                      onBlur={() => markTouched(`${receipt.id}:vendor`)}
                      onChange={(value) => {
                        markTouched(`${receipt.id}:vendor`);
                        update(receipt.id, { vendor: value });
                      }}
                    />

                    <Field
                      label="OR/AR number (optional)"
                      disabled={!editable}
                      value={receipt.receiptNumber}
                      placeholder="e.g. OR-00142"
                      onChange={(value) => update(receipt.id, { receiptNumber: value })}
                    />

                    <Field
                      label="Receipt date"
                      required
                      type="date"
                      disabled={!editable}
                      max={getPhilippineCalendarDate()}
                      value={receipt.receiptDate}
                      error={dateErr}
                      onBlur={() => markTouched(`${receipt.id}:date`)}
                      onChange={(value) => {
                        markTouched(`${receipt.id}:date`);
                        update(receipt.id, { receiptDate: value });
                      }}
                    />

                    {itemized ? (
                      <div className="flex flex-col justify-center rounded-lg border border-border bg-muted/30 px-3 py-2">
                        <span className="text-[11px] font-medium text-muted-foreground">Receipt total (auto-summed)</span>
                        <output
                          className={`mt-0.5 block text-[14px] font-semibold tabular-nums ${
                            receipt.amount > approved ? "text-destructive" : "text-foreground"
                          }`}
                        >
                          {peso.format(receipt.amount)}
                        </output>
                      </div>
                    ) : (
                      <Field
                        label="Receipt amount (₱)"
                        required
                        type="number"
                        disabled={!editable}
                        value={receipt.amount || ""}
                        error={amountErr}
                        onBlur={() => markTouched(`${receipt.id}:amount`)}
                        onChange={(value) => {
                          markTouched(`${receipt.id}:amount`);
                          update(receipt.id, { amount: Number(value) });
                        }}
                        inputClassName="text-right tabular-nums"
                      />
                    )}

                    <label className="block sm:col-span-2">
                      <span
                        className={`text-[11.5px] font-medium text-foreground ${
                          !itemized ? "after:ml-0.5 after:text-destructive after:content-['*']" : ""
                        }`}
                      >
                        {itemized ? "Expense description (optional)" : "Expense description"}
                      </span>
                      <Input
                        aria-invalid={Boolean(descErr)}
                        disabled={!editable}
                        value={receipt.description}
                        placeholder={
                          itemized
                            ? "Optional summary — purchased item details are listed below"
                            : "What was purchased with this receipt?"
                        }
                        onBlur={() => markTouched(`${receipt.id}:desc`)}
                        onChange={(event) => {
                          markTouched(`${receipt.id}:desc`);
                          update(receipt.id, { description: event.target.value });
                        }}
                        className={descErr ? FIELD_ERROR_CLASS : FIELD_CLASS}
                      />
                      {descErr && <p role="alert" className="mt-1 text-[11px] text-destructive">{descErr}</p>}
                    </label>

                    <div className="sm:col-span-2">
                      <label className="block">
                        <span className="text-[11.5px] font-medium text-foreground after:ml-0.5 after:text-destructive after:content-['*']">
                          Receipt image or PDF
                        </span>
                        <div
                          className={`mt-1 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-2.5 transition-colors ${
                            fileErr
                              ? "border-destructive bg-destructive/5"
                              : receipt.file
                                ? "border-primary/40 bg-primary/5"
                                : "border-[var(--eflow-border,#cbd5e1)] bg-muted/20 hover:border-primary/50"
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2 text-[12px]">
                            <Upload size={14} className="shrink-0 text-primary" aria-hidden="true" />
                            {receipt.file ? (
                              <span className="truncate font-medium text-foreground">
                                {receipt.file.name}
                                {receipt.file.size ? (
                                  <span className="ml-1.5 font-normal text-muted-foreground">
                                    ({formatFileSize(receipt.file.size)})
                                  </span>
                                ) : null}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Choose a JPG, PNG, WEBP, or PDF receipt file</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              aria-label={`Receipt image or PDF`}
                              aria-invalid={Boolean(fileErr)}
                              disabled={!editable}
                              type="file"
                              accept="image/jpeg,image/png,image/webp,application/pdf"
                              onChange={(event) => {
                                markTouched(`${receipt.id}:file`);
                                update(receipt.id, { file: event.target.files?.[0] });
                              }}
                              className="h-auto w-[195px] cursor-pointer border-0 bg-transparent p-0 text-[11.5px] shadow-none file:mr-2 file:cursor-pointer file:rounded-md file:border file:border-border file:bg-background file:px-2.5 file:py-1 file:text-[11.5px] file:font-medium file:text-foreground hover:file:bg-muted"
                            />
                            {receipt.file && editable && (
                              <button
                                type="button"
                                aria-label={`Remove file for receipt ${index + 1}`}
                                onClick={() => {
                                  markTouched(`${receipt.id}:file`);
                                  update(receipt.id, { file: undefined });
                                }}
                                className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              >
                                <X size={13} aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        </div>
                      </label>
                      {fileErr && <p role="alert" className="mt-1 text-[11px] text-destructive">{fileErr}</p>}
                    </div>
                  </div>

                  {itemized && (
                    <ReceiptItemEditor
                      items={receipt.items || []}
                      sources={sources}
                      sourceUsage={validation.sourceUsage}
                      itemErrors={rErr?.items || []}
                      showAllErrors={attemptedSubmit}
                      exceedsReleased={validation.exceedsReleased}
                      disabled={!editable}
                      onChange={(items) => {
                        setError("");
                        update(receipt.id, {
                          items,
                          amount:
                            items.reduce(
                              (sum, i) => sum + (Number.isFinite(i.amount) && i.amount <= 90000000000 ? moneyCents(i.amount) : 0),
                              0,
                            ) / 100,
                        });
                      }}
                    />
                  )}
                </article>
              );
            })}
          </div>

          <Button
            kind="secondary"
            size="small"
            disabled={!editable}
            onClick={() =>
              setReceipts((current) => [
                ...current,
                { ...blankReceipt(0), ...(itemized ? { items: [] } : {}) },
              ])
            }
          >
            <Plus size={13} className="mr-1" aria-hidden="true" /> Add receipt
          </Button>

          {/* Cash return section when unused cash remains */}
          {validation.requiresCashReturn && (
            <div className="grid gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4 sm:grid-cols-2">
              <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[12.5px] font-semibold text-foreground">
                  Return unused cash · <span className="tabular-nums text-primary">{peso.format(unusedCash)}</span>
                </span>
                <span className="text-[11px] text-muted-foreground">Required when spending is less than released cash</span>
              </div>
              <Field
                label="Official refund receipt number"
                required
                disabled={!editable}
                value={refundReceiptNumber}
                placeholder="e.g. OR-REF-2026-01"
                error={showFieldError("refundNumber") ? validation.refundReceiptNumberError : ""}
                onBlur={() => markTouched("refundNumber")}
                onChange={(val) => {
                  markTouched("refundNumber");
                  setRefundReceiptNumber(val);
                }}
              />
              <Field
                label="Cash return date"
                required
                type="date"
                disabled={!editable}
                max={getPhilippineCalendarDate()}
                value={refundDate}
                error={showFieldError("refundDate") ? validation.refundDateError : ""}
                onBlur={() => markTouched("refundDate")}
                onChange={(val) => {
                  markTouched("refundDate");
                  setRefundDate(val);
                }}
              />
              <p className="sm:col-span-2 text-[11.5px] leading-5 text-muted-foreground">
                Returning <span className="font-semibold tabular-nums text-foreground">{peso.format(unusedCash)}</span>{" "}
                clears the remaining balance on this cash advance once Accounting verifies your refund receipt.
              </p>
            </div>
          )}

          {/* Liquidation note */}
          <label className="block">
            <span className="text-[11.5px] font-medium text-foreground after:ml-0.5 after:text-destructive after:content-['*']">
              Liquidation note
            </span>
            <Textarea
              aria-invalid={Boolean(showFieldError("note") && validation.noteError)}
              disabled={!editable}
              value={note}
              onBlur={() => markTouched("note")}
              onChange={(event) => {
                markTouched("note");
                setNote(event.target.value);
              }}
              rows={3}
              placeholder="Summarize what was purchased and confirm any unused cash returned."
              className={`mt-1 min-h-[78px] rounded-lg border px-3 py-2 text-[12.5px] ${
                showFieldError("note") && validation.noteError
                  ? "border-destructive bg-destructive/5 focus:border-destructive"
                  : "border-[var(--eflow-border,#cbd5e1)] bg-background focus:border-primary"
              }`}
            />
            {showFieldError("note") && validation.noteError && (
              <p role="alert" className="mt-1 text-[11px] text-destructive">
                {validation.noteError}
              </p>
            )}
          </label>

          {attemptedSubmit && !validation.isValid && !validation.overLimitBlocked && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-[12px] text-destructive"
            >
              <p className="font-semibold">
                Complete {validation.blockingErrors.length}{" "}
                {validation.blockingErrors.length === 1 ? "item" : "items"} before submitting:
              </p>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
                {validation.blockingErrors.slice(0, 6).map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
                {validation.blockingErrors.length > 6 && (
                  <li>And {validation.blockingErrors.length - 6} more highlighted above.</li>
                )}
              </ul>
            </div>
          )}

          {recovery.value && <p role="status">Check your saved liquidation using its original receipt package.</p>}
          {recovery.error && <p role="alert">{recovery.error}</p>}
          {error && !attemptedSubmit && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-[12px] text-destructive"
            >
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3.5 sm:justify-between">
          <div className="text-[11.5px]">
            {!clearanceLoading && !clearanceError && !clearance?.workAccepted && !recovery.value ? (
              <span className="inline-flex items-center gap-1 font-medium text-amber-800">
                <AlertCircle size={13} aria-hidden="true" />
                {request.subtaskId
                  ? "Complete the subtask and get Lead approval to start liquidating"
                  : "Complete the task and get Project Lead approval to start liquidating"}
              </span>
            ) : editable && !recovery.value ? (
              validation.overLimitBlocked ? (
                <span className="inline-flex items-center gap-1 font-medium text-destructive">
                  <AlertCircle size={13} aria-hidden="true" />
                  Exceeds available amount — reduce receipt totals
                </span>
              ) : validation.isValid ? (
                <span className="inline-flex items-center gap-1 font-medium text-primary">
                  <CheckCircle2 size={13} aria-hidden="true" />
                  Ready to submit
                </span>
              ) : (
                <span className="text-muted-foreground">
                  {validation.blockingErrors.length}{" "}
                  {validation.blockingErrors.length === 1 ? "required item" : "required items"} remaining
                </span>
              )
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button kind="secondary" size="small" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              kind="primary"
              size="small"
              disabled={submitDisabled}
              loading={busy}
              onClick={() => void submit()}
            >
              <FileText size={13} className="mr-1" aria-hidden="true" />{" "}
              {recovery.value ? "Check saved liquidation" : "Submit liquidation"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function blankReceipt(amount: number): ReceiptDraft {
  return {
    id: crypto.randomUUID(),
    vendor: "",
    receiptNumber: "",
    receiptDate: getPhilippineCalendarDate(),
    description: "",
    amount,
  };
}

function Field({
  label,
  value,
  onChange,
  onBlur,
  type = "text",
  max,
  placeholder,
  required = false,
  error = "",
  disabled = false,
  inputClassName = "",
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  onBlur?: () => void;
  type?: string;
  max?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  inputClassName?: string;
}) {
  return (
    <label className="block">
      <span
        className={`text-[11.5px] font-medium text-foreground ${
          required ? "after:ml-0.5 after:text-destructive after:content-['*']" : ""
        }`}
      >
        {label}
      </span>
      {type === "number" ? (
        <MoneyInput
          min={0}
          aria-invalid={Boolean(error)}
          disabled={disabled}
          value={value}
          onBlur={onBlur}
          onValueChange={onChange}
          className={`${error ? FIELD_ERROR_CLASS : FIELD_CLASS} ${inputClassName}`}
        />
      ) : (
        <Input
          type={type}
          max={max}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          disabled={disabled}
          value={value}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
          className={`${error ? FIELD_ERROR_CLASS : FIELD_CLASS} ${inputClassName}`}
        />
      )}
      {error && <p role="alert" className="mt-1 text-[11px] text-destructive">{error}</p>}
    </label>
  );
}
