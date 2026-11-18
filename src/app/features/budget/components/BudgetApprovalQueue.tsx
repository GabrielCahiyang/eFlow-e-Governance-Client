import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@vibe/core";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { Banknote, Check, FileCheck2, WalletCards, RotateCcw } from "lucide-react";
import {
  BxSliderAlt,
  BxsBolt,
  BxsCheckShield,
} from "../../../components/ui/boxicons";
import {DecisionModal, DecisionResultModal} from '../../../components/ui/DecisionModal';
import { useToast } from "../../../components/ui/Toast";
import { useAuth } from "../../../contexts/AuthContext";
import { motionTransition } from "../../../shared/motion/motionTokens";
import type { DepartmentBudgetBundle } from "../types";
import {
  createReceiptSignedUrl,
  authorizeLateLiquidation,
  decidePettyCashLiquidation,
  decidePettyCashLiquidationLeaderReview,
  decidePettyCashLeaderReview,
  decidePettyCashRequest,
  decideWorkBudgetAllocation,
  markPettyCashReleased,
} from "../services/budgetService";
import { BudgetEmpty, peso, StatusPill } from "./budgetUi";
import { CashReturnPanel } from "./CashReturnPanel";
import { fetchCashReturnClearance } from "../services/workFinancialClearanceService";
import { useApprovalThreshold } from "../hooks/useApprovalThreshold";
import { ApprovalThresholdDialog } from "./ApprovalThresholdDialog";
import { DEFAULT_BUDGET_PAGE_SIZE, useBudgetPagination } from "../hooks/useBudgetPagination";
import { BudgetPagination } from "./BudgetPagination";
import {
  formatEvidenceCount,
  formatFundingRequestCode,
  getPhilippineCalendarDate,
  isLiquidationLate,
} from "../selectors/cashWorkflowRules";

import { useConfirmation } from "../../../components/ui/useConfirmation";
import { useExplicitDraft } from "../../../shared/useExplicitDraft";
import { requestNavigation } from "../../../shared/navigationGuard";
import {
  financialOutcome,
  recordFinancialOutcome,
  financialFailureIsUncertain,
  financialWriteFeedback,
  financialErrorMessage,
} from "../financialReceipts";
type RejectionTarget = {
  id: string;
  kind:
    | "allocation"
    | "request_leader"
    | "request_department"
    | "liquidation_leader"
    | "liquidation_department";
  title: string;
};

