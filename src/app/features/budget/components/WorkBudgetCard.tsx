import {ReturnedBudgetNote,TaskProjectFunding} from '../../project-setup';
import {OfficePettyCashInlineRequests,OfficePettyCashLauncher} from '../../office-petty-cash';
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Banknote,
  Loader2,
  ReceiptText,
  RotateCcw,
  Trash2,
  WalletCards,
} from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import type { Task } from "../../tasks";
import { getTaskLeadId } from "../../tasks";
import type { Subtask } from "../../subtasks";
import { getCurrentFiscalYear } from "../constants";
import { useDepartmentBudget } from "../hooks/useDepartmentBudget";
import { useTaskFundingContext } from "../hooks/useTaskFundingContext";
import type { PettyCashRequest, WorkCashAssignment } from "../types";
import { peso } from "./budgetUi";
import {
  SubtaskBudgetButton,
  SubtaskBudgetDistributionInline,
  SubtaskBudgetManager,
  type SubtaskBudgetDraftTrigger,
} from "./SubtaskBudgetManager";
import { AssignMoneyModal } from "./AssignMoneyModal";
import { AssignmentReceiptDialog } from "./AssignmentReceiptDialog";
import { CashRequestForm } from "./CashRequestForm";
import { cashRequestActionKey, type CashRequestAttempt } from '../services/cashRequestRecovery';
import { usePendingAction } from '../../../shared/usePendingAction';
import { CashRequestTimeline } from "./CashRequestTimeline";
import { DirectWorkFunding } from "./DirectWorkFunding";
import { isOpenDirectFundingWork } from "../selectors/directFundingEligibility";
import { resolveCashPools } from "../selectors/workCashPools";
import {
  createAssignmentReceiptSignedUrl,
  deleteAssignmentReceipt,
  recallWorkCash,
  submitSubtaskCashClearance,
} from "../services/workCashAssignmentService";
import { readableUiError } from "../../../shared/userFacingError";
import { sumCentavos } from "../../../shared/currency";

interface WorkBudgetCardProps {
  task: Task;
  subtask?: Subtask;
  canManage?: boolean;
  /** Appointed Head fiscal oversight, independent of contributor eligibility. */
  canAuthorizeFunding?: boolean;
  readOnly?: boolean;
  authorityPending?: boolean;
}

const TEMPORARY_HOLD_STATES = new Set([
  "pending",
  "pending_leader_review",
  "pending_department_approval",
]);
const APPROVED_CASH_STATES = new Set([
  "approved",
  "scheduled_for_release",
  "partially_released",
  "released",
  "liquidation_draft",
  "liquidation_submitted",
  "pending_leader_liquidation_review",
  "pending_department_settlement",
  "changes_requested",
  "overdue_liquidation",
]);

