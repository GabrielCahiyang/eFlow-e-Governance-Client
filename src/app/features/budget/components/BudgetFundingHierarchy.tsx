import { ChevronRight, FolderKanban, ListChecks } from "lucide-react";
import type { Task } from "../../tasks";
import type { BudgetCommitment, DepartmentBudgetBundle, WorkBudgetAllocation } from "../types";
import { getAllocationCashPosition } from "../selectors/budgetSelectors";
import { BudgetEmpty, peso, StatusPill } from "./budgetUi";
import { DEFAULT_BUDGET_PAGE_SIZE, useBudgetPagination } from "../hooks/useBudgetPagination";
import { BudgetPagination } from "./BudgetPagination";

interface FundingHierarchyProps {
  data: DepartmentBudgetBundle;
  tasks: Task[];
}

export function BudgetFundingHierarchy({ data, tasks }: FundingHierarchyProps) {
  const pagination = useBudgetPagination(
    data.commitments,
    data.summary?.id || "",
    DEFAULT_BUDGET_PAGE_SIZE,
  );
  if (!data.commitments.length) {
    return (
      <BudgetEmpty
        title="No funded work"
        description="Drafts do not consume funds. Publishing a proposal reserves its approved task budgets once and creates the operational allocations shown here."
      />
    );
  }

  const taskById = new Map(tasks.map((task) => [task.id, task]));
  return (
    <section
      className="min-w-0 overflow-hidden rounded-[10px] border border-border bg-card"
      aria-label="Funding commitments"
    >
      <header className="eflow-budget-section-heading border-b">
        <div>
          <h2>Funding commitments</h2>
          <p>Expand a funded task to inspect its account lines and subtask allocations.</p>
        </div>
        <span className="rounded-[5px] border border-border bg-muted px-2.5 py-1 text-[11px] font-semibold tabular-nums text-muted-foreground">
          {data.commitments.length} {data.commitments.length === 1 ? "record" : "records"}
        </span>
      </header>
      <div className="divide-y divide-border">
        {pagination.pageItems.map((commitment) => (
          <ProposalFundingCard
            key={commitment.id}
            commitment={commitment}
            data={data}
            taskById={taskById}
          />
        ))}
      </div>
      <BudgetPagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        totalItems={pagination.totalItems}
        visibleCount={pagination.pageItems.length}
        noun="record"
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
      />
    </section>
  );
}

