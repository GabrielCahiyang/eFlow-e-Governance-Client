import {TaskProjectFunding} from '../../project-setup';
import {OfficePettyCashLauncher} from '../../office-petty-cash';
import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Loader2,
  WalletCards,
} from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import type { Task } from "../../tasks";
import { getTaskLeadId } from "../../tasks";
import type { Subtask } from "../../subtasks";
import { getCurrentFiscalYear } from "../constants";
import { useDepartmentBudget } from "../hooks/useDepartmentBudget";
import { useTaskFundingContext } from "../hooks/useTaskFundingContext";
import type { PettyCashRequest } from "../types";
import { peso } from "./budgetUi";
import { SubtaskBudgetButton, SubtaskBudgetManager, SubtaskBudgetTotals } from "./SubtaskBudgetManager";
import { CashRequestForm } from "./CashRequestForm";
import { CashRequestTimeline } from "./CashRequestTimeline";
import { DirectWorkFunding } from "./DirectWorkFunding";
import { isOpenDirectFundingWork } from "../selectors/directFundingEligibility";

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
  const currentUserId = userProfile?.id || "";
  const isTaskLeader = currentUserId === getTaskLeadId(task);
  const isAssignedContributor = Boolean(
    subtask?.assignedToIds.includes(currentUserId),
  );
  const context = funding.context;
  const fundingCurrent = !context?.taskLeaderId || context.taskLeaderId === getTaskLeadId(task);
  const canRequestForWork = subtask ? isAssignedContributor || isTaskLeader : isTaskLeader;
  const fundingChecking = authorityPending || funding.loading || budget.loading || !fundingCurrent;
  const canRequest = Boolean(
    !readOnly && !fundingChecking && !funding.error && !budget.error && context?.funded &&
      budget.summary?.status === "locked" &&
      canRequestForWork,
  );
  const taskFinished = !!task.archivedAt || ["completed", "cancelled"].includes(task.status);
  const canManageBudgets = Boolean(
    (!readOnly || taskFinished || subtask?.status === "completed") &&
      !authorityPending && !funding.loading && fundingCurrent && isTaskLeader &&
      context?.funded && context.canManageDistribution && context.subtaskBudgets,
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
  const protectedCaps = context?.cap
    ? 0
    : budget.allocations
        .filter(
          (allocation) =>
            allocation.taskId === task.id &&
            allocation.subtaskId &&
            allocation.status === "approved",
        )
        .reduce((sum, allocation) => sum + allocation.amount, 0);
  const correctionWaiting = requests.some((request) =>
    ["leader_changes_requested", "department_changes_requested"].includes(
      request.status,
    ),
  );
  const hasReleasedCash = requests.some(request => request.cashRecipientId === currentUserId &&
    ['released', 'changes_requested', 'overdue_liquidation'].includes(request.status));
  const showRequest = canRequest || Boolean(subtask && !readOnly && canRequestForWork && fundingChecking && context?.funded);
  const fundingStep = subtask && !funding.error && !budget.error ? (
    fundingChecking ? 'Checking funding access…'
      : hasReleasedCash ? 'Use Record expenses on your cash release. Enter the amount spent and attach the receipts.'
      : !context?.funded ? 'Ask the Task Lead about funding for this subtask.'
      : !requests.length && canRequest && context.available > 0 ? 'Request the amount you need. The cash recipient can record expenses after the cash is released.'
      : !requests.length && (readOnly || !canRequestForWork) ? 'An assigned contributor or the Task Lead can request cash. The recipient records expenses after release.'
      : !requests.length && budget.summary?.status !== 'locked' ? 'Cash requests open once the Office Budget is locked.'
      : !requests.length && context.available <= 0 ? 'There is no requestable balance for this subtask.'
      : requests.some(request => (APPROVED_CASH_STATES.has(request.status) || TEMPORARY_HOLD_STATES.has(request.status) || correctionWaiting)) ? 'Check Funding activity for the request status and any action due.'
      : null
  ) : null;

  const refresh = async () => {
    await budget.refresh();
    await funding.refresh();
  };

  if (!subtask && !budget.summary && !budget.loading && !context?.funded) return <>{!readOnly&&<OfficePettyCashLauncher/>}{task.linkedProjectId&&!subtask&&<TaskProjectFunding projectId={task.linkedProjectId} taskId={task.id} funded={!!context?.funded} onChanged={refresh}/>}</>;
  return (
    <section className="rounded-[10px] border border-border bg-card p-3 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
      {!subtask&&!readOnly&&<OfficePettyCashLauncher/>}
      {!subtask&&authorityPending && <p role="status" className="mb-3 flex items-center gap-2 text-[13px] text-muted-foreground"><Loader2 size={14} className="animate-spin" />Checking current work access. Your draft is kept; controls resume when verified.</p>}
      {task.linkedProjectId&&!subtask&&<TaskProjectFunding projectId={task.linkedProjectId} taskId={task.id} funded={!!context?.funded} onChanged={refresh}/>}
      {!task.linkedProjectId&&!authorityPending&&(canAuthorizeFunding||!readOnly&&canManage)&&isOpenDirectFundingWork(task)&&!subtask&&!context?.funded&&!funding.loading&&userProfile?.role==="head"&&userProfile.is_active!==false&&userProfile.org_id===orgId&&orgId===fundingOffice&&<DirectWorkFunding key={task.id} data={budget} tasks={[task]} onChanged={refresh} />}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-2">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Banknote size={14} />
          </div>
          <div className="min-w-0">
            <div className="text-[12px] uppercase tracking-wide text-emerald-700">
              {subtask ? "Subtask funding" : "Task funding"}
            </div>
            {funding.loading && !context ? (
              <div className="mt-1 flex items-center gap-1 text-[12px] text-neutral-500">
                <Loader2 size={10} className="animate-spin" /> Calculating
                availability…
              </div>
            ) : context?.funded ? (
              <div className="mt-1 text-right">
                <strong className="text-[14px] tabular-nums text-foreground">
                  {peso.format(context.available)}
                </strong>
                <span className="ml-1 text-[12px] text-muted-foreground">
                  available{" "}
                  {context.cap
                    ? "for this subtask"
                    : "from the task budget"}
                </span>
              </div>
            ) : (
              <div className="mt-1 text-[12px] text-neutral-600">
                No approved funding for this task
              </div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {canManageBudgets && (
            <SubtaskBudgetButton hasAllocation={!!context?.cap} subtask={!!subtask} onClick={() => setBudgetsOpen(true)} />
          )}
          {showRequest &&
            !requestOpen &&
            !correction &&
            context &&
            context.available > 0 && (
              <button
                type="button"
                disabled={!canRequest}
                onClick={() => setRequestOpen(true)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-[13px] font-medium text-white disabled:opacity-50"
              >
                <WalletCards size={9} /> Request cash
              </button>
            )}
        </div>
      </header>

      {context?.funded && context.distribution && <div className="mt-3">
        <SubtaskBudgetTotals context={context} subtask={!!subtask} />
      </div>}
      {budgetsOpen && context && <SubtaskBudgetManager key={subtask?.id || task.id} context={context}
        title={subtask?.title || task.title} canManage={canManageBudgets}
        taskFinished={taskFinished} onChanged={refresh} onClose={() => setBudgetsOpen(false)} />}
      {fundingStep && <p role={fundingChecking ? 'status' : undefined} className="mt-3 rounded-md bg-muted px-3 py-2 text-[13px] leading-relaxed text-foreground">{fundingStep}</p>}

      <details hidden={!context?.funded} className="mt-3 text-[13px]">
      <summary className="cursor-pointer text-muted-foreground">Budget details</summary>
      {context?.funded && (
        <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-[12px] text-primary">
          {subtask
            ? context.cap
              ? `${peso.format(context.cap.available)} is available for this subtask.`
              : `This subtask uses the parent task’s budget. ${peso.format(context.available)} is available.`
            : `${peso.format(context.available)} remains in this task’s budget. Cash is released separately after approval.`}
        </div>
      )}

      {context?.funded && (
        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <FundingMetric
            label={context.cap ? "Subtask budget" : "Approved task budget"}
            value={context.cap?.amount || context.taskBudget}
          />
          <FundingMetric
            label="Temporary holds"
            value={temporaryHeld}
            tone={temporaryHeld > 0 ? "amber" : "neutral"}
          />
          <FundingMetric label="Approved cash" value={approvedCash} />
          <FundingMetric label="Settled spending" value={settledSpending} />
          {!context.cap && protectedCaps > 0 && (
            <FundingMetric label="Allocated to subtasks" value={protectedCaps} />
          )}
        </div>
      )}

      {temporaryHeld > 0 && (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[12px] text-amber-800">
          A pending request temporarily reduces what others may request, but it
          is not approved spending and has not been released.
        </div>
      )}
      {correctionWaiting && (
        <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-2 text-[12px] text-blue-800">
          A returned request holds no funds. Its amount is checked and
          temporarily held again only when the member resubmits it.
        </div>
      )}

      {context?.lines.length ? (
        <div className="mt-2 space-y-1">
          {context.lines
            .filter(
              (line) =>
                line.available > 0 || context.cap?.allocationLineId === line.id,
            )
            .map((line) => (
              <div
                key={line.id}
                className="flex items-center justify-between gap-3 rounded-md bg-muted/45 px-2.5 py-1.5 text-[12px]"
              >
                <span className="min-w-0 truncate text-muted-foreground">
                  {line.category} · {line.particular} · {line.fundSource}
                </span>
                <span className="shrink-0 text-right">
                  <strong className="block tabular-nums text-primary">
                    {peso.format(line.available)} requestable
                  </strong>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    of {peso.format(line.amount)} approved
                  </span>
                </span>
              </div>
            ))}
        </div>
      ) : null}

      </details>

      {(requestOpen || correction) && context && (
        <CashRequestForm
          context={context}
          orgId={fundingOffice}
          taskId={task.id}
          subtaskId={subtask?.id}
          currentUserId={currentUserId}
          correction={correction}
          readOnly={!canRequest}
          onCancel={() => {
            setRequestOpen(false);
            setCorrection(undefined);
          }}
          onSaved={async () => {
            setRequestOpen(false);
            setCorrection(undefined);
            await refresh();
          }}
        />
      )}

      <CashRequestTimeline
        data={budget}
        requests={requests}
        currentUserId={currentUserId}
        orgId={fundingOffice}
        canCorrect={canRequest}
        onCorrect={(request) => {
          if (!canRequest) return;
          setCorrection(request);
          setRequestOpen(false);
        }}
        onChanged={refresh}
      />
      {subtask&&!readOnly&&<div className="mt-3 border-t border-border pt-3"><OfficePettyCashLauncher/></div>}

      {(funding.error || budget.error) && (
        <div className="mt-2 rounded-lg bg-rose-50 p-2 text-[12px] text-rose-700">
          {funding.error || budget.error}
        </div>
      )}
    </section>
  );
}

function FundingMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "amber";
}) {
  return (
    <div
      className={`rounded-lg border px-2.5 py-2 ${tone === "amber" ? "border-amber-200 bg-amber-50" : "border-border bg-muted/35"}`}
    >
      <div className="text-[11px] text-muted-foreground">
        {label}
      </div>
      <strong
        className={`mt-0.5 block text-right text-[12px] tabular-nums ${tone === "amber" ? "text-amber-800" : "text-foreground"}`}
      >
        {peso.format(value)}
      </strong>
    </div>
  );
}
