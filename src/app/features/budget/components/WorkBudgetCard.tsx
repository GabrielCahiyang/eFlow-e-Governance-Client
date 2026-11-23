import {ReturnedBudgetNote,TaskProjectFunding} from '../../project-setup';
import {OfficePettyCashLauncher} from '../../office-petty-cash';
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
} from "../services/workCashAssignmentService";
import { readableUiError } from "../../../shared/userFacingError";

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
  const subtaskAssignedTaskCash = activeAssignments
    .filter((a) => a.sourceKind === "task_cash_release")
    .reduce((sum, a) => sum + a.amount, 0);
  const subtaskAssignedPettyCash = activeAssignments
    .filter((a) => a.sourceKind === "office_petty_cash")
    .reduce((sum, a) => sum + a.amount, 0);
  const subtaskAssignedCashTotal = subtaskAssignedTaskCash + subtaskAssignedPettyCash;
  const subtaskAssignedReceiptsTotal = activeAssignments.reduce(
    (sum, a) => sum + a.recordedSpent,
    0,
  );
  const subtaskAssignedUnspentTotal = activeAssignments.reduce(
    (sum, a) => sum + a.unspentAmount,
    0,
  );
  const hasCashOnHandTask = !subtask && cashPools.totals.cashOnHandTask > 0;
  const hasAssignableCashPool =
    cashPools.taskCashReleases.some((p) => p.isCurrentHolder && p.acknowledged) ||
    cashPools.officePettyCashReleases.some((p) => p.isCurrentHolder);
  const hasAssignableBudgetCap = Boolean(
    subtask && context?.parentSources?.some((s) => s.available > 0),
  );
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
      (hasAssignableCashPool || hasAssignableBudgetCap || activeAssignments.length > 0),
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
  const hasReleasedCash = !workClosed && requests.some(request => request.cashRecipientId === currentUserId &&
    ['released', 'changes_requested', 'overdue_liquidation'].includes(request.status));
  const hasUnacknowledgedCash = !workClosed && requests.some(request => request.cashRecipientId === currentUserId &&
    ['released', 'changes_requested', 'overdue_liquidation'].includes(request.status) &&
    budget.releases.some(release => release.requestId === request.id && release.status === 'released' && !release.acknowledgedAt));
  const showRequest = !requiresSubtaskBudget && (
    canRequest || Boolean(subtask && !readOnly && canRequestForWork && fundingChecking && context?.funded)
  );
  const fundingStep = subtask && !funding.error && !budget.error ? (
    fundingChecking ? 'Checking funding access…'
      : subtaskAssignedCashTotal > 0 ? (
        activeAssignments.some((a) => a.canLogReceipt)
          ? 'Cash is already assigned to this subtask. Use Record receipt below — your receipts roll up automatically into the cash holder’s liquidation.'
          : 'Cash is already assigned to this subtask from released funds.'
      )
      : hasUnacknowledgedCash ? 'Acknowledge receipt of the released cash first before recording expenses.'
      : hasReleasedCash ? 'Use Record expenses on your cash release. Enter the amount spent and attach the receipts.'
      : !context?.funded ? (
        canAssignMoney
          ? 'Use Assign money to fund this subtask with released office petty cash.'
          : 'Ask the Task Lead about funding for this subtask.'
      )
      : requiresSubtaskBudget ? (
        canAssignMoney
          ? 'Use Assign money to fund this subtask with released task cash, released office petty cash, or an unrequested task budget cap.'
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

  const refresh = async () => {
    await Promise.all([funding.refresh(), budget.refresh()]);
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
  const separatePettyCashSection = !readOnly && (
    <div
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3"
      aria-label="Separate office petty cash fund"
    >
      <div className="min-w-0">
        <div className="text-[12px] font-medium text-foreground">
          Separate office petty cash
        </div>
        <p className="text-[11.5px] text-muted-foreground">
          Draws from the office’s ₱30,000 revolving fund — does not charge this task’s budget.
        </p>
      </div>
      <OfficePettyCashLauncher />
    </div>
  );

  const cashAssignmentsPanel = activeAssignments.length > 0 && (
    <section
      aria-label={subtask ? "Assigned cash for this subtask" : "Assigned cash on hand"}
      className="space-y-2 rounded-xl border border-emerald-200/80 bg-emerald-50/35 p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
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

      {assignmentActionError && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11.5px] text-destructive">
          {assignmentActionError}
        </p>
      )}

      <ul className="space-y-2">
        {activeAssignments.map((assignment) => (
          <li
            key={assignment.id}
            className="rounded-lg border border-border bg-card px-3 py-2.5"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[12.5px] font-semibold text-foreground">
                    {assignment.subtaskId
                      ? assignment.subtaskTitle || "Subtask"
                      : `This task (${task.title})`}
                  </span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-medium ${
                      assignment.sourceKind === "office_petty_cash"
                        ? "bg-indigo-100 text-indigo-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {assignment.sourceLabel}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11.5px] text-muted-foreground tabular-nums">
                  <span>Assigned <strong className="text-foreground">{peso.format(assignment.amount)}</strong></span>
                  <span>·</span>
                  <span>Receipts logged {peso.format(assignment.recordedSpent)}</span>
                  <span>·</span>
                  <span>Unspent <strong className="text-foreground">{peso.format(assignment.unspentAmount)}</strong></span>
                </div>
                {assignment.note && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{assignment.note}</p>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                {assignment.canLogReceipt && assignment.unspentAmount > 0 && (
                  <button
                    type="button"
                    disabled={Boolean(assignmentActionBusy)}
                    onClick={() => setReceiptTarget(assignment)}
                    className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-[11.5px] font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
                  >
                    <ReceiptText size={11} aria-hidden="true" />
                    Record receipt
                  </button>
                )}
                {canAssignMoney && (
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
                    className="h-7 rounded-md border border-border bg-background px-2 text-[11.5px] font-medium text-foreground hover:bg-muted disabled:opacity-50"
                  >
                    Adjust
                  </button>
                )}
                {assignment.canRecall && assignment.unspentAmount > 0 && (
                  <button
                    type="button"
                    disabled={Boolean(assignmentActionBusy)}
                    onClick={() => void handleRecallAssignment(assignment)}
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 text-[11.5px] font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                  >
                    <RotateCcw size={11} aria-hidden="true" />
                    {assignmentActionBusy === assignment.id ? "Returning…" : "Return unused"}
                  </button>
                )}
              </div>
            </div>

            {assignment.receipts.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border/70 pt-2">
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
        ))}
      </ul>
    </section>
  );

  if (!subtask && !budget.summary && !budget.loading && !context?.funded && !hasAssignableCashPool && !activeAssignments.length) {
    return (
      <section
        aria-label="Task funding"
        className="space-y-4 rounded-[12px] border border-[var(--eflow-border)] bg-[var(--eflow-surface)] p-4"
      >
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
        {separatePettyCashSection}
      </section>
    );
  }
  return (
    <section
      aria-label={subtask ? "Subtask funding" : "Task funding"}
      className="space-y-4 rounded-[12px] border border-[var(--eflow-border)] bg-[var(--eflow-surface)] p-4"
    >
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

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
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
                  <div className="flex flex-wrap items-baseline gap-1.5">
                    <strong className="text-[18px] font-semibold tabular-nums text-emerald-900">
                      {peso.format(subtaskAssignedCashTotal)}
                    </strong>
                    <span className="text-[12.5px] font-medium text-emerald-800">
                      cash on hand assigned to this subtask
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted-foreground tabular-nums">
                    {subtaskAssignedTaskCash > 0 && (
                      <span>Task cash: {peso.format(subtaskAssignedTaskCash)}</span>
                    )}
                    {subtaskAssignedPettyCash > 0 && (
                      <span className="rounded bg-indigo-50 px-1.5 py-0.5 font-medium text-indigo-800">
                        Office petty cash: {peso.format(subtaskAssignedPettyCash)}
                      </span>
                    )}
                    <span>
                      · {peso.format(subtaskAssignedReceiptsTotal)} logged · {peso.format(subtaskAssignedUnspentTotal)} unspent
                    </span>
                  </div>
                  {context?.cap && (
                    <div className="text-[11.5px] text-muted-foreground tabular-nums">
                      Separate subtask budget cap: {peso.format(context.cap.amount)} ({peso.format(context.available)} requestable)
                    </div>
                  )}
                </>
              ) : context?.funded ? (
                <div className="flex flex-wrap items-baseline gap-1.5">
                  <strong className="text-[18px] font-semibold tabular-nums text-foreground">
                    {peso.format(context.cap ? context.available : 0)}
                  </strong>
                  <span className="text-[12.5px] text-muted-foreground">
                    {context.cap
                      ? "available to request for this subtask"
                      : "assigned to this subtask yet"}
                  </span>
                </div>
              ) : (
                <div className="text-[12px] text-muted-foreground">
                  {funding.error ? "Funding unavailable right now" : "No funding assigned to this subtask yet"}
                </div>
              )}
            </div>
          ) : hasCashOnHandTask ? (
            <div className="space-y-1 pl-8">
              <div className="flex flex-wrap items-baseline gap-1.5">
                <strong className="text-[18px] font-semibold tabular-nums text-emerald-900">
                  {peso.format(cashPools.totals.cashOnHandTask)}
                </strong>
                <span className="text-[12.5px] font-medium text-emerald-800">
                  cash on hand (released & usable now)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted-foreground tabular-nums">
                <span>
                  <strong className="text-foreground">{peso.format(cashPools.totals.cashOnHandUnassigned)}</strong> unassigned
                </span>
                <span>·</span>
                <span>
                  <strong className="text-foreground">{peso.format(cashPools.totals.cashOnHandAssigned)}</strong> assigned
                </span>
                <span>·</span>
                <span>
                  <strong className="text-foreground">{peso.format(cashPools.totals.unrequestedBudget)}</strong> unrequested task budget remaining
                </span>
                {cashPools.totals.officePettyCashAssigned > 0 && (
                  <span className="rounded bg-indigo-50 px-1.5 py-0.5 font-medium text-indigo-800">
                    + {peso.format(cashPools.totals.officePettyCashAssigned)} office petty cash assigned
                  </span>
                )}
              </div>
              <p className="text-[11.5px] text-muted-foreground">
                Use <strong>Assign money</strong> to allocate released cash or office petty cash directly to this task or to subtasks.
              </p>
            </div>
          ) : context?.funded ? (
            <div className="pl-8">
              <div className="flex flex-wrap items-baseline gap-1.5">
                <strong className="text-[18px] font-semibold tabular-nums text-foreground">
                  {peso.format(context.available)}
                </strong>
                <span className="text-[12.5px] text-muted-foreground">
                  available from the task budget
                </span>
              </div>
              {cashPools.totals.officePettyCashAssigned > 0 && (
                <div className="mt-1 text-[11.5px] font-medium text-indigo-800 tabular-nums">
                  + {peso.format(cashPools.totals.officePettyCashAssigned)} separate office petty cash assigned
                </div>
              )}
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                Task requests go through Project Lead approval, then Accounting approval to release.
              </p>
            </div>
          ) : (
            <div className="pl-8 text-[12px] text-muted-foreground">
              {funding.error
                ? "Funding unavailable right now"
                : cashPools.totals.officePettyCashAssigned > 0
                  ? `${peso.format(cashPools.totals.officePettyCashAssigned)} separate office petty cash assigned`
                  : "No approved project budget for this task"}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {canAssignMoney && (
            <button
              type="button"
              onClick={() => openAssignMoney()}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-medium transition ${
                hasCashOnHandTask || subtask
                  ? "bg-[var(--eflow-primary)] text-[var(--eflow-on-primary)] hover:bg-[var(--eflow-primary-hover)]"
                  : "border border-border bg-background text-foreground hover:bg-muted"
              }`}
            >
              <ArrowRightLeft size={14} aria-hidden="true" /> Assign money
            </button>
          )}
          {canManageBudgets && (subtask || hasSubtaskSection) && (
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
                    ? "inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 text-[13px] font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
                    : "inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[var(--eflow-primary)] px-3.5 text-[13px] font-medium text-[var(--eflow-on-primary)] transition hover:bg-[var(--eflow-primary-hover)] disabled:opacity-50"
                }
              >
                <WalletCards size={14} aria-hidden="true" /> Request cash
              </button>
            )}
        </div>
      </header>

      {context?.funded && (
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
              ...(fundingSources.length > 0
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

      {context?.funded && activeSection === "all" && (
        <dl
          aria-label="Budget summary"
          className="grid grid-cols-2 divide-y divide-border overflow-hidden rounded-lg border border-border bg-muted/20 sm:grid-cols-4 sm:divide-x sm:divide-y-0"
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
                note={`${peso.format(cashPools.totals.cashOnHandUnassigned)} unassigned · ${peso.format(cashPools.totals.cashOnHandAssigned)} assigned`}
              />
              <SummaryCell
                label="Unrequested budget"
                value={cashPools.totals.unrequestedBudget}
                tone={temporaryHeld > 0 ? "amber" : "neutral"}
                note={temporaryHeld > 0 ? `${peso.format(temporaryHeld)} pending holds` : "Remaining to request"}
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

      {activeSection === "all" && cashAssignmentsPanel}

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

      {(activeSection === "all" || activeSection === "requests") && (
        <>
          <CashRequestTimeline
            data={budget}
            requests={requests}
            currentUserId={currentUserId}
            orgId={fundingOffice}
            canCorrect={canRequest}
            workCompleted={workClosed}
            onCorrect={(request) => {
              if (!canRequest) return;
              setCorrection(request);
              setRequestOpen(false);
            }}
            onChanged={refresh}
          />
          {activeSection === "requests" && !requests.length && (
            <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-[12.5px] text-muted-foreground">
              No cash requests for this {subtask ? "subtask" : "task"} yet.
            </p>
          )}
        </>
      )}

      {(activeSection === "all" || activeSection === "subtasks") && hasSubtaskSection && (
        <SubtaskBudgetDistributionInline
          context={context ?? { funded: false, taskId: task.id, taskBudget: 0, available: 0, lines: [] }}
          subtaskId={subtask?.id}
          canManage={canManageBudgets}
          taskFinished={taskFinished}
          showTotals={false}
          onOpenRow={(trigger) => {
            setBudgetDraft(trigger);
            setBudgetsOpen(true);
          }}
        />
      )}

      {fundingSources.length > 0 && activeSection === "sources" && (
        <div aria-label="Approved funding sources">
          <FundingSourceList lines={fundingSources} />
        </div>
      )}

      {fundingSources.length > 0 && activeSection === "all" && (
        <details className="text-[12.5px]">
          <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
            Funding sources ({fundingSources.length})
          </summary>
          <div className="mt-2">
            <FundingSourceList
              lines={fundingSources.filter(
                (line) => line.available > 0 || context?.cap?.allocationLineId === line.id,
              )}
            />
          </div>
        </details>
      )}

      {separatePettyCashSection}

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
  );
}

function FundingSourceList({
  lines,
}: {
  lines: NonNullable<ReturnType<typeof useTaskFundingContext>["context"]>["lines"];
}) {
  return (
    <div className="space-y-1.5">
      {lines.map((line) => (
        <div
          key={line.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/25 px-3 py-2 text-[12px]"
        >
          <span className="min-w-0 truncate text-foreground">
            {line.category} · {line.particular} · {line.fundSource}
          </span>
          <span className="shrink-0 text-right tabular-nums">
            <strong className="block text-[var(--eflow-primary)]">
              {peso.format(line.available)} available
            </strong>
            <span className="text-[11px] text-muted-foreground">
              of {peso.format(line.amount)} approved
            </span>
          </span>
        </div>
      ))}
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