export function WorkBudgetCard({
  task,
  subtask,
  canManage = false,
  canAuthorizeFunding = false,
  readOnly = false,
  authorityPending = false,
}: WorkBudgetCardProps) {
  const { userProfile } = useAuth();
  const orgId =
    task.orgId || userProfile?.org_id || userProfile?.departmentId || "";
  const [fundingYear,setFundingYear]=useState(getCurrentFiscalYear());
  const [fundingOffice,setFundingOffice]=useState(orgId);
  const budget = useDepartmentBudget(fundingOffice, fundingYear);
  const version = useMemo(
    () =>
      [
        getTaskLeadId(task),
        ...budget.allocations.map(
          (item) => `${item.id}:${item.status}:${item.amount}`,
        ),
        ...budget.requests.map(
          (item) =>
            `${item.id}:${item.status}:${item.requestedAmount}:${item.updatedAt}`,
        ),
      ].join("|"),
    [task.assigneeId, task.recommendationLeadId, budget.allocations, budget.requests],
  );
  const funding = useTaskFundingContext(task.id, subtask?.id, version);
  useEffect(()=>{setFundingYear(funding.context?.fiscalYear||getCurrentFiscalYear());setFundingOffice(funding.context?.fundingOrgId||orgId);},[funding.context?.fiscalYear,funding.context?.fundingOrgId,orgId]);
  const [requestOpen, setRequestOpen] = useState(false);
  const [correction, setCorrection] = useState<PettyCashRequest>();
  const [budgetsOpen, setBudgetsOpen] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState<SubtaskBudgetDraftTrigger>();
  const [assignMoneyOpen, setAssignMoneyOpen] = useState(false);
  const [assignMoneyTarget, setAssignMoneyTarget] = useState<
    { kind: "task" } | { kind: "subtask"; subtaskId: string } | undefined
  >();
  const [receiptTarget, setReceiptTarget] = useState<WorkCashAssignment>();
  const [assignmentActionBusy, setAssignmentActionBusy] = useState("");
  const [assignmentActionError, setAssignmentActionError] = useState("");
  const [section, setSection] = useState<"all" | "requests" | "subtasks" | "sources">("all");
  const currentUserId = userProfile?.id || "";
  const savedRequest = usePendingAction<CashRequestAttempt>(cashRequestActionKey(currentUserId, fundingOffice, task.id, subtask?.id));
  const isTaskLeader = currentUserId === getTaskLeadId(task);
  const isAssignedContributor = Boolean(
    subtask?.assignedToIds.includes(currentUserId),
  );
  const context = funding.context;
  const cashPools = useMemo(
    () =>
      resolveCashPools(context, {
        taskId: task.id,
        requests: budget.requests,
        releases: budget.releases,
        currentUserId,
      }),
    [context, task.id, budget.requests, budget.releases, currentUserId],
  );
  const activeAssignments = useMemo(
    () =>
      cashPools.assignments.filter(
        (a) =>
          a.status === "active" &&
          (subtask ? a.subtaskId === subtask.id : true),
      ),
    [cashPools.assignments, subtask],
  );
  const subtaskAssignedTaskCash = sumCentavos(
    activeAssignments
      .filter((a) => a.sourceKind === "task_cash_release")
      .map((a) => a.amount),
  );
  const subtaskAssignedPettyCash = sumCentavos(
    activeAssignments
      .filter((a) => a.sourceKind === "office_petty_cash")
      .map((a) => a.amount),
  );
  const subtaskAssignedCashTotal = sumCentavos([
    subtaskAssignedTaskCash,
    subtaskAssignedPettyCash,
  ]);
  const subtaskAssignedReceiptsTotal = sumCentavos(
    activeAssignments.map((a) => a.recordedSpent),
  );
  const subtaskAssignedUnspentTotal = sumCentavos(
    activeAssignments.map((a) => a.unspentAmount),
  );
  const releasedByAllocationLine = useMemo(() => {
    const map = new Map<string, { name: string; released: number; unassigned: number }>();
    for (const rel of cashPools.taskCashReleases) {
      if (!rel.acknowledged) continue;
      for (const fl of rel.fundingLines) {
        if (!fl.allocationLineId) continue;
        const prev = map.get(fl.allocationLineId);
        const lineUnassigned = fl.unassignedAmount ?? fl.amount;
        map.set(fl.allocationLineId, {
          name: fl.sourceName || prev?.name || "Approved source",
          released: sumCentavos([prev?.released ?? 0, fl.amount]),
          unassigned: sumCentavos([prev?.unassigned ?? 0, lineUnassigned]),
        });
      }
    }
    return map;
  }, [cashPools.taskCashReleases]);
  const releasedCashLineSummary = useMemo(
    () => Array.from(releasedByAllocationLine.entries()),
    [releasedByAllocationLine],
  );
  const hasCashOnHandTask = !subtask && cashPools.totals.cashOnHandTask > 0;
  const hasAssignableCashPool =
    cashPools.taskCashReleases.some((p) => p.isCurrentHolder && p.acknowledged) ||
    cashPools.officePettyCashReleases.some((p) => p.isCurrentHolder);
  const fundingCurrent = !context?.taskLeaderId || context.taskLeaderId === getTaskLeadId(task);
  const canRequestForWork = subtask ? isAssignedContributor || isTaskLeader : isTaskLeader;
  const requiresSubtaskBudget = Boolean(
    subtask && context?.funded && context.distribution && !context.cap,
  );
  const fundingChecking = authorityPending || funding.loading || budget.loading || !fundingCurrent;
  const canRequest = Boolean(
    !readOnly && !fundingChecking && !funding.error && !budget.error && context?.funded &&
      !requiresSubtaskBudget &&
      budget.summary?.status === "locked" &&
      canRequestForWork,
  );
  const taskFinished = !!task.archivedAt || ["completed", "cancelled"].includes(task.status);
  const canManageBudgets = Boolean(
    (!readOnly || taskFinished || subtask?.status === "completed") &&
      !authorityPending && !(funding.loading && !context) && fundingCurrent && isTaskLeader &&
      context?.funded && context.canManageDistribution && context.subtaskBudgets,
  );
  const canAssignMoney = Boolean(
    !readOnly &&
      !taskFinished &&
      !(subtask?.status === "completed") &&
      !authorityPending &&
      !(funding.loading && !context) &&
      fundingCurrent &&
      isTaskLeader &&
      (cashPools.canAssignCash || context?.canManageDistribution) &&
      (hasAssignableCashPool || activeAssignments.length > 0),
  );
  const requests = budget.requests.filter(
    (request) =>
      request.taskId === task.id &&
      (subtask ? request.subtaskId === subtask.id : !request.subtaskId),
  );
  const poolRequests = context
    ? budget.requests.filter(
        (request) =>
          request.allocationId ===
          (context.cap?.id || context.taskAllocationId),
      )
    : [];
  const temporaryHeld = poolRequests
    .filter((request) => TEMPORARY_HOLD_STATES.has(request.status))
    .reduce(
      (sum, request) =>
        sum + (request.approvedAmount ?? request.requestedAmount),
      0,
    );
  const approvedCash = poolRequests
    .filter((request) => APPROVED_CASH_STATES.has(request.status))
    .reduce(
      (sum, request) =>
        sum + (request.approvedAmount ?? request.requestedAmount),
      0,
    );
  const settledSpending = poolRequests
    .filter((request) => request.status === "settled")
    .reduce((sum, request) => sum + (request.actualSpent || 0), 0);
  const correctionWaiting = requests.some((request) =>
    ["leader_changes_requested", "department_changes_requested"].includes(
      request.status,
    ),
  );
  const workClosed = Boolean(
    task.archivedAt ||
    ["completed", "cancelled"].includes(subtask ? subtask.status : task.status),
  );
  const completionSubmitted = Boolean(
    cashPools.completionSubmitted ||
      (subtask
        ? ["for_review", "completed"].includes(subtask.status)
        : ["for_review", "completed"].includes(task.status)),
  );
  const hasReleasedCash = !workClosed && completionSubmitted && requests.some(request => request.cashRecipientId === currentUserId &&
    ['released', 'changes_requested', 'overdue_liquidation'].includes(request.status));
  const hasUnacknowledgedCash = !workClosed && requests.some(request => request.cashRecipientId === currentUserId &&
    ['released', 'changes_requested', 'overdue_liquidation'].includes(request.status) &&
    budget.releases.some(release => release.requestId === request.id && release.status === 'released' && !release.acknowledgedAt));
  const showRequest = !requiresSubtaskBudget && (
    canRequest || Boolean(subtask && !readOnly && canRequestForWork && fundingChecking && context?.funded)
  );
  const fundingStep = subtask && !funding.error && !budget.error ? (
    fundingChecking ? 'Checking funding access…'
      : subtaskAssignedCashTotal > 0 ? null
      : hasUnacknowledgedCash ? 'Acknowledge receipt of the released cash first before recording expenses.'
      : hasReleasedCash ? 'Use Record expenses on your cash release. Enter the amount spent and attach the receipts.'
      : !context?.funded ? (
        canAssignMoney
          ? 'Use Assign money to fund this subtask with released office petty cash.'
          : 'Ask the Task Lead about funding for this subtask.'
      )
      : requiresSubtaskBudget ? (
        canAssignMoney
          ? 'Use Assign money to fund this subtask from released task cash or office petty cash.'
          : canManageBudgets
            ? 'Allocate a budget to this subtask before requesting cash.'
            : 'Ask the task lead to allocate a budget to this subtask before requesting cash.'
      )
      : !requests.length && canRequest && context.available > 0 ? 'Request the amount you need. The cash recipient can record expenses after the cash is released.'
      : !requests.length && (readOnly || !canRequestForWork) ? 'An assigned contributor or the Task Lead can request cash. The recipient records expenses after release.'
      : !requests.length && budget.summary?.status !== 'locked' ? 'Cash requests open once the Office Budget is locked.'
      : !requests.length && context.available <= 0 ? 'There is no requestable balance for this subtask.'
      : requests.some(request => (APPROVED_CASH_STATES.has(request.status) || TEMPORARY_HOLD_STATES.has(request.status) || correctionWaiting)) ? 'Check Cash requests below for status and any action due.'
      : null
  ) : null;

  const refreshTaskFunding = async () => {
    await Promise.all([funding.refresh(), budget.refresh()]);
  };
  const refresh = async () => {
    await refreshTaskFunding();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("eflow:office-petty"));
    }
  };
  const openAssignMoney = (target?: { kind: "task" } | { kind: "subtask"; subtaskId: string }) => {
    setAssignmentActionError("");
    setAssignMoneyTarget(target ?? (subtask ? { kind: "subtask", subtaskId: subtask.id } : { kind: "task" }));
    setAssignMoneyOpen(true);
  };
  const handleRecallAssignment = async (assignment: WorkCashAssignment) => {
    if (assignmentActionBusy) return;
    setAssignmentActionBusy(assignment.id);
    setAssignmentActionError("");
    try {
      await recallWorkCash({
        assignmentId: assignment.id,
        taskId: assignment.taskId,
        subtaskId: assignment.subtaskId,
        reason: "Returned unspent cash back to unassigned cash pool",
      });
      await refresh();
    } catch (caught) {
      setAssignmentActionError(
        readableUiError(caught, "Could not return unspent cash to the pool.", "write"),
      );
    } finally {
      setAssignmentActionBusy("");
    }
  };
  const handleSubmitAssignmentClearance = async (assignment: WorkCashAssignment) => {
    if (assignmentActionBusy) return;
    setAssignmentActionBusy(`submit:${assignment.id}`);
    setAssignmentActionError("");
    try {
      await submitSubtaskCashClearance({
        taskId: assignment.taskId,
        subtaskId: assignment.subtaskId ?? null,
      });
      await refresh();
    } catch (caught) {
      setAssignmentActionError(
        readableUiError(caught, "Could not submit receipts to Accounting.", "write"),
      );
    } finally {
      setAssignmentActionBusy("");
    }
  };
  const handleDeleteAssignmentReceipt = async (
    assignment: WorkCashAssignment,
    receiptId: string,
    filePath: string,
  ) => {
    if (assignmentActionBusy) return;
    setAssignmentActionBusy(receiptId);
    setAssignmentActionError("");
    try {
      await deleteAssignmentReceipt({
        receiptId,
        sourceKind: assignment.sourceKind,
        filePath,
        taskId: assignment.taskId,
        subtaskId: assignment.subtaskId,
      });
      await refresh();
    } catch (caught) {
      setAssignmentActionError(
        readableUiError(caught, "Could not remove this receipt.", "write"),
      );
    } finally {
      setAssignmentActionBusy("");
    }
  };
  const subtaskRows = context?.subtaskBudgets ?? [];
  const hasSubtaskSection = Boolean(
    context?.funded &&
      context.distribution &&
      (subtask
        ? subtaskRows.some((item) => item.id === subtask.id)
        : subtaskRows.length > 0 || (context.distribution.allocated ?? 0) > 0),
  );
  const fundingSources = context?.lines ?? [];
  const activeSection =
    section === "subtasks" && !hasSubtaskSection
      ? "all"
      : section === "sources" && !fundingSources.length
        ? "all"
        : section;
  const approvedTotal = context?.cap?.amount || context?.taskBudget || 0;
  const releasedTotal = context?.distribution?.released ?? approvedCash;
  const spentTotal = context?.distribution?.spent ?? settledSpending;
  const taskLoggedReceiptsTotal = cashPools.assignments
    .filter((a) => a.status === "active" && a.sourceKind === "task_cash_release")
    .reduce((sum, a) => sum + a.recordedSpent, 0);
  const pettyCashRequestBlocked = Boolean(
    readOnly ||
      taskFinished ||
      workClosed ||
      completionSubmitted ||
      ["for_review", "completed", "cancelled"].includes(task.status) ||
      (subtask && ["for_review", "completed", "cancelled"].includes(subtask.status)),
  );
  const canShowSeparatePettyCash = Boolean(
    orgId &&
      (!readOnly ||
        !task.archivedAt ||
        cashPools.totals.officePettyCashOnHand > 0 ||
        cashPools.totals.officePettyCashAssigned > 0),
  );
  const separatePettyCashSection = canShowSeparatePettyCash && (
    <section
      className="overflow-hidden rounded-[12px] border border-indigo-200/85 bg-[var(--eflow-surface)] shadow-[0_1px_2px_rgb(12_36_33/4%)]"
      aria-label="Separate office petty cash fund"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 bg-indigo-50/35 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-indigo-100/80 text-indigo-700">
            <Banknote size={15} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[13px] font-semibold text-foreground">
                Separate office petty cash
              </h3>
              <span className="rounded-[5px] border border-indigo-200/80 bg-white/80 px-2 py-0.5 text-[10.5px] font-medium text-indigo-800">
                ₱30,000 revolving fund
              </span>
            </div>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Draws from the office’s ₱30,000 revolving fund — does not charge this{" "}
              {subtask ? "subtask’s" : "task’s"} budget.
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <OfficePettyCashLauncher allowRequest={!pettyCashRequestBlocked} />
        </div>
      </div>
      {!subtask && typeof OfficePettyCashInlineRequests === "function" && (
        <OfficePettyCashInlineRequests
          officeId={orgId}
          onChanged={refreshTaskFunding}
          flush
        />
      )}
    </section>
  );

  const cashAssignmentsPanel = activeAssignments.length > 0 && (
    <section
      aria-label={subtask ? "Assigned cash for this subtask" : "Assigned cash on hand"}
      className="flex h-full flex-col overflow-hidden rounded-[12px] border border-emerald-200/85 bg-emerald-50/30 shadow-[0_1px_2px_rgb(12_36_33/4%)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/70 bg-emerald-50/60 px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
          <ArrowRightLeft size={13} className="text-emerald-700" aria-hidden="true" />
          <span>
            {subtask ? "Assigned cash on hand" : "Cash on hand distribution"} ({activeAssignments.length})
          </span>
        </div>
        {canAssignMoney && (
          <button
            type="button"
            onClick={() => openAssignMoney()}
            className="text-[11.5px] font-medium text-primary hover:underline"
          >
            + Assign / adjust
          </button>
        )}
      </div>

      <div className="flex-1 space-y-2 p-3.5">
      {assignmentActionError && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11.5px] text-destructive">
          {assignmentActionError}
        </p>
      )}

      <ul className="space-y-2">
        {activeAssignments.map((assignment) => {
          const reviewStatus = assignment.receiptReviewStatus ?? "open";
          const canSubmitDirect =
            completionSubmitted &&
            (Boolean(assignment.subtaskId) || assignment.sourceKind === "office_petty_cash") &&
            ["open", "changes_requested"].includes(reviewStatus) &&
            (assignment.canLogReceipt || isTaskLeader || isAssignedContributor);
          const canAddReceipt =
            completionSubmitted &&
            assignment.canLogReceipt &&
            assignment.unspentAmount > 0 &&
            ["open", "changes_requested"].includes(reviewStatus);
          const canAdjustOrRecall =
            ["open", "changes_requested"].includes(reviewStatus);
          const hasActions =
            canAddReceipt ||
            canSubmitDirect ||
            (canAssignMoney && canAdjustOrRecall) ||
            (assignment.canRecall && canAdjustOrRecall && assignment.unspentAmount > 0);
          return (
            <li
              key={assignment.id}
              className="space-y-2 rounded-lg border border-border bg-card px-3 py-2.5"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="min-w-0 truncate text-[12.5px] font-semibold text-foreground">
                    {assignment.subtaskId
                      ? assignment.subtaskTitle || "Subtask"
                      : `${task.title} (This task)`}
                  </span>
                  <div className="flex flex-wrap items-center gap-1">
                    {reviewStatus === "pending_accounting" && (
                      <span className="rounded-[5px] border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-900">
                        Pending Accounting
                      </span>
                    )}
                    {reviewStatus === "approved" && (
                      <span className="rounded-[5px] border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-emerald-900">
                        Approved by Accounting
                      </span>
                    )}
                    {reviewStatus === "changes_requested" && (
                      <span className="rounded-[5px] border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-rose-800">
                        Corrections needed
                      </span>
                    )}
                    <span
                      className={`shrink-0 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10.5px] font-medium ${
                        assignment.sourceKind === "office_petty_cash"
                          ? "bg-indigo-100 text-indigo-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {assignment.sourceLabel}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11.5px] tabular-nums text-muted-foreground">
                  <span className="whitespace-nowrap">
                    Assigned <strong className="text-foreground">{peso.format(assignment.amount)}</strong>
                  </span>
                  <span className="whitespace-nowrap">
                    Spent {peso.format(assignment.recordedSpent)}
                  </span>
                  <span className="whitespace-nowrap">
                    Left <strong className="text-foreground">{peso.format(assignment.unspentAmount)}</strong>
                  </span>
                  {(assignment.returnedToPoolAmount ?? 0) > 0 && (
                    <span className="whitespace-nowrap text-emerald-800">
                      Returned {peso.format(assignment.returnedToPoolAmount || 0)} to pool
                    </span>
                  )}
                </div>
                {assignment.note && (
                  <p className="text-[11px] text-muted-foreground">{assignment.note}</p>
                )}
                {reviewStatus === "changes_requested" && assignment.accountingDecisionReason && (
                  <p className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11.5px] text-rose-900">
                    <strong>Accounting feedback: </strong>
                    {assignment.accountingDecisionReason}
                  </p>
                )}
                {!completionSubmitted && !workClosed && (
                  <p className="text-[11px] text-muted-foreground">
                    Click <strong>Mark as complete</strong> when work is done to unlock receipt submission and unused cash return.
                  </p>
                )}
              </div>

              {hasActions && (
                <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2">
                  {canAddReceipt && (
                    <button
                      type="button"
                      disabled={Boolean(assignmentActionBusy)}
                      onClick={() => setReceiptTarget(assignment)}
                      className="inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md bg-primary px-2.5 text-[11.5px] font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
                    >
                      <ReceiptText size={11} aria-hidden="true" />
                      {assignment.receipts.length > 0 ? "Add another receipt" : "Submit receipt"}
                    </button>
                  )}
                  {canSubmitDirect && (
                    <button
                      type="button"
                      disabled={Boolean(assignmentActionBusy)}
                      onClick={() => void handleSubmitAssignmentClearance(assignment)}
                      className={`inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md px-2.5 text-[11.5px] font-medium transition disabled:opacity-50 ${
                        assignment.receipts.length > 0
                          ? "bg-[var(--eflow-primary)] text-[var(--eflow-on-primary)] hover:bg-[var(--eflow-primary-hover)]"
                          : "border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                      }`}
                    >
                      {assignmentActionBusy === `submit:${assignment.id}`
                        ? "Submitting…"
                        : assignment.receipts.length > 0
                          ? assignment.unspentAmount > 0
                            ? `Send to Accounting & return ${peso.format(assignment.unspentAmount)}`
                            : "Send receipts to Accounting"
                          : `Return unused ${peso.format(assignment.unspentAmount)} (₱0 spent)`}
                    </button>
                  )}
                  {canAssignMoney && canAdjustOrRecall && (
                    <button
                      type="button"
                      disabled={Boolean(assignmentActionBusy)}
                      onClick={() =>
                        openAssignMoney(
                          assignment.subtaskId
                            ? { kind: "subtask", subtaskId: assignment.subtaskId }
                            : { kind: "task" },
                        )
                      }
                      className="h-7 whitespace-nowrap rounded-md border border-border bg-background px-2.5 text-[11.5px] font-medium text-foreground hover:bg-muted disabled:opacity-50"
                    >
                      Adjust
                    </button>
                  )}
                  {assignment.canRecall && canAdjustOrRecall && assignment.unspentAmount > 0 && !canSubmitDirect && (
                    <button
                      type="button"
                      disabled={Boolean(assignmentActionBusy)}
                      onClick={() => void handleRecallAssignment(assignment)}
                      className="inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md border border-amber-300 bg-amber-50 px-2.5 text-[11.5px] font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                    >
                      <RotateCcw size={11} aria-hidden="true" />
                      {assignmentActionBusy === assignment.id ? "Returning…" : "Return unused"}
                    </button>
                  )}
                </div>
              )}

              {assignment.receipts.length > 0 && (
                <div className="flex flex-wrap gap-1.5 border-t border-border/70 pt-2">
                  {assignment.receipts.map((rcpt) => (
                    <span
                      key={rcpt.id}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11.5px] text-foreground"
                    >
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const url = await createAssignmentReceiptSignedUrl(
                              assignment.sourceKind,
                              rcpt.filePath,
                            );
                            window.open(url, "_blank", "noopener,noreferrer");
                          } catch (caught) {
                            setAssignmentActionError(
                              readableUiError(caught, "Could not open receipt file.", "read"),
                            );
                          }
                        }}
                        className="inline-flex items-center gap-1 hover:underline"
                      >
                        <ReceiptText size={10} aria-hidden="true" />
                        <span>
                          {rcpt.vendor} · {peso.format(rcpt.amount)}
                        </span>
                      </button>
                      {rcpt.canDelete && (
                        <button
                          type="button"
                          aria-label={`Remove receipt ${rcpt.vendor}`}
                          disabled={assignmentActionBusy === rcpt.id}
                          onClick={() =>
                            void handleDeleteAssignmentReceipt(
                              assignment,
                              rcpt.id,
                              rcpt.filePath,
                            )
                          }
                          className="ml-0.5 rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 size={10} aria-hidden="true" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      </div>
    </section>
  );

  const showRequestsInAll = requests.length > 0;
  const showDistributionInAll = activeAssignments.length > 0;
  const showSubtasksInAll = Boolean(
    hasSubtaskSection && (!subtask || Boolean(context?.cap) || subtaskAssignedCashTotal <= 0),
  );
  const showSourcesInAll = Boolean(fundingSources.length > 0 && !subtask);

  const requestsBentoCard = (
    <section aria-label="Cash requests" className="h-full min-w-0">
      <CashRequestTimeline
        bentoCard
        data={budget}
        requests={requests}
        currentUserId={currentUserId}
        orgId={fundingOffice}
        canCorrect={canRequest}
        workCompleted={workClosed}
        completionSubmitted={completionSubmitted}
        onCorrect={(request) => {
          if (!canRequest) return;
          setCorrection(request);
          setRequestOpen(false);
        }}
        onChanged={refresh}
      />
      {activeSection === "requests" && !requests.length && (
        <div className="rounded-[12px] border border-[var(--eflow-border)] bg-[var(--eflow-surface)] p-4 shadow-[0_1px_2px_rgb(12_36_33/4%)]">
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-[12.5px] text-muted-foreground">
            No cash requests for this {subtask ? "subtask" : "task"} yet.
          </p>
        </div>
      )}
    </section>
  );

  const subtaskAllocationsBentoCard = (
    <section aria-label="Subtask allocations" className="h-full min-w-0">
      <SubtaskBudgetDistributionInline
        context={context ?? { funded: false, taskId: task.id, taskBudget: 0, available: 0, lines: [] }}
        subtaskId={subtask?.id}
        canManage={canManageBudgets}
        taskFinished={taskFinished}
        showTotals={false}
        assignments={activeAssignments}
        onOpenRow={(trigger) => {
          setBudgetDraft(trigger);
          setBudgetsOpen(true);
        }}
      />
    </section>
  );

  const renderFundingSourcesCard = (wideGrid = false) =>
    fundingSources.length > 0 && !subtask ? (
      <section
        aria-label="Approved funding sources"
        className="flex h-full min-w-0 flex-col overflow-hidden rounded-[12px] border border-[var(--eflow-border)] bg-[var(--eflow-surface)] shadow-[0_1px_2px_rgb(12_36_33/4%)]"
      >
        {activeSection === "sources" ? (
          <>
            <div className="border-b border-border bg-muted/30 px-4 py-2.5">
              <h4 className="text-[12px] font-semibold text-foreground">
                Funding sources ({fundingSources.length})
              </h4>
            </div>
            <div className="flex-1 p-3.5">
              <FundingSourceList
                lines={fundingSources}
                releasedByLine={releasedByAllocationLine}
                grid={fundingSources.length > 1}
              />
            </div>
          </>
        ) : (
          <details className="flex h-full flex-col text-[12.5px]" open={fundingSources.length <= 4}>
            <summary className="cursor-pointer border-b border-border bg-muted/30 px-4 py-2.5 text-[12px] font-semibold text-foreground hover:text-[var(--eflow-primary)]">
              Funding sources ({fundingSources.length})
            </summary>
            <div className="flex-1 p-3.5">
              <FundingSourceList
                lines={fundingSources}
                releasedByLine={releasedByAllocationLine}
                grid={wideGrid && fundingSources.length > 1}
              />
            </div>
          </details>
        )}
      </section>
    ) : null;

  if (!subtask && !budget.summary && !budget.loading && !context?.funded && !hasAssignableCashPool && !activeAssignments.length) {
    return (
      <div aria-label="Task funding" className="space-y-3.5">
        <section className="space-y-3 rounded-[12px] border border-[var(--eflow-border)] bg-[var(--eflow-surface)] p-4 shadow-[0_1px_2px_rgb(12_36_33/4%)]">
          <div className="flex items-start gap-2.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-[6px] bg-[var(--eflow-selected)] text-[var(--eflow-primary)]">
              <Banknote size={15} />
            </div>
            <div className="min-w-0">
              <h3 className="text-[13px] font-semibold text-foreground">Task funding</h3>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                No approved budget for this task yet.
              </p>
            </div>
          </div>
          {task.linkedProjectId && (
            <TaskProjectFunding projectId={task.linkedProjectId} taskId={task.id} funded={false} onChanged={refresh} />
          )}
        </section>
        {separatePettyCashSection}
      </div>
    );
  }
  return (
    <div
      aria-label={subtask ? "Subtask funding" : "Task funding"}
      className="space-y-3.5"
    >
      <section className="space-y-3.5 rounded-[12px] border border-[var(--eflow-border)] bg-[var(--eflow-surface)] p-4 shadow-[0_1px_2px_rgb(12_36_33/4%)]">
      <ReturnedBudgetNote taskId={task.id} subtaskId={subtask?.id} finished={taskFinished || subtask?.status === "completed"} />
      {!subtask && authorityPending && (
        <p role="status" className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Loader2 size={14} className="animate-spin" />
          Checking access…
        </p>
      )}
      {task.linkedProjectId && !subtask && (
        <TaskProjectFunding projectId={task.linkedProjectId} taskId={task.id} funded={!!context?.funded} onChanged={refresh} />
      )}
      {!task.linkedProjectId &&
        !authorityPending &&
        (canAuthorizeFunding || (!readOnly && canManage)) &&
        isOpenDirectFundingWork(task) &&
        !subtask &&
        !context?.funded &&
        !funding.loading &&
        userProfile?.role === "head" &&
        userProfile.is_active !== false &&
        userProfile.org_id === orgId &&
        orgId === fundingOffice && (
          <DirectWorkFunding key={task.id} data={budget} tasks={[task]} onChanged={refresh} />
        )}

      <header className={subtask ? "space-y-2.5" : "flex flex-wrap items-start justify-between gap-3"}>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-[6px] bg-[var(--eflow-selected)] text-[var(--eflow-primary)]">
              <Banknote size={14} />
            </div>
            <h3 className="text-[13px] font-semibold text-foreground">
              {subtask ? "Subtask funding" : "Task funding"}
            </h3>
            {context?.fiscalYear && (
              <span className="rounded-[5px] border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                FY {context.fiscalYear}
              </span>
            )}
          </div>
          {funding.loading && !context ? (
            <div className="flex items-center gap-1.5 pl-8 text-[12px] text-muted-foreground">
              <Loader2 size={12} className="animate-spin" />
              <span>Calculating availability…</span>
            </div>
          ) : subtask ? (
            <div className="space-y-1 pl-8">
              {subtaskAssignedCashTotal > 0 ? (
                <>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <strong className="text-[18px] font-semibold tabular-nums text-emerald-900">
                      {peso.format(subtaskAssignedCashTotal)}
                    </strong>
                    <span className="text-[12.5px] font-medium text-emerald-800">
                      cash on hand
                    </span>
                    {subtaskAssignedPettyCash > 0 && (
                      <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-indigo-800">
                        {peso.format(subtaskAssignedPettyCash)} petty cash
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 text-[11.5px] tabular-nums text-muted-foreground">
                    <span>Spent {peso.format(subtaskAssignedReceiptsTotal)}</span>
                    <span>·</span>
                    <span>Left {peso.format(subtaskAssignedUnspentTotal)}</span>
                    {context?.cap && (
                      <>
                        <span>·</span>
                        <span>Cap {peso.format(context.cap.amount)}</span>
                      </>
                    )}
                  </div>
                </>
              ) : context?.funded ? (
                <div className="flex flex-wrap items-baseline gap-1.5">
                  <strong className="text-[18px] font-semibold tabular-nums text-foreground">
                    {peso.format(context.cap ? context.available : 0)}
                  </strong>
                  <span className="text-[12.5px] text-muted-foreground">
                    {context.cap
                      ? "available to request"
                      : "assigned to this subtask yet"}
                  </span>
                </div>
              ) : (
                <div className="text-[12px] text-muted-foreground">
                  {funding.error ? "Funding unavailable right now" : "No funding assigned yet"}
                </div>
              )}
            </div>
          ) : hasCashOnHandTask ? (
            <div className="space-y-1 pl-8">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <strong className="text-[18px] font-semibold tabular-nums text-emerald-900">
                  {peso.format(cashPools.totals.cashOnHandTask)}
                </strong>
                <span className="text-[12.5px] font-medium text-emerald-800">
                  cash on hand
                </span>
                {cashPools.totals.officePettyCashOnHand > 0 ? (
                  <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-indigo-800">
                    + {peso.format(cashPools.totals.officePettyCashOnHand)} office petty cash on hand
                  </span>
                ) : cashPools.totals.officePettyCashAssigned > 0 ? (
                  <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-indigo-800">
                    + {peso.format(cashPools.totals.officePettyCashAssigned)} petty cash
                  </span>
                ) : null}
              </div>
              {releasedCashLineSummary.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium tabular-nums">
                  {releasedCashLineSummary.map(([lineId, info]) => (
                    <span
                      key={lineId}
                      className="rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-900"
                    >
                      {info.name} {peso.format(info.released)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : context?.funded ? (
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 pl-8">
              <strong className="text-[18px] font-semibold tabular-nums text-foreground">
                {peso.format(context.available)}
              </strong>
              <span className="text-[12.5px] text-muted-foreground">
                available from the task budget
              </span>
              {cashPools.totals.officePettyCashAssigned > 0 && (
                <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-indigo-800">
                  + {peso.format(cashPools.totals.officePettyCashAssigned)} petty cash
                </span>
              )}
            </div>
          ) : (
            <div className="pl-8 text-[12px] text-muted-foreground">
              {funding.error
                ? "Funding unavailable right now"
                : cashPools.totals.officePettyCashAssigned > 0
                  ? `${peso.format(cashPools.totals.officePettyCashAssigned)} office petty cash assigned`
                  : "No approved project budget for this task"}
            </div>
          )}
        </div>
        <div className={`flex shrink-0 flex-wrap items-center gap-1.5 ${subtask ? "pl-8" : ""}`}>
          {canAssignMoney && (
            <button
              type="button"
              onClick={() => openAssignMoney()}
              className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[12.5px] font-medium transition ${
                hasCashOnHandTask || subtask
                  ? "bg-[var(--eflow-primary)] text-[var(--eflow-on-primary)] hover:bg-[var(--eflow-primary-hover)]"
                  : "border border-border bg-background text-foreground hover:bg-muted"
              }`}
            >
              <ArrowRightLeft size={13} aria-hidden="true" /> Assign money
            </button>
          )}
          {canManageBudgets &&
            (subtask
              ? Boolean(context?.cap) || subtaskAssignedCashTotal <= 0
              : hasSubtaskSection) && (
              <SubtaskBudgetButton
                hasAllocation={!!context?.cap}
                subtask={!!subtask}
                secondary
                onClick={() => {
                  setBudgetDraft(undefined);
                  setBudgetsOpen(true);
                }}
              />
            )}
          {currentUserId && savedRequest.value && !requestOpen && !correction && context && (
            <button type="button" className="text-sm underline" onClick={() => setRequestOpen(true)}>
              Check saved cash request
            </button>
          )}
          {!savedRequest.value &&
            showRequest &&
            !requestOpen &&
            !correction &&
            context &&
            context.available > 0 && (
              <button
                type="button"
                disabled={!canRequest}
                onClick={() => setRequestOpen(true)}
                className={
                  hasCashOnHandTask && canAssignMoney
                    ? "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-background px-3 text-[12.5px] font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
                    : "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[var(--eflow-primary)] px-3 text-[12.5px] font-medium text-[var(--eflow-on-primary)] transition hover:bg-[var(--eflow-primary-hover)] disabled:opacity-50"
                }
              >
                <WalletCards size={13} aria-hidden="true" /> Request cash
              </button>
            )}
        </div>
      </header>

      {context?.funded && (!subtask || Boolean(context.cap) || requests.length > 0) && (
        <div
          role="tablist"
          aria-label="Task funding sections"
          className="flex flex-wrap gap-1.5 border-b border-border pb-2.5"
        >
          {(
            [
              { id: "all", label: "Overview" },
              { id: "requests", label: `Requests (${requests.length})` },
              ...(hasSubtaskSection
                ? [{ id: "subtasks" as const, label: `Subtask budgets (${subtaskRows.length})` }]
                : []),
              ...(fundingSources.length > 0 && !subtask
                ? [{ id: "sources" as const, label: `Sources (${fundingSources.length})` }]
                : []),
            ] as const
          ).map((tab) => {
            const active = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSection(tab.id)}
                className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition ${
                  active
                    ? "bg-[var(--eflow-selected)] text-[var(--eflow-primary)]"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {context?.funded && activeSection === "all" && (!subtask || Boolean(context.cap)) && (
        <dl
          aria-label="Budget summary"
          className={
            subtask
              ? "grid grid-cols-2 divide-y divide-border overflow-hidden rounded-lg border border-border bg-muted/20"
              : "grid grid-cols-2 divide-y divide-border overflow-hidden rounded-lg border border-border bg-muted/20 sm:grid-cols-4 sm:divide-x sm:divide-y-0"
          }
        >
          <SummaryCell
            label={context.cap ? "Subtask budget" : "Approved budget"}
            value={approvedTotal}
          />
          {hasCashOnHandTask ? (
            <>
              <SummaryCell
                label="Cash on hand"
                value={cashPools.totals.cashOnHandTask}
                note={
                  cashPools.totals.cashOnHandAssigned > 0
                    ? `${peso.format(cashPools.totals.cashOnHandUnassigned)} free · ${peso.format(cashPools.totals.cashOnHandAssigned)} assigned`
                    : "All unassigned"
                }
              />
              <SummaryCell
                label="Unrequested"
                value={cashPools.totals.unrequestedBudget}
                tone={temporaryHeld > 0 ? "amber" : "neutral"}
                note={temporaryHeld > 0 ? `${peso.format(temporaryHeld)} on hold` : "Not yet requested"}
              />
            </>
          ) : (
            <>
              <SummaryCell
                label="Pending holds"
                value={temporaryHeld}
                tone={temporaryHeld > 0 ? "amber" : "neutral"}
                note={temporaryHeld > 0 ? "Held, not spent yet" : "No pending holds"}
              />
              <SummaryCell
                label="Cash released"
                value={releasedTotal}
              />
            </>
          )}
          <SummaryCell
            label="Actual spent"
            value={spentTotal}
            note={
              taskLoggedReceiptsTotal > 0
                ? `Settled · ${peso.format(taskLoggedReceiptsTotal)} logged`
                : "Settled receipts"
            }
          />
        </dl>
      )}

      {fundingStep && (
        <p
          role={fundingChecking ? "status" : undefined}
          className="rounded-lg border border-border bg-muted/35 px-3 py-2 text-[12.5px] leading-relaxed text-foreground"
        >
          {fundingStep}
        </p>
      )}

      {activeSection === "all" && temporaryHeld > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          Pending cash requests temporarily hold <strong>{peso.format(temporaryHeld)}</strong> until approved or cancelled — this is not released or spent money yet.
        </p>
      )}
      {activeSection === "all" && correctionWaiting && (
        <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[12px] text-blue-900">
          Returned requests hold no funds. Funds are checked and held again only when resubmitted.
        </p>
      )}

      {(funding.error || budget.error) && (
        <div role="alert" className="flex items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
          <span>{funding.error || budget.error}</span>
          <button
            type="button"
            onClick={() => void refresh()}
            className="shrink-0 rounded-md border border-rose-300 bg-white px-2.5 py-1 text-xs font-medium text-rose-800 hover:bg-rose-100"
          >
            Retry
          </button>
        </div>
      )}
      </section>

      {activeSection === "all" && !subtask && (() => {
        const sourcesPairedWithDistribution = showDistributionInAll && showSourcesInAll;
        const remainingSources = showSourcesInAll && !sourcesPairedWithDistribution;
        const pairRequestsWithSubtasks = requests.length === 1 && showSubtasksInAll;
        const pairRequestsWithSources = requests.length === 1 && !showSubtasksInAll && remainingSources;
        const pairSubtasksWithSources = !showRequestsInAll && showSubtasksInAll && remainingSources;

        return (
          <>
            {sourcesPairedWithDistribution ? (
              <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-12">
                <div className="min-w-0 lg:col-span-7">{cashAssignmentsPanel}</div>
                <div className="min-w-0 lg:col-span-5">{renderFundingSourcesCard(false)}</div>
              </div>
            ) : showDistributionInAll ? (
              cashAssignmentsPanel
            ) : null}

            {pairRequestsWithSubtasks ? (
              <>
                <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-12">
                  <div className="min-w-0 lg:col-span-7">{requestsBentoCard}</div>
                  <div className="min-w-0 lg:col-span-5">{subtaskAllocationsBentoCard}</div>
                </div>
                {remainingSources && renderFundingSourcesCard(true)}
              </>
            ) : pairRequestsWithSources ? (
              <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-12">
                <div className="min-w-0 lg:col-span-7">{requestsBentoCard}</div>
                <div className="min-w-0 lg:col-span-5">{renderFundingSourcesCard(false)}</div>
              </div>
            ) : pairSubtasksWithSources ? (
              <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-12">
                <div className="min-w-0 lg:col-span-7">{subtaskAllocationsBentoCard}</div>
                <div className="min-w-0 lg:col-span-5">{renderFundingSourcesCard(false)}</div>
              </div>
            ) : (
              <>
                {showRequestsInAll && requestsBentoCard}
                {showSubtasksInAll && subtaskAllocationsBentoCard}
                {remainingSources && renderFundingSourcesCard(true)}
              </>
            )}
          </>
        );
      })()}

      {activeSection === "all" && subtask && (
        showDistributionInAll && showRequestsInAll ? (
          <>
            <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-12">
              <div className="min-w-0 lg:col-span-6">{cashAssignmentsPanel}</div>
              <div className="min-w-0 lg:col-span-6">{requestsBentoCard}</div>
            </div>
            {showSubtasksInAll && subtaskAllocationsBentoCard}
          </>
        ) : (
          <>
            {showDistributionInAll && cashAssignmentsPanel}
            {showRequestsInAll && requestsBentoCard}
            {showSubtasksInAll && subtaskAllocationsBentoCard}
          </>
        )
      )}

      {activeSection === "requests" && requestsBentoCard}
      {activeSection === "subtasks" && showSubtasksInAll && subtaskAllocationsBentoCard}
      {activeSection === "sources" && renderFundingSourcesCard(true)}

      {separatePettyCashSection}

      {assignMoneyOpen && context && (
        <AssignMoneyModal
          taskTitle={task.title}
          context={context}
          pools={cashPools}
          initialTarget={assignMoneyTarget}
          lockTarget={Boolean(subtask)}
          onChanged={refresh}
          onClose={() => {
            setAssignMoneyOpen(false);
            setAssignMoneyTarget(undefined);
          }}
        />
      )}

      {receiptTarget && (
        <AssignmentReceiptDialog
          assignment={receiptTarget}
          workTitle={
            receiptTarget.subtaskId
              ? receiptTarget.subtaskTitle || subtask?.title || "Subtask"
              : task.title
          }
          onSaved={refresh}
          onClose={() => setReceiptTarget(undefined)}
        />
      )}

      {budgetsOpen && context && (
        <SubtaskBudgetManager
          key={`${subtask?.id || task.id}:${budgetDraft?.id || "all"}:${budgetDraft?.mode || "list"}`}
          context={context}
          title={subtask?.title || task.title}
          canManage={canManageBudgets}
          taskFinished={taskFinished}
          initialDraft={budgetDraft}
          readLatestContext={funding.readLatest}
          onChanged={refresh}
          onClose={() => {
            setBudgetsOpen(false);
            setBudgetDraft(undefined);
          }}
        />
      )}

      {(requestOpen || correction) && context && (
        <CashRequestForm
          key={`${currentUserId}:${fundingOffice}:${task.id}:${subtask?.id ?? ""}:${correction?.id ?? ""}`}
          context={context}
          orgId={fundingOffice}
          taskId={task.id}
          subtaskId={subtask?.id}
          currentUserId={currentUserId}
          taskStart={task.startDate}
          taskDue={task.deadline || task.dueDate}
          correction={correction}
          readOnly={!canRequest}
          onCancel={() => {
            setRequestOpen(false);
            setCorrection(undefined);
          }}
          onSaved={async () => {
            await refresh();
            setRequestOpen(false);
            setCorrection(undefined);
          }}
        />
      )}
    </div>
  );
}

function FundingSourceList({
  lines,
  releasedByLine,
  grid = false,
}: {
  lines: NonNullable<ReturnType<typeof useTaskFundingContext>["context"]>["lines"];
  releasedByLine?: Map<string, { name: string; released: number; unassigned: number }>;
  grid?: boolean;
}) {
  return (
    <div className={grid ? "grid grid-cols-1 gap-2 md:grid-cols-2" : "space-y-1.5"}>
      {lines.map((line) => {
        const releasedInfo = releasedByLine?.get(line.id);
        const releasedAmount = releasedInfo?.released ?? 0;
        return (
          <div
            key={line.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/25 px-3 py-2 text-[12px]"
          >
            <span className="min-w-0 truncate text-foreground">
              {line.category} · {line.particular} · {line.fundSource}
            </span>
            <span className="shrink-0 text-right tabular-nums">
              {releasedAmount > 0 ? (
                <>
                  <strong className="block text-emerald-800">
                    {peso.format(releasedAmount)} released
                  </strong>
                  <span className="text-[11px] text-muted-foreground">
                    {peso.format(line.available)} unrequested · of {peso.format(line.amount)} approved
                  </span>
                </>
              ) : (
                <>
                  <strong
                    className={`block ${
                      line.available > 0 ? "text-[var(--eflow-primary)]" : "text-muted-foreground"
                    }`}
                  >
                    {peso.format(line.available)} available
                  </strong>
                  <span className="text-[11px] text-muted-foreground">
                    of {peso.format(line.amount)} approved
                  </span>
                </>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SummaryCell({
  label,
  value,
  note,
  tone = "neutral",
}: {
  label: string;
  value: number;
  note?: string;
  tone?: "neutral" | "amber";
}) {
  return (
    <div className={`min-w-0 px-3 py-2.5 ${tone === "amber" ? "bg-amber-50/70" : ""}`}>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd
        className={`mt-0.5 text-[13.5px] font-semibold tabular-nums ${
          tone === "amber" ? "text-amber-900" : "text-foreground"
        }`}
      >
        {peso.format(value)}
      </dd>
      {note && <div className="mt-0.5 text-[10.5px] text-muted-foreground">{note}</div>}
    </div>
  );
}
