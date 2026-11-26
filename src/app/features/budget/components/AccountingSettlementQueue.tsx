import {
  ActionBlockerGroup,
  type ActionBlockerItem,
} from "../../../components/ui/action-blockers";
import { BoundedTextarea } from "../../../components/ui/BoundedInput";
import { EmptyState } from "../../../components/ui/EmptyState";
import { INPUT_LIMITS } from "../../../shared/inputLimits";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AttentionBox, Button, Label } from "@vibe/core";
import { useNotificationNavigationIntent } from "../../notifications";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  ReceiptText,
  RotateCcw,
} from "lucide-react";
import {
  createReceiptSignedUrl,
  decidePettyCashLiquidation,
  fetchDepartmentBudgetBundle,
} from "../services/budgetService";
import {
  createAssignmentReceiptSignedUrl,
  decideAssignmentReceiptReview,
  fetchPendingAssignmentReceiptReviews,
} from "../services/workCashAssignmentService";
import type {
  DepartmentBudgetBundle,
  PendingAssignmentReceiptReview,
  WorkCashSourceKind,
} from "../types";
import { peso } from "./budgetUi";
import {
  formatEvidenceCount,
  isLiquidationLate,
} from "../selectors/cashWorkflowRules";
import { useAuth } from "../../../contexts/AuthContext";
import { useConfirmation } from "../../../components/ui/useConfirmation";
import { useExplicitDraft } from "../../../shared/useExplicitDraft";
import { requestNavigation } from "../../../shared/navigationGuard";
import { Button as ActionButton } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { useIndependentReviews } from "../hooks/useIndependentReviews";
import {
  getIndependentReview,
  independentReviewAllowsPosting,
} from "../services/independentReviewService";
import { IndependentReviewCard } from "./IndependentReviewCard";
import {
  financialOutcome,
  recordFinancialOutcome,
  financialFailureIsUncertain,
  financialWriteFeedback,
  financialErrorMessage,
} from "../financialReceipts";
import {
  DEFAULT_BUDGET_PAGE_SIZE,
  useBudgetPagination,
} from "../hooks/useBudgetPagination";
import { BudgetPagination } from "./BudgetPagination";

function isImageReceipt(fileName?: string, mimeType?: string): boolean {
  if (mimeType && mimeType.toLowerCase().startsWith("image/")) return true;
  return /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(fileName || "");
}

function ReceiptAttachmentButton({
  vendor,
  amount,
  receiptNumber,
  fileName,
  filePath,
  mimeType,
  onOpen,
}: {
  vendor?: string;
  amount: number;
  receiptNumber?: string;
  fileName?: string;
  filePath?: string;
  mimeType?: string;
  onOpen: () => void;
}) {
  const isImg = isImageReceipt(fileName || filePath, mimeType);
  const displayFileName =
    fileName || (filePath ? filePath.split("/").pop() : undefined);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group inline-flex items-center gap-2.5 rounded-lg border border-border bg-muted/35 px-3 py-2 text-left text-xs transition hover:border-primary/50 hover:bg-primary/5"
    >
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
        aria-hidden="true"
      >
        {isImg ? <ImageIcon size={14} /> : <FileText size={14} />}
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-1.5 font-medium text-foreground">
          <span>{vendor || "Receipt"}</span>
          <span className="tabular-nums text-muted-foreground">
            · {peso.format(amount)}
          </span>
          {receiptNumber && (
            <span className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground">
              OR #{receiptNumber}
            </span>
          )}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="font-medium text-primary">
            {isImg ? "View receipt image" : "View receipt PDF"}
          </span>
          {displayFileName && (
            <span className="max-w-[180px] truncate">· {displayFileName}</span>
          )}
          <ExternalLink
            size={11}
            className="shrink-0 text-primary"
            aria-hidden="true"
          />
        </span>
      </span>
    </button>
  );
}

