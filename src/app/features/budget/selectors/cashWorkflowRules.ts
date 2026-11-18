import type {
  PettyCashLiquidation,
  PettyCashRelease,
  PettyCashRequest,
} from "../types";

import { getPhilippineCalendarDate } from '../../../shared/calendarDates';
export { getPhilippineCalendarDate } from '../../../shared/calendarDates';

export function isPastCashNeededBy(
  neededBy?: string,
  today = getPhilippineCalendarDate(),
) {
  return Boolean(neededBy && neededBy < today);
}

export function assertCashNeededByIsCurrentOrFuture(neededBy?: string) {
  if (isPastCashNeededBy(neededBy)) {
    throw new Error("Needed-by date cannot be earlier than today.");
  }
}

export function getScheduledReleaseSummary(
  releases: PettyCashRelease[],
  today = getPhilippineCalendarDate(),
) {
  const scheduled = releases.filter((release) => release.status === "scheduled");
  const due = scheduled.filter((release) => release.scheduledDate <= today);
  return {
    scheduledCount: scheduled.length,
    scheduledAmount: scheduled.reduce((sum, release) => sum + release.amount, 0),
    dueCount: due.length,
    dueAmount: due.reduce((sum, release) => sum + release.amount, 0),
    futureCount: scheduled.length - due.length,
  };
}

export function isLiquidationLate(
  request?: PettyCashRequest,
  liquidation?: PettyCashLiquidation,
) {
  return Boolean(
    request?.liquidationDueAt &&
      liquidation?.submittedAt &&
      liquidation.submittedAt > request.liquidationDueAt,
  );
}

export function isLiquidationCurrentlyOverdue(
  request?: PettyCashRequest,
  now = Date.now(),
) {
  return Boolean(request?.liquidationDueAt && now > request.liquidationDueAt);
}

export function formatFundingRequestCode(requestNumber?: number | null): string {
  return `FR-${String(requestNumber || 0).padStart(5, "0")}`;
}

export function formatEvidenceCount(count: number): string {
  return `${count} evidence record${count === 1 ? "" : "s"}`;
}

export function formatJournalMemoForDisplay(memo?: string | null): string {
  if (!memo) return "";
  return memo.replace(
    /^Release to [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12} for /i,
    "Release to assigned recipient for ",
  );
}

const CASH_STATUS_LABELS: Readonly<Record<string, string>> = {
  draft: "Draft",
  pending: "Pending Project Lead approval",
  pending_leader_review: "Pending Task Lead endorsement",
  leader_changes_requested: "Changes requested by Task Lead",
  pending_department_approval: "Pending Project Lead approval",
  department_changes_requested: "Changes requested by Project Lead",
  approved: "Pending Accounting approval to release",
  scheduled_for_release: "Scheduled for Accounting release",
  partially_released: "Partially released by Accounting",
  released: "Cash released",
  liquidation_draft: "Receipts draft",
  liquidation_submitted: "Receipts submitted",
  pending_leader_liquidation_review: "Pending Task Lead receipt review",
  pending_department_settlement: "Awaiting Accounting settlement",
  changes_requested: "Receipt changes requested",
  overdue_liquidation: "Receipts overdue",
  settled: "Settled",
  rejected: "Declined",
  cancelled: "Cancelled",
  expired: "Expired",
};

export function formatCashStatusLabel(status: string): string {
  if (Object.prototype.hasOwnProperty.call(CASH_STATUS_LABELS, status)) {
    return CASH_STATUS_LABELS[status];
  }
  const readable = status.replace(/_/g, " ").trim();
  return readable ? readable.charAt(0).toUpperCase() + readable.slice(1) : "";
}

const LEDGER_ENTRY_LABELS: Readonly<Record<string, string>> = {
  budget_locked: "Office budget locked",
  budget_adjusted: "Office budget adjusted",
  budget_closed: "Office budget closed",
  proposal_committed: "Project budget committed",
  proposal_released: "Unused project budget released",
  allocation_approved: "Task budget allocated",
  petty_cash_reserved: "Fund cash held for request",
  petty_cash_released: "Fund cash released",
  expense_posted: "Settled expense recorded",
  cash_returned: "Unused cash returned",
  financial_override: "Release schedule override",
};

export function formatLedgerEntryLabel(entryType: string): string {
  if (Object.prototype.hasOwnProperty.call(LEDGER_ENTRY_LABELS, entryType)) {
    return LEDGER_ENTRY_LABELS[entryType];
  }
  const readable = entryType.replace(/_/g, " ").trim();
  return readable ? readable.charAt(0).toUpperCase() + readable.slice(1) : "";
}

export interface CashWorkflowStep {
  id: "leader" | "project_lead" | "accounting_release" | "settlement";
  label: string;
  state: "complete" | "current" | "upcoming" | "attention";
}

