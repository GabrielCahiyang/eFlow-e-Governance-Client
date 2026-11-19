import { CheckCircle2, ShieldAlert } from "lucide-react";
import { getPhilippineYear } from "../../../shared/calendarDates";
import {
  buildProposalBudgetFromTasks,
  getProposalBudgetReadiness,
  type TaskBudgetSource,
} from "../selectors/budgetSelectors";
import { peso } from "./budgetUi";

export function ProposalTaskBudgetSummary({
  tasks,
  fiscalYear = getPhilippineYear(),
  fundingOwnerName,
}: {
  tasks: TaskBudgetSource[];
  fiscalYear?: number;
  fundingOwnerName?: string;
}) {
  const budget = buildProposalBudgetFromTasks(tasks, fiscalYear);
  const readiness = getProposalBudgetReadiness(tasks);
  const enabledCount = tasks.filter((task) => task.enabled !== false).length;
  const needsDecisionCount =
    readiness.missingTaskKeys.length + readiness.invalidTaskKeys.length;

  return (
    <div className="space-y-3">
      {/* Budget Pulse Strip */}
      <div className="eflow-health-strip">
        <div className="eflow-health-item">
          <span className="eflow-health-item-label">Proposal total budget</span>
          <div className="flex items-center gap-2">
            <span className="eflow-health-item-value text-neutral-900">
              {peso.format(budget.totalAmount)}
            </span>
            <span className="text-xs text-secondary">
              (FY {fiscalYear})
            </span>
          </div>
        </div>

        <div className="eflow-health-item">
          <span className="eflow-health-item-label">Total tasks</span>
          <span className="eflow-health-item-value">{enabledCount}</span>
        </div>

        <div className="eflow-health-item">
          <span className="eflow-health-item-label">Funded tasks</span>
          <span className="eflow-health-item-value text-blue-600">
            {readiness.fundedCount}
          </span>
        </div>

        <div className="eflow-health-item">
          <span className="eflow-health-item-label">No-cost tasks</span>
          <span className="eflow-health-item-value text-emerald-600">
            {readiness.noCostCount}
          </span>
        </div>

        <div className="eflow-health-item">
          <span className="eflow-health-item-label">Needs decision</span>
          <span
            className={`eflow-health-item-value ${needsDecisionCount > 0 ? "text-amber-600" : "text-neutral-900"}`}
          >
            {needsDecisionCount}
          </span>
        </div>
      </div>

      <div
        className={`rounded-lg border p-3.5 text-xs ${
          readiness.ready
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : "border-amber-200 bg-amber-50 text-amber-900"
        }`}
      >
        {readiness.ready ? (
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
            <span>
              <strong>Funding schedule complete.</strong> Publishing will reserve this proposal total from{" "}
              {fundingOwnerName ? `${fundingOwnerName}'s` : "the owner's"} budget and create matching task allocations.
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-amber-700 shrink-0" />
            <span>
              <strong>Funding is incomplete.</strong> Every enabled task must be marked funded with valid line items, or explicitly marked as no-cost.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
