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

type BudgetDestination = "funding" | "approvals" | "releases";

interface BudgetPositionSummaryProps {
  data: DepartmentBudgetBundle;
  summary: DepartmentBudgetSummary;
  onNavigate: (destination: BudgetDestination) => void;
}

/**
 * A concise financial position, not a second dashboard of generic KPIs. Each
 * exposure takes the reader to the existing workflow that can resolve it.
 */
export function BudgetPositionSummary({
  data,
  summary,
  onNavigate,
}: BudgetPositionSummaryProps) {
  const today = new Date().toISOString().slice(0, 10);
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
      className="overflow-hidden rounded-[10px] border border-border bg-card shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]"
    >
      <div className="grid xl:grid-cols-[minmax(20rem,0.9fr)_minmax(34rem,1.6fr)]">
        <div className="border-b border-primary/20 bg-primary/5 p-5 text-foreground xl:border-b-0 xl:border-r">
          <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.14em] text-primary">
            <Landmark size={15} /> Available to fund
          </div>
          <div className="mt-3 text-right text-[32px] font-semibold tracking-tight text-primary tabular-nums">
            {peso.format(summary.availableAmount)}
          </div>
          <p className="mt-2 text-right text-[12px] leading-relaxed text-muted-foreground">
            Funds not yet reserved by published proposals or recorded as actual
            expenditure.
          </p>
          <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-primary/15 pt-4 text-right">
            <PositionNumber label="Annual authority" value={summary.approvedAmount} />
            <PositionNumber label="Committed" value={summary.committedAmount} />
            <PositionNumber label="Actual spending" value={summary.spentAmount} />
          </dl>
        </div>

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
            amount={summary.pettyCashReserved}
            action="Review settlement"
            onClick={() => onNavigate("releases")}
          />
        </div>
      </div>
    </section>
  );
}

function PositionNumber({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-neutral-400">{label}</dt>
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
      className="grid w-full gap-3 p-4 text-left transition-colors hover:bg-accent/70 focus-visible:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-ring sm:grid-cols-[2rem_minmax(0,1fr)_auto_auto] sm:items-center"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-foreground">{label}</span>
        <span className="mt-0.5 block text-[12px] leading-relaxed text-muted-foreground">{detail}</span>
      </span>
      <strong className="whitespace-nowrap text-right text-[15px] font-semibold text-foreground tabular-nums">
        {count ? String(amount) : peso.format(amount)}
      </strong>
      <span className="inline-flex items-center justify-end gap-1 text-[12px] font-medium text-blue-700">
        {action} <ArrowRight size={14} />
      </span>
    </button>
  );
}