function ProposalFundingCard({
  commitment,
  data,
  taskById,
}: {
  commitment: BudgetCommitment;
  data: DepartmentBudgetBundle;
  taskById: Map<string, Task>;
}) {
  const allocations = data.allocations.filter((item) => item.commitmentId === commitment.id);
  const taskAllocations = allocations.filter((item) => !item.subtaskId);
  const settled = data.requests
    .filter((item) => item.commitmentId === commitment.id && item.status === "settled")
    .reduce((sum, item) => sum + (item.actualSpent || 0), 0);

  return (
    <details open className="eflow-budget-funding-commitment group">
      <summary className="eflow-budget-funding-summary">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border border-border bg-muted/60 text-primary">
            <FolderKanban size={15} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-foreground">
              {commitment.title}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {taskAllocations.length} funded {taskAllocations.length === 1 ? "task" : "tasks"} ·{" "}
              {commitment.proposalDraftId ? "reserved at publication" : "direct work authorization"}
            </div>
          </div>
        </div>
        <FundingMetric label="Actual" value={settled} />
        <FundingMetric label="Committed" value={commitment.amount} emphasized />
        <div className="flex items-center justify-end gap-2">
          <StatusPill status={commitment.status} />
          <ChevronRight
            size={14}
            aria-hidden="true"
            className="shrink-0 text-muted-foreground transition group-open:rotate-90"
          />
        </div>
      </summary>

      <div className="border-t border-border bg-subtle">
        {taskAllocations.length ? (
          <div>
            <div className="eflow-budget-funding-task-head" aria-hidden="true">
              <span>Task &amp; lead</span>
              <span className="text-right">Approved task budget</span>
              <span className="text-right">In subtasks</span>
              <span className="text-right">Unallocated</span>
              <span className="text-right">Cash released</span>
              <span className="text-right">Actual spent</span>
              <span />
            </div>
            <div className="divide-y divide-border bg-card">
              {taskAllocations.map((allocation) => (
                <TaskFundingCard
                  key={allocation.id}
                  allocation={allocation}
                  allCommitmentAllocations={allocations}
                  data={data}
                  task={taskById.get(allocation.taskId)}
                  authorizedTitle={
                    !commitment.proposalDraftId && taskAllocations.length === 1
                      ? commitment.title
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="px-4 py-3 text-[12px] text-muted-foreground">
            No task funding allocations recorded under this commitment yet.
          </div>
        )}
      </div>
    </details>
  );
}

function TaskFundingCard({
  allocation,
  allCommitmentAllocations,
  data,
  task,
  authorizedTitle,
}: {
  allocation: WorkBudgetAllocation;
  allCommitmentAllocations: WorkBudgetAllocation[];
  data: DepartmentBudgetBundle;
  task?: Task;
  authorizedTitle?: string;
}) {
  const childAllocations = allCommitmentAllocations.filter(
    (item) => item.taskId === allocation.taskId && item.subtaskId,
  );
  const taskRequests = data.requests.filter(
    (request) =>
      request.allocationId === allocation.id ||
      childAllocations.some((child) => child.id === request.allocationId),
  );
  const position = getAllocationCashPosition(allocation.amount, taskRequests);
  const allocated = childAllocations
    .filter((item) => item.status === "approved" || item.status === "pending")
    .reduce((total, item) => total + item.amount, 0);
  const cashReleased = taskRequests.reduce(
    (sum, request) => sum + (request.releasedAmount ?? 0),
    0,
  );
  const unallocated = Math.max(0, allocation.amount - allocated);

  return (
    <details className="eflow-budget-funding-task group/task">
      <summary className="eflow-budget-funding-task-row">
        <div className="flex min-w-0 items-center gap-2.5">
          <ListChecks size={14} aria-hidden="true" className="shrink-0 text-primary" />
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium text-foreground">
              {task?.title || authorizedTitle || "Funded task"}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Task Leader: {task?.assigneeName || "Assigned lead"}
            </div>
          </div>
        </div>
        <TaskCellMetric label="Approved" value={allocation.amount} emphasized />
        <TaskCellMetric label="In subtasks" value={allocated} />
        <TaskCellMetric label="Unallocated" value={unallocated} />
        <TaskCellMetric label="Cash released" value={cashReleased} />
        <TaskCellMetric label="Actual spent" value={position.spent} />
        <ChevronRight
          size={13}
          aria-hidden="true"
          className="justify-self-end text-muted-foreground transition group-open/task:rotate-90"
        />
      </summary>

      <div className="space-y-3 border-t border-border bg-subtle px-4 py-3">
        <AllocationLines allocationId={allocation.id} data={data} />
        <SubtaskFunding allocations={childAllocations} data={data} />
        {!data.allocationLines.some((line) => line.allocationId === allocation.id) &&
          !childAllocations.length && (
            <div className="text-[12px] text-muted-foreground">
              No account breakdown or subtask allocations recorded for this task yet.
            </div>
          )}
      </div>
    </details>
  );
}

function AllocationLines({ allocationId, data }: { allocationId: string; data: DepartmentBudgetBundle }) {
  const lines = data.allocationLines.filter((line) => line.allocationId === allocationId);
  if (!lines.length) return null;
  return (
    <div className="overflow-hidden rounded-[8px] border border-border bg-card">
      <div className="border-b border-border bg-muted/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Account lines
      </div>
      <div className="divide-y divide-border">
        {lines.map((line) => (
          <div
            key={line.id}
            className="grid items-center gap-2 px-3 py-2 text-[12px] sm:grid-cols-[minmax(0,1fr)_auto_auto]"
          >
            <div className="min-w-0">
              <strong className="font-medium text-foreground">{line.category}</strong>
              <span className="ml-1.5 text-muted-foreground">· {line.particular}</span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              {line.expenseClass} · {line.quantity} {line.unit} × {peso.format(line.unitCost || 0)}
            </span>
            <strong className="text-right tabular-nums text-foreground">
              {peso.format(line.amount)}
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function SubtaskFunding({
  allocations,
  data,
}: {
  allocations: WorkBudgetAllocation[];
  data: DepartmentBudgetBundle;
}) {
  if (!allocations.length) return null;
  return (
    <div className="overflow-hidden rounded-[8px] border border-border bg-card">
      <div className="border-b border-border bg-muted/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Subtask distribution
      </div>
      <div className="divide-y divide-border">
        {allocations.map((allocation) => {
          const requests = data.requests.filter((request) => request.allocationId === allocation.id);
          const position = getAllocationCashPosition(allocation.amount, requests);
          const released = requests.reduce((sum, request) => sum + (request.releasedAmount ?? 0), 0);
          return (
            <div
              key={allocation.id}
              className="grid items-center gap-2 px-3 py-2 text-[12px] sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
            >
              <span className="font-medium text-foreground">
                {allocation.subtaskTitle || "Funded subtask"}
              </span>
              <StatusPill status={allocation.status} />
              <span className="tabular-nums text-muted-foreground">
                Released {peso.format(released)} · Spent {peso.format(position.spent)}
              </span>
              <strong className="text-right tabular-nums text-foreground">
                {peso.format(allocation.amount)}
              </strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FundingMetric({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: number;
  emphasized?: boolean;
}) {
  return (
    <div className="text-right text-[11px] text-muted-foreground">
      <span className="block">{label}</span>
      <strong
        className={`tabular-nums ${emphasized ? "text-[14px] font-semibold text-foreground" : "text-[12px] font-medium text-foreground"}`}
      >
        {peso.format(value)}
      </strong>
    </div>
  );
}

function TaskCellMetric({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: number;
  emphasized?: boolean;
}) {
  return (
    <div className="eflow-budget-funding-cell text-right tabular-nums">
      <span className="eflow-budget-funding-cell-label">{label}</span>
      <strong className={emphasized ? "font-semibold text-foreground" : "font-medium text-foreground"}>
        {peso.format(value)}
      </strong>
    </div>
  );
}