export function getCashWorkflowProgress(
  request: Pick<PettyCashRequest, "status" | "taskLeaderId" | "leaderDecisionReason">,
  options?: { unacknowledgedRelease?: boolean },
): { steps: CashWorkflowStep[]; nextAction: string } {
  const s = request.status;
  const includeLeaderStep =
    s === "pending_leader_review" ||
    s === "leader_changes_requested" ||
    Boolean(request.taskLeaderId || request.leaderDecisionReason);

  const leaderState: CashWorkflowStep["state"] =
    s === "pending_leader_review"
      ? "current"
      : s === "leader_changes_requested"
        ? "attention"
        : "complete";

  const projectLeadState: CashWorkflowStep["state"] =
    s === "pending_leader_review" || s === "leader_changes_requested" || s === "draft"
      ? "upcoming"
      : s === "pending" || s === "pending_department_approval"
        ? "current"
        : s === "department_changes_requested" || s === "rejected"
          ? "attention"
          : ["cancelled", "expired"].includes(s)
            ? "upcoming"
            : "complete";

  const accountingReleaseState: CashWorkflowStep["state"] = [
    "approved",
    "scheduled_for_release",
    "partially_released",
  ].includes(s)
    ? "current"
    : [
          "released",
          "liquidation_draft",
          "liquidation_submitted",
          "pending_leader_liquidation_review",
          "pending_department_settlement",
          "changes_requested",
          "overdue_liquidation",
          "settled",
        ].includes(s)
      ? "complete"
      : "upcoming";

  const settlementState: CashWorkflowStep["state"] =
    s === "settled"
      ? "complete"
      : ["changes_requested", "overdue_liquidation"].includes(s)
        ? "attention"
        : [
              "released",
              "liquidation_draft",
              "liquidation_submitted",
              "pending_leader_liquidation_review",
              "pending_department_settlement",
            ].includes(s)
          ? "current"
          : "upcoming";

  const steps: CashWorkflowStep[] = [
    ...(includeLeaderStep
      ? [{ id: "leader" as const, label: "Task Lead endorsement", state: leaderState }]
      : []),
    { id: "project_lead", label: "Project Lead approval", state: projectLeadState },
    { id: "accounting_release", label: "Accounting release", state: accountingReleaseState },
    { id: "settlement", label: "Receipts & settlement", state: settlementState },
  ];

  let nextAction = "";
  switch (s) {
    case "draft":
      nextAction = "Next: Finish and submit this request for approval.";
      break;
    case "pending_leader_review":
      nextAction = "Next: Task Lead reviews and endorses this request before Project Lead approval.";
      break;
    case "leader_changes_requested":
      nextAction = "Next: Update the details using Task Lead feedback and resubmit.";
      break;
    case "pending":
    case "pending_department_approval":
      nextAction = "Next: Project Lead reviews and approves before Accounting releases the cash.";
      break;
    case "department_changes_requested":
      nextAction = "Next: Update the request using Project Lead feedback and resubmit.";
      break;
    case "rejected":
      nextAction = "This request was declined. Submit a new request after addressing feedback.";
      break;
    case "approved":
    case "scheduled_for_release":
      nextAction = "Project Lead approved. Next: Accounting approves and releases the cash on schedule.";
      break;
    case "partially_released":
      nextAction = "Next: Accounting records the remaining cash release while receipts are prepared.";
      break;
    case "released":
    case "liquidation_draft":
      nextAction = options?.unacknowledgedRelease
        ? "Next: Confirm cash receipt below, then upload receipts and return any unused cash."
        : "Next: Record expenses, attach receipts, and return any unused cash for Accounting settlement.";
      break;
    case "changes_requested":
      nextAction = "Next: Correct and resubmit your receipts based on reviewer feedback.";
      break;
    case "overdue_liquidation":
      nextAction = "Overdue: Submit receipts and unused cash immediately for Accounting settlement.";
      break;
    case "liquidation_submitted":
    case "pending_leader_liquidation_review":
      nextAction = "Next: Task Lead endorses receipts, then Accounting settles the request.";
      break;
    case "pending_department_settlement":
      nextAction = "Next: Accounting verifies receipts and finalizes settlement.";
      break;
    case "settled":
      nextAction = "Completed: Accounting verified the receipts and settled this cash request.";
      break;
    case "cancelled":
      nextAction = "Cancelled. No funds remain held for this request.";
      break;
    case "expired":
      nextAction = "Hold expired before approval. Submit a new request if funding is still needed.";
      break;
    default:
      nextAction = `Status: ${formatCashStatusLabel(s)}.`;
  }

  return { steps, nextAction };
}