export function AccountingSettlementQueue({
  data,
  onChanged,
}: {
  data: DepartmentBudgetBundle;
  onChanged: () => Promise<void>;
}) {
  const { userProfile, can } = useAuth();
  const independent = useIndependentReviews(data);
  const orgId =
    data.summary?.orgId ||
    userProfile?.org_id ||
    userProfile?.departmentId ||
    "";

  const canSettle =
    userProfile?.role === "accounting_staff" &&
    can("accounting.settle_liquidation") &&
    !(data as DepartmentBudgetBundle & { error?: string }).error;

  const items = useMemo(
    () =>
      data.liquidations.filter(
        (item) => item.status === "pending_department_settlement",
      ),
    [data.liquidations],
  );
  const requestById = useMemo(
    () => new Map(data.requests.map((request) => [request.id, request])),
    [data.requests],
  );

  // Pending subtask / assignment receipt reviews
  const [assignmentReviews, setAssignmentReviews] = useState<
    PendingAssignmentReceiptReview[]
  >([]);
  const assignmentRunRef = useRef(0);

  const loadAssignmentReviews = useCallback(async () => {
    if (!orgId) {
      setAssignmentReviews([]);
      return;
    }
    const run = ++assignmentRunRef.current;
    try {
      const next = await fetchPendingAssignmentReceiptReviews(orgId);
      if (run === assignmentRunRef.current) {
        setAssignmentReviews(next);
      }
    } catch {
      // Keep last verified list if background refresh fails transiently
    }
  }, [orgId]);

  useEffect(() => {
    void loadAssignmentReviews();
    if (typeof window === "undefined") return;
    const reload = () => void loadAssignmentReviews();
    window.addEventListener("focus", reload);
    window.addEventListener("eflow:finance-updated", reload);
    window.addEventListener("eflow:expenses-updated", reload);
    window.addEventListener("eflow:subtask-budget-changed", reload);
    window.addEventListener("eflow:work-updated", reload);
    return () => {
      assignmentRunRef.current++;
      window.removeEventListener("focus", reload);
      window.removeEventListener("eflow:finance-updated", reload);
      window.removeEventListener("eflow:expenses-updated", reload);
      window.removeEventListener("eflow:subtask-budget-changed", reload);
      window.removeEventListener("eflow:work-updated", reload);
    };
  }, [loadAssignmentReviews]);

  const pagination = useBudgetPagination(
    items,
    data.summary?.id || "",
    DEFAULT_BUDGET_PAGE_SIZE,
  );
  const [focusId, setFocusId] = useState<string>("");
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});

  useNotificationNavigationIntent(
    (intent) =>
      intent.kind === "budget" &&
      Boolean(intent.financialRecordId) &&
      intent.financialRecordType !== "project_funding" &&
      intent.financialRecordType !== "office_petty_cash",
    (intent) => {
      const target = intent.financialRecordId || "";
      const index = items.findIndex(
        (item) => item.id === target || item.requestId === target,
      );
      if (index >= 0) {
        const matched = items[index];
        setFocusId(matched.id);
        pagination.setPage(Math.floor(index / pagination.pageSize) + 1);
      } else {
        setFocusId(target);
      }
      return true;
    },
    [items, pagination.pageSize, pagination.setPage],
  );

  useEffect(() => {
    if (!focusId) return;
    const node = cardRefs.current[focusId];
    if (node && typeof node.scrollIntoView === "function") {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusId, pagination.page, assignmentReviews.length]);

  const [busy, setBusy] = useState("");
  const [rejecting, setRejecting] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const latestData = useRef(data);
  latestData.current = data;
  const pending = useRef(false);
  const confirmation = useConfirmation();
  const [receipt, setReceipt] = useState("");
  const [uncertain, setUncertain] = useState("");
  const draft = useExplicitDraft(
    "Settlement review reason",
    Boolean(reason.trim()),
    Boolean(busy),
    () => {
      setReason("");
      setRejecting("");
    },
  );
  const keyFor = (id: string) => `settlement:${userProfile?.id}:${id}`;

  const verify = async () => {
    if (!uncertain || !data.summary || pending.current) return;
    pending.current = true;
    setBusy(uncertain);
    setError("");
    try {
      const next = await fetchDepartmentBudgetBundle(
        data.summary.orgId,
        data.summary.fiscalYear,
      );
      const row = next.liquidations.find((item) => item.id === uncertain);
      if (row?.status === "approved" || row?.status === "changes_requested") {
        recordFinancialOutcome(keyFor(uncertain), "saved");
        setReceipt(
          `${row.liquidationNumber || row.id} · ${row.status === "approved" ? "Accounting settlement recorded" : "Corrections requested"}. Confirmed in financial history.`,
        );
        setUncertain("");
        draft.markClean();
        setReason("");
        setRejecting("");
      } else
        setError(
          "We couldn’t confirm a settlement or request for corrections. Check financial history with Accounting before submitting another decision.",
        );
      await Promise.all([onChanged(), loadAssignmentReviews()]);
    } catch (caught) {
      setError(
        financialErrorMessage(
          caught,
          "We couldn’t check the settlement record. Reload financial history before continuing.",
          "read",
        ),
      );
    } finally {
      pending.current = false;
      setBusy("");
    }
  };

  const decide = async (id: string, approve: boolean) => {
    const item = data.liquidations.find((row) => row.id === id);
    const request = item && requestById.get(item.requestId);
    if (
      !canSettle ||
      pending.current ||
      !item ||
      !request ||
      item.status !== "pending_department_settlement" ||
      [
        request.cashRecipientId,
        request.requesterId,
        request.taskLeaderId,
      ].includes(userProfile?.id) ||
      (approve &&
        isLiquidationLate(request, item) &&
        !item.departmentDecidedAt) ||
      (!approve && !reason.trim())
    )
      return;

    // Requester's Refund OR is recorded automatically when present; the confirmation modal is Accounting's attestation.
    const returnRef = item.refundReceiptNumber?.trim() || "";

    if (financialOutcome(keyFor(id))) {
      setUncertain(financialOutcome(keyFor(id)) === "uncertain" ? id : "");
      setError(
        "A previous decision already has a saved or uncertain result. Verify current records before continuing.",
      );
      return;
    }
    const reviewedSnapshot = JSON.stringify({ item, request });
    pending.current = true;
    draft.pendingRef.current = true;
    setBusy(id);
    setError("");
    let submitted = false;
    try {
      const review = await getIndependentReview(id);
      if (
        review.version !== item.version ||
        !independentReviewAllowsPosting(review, userProfile?.id || "")
      )
        throw new Error(
          "Current independent leadership review is required before Accounting can settle this package.",
        );
      if (
        !(await confirmation.confirm({
          title: approve
            ? item.returnedAmount > 0
              ? `Confirm you received ${peso.format(item.returnedAmount)} and settle?`
              : "Settle and post liquidation?"
            : "Request liquidation corrections?",
          description: `${request.cashRecipientName || request.requesterName || "Recipient"} · ${request.taskTitle || "Funded work"}. ${item.liquidationNumber || item.id} · version ${item.version}. Expense ${peso.format(item.declaredSpent)}, returned cash ${peso.format(item.returnedAmount)}${approve && item.returnedAmount > 0 ? (returnRef ? ` (Ref: ${returnRef})` : "") : ""}, ${formatEvidenceCount(item.receipts.length)}. ${approve ? (item.returnedAmount > 0 ? `By confirming, you attest that you physically received ${peso.format(item.returnedAmount)} from ${request.cashRecipientName || request.requesterName || "the recipient"}. This credits the cash back, posts the balanced journal entry, records your name and time in the audit trail, and auto-completes the work once approved.` : "Settlement verifies the receipts, posts the balanced journal entry, and auto-completes the work once approved.") : "Reason: " + reason.trim()}`,
          actionLabel: approve
            ? item.returnedAmount > 0
              ? "Yes, I received the cash — settle"
              : "Confirm settlement"
            : "Send corrections",
          tone: approve ? "approve" : undefined,
        }))
      )
        return;
      const currentItem = latestData.current.liquidations.find(
        (row) => row.id === id,
      );
      const currentRequest = latestData.current.requests.find(
        (row) => row.id === currentItem?.requestId,
      );
      if (
        JSON.stringify({ item: currentItem, request: currentRequest }) !==
        reviewedSnapshot
      ) {
        setError(
          "The liquidation package changed while being reviewed. Review its current evidence and authorization before deciding.",
        );
        return;
      }
      submitted = true;
      await decidePettyCashLiquidation(
        id,
        approve,
        approve
          ? "Receipts verified and balanced journal settlement approved"
          : reason.trim(),
        approve && item.returnedAmount > 0 ? returnRef : undefined,
      );
      recordFinancialOutcome(keyFor(id), "saved");
      setReceipt(
        `${item.liquidationNumber || item.id}: ${approve ? "Settlement & cash return recorded" : "Corrections requested"}. Refreshing canonical records.`,
      );
      draft.markClean();
      setRejecting("");
      setReason("");
      await Promise.all([onChanged(), loadAssignmentReviews()]);
    } catch (caught) {
      if (
        submitted &&
        !financialOutcome(keyFor(id)) &&
        financialFailureIsUncertain(caught)
      ) {
        recordFinancialOutcome(keyFor(id), "uncertain");
        setUncertain(id);
      }
      setError(
        financialWriteFeedback(caught, {
          outcome: financialOutcome(keyFor(id)),
          submitted,
          action: approve ? "The settlement" : "Your request for corrections",
          record: "financial history",
          draft: approve ? undefined : "Your reason is still in the form.",
        }),
      );
    } finally {
      pending.current = false;
      draft.pendingRef.current = false;
      setBusy("");
    }
  };

  const decideSubtaskReview = async (
    reviewItem: PendingAssignmentReceiptReview,
    approve: boolean,
  ) => {
    if (
      !canSettle ||
      !reviewItem.canDecide ||
      pending.current ||
      (!approve && !reason.trim())
    ) {
      return;
    }
    const targetTitle = reviewItem.subtaskTitle || reviewItem.taskTitle;
    pending.current = true;
    draft.pendingRef.current = true;
    setBusy(reviewItem.assignmentId);
    setError("");
    try {
      if (
        !(await confirmation.confirm({
          title: approve
            ? "Approve subtask receipts?"
            : "Request receipt corrections?",
          description: approve
            ? `Verify ${peso.format(reviewItem.amount)} in receipts for "${targetTitle}" (${reviewItem.sourceLabel}).${reviewItem.returnedToPoolAmount > 0 ? ` ${peso.format(reviewItem.returnedToPoolAmount)} unused cash was already returned to the task pool.` : ""} Once both Task Lead and Accounting approve, this subtask is automatically marked as completed.`
            : `Return receipts for "${targetTitle}" for correction. Reason: ${reason.trim()}`,
          actionLabel: approve ? "Approve receipts" : "Send corrections",
        }))
      ) {
        return;
      }
      const outcome = await decideAssignmentReceiptReview({
        assignmentId: reviewItem.assignmentId,
        taskId: reviewItem.taskId,
        subtaskId: reviewItem.subtaskId,
        approve,
        reason: approve ? undefined : reason.trim(),
      });
      setReceipt(
        approve
          ? outcome.autoCompleted
            ? `${targetTitle}: Receipts approved by Accounting and subtask automatically marked completed.`
            : `${targetTitle}: Receipts approved by Accounting. Waiting on Task Lead approval to auto-complete.`
          : `${targetTitle}: Receipt corrections requested.`,
      );
      draft.markClean();
      setRejecting("");
      setReason("");
      await Promise.all([loadAssignmentReviews(), onChanged()]);
    } catch (caught) {
      setError(
        financialErrorMessage(
          caught,
          "Could not save your receipt review decision.",
          "write",
        ),
      );
    } finally {
      pending.current = false;
      draft.pendingRef.current = false;
      setBusy("");
    }
  };

  const openReceipt = async (path: string) => {
    try {
      window.open(
        await createReceiptSignedUrl(path),
        "_blank",
        "noopener,noreferrer",
      );
    } catch (caught) {
      setError(
        financialErrorMessage(
          caught,
          "We couldn’t open the receipt. Reopen the package to check the available files.",
          "read",
        ),
      );
    }
  };

  const openAssignmentReceipt = async (
    sourceKind: WorkCashSourceKind,
    path: string,
  ) => {
    try {
      window.open(
        await createAssignmentReceiptSignedUrl(sourceKind, path),
        "_blank",
        "noopener,noreferrer",
      );
    } catch (caught) {
      setError(
        financialErrorMessage(
          caught,
          "We couldn’t open this receipt attachment.",
          "read",
        ),
      );
    }
  };

  const totalPendingCount = items.length + assignmentReviews.length;

  return (
    <section className="eflow-accounting-panel">
      {confirmation.dialog}
      <header className="eflow-accounting-panel__header">
        <div className="eflow-accounting-panel__title">
          <ReceiptText size={17} aria-hidden="true" />
          <div>
            <h2>Accounting settlement queue</h2>
            <p>
              Verify subtask receipts, returned cash, and task liquidations before closing advances.
            </p>
          </div>
        </div>
        <Label
          className="ml-auto"
          color={totalPendingCount ? "dark" : "positive"}
          text={`${totalPendingCount} pending`}
        />
      </header>
      <div className="space-y-3 p-4 sm:p-5">
        {receipt && (
          <p
            role="status"
            className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
          >
            {receipt}
          </p>
        )}
        {uncertain && (
          <ActionButton
            variant="outline"
            disabled={Boolean(busy)}
            onClick={() => void verify()}
          >
            Verify settlement outcome
          </ActionButton>
        )}
        {error && <AttentionBox type="negative" text={error} />}

        {/* Pending Subtask / Cash-Assignment Receipt Reviews */}
        {assignmentReviews.length > 0 && (
          <div className="space-y-3" aria-label="Pending subtask receipt reviews">
            {assignmentReviews.map((reviewItem) => {
              const isFocused = focusId === reviewItem.assignmentId;
              const targetTitle =
                reviewItem.subtaskTitle || reviewItem.taskTitle;
              return (
                <m.article
                  layout
                  key={`assign:${reviewItem.assignmentId}`}
                  ref={(node) => {
                    cardRefs.current[reviewItem.assignmentId] = node;
                  }}
                  data-focused={isFocused ? "true" : undefined}
                  className={`rounded-[10px] border bg-card p-4 transition-shadow ${
                    isFocused
                      ? "border-[var(--eflow-primary)] ring-2 ring-[var(--eflow-primary)]/25"
                      : "border-border"
                  }`}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-[5px] border border-primary/25 bg-[var(--eflow-selected)] px-2 py-0.5 text-[11px] font-semibold text-[var(--eflow-primary)]">
                          {reviewItem.subtaskId ? "Subtask receipts" : "Work receipts"}
                        </span>
                        <span className="text-sm font-semibold text-foreground">
                          {targetTitle}
                        </span>
                        {reviewItem.subtaskId && (
                          <span className="text-xs text-muted-foreground">
                            in {reviewItem.taskTitle}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {reviewItem.submittedByName} · {reviewItem.sourceLabel}
                        {reviewItem.submissionNote
                          ? ` · “${reviewItem.submissionNote}”`
                          : ""}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge
                          variant="outline"
                          className="eflow-financial-status tabular-nums"
                        >
                          {peso.format(reviewItem.amount)} in receipts
                        </Badge>
                        {reviewItem.returnedToPoolAmount > 0 && (
                          <Badge
                            variant="outline"
                            className="eflow-financial-status tabular-nums"
                            data-tone="positive"
                          >
                            {peso.format(reviewItem.returnedToPoolAmount)} returned to task pool
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className="eflow-financial-status"
                          data-tone={reviewItem.workAccepted ? "positive" : "info"}
                        >
                          {reviewItem.workAccepted
                            ? "Task Lead approved"
                            : "Awaiting Task Lead approval"}
                        </Badge>
                      </div>
                      {reviewItem.receipts.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {reviewItem.receipts.map((rcpt) => (
                            <ReceiptAttachmentButton
                              key={rcpt.id}
                              vendor={rcpt.vendor}
                              amount={rcpt.amount}
                              receiptNumber={rcpt.receiptNumber}
                              fileName={rcpt.fileName}
                              filePath={rcpt.filePath}
                              onOpen={() =>
                                void openAssignmentReceipt(
                                  reviewItem.sourceKind,
                                  rcpt.filePath,
                                )
                              }
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        kind="secondary"
                        size="small"
                        disabled={
                          Boolean(busy) || !canSettle || !reviewItem.canDecide
                        }
                        onClick={() => {
                          setRejecting(`assign:${reviewItem.assignmentId}`);
                          setReason("");
                        }}
                      >
                        <RotateCcw size={14} aria-hidden="true" /> Request changes
                      </Button>
                      <ActionBlockerGroup
                        actionLabel="Approve receipts"
                        busy={Boolean(busy)}
                        size="sm"
                        blockers={
                          !canSettle
                            ? [
                                {
                                  id: `${reviewItem.assignmentId}-perm`,
                                  category: "accounting_approval",
                                  title: "Financial Officer (Accounting) required",
                                  detail:
                                    "Only an eligible Financial Officer (Accounting) can approve and post subtask receipts.",
                                  waitingOn: "Financial Officer (Accounting)",
                                  statusLabel: "Role required",
                                },
                              ]
                            : !reviewItem.canDecide
                              ? [
                                  {
                                    id: `${reviewItem.assignmentId}-sod`,
                                    category: "separation_of_duties",
                                    title: "Independent Financial Officer required",
                                    detail:
                                      "You cannot approve receipts you uploaded, assigned, or submitted. Another Financial Officer (Accounting) must verify this package.",
                                    waitingOn: "Another Financial Officer (Accounting)",
                                    statusLabel: "Separation of duties",
                                  },
                                ]
                              : []
                        }
                      >
                        <Button
                          kind="primary"
                          color="primary"
                          size="small"
                          loading={busy === reviewItem.assignmentId}
                          disabled={
                            Boolean(busy) || !canSettle || !reviewItem.canDecide
                          }
                          onClick={() => void decideSubtaskReview(reviewItem, true)}
                        >
                          <CheckCircle2 size={14} aria-hidden="true" /> Approve receipts
                        </Button>
                      </ActionBlockerGroup>
                    </div>
                  </div>

                  {rejecting === `assign:${reviewItem.assignmentId}` && (
                    <m.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-4 border-t border-border pt-4"
                    >
                      <label className="block text-xs font-medium text-muted-foreground">
                        <span className="block">Required receipt correction *</span>
                        <BoundedTextarea
                          aria-label="Required receipt correction"
                          maxLength={INPUT_LIMITS.REASON}
                          value={reason}
                          disabled={Boolean(busy)}
                          onChange={(event) => setReason(event.target.value)}
                          rows={2}
                          className="mt-1.5 w-full rounded-lg border border-border bg-card p-2.5 text-sm text-foreground"
                        />
                      </label>
                      <div className="mt-2.5 flex justify-end gap-2">
                        <Button
                          kind="tertiary"
                          size="small"
                          onClick={() => {
                            void requestNavigation(() => {
                              setRejecting("");
                              setReason("");
                            });
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          kind="primary"
                          color="negative"
                          size="small"
                          loading={busy === reviewItem.assignmentId}
                          disabled={
                            !reason.trim() ||
                            Boolean(busy) ||
                            !canSettle ||
                            !reviewItem.canDecide
                          }
                          onClick={() =>
                            void decideSubtaskReview(reviewItem, false)
                          }
                        >
                          Send correction
                        </Button>
                      </div>
                    </m.div>
                  )}
                </m.article>
              );
            })}
          </div>
        )}

        {/* Task Cash-Release Liquidations (with One-Step Unused Cash Return Verification) */}
        {items.length ? (
          <AnimatePresence mode="popLayout">
            {pagination.pageItems.map((item) => {
              const request = requestById.get(item.requestId);
              const late = isLiquidationLate(request, item);
              const awaitingHead = late && !item.departmentDecidedAt;
              const ownFunds = Boolean(
                userProfile?.id &&
                  [
                    request?.cashRecipientId,
                    request?.requesterId,
                    request?.taskLeaderId,
                  ].includes(userProfile.id),
              );
              const review = independent.contexts[item.id];
              const canDecide =
                canSettle &&
                !ownFunds &&
                Boolean(
                  review &&
                    independentReviewAllowsPosting(
                      review,
                      userProfile?.id || "",
                    ),
                );
              const isFocused = Boolean(
                focusId && (item.id === focusId || item.requestId === focusId),
              );

              return (
                <m.article
                  layout
                  exit={{ opacity: 0, height: 0 }}
                  key={item.id}
                  ref={(node) => {
                    cardRefs.current[item.id] = node;
                  }}
                  data-focused={isFocused ? "true" : undefined}
                  className={`rounded-[10px] border bg-card p-4 transition-shadow ${
                    isFocused
                      ? "border-[var(--eflow-primary)] ring-2 ring-[var(--eflow-primary)]/25"
                      : "border-border"
                  }`}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-medium text-primary">
                          {item.liquidationNumber || `LIQ v${item.version}`}
                        </span>
                        <span className="text-sm font-semibold text-foreground">
                          {request?.subtaskTitle ||
                            request?.taskTitle ||
                            "Funded work"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {request?.requesterName || "Recipient"} ·{" "}
                        {request?.purpose}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge
                          variant="outline"
                          className="eflow-financial-status tabular-nums"
                        >
                          {peso.format(item.declaredSpent)} expense
                        </Badge>
                        <Badge
                          variant="outline"
                          className="eflow-financial-status tabular-nums"
                          data-tone={
                            item.returnedAmount ? "positive" : "neutral"
                          }
                        >
                          {peso.format(item.returnedAmount)} returned
                        </Badge>
                        {item.refundReceiptNumber && (
                          <Badge
                            variant="outline"
                            className="eflow-financial-status"
                            data-tone="info"
                          >
                            Refund OR {item.refundReceiptNumber}
                          </Badge>
                        )}
                        {late && (
                          <Badge
                            variant="outline"
                            className="eflow-financial-status"
                            data-tone={awaitingHead ? "negative" : "positive"}
                          >
                            {awaitingHead
                              ? "Late · Head approval required"
                              : "Late · Head approved"}
                          </Badge>
                        )}
                      </div>
                      {item.receipts.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.receipts.map((rcpt) => (
                            <ReceiptAttachmentButton
                              key={rcpt.id}
                              vendor={rcpt.vendor}
                              amount={rcpt.amount}
                              receiptNumber={rcpt.receiptNumber}
                              fileName={rcpt.fileName}
                              filePath={rcpt.filePath}
                              mimeType={rcpt.mimeType}
                              onOpen={() => void openReceipt(rcpt.filePath)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        kind="secondary"
                        size="small"
                        disabled={Boolean(busy) || !canDecide}
                        onClick={() => {
                          setRejecting(item.id);
                          setReason("");
                        }}
                      >
                        <RotateCcw size={14} aria-hidden="true" /> Request changes
                      </Button>
                      {(() => {
                        const settleLabel =
                          item.returnedAmount > 0
                            ? "Confirm return & settle"
                            : "Settle & post";
                        const settleBlockers: ActionBlockerItem[] = [];
                        if (awaitingHead) {
                          settleBlockers.push({
                            id: `${item.id}-late-head`,
                            category: "head_approval",
                            title: "Waiting for Office Head approval",
                            detail:
                              "This liquidation was submitted past its deadline. The Office Head must authorize the late package in Financial Approvals before the Financial Officer (Accounting) can settle and post.",
                            waitingOn: "Office Head",
                            statusLabel: "Late · Pending Head",
                            amount: item.declaredSpent + item.returnedAmount,
                            dueAt: request?.liquidationDueAt,
                          });
                        }
                        if (!canSettle) {
                          settleBlockers.push({
                            id: `${item.id}-role`,
                            category: "accounting_approval",
                            title: "Financial Officer (Accounting) required",
                            detail:
                              "Only an eligible Financial Officer (Accounting) can settle and post liquidation packages.",
                            waitingOn: "Financial Officer (Accounting)",
                            statusLabel: "Role required",
                          });
                        } else if (ownFunds) {
                          settleBlockers.push({
                            id: `${item.id}-sod`,
                            category: "separation_of_duties",
                            title: "Independent Financial Officer required",
                            detail:
                              "You cannot settle cash you requested, received, reviewed, or led. Another eligible Financial Officer (Accounting) must settle and post this package.",
                            waitingOn: "Another Financial Officer (Accounting)",
                            statusLabel: "Separation of duties",
                          });
                        } else if (!canDecide && (review || independent.errors[item.id])) {
                          settleBlockers.push({
                            id: `${item.id}-indep`,
                            category: "accounting_approval",
                            title: "Independent review clearance pending",
                            detail:
                              review?.eligibleSettlers === 0
                                ? "No eligible independent Financial Officer is available. Wait for escalation resolution or Head approval."
                                : "Independent review clearance must complete before this liquidation can be posted.",
                            waitingOn:
                              review?.eligibleSettlers === 0
                                ? "Office Head / System Admin"
                                : "Assigned Independent Reviewer",
                            statusLabel: "Review required",
                          });
                        }

                        return (
                          <ActionBlockerGroup
                            actionLabel={settleLabel}
                            blockers={settleBlockers}
                            busy={Boolean(busy)}
                            size="sm"
                          >
                            <Button
                              kind="primary"
                              color="primary"
                              size="small"
                              loading={busy === item.id}
                              disabled={
                                Boolean(busy) || awaitingHead || !canDecide
                              }
                              onClick={() => void decide(item.id, true)}
                            >
                              <CheckCircle2 size={14} aria-hidden="true" />{" "}
                              {settleLabel}
                            </Button>
                          </ActionBlockerGroup>
                        );
                      })()}
                    </div>
                  </div>

                  <IndependentReviewCard
                    id={item.id}
                    version={item.version}
                    returnedAmount={item.returnedAmount}
                    context={review}
                    error={independent.errors[item.id]}
                    onChanged={async () => {
                      await independent.refresh();
                      await onChanged();
                    }}
                    submittedByAccountingRequester={Boolean(
                      request?.requesterIsAccountingStaff &&
                        item.submittedBy === request.requesterId,
                    )}
                  />
                  {rejecting === item.id && (
                    <m.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-4 border-t border-border pt-4"
                    >
                      <label className="block text-xs font-medium text-muted-foreground">
                        <span className="block">Required correction *</span>
                        <BoundedTextarea
                          aria-label="Required liquidation correction"
                          maxLength={INPUT_LIMITS.REASON}
                          value={reason}
                          disabled={Boolean(busy)}
                          onChange={(event) => setReason(event.target.value)}
                          rows={2}
                          className="mt-1.5 w-full rounded-lg border border-border bg-card p-2.5 text-sm text-foreground"
                        />
                      </label>
                      <div className="mt-2.5 flex justify-end gap-2">
                        <Button
                          kind="tertiary"
                          size="small"
                          onClick={() => {
                            void requestNavigation(() => {
                              setRejecting("");
                              setReason("");
                            });
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          kind="primary"
                          color="negative"
                          size="small"
                          loading={busy === item.id}
                          disabled={
                            !reason.trim() || Boolean(busy) || !canDecide
                          }
                          onClick={() => void decide(item.id, false)}
                        >
                          Send correction
                        </Button>
                      </div>
                    </m.div>
                  )}
                </m.article>
              );
            })}
          </AnimatePresence>
        ) : assignmentReviews.length === 0 ? (
          <EmptyState
            size="page"
            illustration="complete"
            title="Settlement queue is clear"
            description="Subtask receipts and task liquidations awaiting Accounting review will appear here."
          />
        ) : null}
      </div>
      {items.length > 0 && (
        <BudgetPagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          totalItems={pagination.totalItems}
          visibleCount={pagination.pageItems.length}
          noun="package"
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      )}
    </section>
  );
}
