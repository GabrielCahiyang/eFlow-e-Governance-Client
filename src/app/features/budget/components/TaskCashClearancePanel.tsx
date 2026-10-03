import { AlertCircle, ArrowRight, RefreshCw } from "lucide-react";
import type { CashReviewFocus, TaskCashBlocker } from "../types";
import { canOpenCashBlockerReview } from "../selectors/taskCashClearance";
import { peso } from "./budgetUi";

export function TaskCashClearancePanel({ blockers, loading, error, serverBlocked, currentUserId, role, onRefresh, onOpenFinancialReview }: {
  blockers: TaskCashBlocker[];
  loading: boolean;
  error: string;
  serverBlocked: boolean;
  currentUserId?: string;
  role?: string;
  onRefresh: () => void;
  onOpenFinancialReview?: (focus: CashReviewFocus) => void;
}) {
  const blocked = blockers.length > 0 || serverBlocked;
  return (
    <section aria-label="Cash clearance" className={`mb-4 rounded-xl border p-4 ${blocked ? "border-amber-200 bg-amber-50/60" : "border-neutral-200 bg-neutral-50/50"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900"><AlertCircle size={14} /> Cash clearance</h3>
          <p aria-live="polite" className="mt-1 text-xs text-neutral-600">
            {loading ? "Checking task and subtask cash…" : blockers.length
              ? `${blockers.length} open cash request${blockers.length === 1 ? " is" : "s are"} holding up task approval.`
              : error ? "Cash clearance could not be checked. This does not mean the task is financially cleared."
                : serverBlocked ? "The last approval attempt reported unresolved cash, but no open requests are visible now. Retry approval to recheck; if it is still blocked, ask the Head to check this task's funding records."
                  : "No open cash requests found. Final clearance is checked again when approving."}
          </p>
        </div>
        <button type="button" onClick={onRefresh} disabled={loading} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700 disabled:opacity-50">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh cash status
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-rose-700">{error} Try refreshing, or ask the Head to inspect the funding record. Approval still uses the database's settlement checks.</p>}
      {blockers.length > 0 && <>
        <p className="mt-2 text-xs text-amber-900">Work approval and cash settlement are separate. Resolve each request below; requesting changes to the work is still available.</p>
        <ul className="mt-3 space-y-3">
          {blockers.map((blocker) => {
            const { request, liquidation } = blocker;
            const number = `FR-${String(request.requestNumber).padStart(5, "0")}`;
            const feedback = request.status === "leader_changes_requested" ? request.leaderDecisionReason
              : request.status === "department_changes_requested" ? request.departmentDecisionReason
                : request.status === "changes_requested" ? liquidation?.decisionReason : undefined;
            return <li key={request.id} className="min-w-0 break-words rounded-lg border border-amber-100 bg-white p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-neutral-900">{number} · {blocker.stage}</strong>
                <span className="text-neutral-600">{request.approvedAmount != null ? "Approved" : "Requested"}: {peso.format(request.approvedAmount ?? request.requestedAmount)}</span>
              </div>
              <p className="mt-1 break-words font-medium text-neutral-800">Task: {request.taskTitle || request.taskId}{request.subtaskId ? ` → Subtask: ${request.subtaskTitle || request.subtaskId}` : " · Task-level cash"}</p>
              <p className="mt-1 break-words text-neutral-600">{request.purpose || "No purpose recorded"}</p>
              {(request.cashRecipientName || request.requesterName) && <p className="mt-1 text-neutral-600">Cash recipient: {request.cashRecipientName || request.requesterName}</p>}
              {(blocker.sourceLabel || blocker.fiscalYear) && <p className="mt-1 text-neutral-500">{[blocker.sourceLabel, blocker.fiscalYear ? `FY ${blocker.fiscalYear}` : undefined].filter(Boolean).join(" · ")}</p>}
              <dl className="mt-3 space-y-1.5 text-neutral-700">
                <div><dt className="inline font-semibold">Waiting on: </dt><dd className="inline">{blocker.owner}</dd></div>
                <div><dt className="inline font-semibold">Next step: </dt><dd className="inline">{blocker.nextStep}</dd></div>
                <div><dt className="inline font-semibold">Where: </dt><dd className="inline">{blocker.location} → {number}</dd></div>
              </dl>
              {(request.releasedAmount || 0) > 0 && <p className="mt-2 text-neutral-600">Released: {peso.format(request.releasedAmount || 0)}{request.liquidationDueAt ? ` · Receipts due ${new Date(request.liquidationDueAt).toLocaleDateString()}` : ""}</p>}
              {liquidation && <p className="mt-1 text-neutral-600">Receipt package #{liquidation.version}: {peso.format(liquidation.declaredSpent)} declared spent · {peso.format(liquidation.returnedAmount)} declared return</p>}
              {feedback && <p className="mt-2 rounded bg-amber-50 p-2 text-amber-900">Reviewer feedback: {feedback}</p>}
              {onOpenFinancialReview && canOpenCashBlockerReview(blocker, currentUserId, role) && <button
                type="button"
                onClick={() => onOpenFinancialReview({ recordId: blocker.reviewTarget!.recordId, orgId: request.orgId, fiscalYear: blocker.fiscalYear! })}
                className="mt-3 inline-flex items-center gap-1 rounded-lg border border-amber-300 px-3 py-1.5 font-medium text-amber-900 hover:bg-amber-50"
              >Open financial review for {number}<ArrowRight size={12} /></button>}
            </li>;
          })}
        </ul>
      </>}
    </section>
  );
}
