import {
  ArrowRight,
  BriefcaseBusiness,
  Clock3,
  Landmark,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import type { ReactNode } from "react";
import type { DepartmentBudgetBundle, DepartmentBudgetSummary } from "../types";
import { peso } from "./budgetUi";
import { getPhilippineCalendarDate } from '../../../shared/calendarDates';
import { financialPosition } from '../selectors/financialPosition';

type BudgetDestination = "funding" | "approvals" | "releases";

interface BudgetPositionSummaryProps {
  data: DepartmentBudgetBundle;
  summary: DepartmentBudgetSummary;
  onNavigate: (destination: BudgetDestination) => void;
  utilization?: { value: number; underTarget: boolean };
}

/**
 * A concise financial position, not a second dashboard of generic KPIs. Each
 * exposure takes the reader to the existing workflow that can resolve it.
 */
export function BudgetPositionSummary({
  data,
  summary,
  onNavigate,
  utilization,
}: BudgetPositionSummaryProps) {
  const today = getPhilippineCalendarDate();
  const position = financialPosition(data, summary);
  const pendingApprovals =
    data.allocations.filter((item) => item.status === "pending").length +
    data.requests.filter((item) => item.status === "pending_department_approval")
      .length +
    data.liquidations.filter(
      (item) => item.status === "pending_department_settlement",
    ).length;
  const releasesDue = data.releases.filter(
    (item) => item.status === "scheduled" && item.scheduledDate <= today,
  );
  const unsettledRequests = data.requests.filter(
    (item) => (item.releasedAmount || 0) > 0 && item.status !== "settled",
  );

  return (
    <section
      aria-label="Budget position summary"
      className="eflow-budget-position"
    >
        <div className="eflow-budget-balance rounded-[10px] border border-border bg-card">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Landmark size={15} /> Available to fund
          </h2>
          <div className="eflow-budget-balance-value font-semibold tracking-tight tabular-nums">
            {peso.format(summary.availableAmount)}
          </div>
          <p className="text-xs text-muted-foreground">
            Released budget available for new commitments.
          </p>
          <dl className="eflow-budget-position-numbers">
            <PositionNumber label="Annual authority" value={summary.approvedAmount} />
            <PositionNumber label="Committed" value={summary.committedAmount} />
            <PositionNumber label="Actual spending" value={summary.spentAmount} />
          </dl>
          {utilization && <div className="space-y-2">
            <div className="flex justify-between gap-2 text-xs">
              <span>Annual utilization</span>
              <strong className="tabular-nums">{utilization.value.toFixed(1)}%</strong>
            </div>
            <div className="eflow-budget-utilization" data-under-target={utilization.underTarget} aria-hidden="true">
              <span style={{ width: `${Math.max(0, Math.min(100, utilization.value))}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">Actual spending as a share of annual authority.</p>
          </div>}
          <details className="eflow-budget-position-details text-sm">
            <summary className="cursor-pointer font-medium">Cash and retained funding</summary>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-right">
              <PositionNumber label="Released cash" value={position.released} />
              <PositionNumber label="Returned cash" value={position.returned} />
              <PositionNumber label="Unsettled advances" value={position.unsettled} />
              <PositionNumber label="Unused commitment" value={position.unusedCommitment} />
            </dl>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Cash returns clear advances. Unused commitments are handled through project funding closeout.</p>
          </details>
        </div>

        <section className="overflow-hidden rounded-[10px] border border-border bg-card" aria-label="Financial actions">
          <div className="eflow-budget-section-heading border-b"><h2>Financial actions</h2></div>
          <div className="divide-y divide-border/70">
          <ActionRow
            icon={<BriefcaseBusiness size={16} />}
            label="Proposal commitments"
            detail={`${data.commitments.filter((item) => item.status === "active").length} active commitment(s)`}
            amount={summary.committedAmount}
            action="View funding"
            onClick={() => onNavigate("funding")}
          />
          <ActionRow
            icon={<WalletCards size={16} />}
            label="Pending approvals"
            detail="Funding requests and settlement decisions needing attention"
            amount={pendingApprovals}
            count
            action="Open requests"
            onClick={() => onNavigate("approvals")}
          />
          <ActionRow
            icon={<Clock3 size={16} />}
            label="Release deadlines"
            detail={
              releasesDue.length
                ? `${releasesDue.length} scheduled tranche(s) are due today or overdue`
                : "No scheduled release is currently due"
            }
            amount={releasesDue.reduce((sum, item) => sum + item.amount, 0)}
            action="Review releases"
            onClick={() => onNavigate("releases")}
          />
          <ActionRow
            icon={<ReceiptText size={16} />}
            label="Settlement exposure"
            detail={`${unsettledRequests.length} released request(s) still need receipts or settlement`}
            amount={position.unsettled}
            action="Review settlement"
            onClick={() => onNavigate("releases")}
          />
          </div>
        </section>
    </section>
  );
}

function PositionNumber({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-[13px] font-medium tabular-nums">
        {peso.format(value)}
      </dd>
    </div>
  );
}

function ActionRow({
  icon,
  label,
  detail,
  amount,
  action,
  count = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  detail: string;
  amount: number;
  action: string;
  count?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="eflow-budget-action-row hover:bg-muted focus-visible:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-ring"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-foreground">{label}</span>
        <span className="mt-0.5 block text-[12px] leading-relaxed text-muted-foreground">{detail}</span>
      </span>
      <strong className="text-right text-sm font-semibold text-foreground tabular-nums">
        {count ? String(amount) : peso.format(amount)}
      </strong>
      <span className="eflow-budget-action-link inline-flex items-center gap-1 text-xs font-medium text-primary">
        {action} <ArrowRight size={14} />
      </span>
    </button>
  );
}