export function BudgetApprovalQueue({
  data,
  onChanged,
  focusRecordId,
}: {
  data: DepartmentBudgetBundle;
  onChanged: () => Promise<void>;
  focusRecordId?: string;
}) {
  const { userProfile, can } = useAuth();
  const { toast } = useToast();
  const currentUserId = userProfile?.id || "";
  const orgId =
    userProfile?.org_id ||
    userProfile?.departmentId ||
    data.summary?.orgId ||
    "";
  const isDepartmentApprover = userProfile?.role === "head";
  const isHead = userProfile?.role === "head";
  const canSettle =
    userProfile?.role === "accounting_staff" &&
    can("accounting.settle_liquidation");
  const canRelease =
    userProfile?.role === "accounting_staff" && can("accounting.release_cash");
  const { threshold, setThreshold, defaultThreshold } =
    useApprovalThreshold(orgId);
  const [thresholdDialogOpen, setThresholdDialogOpen] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success"|"returned"|"warning"|"error">("success");
  const [rejection, setRejection] = useState<RejectionTarget | null>(null);
  const pendingAllocations = data.allocations.filter(
    (item) =>
      isDepartmentApprover &&
      item.status === "pending" &&
      item.requestedBy !== currentUserId,
  );
  const pendingRequests = data.requests.filter(
    (item) =>
      (isDepartmentApprover &&
        item.status === "pending_department_approval" &&
        item.requesterId !== currentUserId) ||
      (item.status === "pending_leader_review" &&
        item.taskLeaderId === currentUserId &&
        item.requesterId !== currentUserId),
  );
  const tier1DepartmentRequests = isDepartmentApprover
    ? pendingRequests.filter(
        (item) =>
          item.status === "pending_department_approval" &&
          item.requestedAmount <= threshold,
      )
    : [];
  const pendingLiquidations = data.liquidations.filter((item) => {
    const request = data.requests.find(
      (candidate) => candidate.id === item.requestId,
    );
    const lateAuthorization =
      isHead && isLiquidationLate(request, item) && !item.departmentDecidedAt;
    return (
      ((lateAuthorization || canSettle) &&
        item.status === "pending_department_settlement" &&
        request?.cashRecipientId !== currentUserId &&
        request?.requesterId !== currentUserId &&
        request?.taskLeaderId !== currentUserId) ||
      (item.status === "pending_leader_review" &&
        request?.taskLeaderId === currentUserId &&
        request?.cashRecipientId !== currentUserId)
    );
  });
  const dueReleases = data.releases.filter(
    (item) =>
      canRelease &&
      item.status === "scheduled" &&
      item.scheduledDate <= getPhilippineCalendarDate(),
  );
  const requestById = useMemo(
    () => new Map(data.requests.map((item) => [item.id, item])),
    [data.requests],
  );
  const commitmentById = useMemo(
    () => new Map(data.commitments.map((item) => [item.id, item])),
    [data.commitments],
  );
  const lineById = useMemo(
    () => new Map(data.allocationLines.map((item) => [item.id, item])),
    [data.allocationLines],
  );
  const allocationPagination = useBudgetPagination(pendingAllocations, data.summary?.id || "", DEFAULT_BUDGET_PAGE_SIZE);
  const requestPagination = useBudgetPagination(pendingRequests, data.summary?.id || "", DEFAULT_BUDGET_PAGE_SIZE);
  const liquidationPagination = useBudgetPagination(pendingLiquidations, data.summary?.id || "", DEFAULT_BUDGET_PAGE_SIZE);
  const releasePagination = useBudgetPagination(dueReleases, data.summary?.id || "", DEFAULT_BUDGET_PAGE_SIZE);
  useEffect(() => {
    if (!focusRecordId) return;
    const allocIdx = pendingAllocations.findIndex((item) => item.id === focusRecordId);
    if (allocIdx >= 0) allocationPagination.setPage(Math.floor(allocIdx / allocationPagination.pageSize) + 1);
    const reqIdx = pendingRequests.findIndex((item) => item.id === focusRecordId);
    if (reqIdx >= 0) requestPagination.setPage(Math.floor(reqIdx / requestPagination.pageSize) + 1);
    const liqIdx = pendingLiquidations.findIndex((item) => item.id === focusRecordId);
    if (liqIdx >= 0) liquidationPagination.setPage(Math.floor(liqIdx / liquidationPagination.pageSize) + 1);
    const relIdx = dueReleases.findIndex((item) => item.id === focusRecordId);
    if (relIdx >= 0) releasePagination.setPage(Math.floor(relIdx / releasePagination.pageSize) + 1);
  }, [focusRecordId]);
  useEffect(() => {
    if (!focusRecordId) return;
    const timer = window.setTimeout(
      () =>
        document
          .getElementById(`financial-record-${focusRecordId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      120,
    );
    return () => window.clearTimeout(timer);
  }, [focusRecordId]);

  const confirmation = useConfirmation();
  const pending = useRef(false);
  const draft = useExplicitDraft(
    "Financial review",
    false,
    Boolean(busy || batchBusy),
    () => {},
  );
  const act = async (id: string, operation: () => Promise<void>) => {
    const item = data.liquidations.find((row) => row.id === id);
    const request = data.requests.find(
      (row) => row.id === (item?.requestId || id),
    );
    const key = `approval:${currentUserId}:${id}:${item?.status || request?.status || "pending"}:${item?.departmentDecidedAt || ""}`;
    if (pending.current) return false;
    if (financialOutcome(key)) {
      setMessageTone("warning");
      setMessage(
        "This decision has a pending, saved or uncertain result. Refresh financial history before continuing.",
      );
      return false;
    }
    pending.current = true;
    draft.pendingRef.current = true;
    setBusy(id);
    setMessage("");
    let submitted = false;
    try {
      if (
        !rejection &&
        !(await confirmation.confirm({
          title:
            item?.status === "pending_leader_review" ? "Endorse these receipts?" : item && isHead
              ? "Authorize late liquidation package?"
              : item ? "Record this settlement?" : dueReleases.some(row => row.id === id) ? "Record this cash release?" : request?.status === "pending_leader_review" ? "Endorse this cash request?" : "Approve this request?",
          description: `Are you sure? ${request?.cashRecipientName || request?.requesterName || "Authorized work"} · ${request?.taskTitle || id}. ${item ? `${item.liquidationNumber || item.id} · version ${item.version} · expense ${peso.format(item.declaredSpent)} · returned ${peso.format(item.returnedAmount)} · ${formatEvidenceCount(item.receipts.length)}. ${item.status === "pending_leader_review" ? "This endorses the receipts. Independent Accounting settlement remains separate." : isHead ? "Head authorization permits a separate independent Accounting settlement. This does not settle the advance." : "Independent Accounting settlement records a balanced posting."}` : "Existing funding, independent-person and release limits remain in force."}`,
          actionLabel:
            item?.status === "pending_leader_review" ? "Yes, endorse" : item && isHead ? "Yes, authorize" : item ? "Yes, record settlement" : dueReleases.some(row => row.id === id) ? "Yes, record release" : request?.status === "pending_leader_review" ? "Yes, endorse" : "Yes, approve",
          tone: "approve",
        }))
      )
        return false;
      submitted = true;
      await operation();
      recordFinancialOutcome(key, "saved");
      setRejection(null);
      const code = item?.liquidationNumber || (request ? formatFundingRequestCode(request.requestNumber) : id);
      const summary = `${rejection ? "Returned to requester" : "Decision saved"} · ${code}.`;
      try {
        await onChanged();
        setMessage("");
        toast(summary, rejection ? "warning" : "success");
      } catch {
        setMessageTone("warning");
        setMessage(`${summary} Your decision was saved. Check the latest status before making another decision.`);
      }
      return true;
    } catch (error) {
      const uncertain = submitted && financialFailureIsUncertain(error);
      setMessageTone(uncertain ? "warning" : "error");
      if (!financialOutcome(key) && uncertain)
        recordFinancialOutcome(key, "uncertain");
      setMessage(financialWriteFeedback(error, {
        outcome: financialOutcome(key), submitted, action: 'Your decision', record: 'financial history',
      }));
      return false;
    } finally {
      pending.current = false;
      draft.pendingRef.current = false;
      setBusy("");
    }
  };

  const confirmRejection = async (reason: string) => {
    if (!rejection) return;
    const operation =
      rejection.kind === "allocation"
        ? () => decideWorkBudgetAllocation(rejection.id, false, reason)
        : rejection.kind === "request_leader"
          ? () => decidePettyCashLeaderReview(rejection.id, false, reason)
          : rejection.kind === "request_department"
            ? () => decidePettyCashRequest(rejection.id, false, reason)
            : rejection.kind === "liquidation_leader"
              ? () =>
                  decidePettyCashLiquidationLeaderReview(
                    rejection.id,
                    false,
                    reason,
                  )
              : () =>
                  isHead
                    ? authorizeLateLiquidation(rejection.id, false, reason)
                    : decidePettyCashLiquidation(rejection.id, false, reason);
    if (await act(rejection.id, operation)) setRejection(null);
  };

  const handleBatchAuthorizeTier1 = async () => {
    if (pending.current || batchBusy || !tier1DepartmentRequests.length) return;
    pending.current = true;
    draft.pendingRef.current = true;
    setBatchBusy(true);
    setMessage("");
    try {
      if (
        !(await confirmation.confirm({
          title: "Authorize selected funding requests?",
          description: `${tier1DepartmentRequests.length} requests totaling ${peso.format(tier1DepartmentRequests.reduce((sum, item) => sum + item.requestedAmount, 0))}. Each request remains subject to server fiscal limits and independent-person rules.`,
          actionLabel: "Yes, approve",
          tone: "approve",
          impact: (
            <ul>
              {tier1DepartmentRequests.map((item) => (
                <li key={item.id}>
                  {item.requestNumber}: {item.purpose} ·{" "}
                  {peso.format(item.requestedAmount)}
                </li>
              ))}
            </ul>
          ),
        }))
      )
        return;
      for (const item of tier1DepartmentRequests) {
        const key = `approval:${currentUserId}:${item.id}:pending_department_approval:`;
        if (financialOutcome(key) === 'uncertain') {
          throw new Error('We couldn’t confirm an earlier approval for a selected request.');
        }
        if (financialOutcome(key) === 'saved') continue;
        try {
          await decidePettyCashRequest(
            item.id,
            true,
            "Approved under quick-approval limit",
          );
          recordFinancialOutcome(key, "saved");
        } catch (caught) {
          if (financialFailureIsUncertain(caught))
            recordFinancialOutcome(key, "uncertain");
          throw caught;
        }
      }
      const summary = "The selected funding requests were approved.";
      try {
        await onChanged();
        setMessage("");
        toast(summary, "success");
      } catch {
        setMessageTone("warning");
        setMessage("Approvals saved. Check the latest status before continuing.");
      }
    } catch (error) {
      setMessageTone(financialFailureIsUncertain(error) ? "warning" : "error");
      const detail = financialErrorMessage(error, "We couldn’t finish the approvals.", 'read');
      setMessage(`${detail} Check the status of each selected request before approving any again. Earlier approvals may already be saved.`);
    } finally {
      pending.current = false;
      draft.pendingRef.current = false;
      setBatchBusy(false);
    }
  };

  const resultDialog = message && !rejection && (messageTone === "error" || messageTone === "warning") && <DecisionResultModal title={messageTone === 'warning' ? 'Check the latest status' : 'Could not save this decision'} message={message} tone={messageTone} onClose={() => setMessage('')} onCheck={() => { void onChanged().then(() => setMessage('')).catch(() => { setMessageTone('error'); setMessage('Could not load the latest status. Please try again.'); }); }} />;
  const governanceBanner = isDepartmentApprover ? (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border border-border bg-muted/60 text-foreground">
          <BxSliderAlt size={16} />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-semibold text-foreground">
              Quick-approval limit
            </span>
            <span className="rounded-[5px] border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-emerald-800">
              Limit: {peso.format(threshold)}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Requests of {peso.format(threshold)} or less can be approved together. Larger requests are reviewed one by one.
          </p>
        </div>
      </div>
      <Button
        kind="secondary"
        size="small"
        onClick={() => setThresholdDialogOpen(true)}
      >
        <BxSliderAlt size={13} className="mr-1" />
        Change limit
      </Button>
    </div>
  ) : null;

  if (
    !pendingAllocations.length &&
    !pendingRequests.length &&
    !pendingLiquidations.length &&
    !dueReleases.length
  ) {
    return (
      <div className="space-y-4">
        {confirmation.dialog}
        {resultDialog}
        {governanceBanner}
        <BudgetEmpty
          illustration="complete"
          title="Approval inbox is clear"
          description="New task-linked cash requests, release actions, and receipt settlements will appear here."
        />
        {thresholdDialogOpen && (
          <ApprovalThresholdDialog
            currentThreshold={threshold}
            defaultThreshold={defaultThreshold}
            onClose={() => setThresholdDialogOpen(false)}
            onSave={setThreshold}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {confirmation.dialog}
      {resultDialog}
      {governanceBanner}

      {pendingAllocations.length > 0 && (
        <QueueSection
          icon={<WalletCards size={14} />}
          title="Legacy subtask allocation proposals"
          count={pendingAllocations.length}
          footer={
            <BudgetPagination
              page={allocationPagination.page}
              pageSize={allocationPagination.pageSize}
              totalItems={allocationPagination.totalItems}
              visibleCount={allocationPagination.pageItems.length}
              noun="allocation"
              onPageChange={allocationPagination.setPage}
              onPageSizeChange={allocationPagination.setPageSize}
            />
          }
        >
          {allocationPagination.pageItems.map((item) => (
            <QueueRow
              key={item.id}
              recordId={item.id}
              focused={focusRecordId === item.id}
              title={item.reason}
              meta={`Requested allocation · ${peso.format(item.amount)}`}
              status={item.status}
              actions={
                <DecisionButtons
                  busy={busy === item.id}
                  onApprove={() =>
                    void act(item.id, () =>
                      decideWorkBudgetAllocation(
                        item.id,
                        true,
                        "Approved for the assigned work",
                      ),
                    )
                  }
                  onReject={() => {
                    setMessage('');
                    setRejection({
                      id: item.id,
                      kind: "allocation",
                      title: "Decline subtask budget",
                    });
                  }}
                />
              }
            />
          ))}
        </QueueSection>
      )}

      {pendingRequests.length > 0 && (
        <QueueSection
          icon={<WalletCards size={14} />}
          title="Task-linked cash requests"
          count={pendingRequests.length}
          footer={
            <BudgetPagination
              page={requestPagination.page}
              pageSize={requestPagination.pageSize}
              totalItems={requestPagination.totalItems}
              visibleCount={requestPagination.pageItems.length}
              noun="request"
              onPageChange={requestPagination.setPage}
              onPageSizeChange={requestPagination.setPageSize}
            />
          }
          action={
            isDepartmentApprover && tier1DepartmentRequests.length > 1 ? (
              <Button
                kind="primary"
                color="positive"
                size="small"
                disabled={batchBusy || Boolean(busy)}
                loading={batchBusy}
                onClick={() => void handleBatchAuthorizeTier1()}
              >
                <BxsBolt size={12} className="mr-1" />
                Approve ≤ {peso.format(threshold)} ({tier1DepartmentRequests.length})
              </Button>
            ) : undefined
          }
        >
          {requestPagination.pageItems.map((item) => {
            const line = item.allocationLineId
              ? lineById.get(item.allocationLineId)
              : undefined;
            const attachments = data.requestAttachments.filter(
              (attachment) => attachment.requestId === item.id,
            );
            const hierarchy = [
              commitmentById.get(item.commitmentId)?.title,
              item.taskTitle,
              item.subtaskTitle,
            ]
              .filter(Boolean)
              .join(" → ");
            const isTier1 = item.requestedAmount <= threshold;
            const isLeaderReview = item.status === "pending_leader_review";
            const tierBadge = isTier1 ? (
              <span className="inline-flex items-center gap-1 rounded-[5px] border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                <BxsBolt size={11} className="text-emerald-700" />
                Under limit
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-[5px] border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                <BxsCheckShield size={11} className="text-amber-700" />
                Over limit
              </span>
            );
            const approveLabel = isLeaderReview ? "Endorse" : "Approve";

            return (
              <QueueRow
                key={item.id}
                recordId={item.id}
                focused={focusRecordId === item.id}
                title={`FR-${String(item.requestNumber).padStart(5, "0")} · ${hierarchy || "Funded work"}`}
                meta={`${item.requesterName || "Member"} · ${item.purpose} · ${peso.format(item.requestedAmount)} · ${isLeaderReview ? "Leader endorsement" : "Department approval"}${line ? ` · ${line.category} / ${line.particular} / ${line.fundSource}` : ""}`}
                status={item.status}
                tierBadge={tierBadge}
                details={
                  attachments.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {attachments.map((attachment) => (
                        <button
                          key={attachment.id}
                          type="button"
                          onClick={async () =>
                            window.open(
                              await createReceiptSignedUrl(attachment.filePath),
                              "_blank",
                              "noopener,noreferrer",
                            )
                          }
                          className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-[8.8px] text-neutral-600"
                        >
                          {attachment.fileName}
                        </button>
                      ))}
                    </div>
                  ) : undefined
                }
                actions={
                  <DecisionButtons
                    busy={busy === item.id || batchBusy}
                    approveLabel={approveLabel}
                    onApprove={() =>
                      void act(item.id, () =>
                        isLeaderReview
                          ? decidePettyCashLeaderReview(
                              item.id,
                              true,
                              isTier1
                                ? "Endorsed under quick-approval limit"
                                : "Endorsed for department approval",
                            )
                          : decidePettyCashRequest(
                              item.id,
                              true,
                              isTier1
                                ? "Approved under quick-approval limit"
                                : "Approved",
                            ),
                      )
                    }
                    onReject={() => {
                      setMessage('');
                    setRejection({
                        id: item.id,
                        kind: isLeaderReview
                          ? "request_leader"
                          : "request_department",
                        title: isLeaderReview
                          ? "Return cash request"
                          : "Decline cash request",
                      });
                    }}
                  />
                }
              />
            );
          })}
        </QueueSection>
      )}

      {pendingLiquidations.length > 0 && (
        <QueueSection
          icon={<FileCheck2 size={14} />}
          title="Receipt liquidations"
          count={pendingLiquidations.length}
          footer={
            <BudgetPagination
              page={liquidationPagination.page}
              pageSize={liquidationPagination.pageSize}
              totalItems={liquidationPagination.totalItems}
              visibleCount={liquidationPagination.pageItems.length}
              noun="liquidation"
              onPageChange={liquidationPagination.setPage}
              onPageSizeChange={liquidationPagination.setPageSize}
            />
          }
        >
          {liquidationPagination.pageItems.map((item) => {
            const request = requestById.get(item.requestId);
            const late = isLiquidationLate(request, item);
            const needsHead =
              late &&
              !item.departmentDecidedAt &&
              item.status === "pending_department_settlement";
            return (
              <div
                id={`financial-record-${item.id}`}
                key={item.id}
                className={`border-b border-neutral-100 p-4 last:border-0 ${focusRecordId === item.id ? "bg-blue-50 ring-1 ring-inset ring-blue-200" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[11.5px] font-medium text-neutral-900">
                      {request &&
                        `FR-${String(request.requestNumber).padStart(5, "0")} · `}
                      {[
                        request
                          ? commitmentById.get(request.commitmentId)?.title
                          : undefined,
                        request?.taskTitle,
                        request?.subtaskTitle,
                      ]
                        .filter(Boolean)
                        .join(" → ") || "Cash liquidation"}
                    </div>
                    <div className="mt-1 text-[10px] text-neutral-500">
                      {request?.requesterName} · spent{" "}
                      {peso.format(item.declaredSpent)} · return{" "}
                      {peso.format(item.returnedAmount)}
                    </div>
                    {late && (
                      <div className="mt-1 inline-flex rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700">
                        Submitted after the liquidation deadline · Head approval
                        required
                      </div>
                    )}
                    <div className="mt-1 text-[10px] text-neutral-600">
                      {item.note}
                    </div>
                  </div>
                  <DecisionButtons
                    busy={busy === item.id}
                    approveDisabled={needsHead && !isHead}
                    approveLabel={
                      item.status === "pending_leader_review"
                        ? "Submit to Accounting"
                        : needsHead
                          ? "Approve late liquidation"
                          : "Settle liquidation"
                    }
                    onApprove={() =>
                      void act(item.id, async () => {
                        if (item.status === "pending_leader_review") {
                          await decidePettyCashLiquidationLeaderReview(
                            item.id,
                            true,
                            "Receipts endorsed for office settlement",
                          );
                          return;
                        }
                        if (needsHead && isHead) {
                          await authorizeLateLiquidation(
                            item.id,
                            true,
                            "Late package authorized for independent accounting settlement",
                          );
                          return;
                        }
                        if (
                          item.returnedAmount > 0 &&
                          !(await fetchCashReturnClearance(item.id)).approved
                        ) {
                          throw new Error(
                            "Accounting must acknowledge the cash received and the Office Head must approve the return before settlement.",
                          );
                        }
                        await decidePettyCashLiquidation(
                          item.id,
                          true,
                          "Receipts verified and settled",
                        );
                      })
                    }
                    onReject={() => {
                      setMessage('');
                    setRejection({
                        id: item.id,
                        kind:
                          item.status === "pending_leader_review"
                            ? "liquidation_leader"
                            : "liquidation_department",
                        title: "Request receipt corrections",
                      });
                    }}
                  />
                </div>
                <CashReturnPanel
                  liquidationId={item.id}
                  rootId={request?.taskId}
                  version={item.version}
                  amount={item.returnedAmount}
                  onSaved={onChanged}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.receipts.map((receipt) => (
                    <button
                      key={receipt.id}
                      onClick={async () =>
                        window.open(
                          await createReceiptSignedUrl(receipt.filePath),
                          "_blank",
                          "noopener,noreferrer",
                        )
                      }
                      className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-left text-[9.5px] text-neutral-600 hover:border-neutral-300"
                    >
                      <strong>{receipt.vendor}</strong> ·{" "}
                      {peso.format(receipt.amount)}
                      <br />
                      {receipt.fileName}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </QueueSection>
      )}

      {dueReleases.length > 0 && (
        <QueueSection
          icon={<Banknote size={14} />}
          title="Cash releases due"
          count={dueReleases.length}
          footer={
            <BudgetPagination
              page={releasePagination.page}
              pageSize={releasePagination.pageSize}
              totalItems={releasePagination.totalItems}
              visibleCount={releasePagination.pageItems.length}
              noun="release"
              onPageChange={releasePagination.setPage}
              onPageSizeChange={releasePagination.setPageSize}
            />
          }
        >
          {releasePagination.pageItems.map((release) => {
            const request = requestById.get(release.requestId);
            return (
              <QueueRow
                key={release.id}
                recordId={release.id}
                focused={focusRecordId === release.id}
                title={`FR-${String(request?.requestNumber || 0).padStart(5, "0")} · ${[request ? commitmentById.get(request.commitmentId)?.title : undefined, request?.taskTitle, request?.subtaskTitle].filter(Boolean).join(" → ") || "Funded work"}`}
                meta={`${release.scheduledDate} · recipient ${request?.cashRecipientName || request?.requesterName || "Member"} · ${peso.format(release.amount)}`}
                status={release.status}
                actions={
                  <button
                    disabled={busy === release.id}
                    onClick={() =>
                      void act(release.id, () =>
                        markPettyCashReleased(release.id),
                      )
                    }
                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-700 px-3 text-[9.5px] text-white disabled:opacity-40"
                  >
                    <Check size={11} /> Record release
                  </button>
                }
              />
            );
          })}
        </QueueSection>
      )}

      {rejection && (
        <RejectionDialog
          title={rejection.title}
          error={message}
          busy={busy === rejection.id}
          onClose={() => {setRejection(null);setMessage('');}}
          onConfirm={confirmRejection}
        />
      )}

      {thresholdDialogOpen && (
        <ApprovalThresholdDialog
          currentThreshold={threshold}
          defaultThreshold={defaultThreshold}
          onClose={() => setThresholdDialogOpen(false)}
          onSave={setThreshold}
        />
      )}
    </div>
  );
}

function QueueSection({
  icon,
  title,
  count,
  children,
  action,
  footer,
}: {
  icon: ReactNode;
  title: string;
  count: number;
  children: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[10px] border border-border bg-card">
      <header className="eflow-budget-section-heading border-b bg-muted">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-primary">{icon}</span>
          <h3>{title}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {action}
          <span className="rounded-[5px] border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-amber-800">
            {count}
          </span>
        </div>
      </header>
      <div className="divide-y divide-border/70">
        <AnimatePresence initial={false} mode="popLayout">
          {children}
        </AnimatePresence>
      </div>
      {footer}
    </section>
  );
}

function QueueRow({
  recordId,
  title,
  meta,
  status,
  actions,
  details,
  focused = false,
  tierBadge,
}: {
  recordId: string;
  title: string;
  meta: string;
  status: string;
  actions: ReactNode;
  details?: ReactNode;
  focused?: boolean;
  tierBadge?: ReactNode;
}) {
  return (
    <m.div
      id={`financial-record-${recordId}`}
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={motionTransition.productive}
      className={`eflow-budget-queue-row ${focused ? "bg-accent ring-1 ring-inset ring-primary/25" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="break-words text-sm font-semibold text-foreground">
            {title}
          </div>
          <StatusPill status={status} />
          {tierBadge}
        </div>
        <div className="mt-1 break-words text-xs text-muted-foreground">{meta}</div>
        {details}
      </div>
      {actions}
    </m.div>
  );
}

function DecisionButtons({
  busy,
  onApprove,
  onReject,
  approveLabel = "Approve",
  approveDisabled = false,
}: {
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  approveLabel?: string;
  approveDisabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        kind="tertiary"
        className="!text-[var(--eflow-warning-text)] !bg-[var(--eflow-warning-bg)]"
        size="small"
        disabled={busy}
        onClick={onReject}
      >
        <RotateCcw size={11} className="mr-1" />
        Decline
      </Button>
      <Button
        kind="primary"
        size="small"
        disabled={busy || approveDisabled}
        loading={busy}
        onClick={onApprove}
      >
        <Check size={11} className="mr-1" />
        {approveLabel}
      </Button>
    </div>
  );
}

function RejectionDialog({title,busy,error,onClose,onConfirm}:{title:string;busy:boolean;error?:string;onClose:()=>void;onConfirm:(reason:string)=>Promise<void>}) {
  const [reason,setReason]=useState('');
  useExplicitDraft('Financial decision reason',Boolean(reason.trim()),busy,()=>setReason(''));
  const changes=/correction|changes/i.test(title);
  return <DecisionModal title={title} description="Are you sure? Add a reason so the requester knows what to change." decision={changes?'changes':'reject'} reason={reason} onReasonChange={setReason} reasonLabel="Reason or required correction" requireReason busy={busy} error={error} onCancel={()=>{if(!busy)void requestNavigation(onClose);}} onConfirm={()=>void onConfirm(reason.trim())}/>;
}
