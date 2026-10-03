import type { DepartmentBudgetBundle, PettyCashRequest, TaskCashBlocker } from "../types";
import { isLiquidationLate } from "./cashWorkflowRules";

// Match guard_task_financial_completion exactly. In particular, do not silently
// consider expired/draft requests cleared when the database still blocks them.
export const CASH_COMPLETION_TERMINAL_STATES = ["settled", "rejected", "cancelled"] as const;

export function isCashCompletionError(error: unknown): boolean {
  return error instanceof Error && /settle all (task and subtask|released or reserved) cash before approving/i.test(error.message);
}

type ClearanceData = Pick<DepartmentBudgetBundle, "requests" | "releases" | "liquidations" | "allocationLines">;

export function getTaskCashBlockers(
  taskId: string,
  data: ClearanceData,
  fiscalYears: Map<string, number> = new Map(),
  today = new Date().toISOString().slice(0, 10),
): TaskCashBlocker[] {
  return data.requests
    .filter((request) => request.taskId === taskId && !CASH_COMPLETION_TERMINAL_STATES.some((status) => status === request.status))
    .map((request) => {
      const requester = request.requesterName || `Requester (${request.requesterId})`;
      const recipient = request.cashRecipientName || request.requesterName || "Cash recipient";
      const leader = request.taskLeaderName ? `${request.taskLeaderName} (Task Leader)` : "Task Leader";
      const line = data.allocationLines.find((item) => item.id === request.allocationLineId);
      const liquidation = data.liquidations.filter((item) => item.requestId === request.id)
        .sort((a, b) => b.version - a.version)[0];
      const scheduled = data.releases.filter((item) => item.requestId === request.id && item.status === "scheduled")
        .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
      const unacknowledged = data.releases.some((item) => item.requestId === request.id && item.status === "released" && !item.acknowledgedAt);
      const fundingLocation = `${request.subtaskId ? "Subtask" : "Task"} details → Funding activity`;
      const blocker: TaskCashBlocker = {
        request, fiscalYear: fiscalYears.get(request.fiscalBudgetId), liquidation,
        sourceLabel: line ? [line.category, line.particular, line.fundSource].filter(Boolean).join(" · ") : undefined,
        stage: request.status.replace(/_/g, " "), owner: "Head",
        nextStep: "Check this request's funding record with the Head; its current state still prevents task completion.",
        location: fundingLocation,
      };
      const review = (role: "leader" | "department", recordId: string, location: string) => {
        blocker.reviewTarget = { role, recordId };
        blocker.location = `Reviews → Budget → ${location}`;
      };
      switch (request.status) {
        case "draft":
          Object.assign(blocker, { stage: "Unfinished cash request", owner: requester, nextStep: "Finish the request, or cancel it if the cash is no longer needed." });
          break;
        case "pending_leader_review":
          Object.assign(blocker, { stage: "Awaiting operational endorsement", owner: leader, nextStep: "Endorse the cash request or return it for correction. No cash has been settled yet." });
          review("leader", request.id, "Task-linked cash requests");
          break;
        case "pending":
        case "pending_department_approval":
          Object.assign(blocker, { stage: "Awaiting fiscal authorization", nextStep: "Authorize the cash request or return it for correction. If no longer needed, the requester can cancel it." });
          if (request.status === "pending_department_approval") review("department", request.id, "Task-linked cash requests");
          break;
        case "leader_changes_requested":
        case "department_changes_requested":
          Object.assign(blocker, { stage: "Cash request needs correction", owner: requester, nextStep: "Correct and resubmit the cash request, or cancel it if no longer needed. This is an open request, not settled spending." });
          break;
        case "approved":
        case "scheduled_for_release":
        case "partially_released":
          Object.assign(blocker, {
            stage: request.status === "partially_released" ? "Cash only partially released" : "Awaiting cash release", owner: "Accounting Staff",
            nextStep: scheduled[0]
              ? `Record the ${scheduled[0].scheduledDate} cash release${scheduled.length > 1 ? " and remaining scheduled releases" : ""}. The recipient must then submit receipts and any unused cash for settlement.`
              : "Check the cash release schedule with Accounting Staff. Released cash must then be supported by receipts and any unused cash returned for settlement.",
            location: "Office Budget → Releases & Settlement",
          });
          if (scheduled[0]?.scheduledDate <= today) review("department", scheduled[0].id, "Cash releases due");
          break;
        case "released":
        case "liquidation_draft":
        case "overdue_liquidation":
        case "changes_requested":
          Object.assign(blocker, {
            stage: request.status === "changes_requested" ? "Receipts need correction" : request.status === "overdue_liquidation" ? "Receipts overdue" : "Awaiting receipts and return",
            owner: recipient,
            nextStep: `${unacknowledged ? "Acknowledge receipt of the released cash. " : ""}${request.status === "changes_requested" ? "Correct and resubmit the receipt package" : "Upload receipts and submit the liquidation"}, including any unused cash to return. It must then be reviewed and settled.`,
          });
          break;
        case "pending_leader_liquidation_review":
          Object.assign(blocker, { stage: "Receipts awaiting Task Leader review", owner: leader, nextStep: "Review and endorse the receipt package so Accounting Staff can settle the cash." });
          blocker.location = "Reviews → Budget → Receipt liquidations";
          if (liquidation?.status === "pending_leader_review") review("leader", liquidation.id, "Receipt liquidations");
          break;
        case "liquidation_submitted":
        case "pending_department_settlement":
          Object.assign(blocker, { stage: "Awaiting final cash settlement", owner: isLiquidationLate(request,liquidation) && !liquidation?.departmentDecidedAt ? "Head" : "Accounting Staff", nextStep: "Accounting verifies the receipts and unused cash. Late packages need independent Head authorization before settlement. Approving work evidence does not settle this cash." });
          blocker.location = "Reviews → Budget → Receipt liquidations";
          if (liquidation?.status === "pending_department_settlement") review("department", liquidation.id, "Receipt liquidations");
          break;
        case "expired":
          Object.assign(blocker, { stage: "Expired request still blocks completion", owner: "Head / system administrator", nextStep: "Reconcile this expired request with the system administrator. The current database completion rule still treats it as open; do not release cash just to clear this error." });
          break;
      }
      return blocker;
    });
}

export function canOpenCashBlockerReview(blocker: TaskCashBlocker, userId?: string, role?: string): boolean {
  if (!userId || !blocker.reviewTarget || !blocker.fiscalYear) return false;
  const request: PettyCashRequest = blocker.request;
  // Navigation mirrors existing queue visibility; the decision RPC remains the authority.
  if (blocker.reviewTarget.recordId === blocker.liquidation?.id) {
    if (userId === request.cashRecipientId || userId === request.requesterId) return false;
  } else if (blocker.reviewTarget.recordId === request.id && userId === request.requesterId) return false;
  if (blocker.reviewTarget.role === "leader") return request.taskLeaderId === userId;
  if (blocker.reviewTarget.recordId === blocker.liquidation?.id) {
    return role === "accounting_staff" || (role === "head" && isLiquidationLate(request,blocker.liquidation) && !blocker.liquidation.departmentDecidedAt);
  }
  if (blocker.reviewTarget.recordId !== request.id) return role === "accounting_staff";
  return role === "head";
}
