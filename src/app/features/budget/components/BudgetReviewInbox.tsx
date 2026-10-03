import { useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, Inbox, ReceiptText } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { PageHeader } from "../../../components/workflow/primitives";
import { WorkspaceLoadingSkeleton } from "../../../components/workflow/WorkspaceLoadingSkeleton";
import { useDepartmentBudget } from "../hooks/useDepartmentBudget";
import { BudgetApprovalQueue } from "./BudgetApprovalQueue";
import { BudgetCard, BudgetEmpty } from "./budgetUi";
import { FiscalYearControl } from "./FiscalYearControl";
import { getCurrentFiscalYear } from "../constants";
import type { NotificationNavigationIntent } from "../../notifications";
import type { CashReviewFocus } from "../types";
import { isLiquidationLate } from "../selectors/cashWorkflowRules";

export function BudgetReviewInbox({
  actions,
  embedded = false,
  focus,
  cashReviewFocus,
  scope = "department",
}: {
  actions?: ReactNode;
  focus?: NotificationNavigationIntent | null;
  cashReviewFocus?: CashReviewFocus | null;
  scope?: "department" | "leading";
  embedded?: boolean;
}) {
  const { userProfile, can } = useAuth();
  const orgId = cashReviewFocus?.orgId || userProfile?.org_id || userProfile?.departmentId || "";
  const [fiscalYear, setFiscalYear] = useState(cashReviewFocus?.fiscalYear || getCurrentFiscalYear());
  const budget = useDepartmentBudget(orgId, fiscalYear);
  const currentUserId = userProfile?.id || "";
  const isDepartmentApprover = ["head", "head"].includes(userProfile?.role || "");
  const canSettle = userProfile?.role === "accounting_staff" && can("accounting.settle_liquidation");
  const canRelease = userProfile?.role === "accounting_staff" && can("accounting.release_cash");
  const counts = useMemo(() => ({
    allocations: budget.allocations.filter((item) => isDepartmentApprover && item.status === "pending" && item.requestedBy !== currentUserId).length,
    requests: budget.requests.filter((item) => (isDepartmentApprover && item.status === "pending_department_approval" && item.requesterId !== currentUserId) || (item.status === "pending_leader_review" && item.taskLeaderId === currentUserId && item.requesterId !== currentUserId)).length,
    liquidations: budget.liquidations.filter((item) => {
      const request = budget.requests.find((candidate) => candidate.id === item.requestId);
      const lateAuthorization = isDepartmentApprover && isLiquidationLate(request,item) && !item.departmentDecidedAt;
      return ((lateAuthorization || canSettle) && item.status === "pending_department_settlement" && request?.cashRecipientId !== currentUserId && request?.requesterId !== currentUserId && request?.taskLeaderId !== currentUserId) || (item.status === "pending_leader_review" && request?.taskLeaderId === currentUserId && request?.cashRecipientId !== currentUserId);
    }).length,
    releases: budget.releases.filter((item) => canRelease && item.status === "scheduled" && item.scheduledDate <= new Date().toISOString().slice(0, 10)).length,
  }), [budget.allocations, budget.liquidations, budget.releases, budget.requests, currentUserId, isDepartmentApprover,canRelease,canSettle]);
  const total = counts.allocations + counts.requests + counts.liquidations + counts.releases;

  return (
    <div className={embedded ? "space-y-4" : "min-h-full p-4 sm:p-8"}>
      {!embedded && <PageHeader
        eyebrow={scope === "leading" ? "Leader Workspace · Financial Reviews" : "Office · Reviews"}
        title="Financial Approvals"
        subtitle={scope === "leading" ? "Operationally endorse cash requests and receipt packages from contributors on work you lead." : "Fiscally authorize task-linked cash requests, releases, and receipt settlements from one review inbox."}
        actions={(
          <div className="flex w-full min-w-0 max-w-full flex-wrap items-center gap-2">
            {actions}
            <FiscalYearControl value={fiscalYear} onChange={setFiscalYear} compact />
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[12px] text-amber-700">
              <Inbox size={14} /> {total} awaiting review
            </div>
          </div>
        )}
      />}

      {embedded && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
        <div><div className="text-[14px] font-semibold text-neutral-900">Financial approvals</div><div className="text-[12px] text-neutral-500">Task-linked cash requests, releases, and receipt settlements.</div></div>
        <div className="flex items-center gap-2"><FiscalYearControl value={fiscalYear} onChange={setFiscalYear} compact /><div className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[12px] text-amber-700"><Inbox size={14} /> {total} awaiting review</div></div>
      </div>}

      {budget.loading ? (
        <WorkspaceLoadingSkeleton label="Loading financial approvals…" rows={4} />
      ) : budget.error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-[11px] text-rose-700">{budget.error}</div>
      ) : !budget.summary ? (
        <BudgetEmpty title={`No ${fiscalYear} office budget`} description="Create and lock the annual office budget before contributors can request task funding." />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <BudgetCard label="Allocation proposals" value={String(counts.allocations)} note="Task Leader requests" icon={<ReceiptText size={15} />} tone={counts.allocations ? "warn" : "good"} />
            <BudgetCard label="Cash requests" value={String(counts.requests)} note="Task-linked requests" icon={<Inbox size={15} />} tone={counts.requests ? "warn" : "good"} />
            <BudgetCard label="Receipt packages" value={String(counts.liquidations)} note="Liquidations to verify" icon={<CheckCircle2 size={15} />} tone={counts.liquidations ? "warn" : "good"} />
            <BudgetCard label="Cash releases" value={String(counts.releases)} note="Scheduled tranches due" icon={<ReceiptText size={15} />} tone={counts.releases ? "warn" : "good"} />
          </div>
          <BudgetApprovalQueue data={budget} onChanged={budget.refresh} focusRecordId={cashReviewFocus?.recordId || focus?.financialRecordId} />
        </div>
      )}
    </div>
  );
}
