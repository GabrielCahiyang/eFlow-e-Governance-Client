import { EmptyState } from '../../../components/ui/EmptyState';
import { FieldLengthHint } from '../../../components/ui/FieldLengthHint';
import { INPUT_LIMITS } from '../../../shared/inputLimits';
import { useMemo, useRef, useState } from "react";
import { AttentionBox, Button, Label } from "@vibe/core";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import {
  CheckCircle2,
  ExternalLink,
  ReceiptText,
  RotateCcw,
} from "lucide-react";
import {
  createReceiptSignedUrl,
  decidePettyCashLiquidation,
} from "../services/budgetService";
import type { DepartmentBudgetBundle } from "../types";
import { peso } from "./budgetUi";
import { formatEvidenceCount, isLiquidationLate } from "../selectors/cashWorkflowRules";
import { useAuth } from "../../../contexts/AuthContext";

import { useConfirmation } from "../../../components/ui/useConfirmation";
import { useExplicitDraft } from "../../../shared/useExplicitDraft";
import { requestNavigation } from "../../../shared/navigationGuard";
import { Button as ActionButton } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { fetchDepartmentBudgetBundle } from "../services/budgetService";
import { useIndependentReviews } from '../hooks/useIndependentReviews';
import { getIndependentReview, independentReviewAllowsPosting } from '../services/independentReviewService';
import { IndependentReviewCard } from './IndependentReviewCard';
import { CashReturnPanel } from './CashReturnPanel';
import { fetchCashReturnClearance } from '../services/workFinancialClearanceService';
import {
  financialOutcome,
  recordFinancialOutcome,
  financialFailureIsUncertain,
  financialWriteFeedback,
  financialErrorMessage,
} from "../financialReceipts";
import { DEFAULT_BUDGET_PAGE_SIZE, useBudgetPagination } from "../hooks/useBudgetPagination";
import { BudgetPagination } from "./BudgetPagination";
export function AccountingSettlementQueue({
  data,
  onChanged,
}: {
  data: DepartmentBudgetBundle;
  onChanged: () => Promise<void>;
}) {
  const { userProfile, can } = useAuth();
  const independent = useIndependentReviews(data);
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
  const pagination = useBudgetPagination(
    items,
    data.summary?.id || "",
    DEFAULT_BUDGET_PAGE_SIZE,
  );
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
          `${row.liquidationNumber || row.id} · ${row.status === 'approved' ? 'Accounting settlement recorded' : 'Corrections requested'}. Confirmed in financial history.`,
        );
        setUncertain("");
        draft.markClean();
        setReason("");
        setRejecting("");
      } else
        setError(
          "We couldn’t confirm a settlement or request for corrections. Check financial history with Accounting before submitting another decision.",
        );
      await onChanged();
    } catch (caught) {
      setError(financialErrorMessage(caught, "We couldn’t check the settlement record. Reload financial history before continuing.", 'read'));
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
      if (
        approve &&
        item.returnedAmount > 0 &&
        !(await fetchCashReturnClearance(id)).approved
      ) {
        throw new Error(
          'Accounting must acknowledge the cash received and the Office Head must approve the return before settlement.',
        );
      }
      const review = await getIndependentReview(id);
      if (review.version !== item.version || !independentReviewAllowsPosting(review, userProfile?.id || '')) throw new Error('Current independent leadership review is required before Accounting can settle this package.');
      if (
        !(await confirmation.confirm({
          title: approve
            ? "Settle and post liquidation?"
            : "Request liquidation corrections?",
          description: `${request.cashRecipientName || request.requesterName || "Recipient"} · ${request.taskTitle || "Funded work"}. ${item.liquidationNumber || item.id} · version ${item.version}. Expense ${peso.format(item.declaredSpent)}, returned cash ${peso.format(item.returnedAmount)}, ${formatEvidenceCount(item.receipts.length)}. ${item.departmentDecidedAt ? "Head authorization recorded." : "No late-package Head authorization recorded."} ${approve ? "Settlement clears the advance through the existing balanced posting; financial history cannot be edited." : "Reason: " + reason.trim()}`,
          actionLabel: approve ? "Confirm settlement" : "Send corrections",
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
      );
      recordFinancialOutcome(keyFor(id), "saved");
      setReceipt(
        `${item.liquidationNumber || item.id}: ${approve ? "Settlement recorded" : "Corrections requested"}. Refreshing canonical records.`,
      );
      draft.markClean();
      setRejecting("");
      setReason("");
      await onChanged();
    } catch (caught) {
      if (
        submitted && !financialOutcome(keyFor(id)) &&
        financialFailureIsUncertain(caught)
      ) {
        recordFinancialOutcome(keyFor(id), "uncertain");
        setUncertain(id);
      }
      setError(financialWriteFeedback(caught, {
        outcome: financialOutcome(keyFor(id)), submitted, action: approve ? 'The settlement' : 'Your request for corrections',
        record: 'financial history', draft: approve ? undefined : 'Your reason is still in the form.',
      }));
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
        financialErrorMessage(caught, "We couldn’t open the receipt. Reopen the package to check the available files.", 'read'),
      );
    }
  };
  return (
    <section className="eflow-accounting-panel">
      {confirmation.dialog}
      <header className="eflow-accounting-panel__header">
        <div className="eflow-accounting-panel__title">
          <ReceiptText size={17} aria-hidden="true" />
          <div>
            <h2>Accounting settlement queue</h2>
            <p>
              Check receipts, cash returned, and the journal entry before closing an advance.
            </p>
          </div>
        </div>
        <Label
          className="ml-auto"
          color={items.length ? "dark" : "positive"}
          text={`${items.length} pending`}
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
              const canDecide = canSettle && !ownFunds && Boolean(review && independentReviewAllowsPosting(review, userProfile?.id || ''));
              return (
                <m.article
                  layout
                  exit={{ opacity: 0, height: 0 }}
                  key={item.id}
                  className="rounded-[10px] border border-border bg-card p-4"
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
                        <Badge variant="outline" className="eflow-financial-status tabular-nums">{peso.format(item.declaredSpent)} expense</Badge>
                        <Badge variant="outline" className="eflow-financial-status tabular-nums" data-tone={item.returnedAmount ? "positive" : "neutral"}>{peso.format(item.returnedAmount)} returned</Badge>
                        {item.refundReceiptNumber && (
                          <Badge variant="outline" className="eflow-financial-status" data-tone="info">Refund OR {item.refundReceiptNumber}</Badge>
                        )}
                        {late && (
                          <Badge variant="outline" className="eflow-financial-status" data-tone={awaitingHead ? "negative" : "positive"}>{awaitingHead ? "Late · Head approval required" : "Late · Head approved"}</Badge>
                        )}
                      </div>
                      {item.receipts.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.receipts.map((receipt) => (
                            <Button
                              key={receipt.id}
                              kind="tertiary"
                              size="small"
                              onClick={() => void openReceipt(receipt.filePath)}
                            >
                              <ExternalLink size={14} aria-hidden="true" />{" "}
                              {receipt.receiptNumber || receipt.fileName}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
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
                      <Button
                        kind="primary"
                        color="primary"
                        size="small"
                        loading={busy === item.id}
                        disabled={Boolean(busy) || awaitingHead || !canDecide}
                        onClick={() => void decide(item.id, true)}
                      >
                        <CheckCircle2 size={14} aria-hidden="true" />{" "}
                        {awaitingHead ? "Awaiting Head" : "Settle & post"}
                      </Button>
                    </div>
                  </div>
                  <CashReturnPanel
                    liquidationId={item.id}
                    rootId={request?.taskId}
                    version={item.version}
                    amount={item.returnedAmount}
                    onSaved={async () => {
                      await independent.refresh();
                      await onChanged();
                    }}
                  />
                  <IndependentReviewCard id={item.id} version={item.version} returnedAmount={item.returnedAmount} context={review} error={independent.errors[item.id]} onChanged={async () => { await independent.refresh(); await onChanged(); }}
                    submittedByAccountingRequester={Boolean(request?.requesterIsAccountingStaff && item.submittedBy === request.requesterId)} />
                  {ownFunds && review?.eligibleSettlers !== 0 && (
                    <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      You can’t settle cash you requested, received, reviewed, or led. Another Accounting Officer is needed.
                    </p>
                  )}
                  {awaitingHead && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      The Head must authorize this late package in Financial
                      Approvals before Accounting Staff can settle it.
                    </div>
                  )}
                  {rejecting === item.id && (
                    <m.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-4 border-t border-border pt-4"
                    >
                      <label className="block text-xs font-medium text-muted-foreground">
                        <span className="flex items-center justify-between gap-2">
                          <span>Required correction</span>
                          <FieldLengthHint length={reason.length} max={INPUT_LIMITS.REASON} />
                        </span>
                        <textarea
                          aria-label="Required liquidation correction"
                          maxLength={INPUT_LIMITS.REASON}
                          value={reason}
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
        ) : (
          <EmptyState size="page" illustration="complete" title="Settlement queue is clear" description="Leader-endorsed liquidations will appear here."/>
        )}
      </div>
      <BudgetPagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        totalItems={pagination.totalItems}
        visibleCount={pagination.pageItems.length}
        noun="package"
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
      />
    </section>
  );
}
