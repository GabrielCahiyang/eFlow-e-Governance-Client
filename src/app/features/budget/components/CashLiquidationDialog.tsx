import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AttentionBox, Button } from "@vibe/core";
import { AlertCircle, CheckCircle2, ExternalLink, FileText, Lock, Plus, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { BoundedTextarea, BoundedTextInput } from "../../../components/ui/BoundedInput";
import { DateInput } from "../../../components/ui/DateInput";
import { Input } from "../../../components/ui/input";
import { MoneyInput } from "../../../components/ui/MoneyInput";
import { ActionBlockerGroup } from "../../../components/ui/action-blockers";
import { WorkspaceTooltip } from "../../../components/ui/workspace/WorkspaceTooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { formatManilaDate } from "../../../shared/calendarDisplay";
import { diffCentavos, exceedsCentavos, sumCentavos } from "../../../shared/currency";
import { INPUT_LIMITS } from "../../../shared/inputLimits";
import type { PettyCashRequest, ReceiptDraft } from "../types";
import { createReceiptSignedUrl, findSavedLiquidation, submitPettyCashLiquidation, type LiquidationAttempt } from "../services/budgetService";
import { fetchRequestAssignmentReceipts } from "../services/workCashAssignmentService";
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
  const sources = useMemo(() => request.fundingLines || [], [request.fundingLines]);
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
  const [invalidDates, setInvalidDates] = useState<Record<string, boolean>>({});
  const noteId = useId();
  const clearanceRun = useRef(0);
  const inFlight = useRef(false);

  const markTouched = (key: string) =>
    setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  const showFieldError = (key: string) => attemptedSubmit || Boolean(touched[key]);
  const setDateInvalid = (key: string, invalid: boolean) =>
    setInvalidDates((prev) => (Boolean(prev[key]) === invalid ? prev : { ...prev, [key]: invalid }));

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

  const [rolledUpCount, setRolledUpCount] = useState(0);

  useEffect(() => {
    void loadClearance();
    return () => {
      clearanceRun.current++;
    };
  }, [loadClearance]);

  useEffect(() => {
    if (!clearance?.canSubmit) return;
    let active = true;
    void fetchRequestAssignmentReceipts(request.id)
      .then((rows) => {
        if (!active || !rows.length) return;
        const mapped: ReceiptDraft[] = rows.map((row) => {
          const originLabel = row.subtaskTitle
            ? `Subtask: ${row.subtaskTitle}${row.uploadedByName ? ` · ${row.uploadedByName}` : ""}`
            : `This task${row.uploadedByName ? ` · ${row.uploadedByName}` : ""}`;
          const fallbackItems =
            itemized && (!row.items || row.items.length === 0) && sources.length > 0
              ? [
                  {
                    id: crypto.randomUUID(),
                    allocationLineId: sources[0].allocationLineId,
                    quantity: 1,
                    unit: "lot",
                    particular: row.description || row.vendor,
                    purpose: `${originLabel} — ${row.description || row.vendor}`.slice(0, 200),
                    amount: row.amount,
                  },
                ]
              : row.items;
          return {
            id: row.id || crypto.randomUUID(),
            vendor: row.vendor,
            receiptNumber: row.receiptNumber || "",
            receiptDate: row.receiptDate || getPhilippineCalendarDate(),
            description: row.description || "",
            amount: row.amount,
            existingFile: {
              fileName: row.fileName,
              filePath: row.filePath,
              mimeType: row.mimeType,
              fileSize: row.fileSize,
            },
            originLabel,
            locked: row.locked === true || row.receiptReviewStatus === "approved",
            approvedByName: row.accountingDecidedByName || undefined,
            ...(itemized ? { items: fallbackItems } : {}),
          };
        });
        setRolledUpCount(mapped.length);
        setReceipts(mapped);
        if (!itemized) {
          const total = mapped.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
          setSpent(Math.round(total * 100) / 100);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [clearance?.canSubmit, request.id, itemized, sources]);

  const editable =
    !!actor &&
    recovery.ready &&
    !recovery.value &&
    !busy &&
    !saved &&
    !clearanceLoading &&
    !clearanceError &&
    clearance?.canSubmit === true;

  const receiptTotal = sumCentavos(receipts.map((receipt) => Number(receipt.amount) || 0));
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

  const hasInvalidDateText =
    receipts.some((receipt) => Boolean(invalidDates[`${receipt.id}:date`])) ||
    (validation.requiresCashReturn && Boolean(invalidDates.refundDate));

  const update = (id: string, patch: Partial<ReceiptDraft>) => {
    if (!editable) return;
    setError("");
    setReceipts((current) =>
      current.map((item) => (item.id === id && !item.locked ? { ...item, ...patch } : item)),
    );
  };

  const submit = async () => {
    if (!actor || !recovery.ready || inFlight.current || saved) return;
    if (!recovery.value) {
      if (!editable) return;
      setAttemptedSubmit(true);
      if (hasInvalidDateText) {
        setError("Enter valid dates in MM/DD/YYYY format before submitting.");
        return;
      }
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
    ? formatManilaDate(request.liquidationDueAt, `${liquidationDueDays} days after full release`)
    : `${liquidationDueDays} days after full release`;

  const unusedCash = Math.max(0, diffCentavos(approved, spent));
  const submitDisabled =
    saved ||
    busy ||
    !recovery.ready ||
    (!recovery.value && (!editable || validation.overLimitBlocked || hasInvalidDateText));

  const submitBusy = busy || clearanceLoading || !recovery.ready;
  const submitBlockers: string[] = [];
  if (submitDisabled && !submitBusy) {
    if (saved) {
      submitBlockers.push("Liquidation has already been submitted.");
    } else if (!recovery.value) {
      if (clearanceError) {
        submitBlockers.push(clearanceError);
      } else if (!clearance?.workAccepted) {
        submitBlockers.push(
          request.subtaskId
            ? "Complete this subtask and have it approved by your Lead before submitting receipts."
            : "Complete this task and have it approved by the Project Lead before submitting receipts.",
        );
      } else if (!editable) {
        submitBlockers.push("Receipt submission is currently locked.");
      }
      if (hasInvalidDateText) {
        submitBlockers.push("Enter valid dates in MM/DD/YYYY format before submitting.");
      }
      if (validation.overLimitBlocked) {
        if (validation.releasedError) {
          submitBlockers.push(validation.releasedError);
        }
        for (const source of validation.exceededSources) {
          submitBlockers.push(
            `${source.label} exceeds its approved funding by ${peso.format(source.overByAmount)}.`,
          );
        }
        if (!validation.releasedError && validation.exceededSources.length === 0) {
          submitBlockers.push("Spending exceeds the available cash limit.");
        }
      }
    }
  }

  const addReceiptBlockers: string[] = [];
  if (!editable && !submitBusy) {
    if (saved) {
      addReceiptBlockers.push("Liquidation has already been submitted.");
    } else if (recovery.value) {
      addReceiptBlockers.push("Check your saved liquidation before adding receipts.");
    } else if (clearanceError) {
      addReceiptBlockers.push(clearanceError);
    } else if (!clearance?.workAccepted) {
      addReceiptBlockers.push("Complete and get work accepted before adding receipts.");
    } else {
      addReceiptBlockers.push("Receipt editing is currently locked.");
    }
  }

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
                  availableMax={approved}
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
          {rolledUpCount > 0 && (
            <div
              role="status"
              className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-[12px] text-emerald-950"
            >
              {receipts.some((item) => item.locked) ? (
                <>
                  <strong>
                    {receipts.filter((item) => item.locked).length} Accounting-approved{" "}
                    {receipts.filter((item) => item.locked).length === 1 ? "receipt" : "receipts"} rolled up &amp; locked
                  </strong>{" "}
                  — already-verified receipts cannot be edited, replaced, or removed. Add any remaining receipts below or submit directly.
                </>
              ) : (
                <>
                  <strong>
                    {rolledUpCount} pre-logged {rolledUpCount === 1 ? "receipt" : "receipts"} rolled up
                  </strong>{" "}
                  from assigned task/subtask cash. Their uploaded files are already attached — add any remaining receipts below or submit directly.
                </>
              )}
            </div>
          )}
          <div className="space-y-3">
            {receipts.map((receipt, index) => {
              const isReceiptLocked = Boolean(receipt.locked);
              const receiptEditable = editable && !isReceiptLocked;
              const rErr = validation.receipts[index];
              const vendorErr = showFieldError(`${receipt.id}:vendor`) ? rErr?.vendor || "" : "";
              const dateInvalid = Boolean(invalidDates[`${receipt.id}:date`]);
              const dateErr = dateInvalid
                ? "Enter a valid receipt date in MM/DD/YYYY format."
                : showFieldError(`${receipt.id}:date`)
                  ? rErr?.receiptDate || ""
                  : "";
              const amountOverApproved = exceedsCentavos(receipt.amount, approved);
              const amountErr =
                !itemized && rErr?.amount && amountOverApproved
                  ? rErr.amount
                  : showFieldError(`${receipt.id}:amount`)
                    ? rErr?.amount || ""
                    : "";
              const descErr = showFieldError(`${receipt.id}:desc`) ? rErr?.description || "" : "";
              const fileErr = showFieldError(`${receipt.id}:file`) ? rErr?.file || "" : "";
              const removeReceiptDisabled = !receiptEditable || receipts.length === 1;
              const removeReceiptBlocker =
                !removeReceiptDisabled || submitBusy
                  ? ""
                  : isReceiptLocked
                    ? "Approved by Accounting — locked and cannot be removed."
                    : !editable
                      ? clearanceError ||
                        (!clearance?.workAccepted
                          ? "Complete and get work accepted before editing receipts."
                          : "Receipt editing is currently locked.")
                      : receipts.length === 1
                        ? "At least one receipt is required."
                        : "";

              return (
                <article
                  key={receipt.id}
                  className={`rounded-xl border p-4 shadow-[0_2px_4px_-3px_rgba(0,0,0,0.12)] ${
                    isReceiptLocked
                      ? "border-emerald-200/90 bg-emerald-50/25"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-border/70 pb-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-semibold text-foreground">Receipt {index + 1}</span>
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[11.5px] font-semibold tabular-nums text-foreground">
                        {peso.format(receipt.amount || 0)}
                      </span>
                      {receipt.originLabel && (
                        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-900">
                          {receipt.originLabel}
                        </span>
                      )}
                      {isReceiptLocked && (
                        <span className="inline-flex items-center gap-1 rounded-[5px] border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-900">
                          <Lock size={11} aria-hidden="true" />
                          Approved by Accounting{receipt.approvedByName ? ` (${receipt.approvedByName})` : ""} · Locked
                        </span>
                      )}
                    </div>
                    {isReceiptLocked ? (
                      <span
                        title="Approved by Accounting — locked and cannot be edited or removed"
                        className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50/80 px-2 py-1 text-[11px] font-medium text-emerald-800"
                      >
                        <Lock size={11} aria-hidden="true" />
                        Locked
                      </span>
                    ) : (
                      <ActionBlockerGroup
                        actionLabel={`Remove receipt ${index + 1}`}
                        blockers={removeReceiptBlocker}
                        busy={submitBusy}
                        compact
                        size="sm"
                      >
                        <WorkspaceTooltip
                          content={`Remove receipt ${index + 1} from this liquidation draft.`}
                          disabled={removeReceiptDisabled}
                        >
                          <button
                            type="button"
                            aria-label={`Remove receipt ${index + 1}`}
                            disabled={removeReceiptDisabled}
                            onClick={() => {
                              if (isReceiptLocked || !editable) return;
                              setInvalidDates((prev) => {
                                const next = { ...prev };
                                delete next[`${receipt.id}:date`];
                                return next;
                              });
                              setReceipts((current) => current.filter((item) => item.id !== receipt.id));
                            }}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-30"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        </WorkspaceTooltip>
                      </ActionBlockerGroup>
                    )}
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field
                      label="Vendor / payee"
                      required
                      disabled={!receiptEditable}
                      maxLength={INPUT_LIMITS.TITLE}
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
                      disabled={!receiptEditable}
                      maxLength={INPUT_LIMITS.CODE}
                      value={receipt.receiptNumber}
                      placeholder="e.g. OR-00142"
                      onChange={(value) => update(receipt.id, { receiptNumber: value })}
                    />

                    <Field
                      label="Receipt date"
                      required
                      type="date"
                      disabled={!receiptEditable}
                      max={getPhilippineCalendarDate()}
                      value={receipt.receiptDate}
                      error={dateErr}
                      onInvalidTextChange={(invalid) => setDateInvalid(`${receipt.id}:date`, invalid)}
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
                            amountOverApproved ? "text-destructive" : "text-foreground"
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
                        disabled={!receiptEditable}
                        value={receipt.amount || ""}
                        availableMax={approved}
                        error={amountErr}
                        onBlur={() => markTouched(`${receipt.id}:amount`)}
                        onChange={(value) => {
                          markTouched(`${receipt.id}:amount`);
                          update(receipt.id, { amount: Number(value) });
                        }}
                        inputClassName="text-right tabular-nums"
                      />
                    )}

                    <div className="sm:col-span-2">
                      <Field
                        label={itemized ? "Expense description (optional)" : "Expense description"}
                        required={!itemized}
                        disabled={!receiptEditable}
                        maxLength={INPUT_LIMITS.TITLE}
                        value={receipt.description}
                        placeholder={
                          itemized
                            ? "Optional summary — purchased item details are listed below"
                            : "What was purchased with this receipt?"
                        }
                        error={descErr}
                        onBlur={() => markTouched(`${receipt.id}:desc`)}
                        onChange={(value) => {
                          markTouched(`${receipt.id}:desc`);
                          update(receipt.id, { description: value });
                        }}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <div className="block">
                        <span className="text-[11.5px] font-medium text-foreground after:ml-0.5 after:text-destructive after:content-['*']">
                          Receipt image or PDF
                        </span>
                        <div
                          className={`mt-1 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-2.5 transition-colors ${
                            fileErr
                              ? "border-destructive bg-destructive/5"
                              : isReceiptLocked
                                ? "border-emerald-300 bg-emerald-50/60"
                                : receipt.file || receipt.existingFile?.filePath
                                  ? "border-primary/40 bg-primary/5"
                                  : "border-[var(--eflow-border,#cbd5e1)] bg-muted/20 hover:border-primary/50"
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2 text-[12px]">
                            {isReceiptLocked ? (
                              <Lock size={14} className="shrink-0 text-emerald-700" aria-hidden="true" />
                            ) : (
                              <Upload size={14} className="shrink-0 text-primary" aria-hidden="true" />
                            )}
                            {receipt.file ? (
                              <span className="truncate font-medium text-foreground">
                                {receipt.file.name}
                                {receipt.file.size ? (
                                  <span className="ml-1.5 font-normal text-muted-foreground">
                                    ({formatFileSize(receipt.file.size)})
                                  </span>
                                ) : null}
                              </span>
                            ) : receipt.existingFile?.filePath ? (
                              <span className="truncate font-medium text-emerald-900">
                                {receipt.existingFile.fileName}
                                <span className="ml-1.5 font-normal text-emerald-700">
                                  {isReceiptLocked
                                    ? "(Verified & locked — cannot be replaced)"
                                    : "(Already uploaded · replace optional)"}
                                </span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Choose a JPG, PNG, WEBP, or PDF receipt file</span>
                            )}
                          </div>
                          {isReceiptLocked ? (
                            receipt.existingFile?.filePath ? (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const url = await createReceiptSignedUrl(receipt.existingFile!.filePath);
                                    window.open(url, "_blank", "noopener,noreferrer");
                                  } catch (caught) {
                                    setError(
                                      readableUiError(caught, "Could not open this receipt file.", "read"),
                                    );
                                  }
                                }}
                                className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-background px-2.5 py-1 text-[11.5px] font-medium text-emerald-900 hover:bg-emerald-50"
                              >
                                <ExternalLink size={12} aria-hidden="true" />
                                View receipt
                              </button>
                            ) : null
                          ) : (
                            <div className="flex items-center gap-2">
                              <Input
                                aria-label={`Receipt image or PDF`}
                                aria-invalid={Boolean(fileErr)}
                                disabled={!receiptEditable}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,application/pdf"
                                onChange={(event) => {
                                  markTouched(`${receipt.id}:file`);
                                  update(receipt.id, { file: event.target.files?.[0] });
                                }}
                                className="h-auto w-[195px] cursor-pointer border-0 bg-transparent p-0 text-[11.5px] shadow-none file:mr-2 file:cursor-pointer file:rounded-md file:border file:border-border file:bg-background file:px-2.5 file:py-1 file:text-[11.5px] file:font-medium file:text-foreground hover:file:bg-muted"
                              />
                              {receipt.file && receiptEditable && (
                                <WorkspaceTooltip content={`Remove attached file for receipt ${index + 1}.`}>
                                  <span className="inline-flex">
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
                                  </span>
                                </WorkspaceTooltip>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
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
                      disabled={!receiptEditable}
                      busy={submitBusy}
                      locked={isReceiptLocked}
                      onChange={(items) => {
                        if (isReceiptLocked || !editable) return;
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

          <ActionBlockerGroup
            actionLabel="Add receipt"
            blockers={addReceiptBlockers}
            busy={submitBusy}
            size="sm"
          >
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
          </ActionBlockerGroup>

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
                maxLength={INPUT_LIMITS.CODE}
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
                error={
                  invalidDates.refundDate
                    ? "Enter a valid cash return date in MM/DD/YYYY format."
                    : showFieldError("refundDate")
                      ? validation.refundDateError
                      : ""
                }
                onInvalidTextChange={(invalid) => setDateInvalid("refundDate", invalid)}
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
          <div>
            <label htmlFor={noteId} className="block text-[11.5px] font-medium text-foreground">
              Liquidation note{" "}
              <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
                *
              </span>
            </label>
            <BoundedTextarea
              id={noteId}
              disabled={!editable}
              aria-required="true"
              maxLength={INPUT_LIMITS.REASON}
              value={note}
              error={showFieldError("note") ? validation.noteError || undefined : undefined}
              onBlur={() => markTouched("note")}
              onChange={(event) => {
                markTouched("note");
                setNote(event.target.value);
              }}
              rows={3}
              placeholder="Summarize what was purchased and confirm any unused cash returned."
              className="mt-1 min-h-[78px] w-full rounded-lg border border-[var(--eflow-border,#cbd5e1)] bg-background px-3 py-2 text-[12.5px] text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
            />
          </div>

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
            <ActionBlockerGroup
              actionLabel={recovery.value ? "Check saved liquidation" : "Submit liquidation"}
              blockers={submitBlockers}
              busy={submitBusy}
              size="sm"
              onRefresh={
                clearanceError || !clearance?.workAccepted
                  ? () => void loadClearance()
                  : undefined
              }
              refreshing={clearanceLoading}
            >
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
            </ActionBlockerGroup>
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
  onInvalidTextChange,
  type = "text",
  max,
  availableMax,
  maxLength,
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
  onInvalidTextChange?: (invalid: boolean) => void;
  type?: string;
  max?: string;
  availableMax?: number;
  maxLength?: number;
  placeholder?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  inputClassName?: string;
}) {
  const fieldId = useId();
  return (
    <div className="block">
      <label htmlFor={fieldId} className="block text-[11.5px] font-medium text-foreground">
        {label}
        {required && (
          <span className="ml-0.5 text-[var(--eflow-negative-text)]" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {type === "number" ? (
        <MoneyInput
          id={fieldId}
          min={0}
          max={INPUT_LIMITS.MONEY_MAX_BUDGET}
          availableMax={availableMax}
          showCeilingHint
          externalError={error || undefined}
          aria-required={required || undefined}
          disabled={disabled}
          value={value}
          onBlur={onBlur}
          onValueChange={onChange}
          className={`${error ? FIELD_ERROR_CLASS : FIELD_CLASS} ${inputClassName}`}
        />
      ) : type === "date" ? (
        <>
          <div className="mt-1">
            <DateInput
              id={fieldId}
              max={max}
              value={String(value ?? "")}
              disabled={disabled}
              aria-required={required || undefined}
              hasError={Boolean(error)}
              errorMessage={error || undefined}
              onInvalidTextChange={onInvalidTextChange}
              onBlur={onBlur}
              onChange={(event) => onChange(event.target.value)}
              className={`h-9 text-[12.5px] ${inputClassName}`}
            />
          </div>
          {error && (
            <p role="alert" className="mt-1 text-[11px] text-destructive">
              {error}
            </p>
          )}
        </>
      ) : (
        <BoundedTextInput
          id={fieldId}
          maxLength={maxLength ?? INPUT_LIMITS.TITLE}
          placeholder={placeholder}
          aria-required={required || undefined}
          disabled={disabled}
          value={String(value ?? "")}
          error={error || undefined}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
          className={`${error ? FIELD_ERROR_CLASS : FIELD_CLASS} ${inputClassName}`}
        />
      )}
    </div>
  );
}
