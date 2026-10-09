import { AlertTriangle, ChevronRight, FolderKanban, ListChecks } from "lucide-react";
import type { Task } from "../../tasks";
import type { BudgetCommitment, DepartmentBudgetBundle, WorkBudgetAllocation } from "../types";
import { getAllocationCashPosition } from "../selectors/budgetSelectors";
import { BudgetEmpty, peso, StatusPill } from "./budgetUi";

interface FundingHierarchyProps {
  data: DepartmentBudgetBundle;
  tasks: Task[];
}

export function BudgetFundingHierarchy({ data, tasks }: FundingHierarchyProps) {
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
    <div className="space-y-3">
      {data.commitments.map((commitment) => (
        <ProposalFundingCard key={commitment.id} commitment={commitment} data={data} taskById={taskById} />
      ))}
    </div>
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
    <details open className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
          <FolderKanban size={15} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-semibold">{commitment.title}</div>
          <div className="mt-1 text-[12px] text-neutral-500">
            {taskAllocations.length} funded task(s) · {commitment.proposalDraftId ? "reserved at publication" : "direct work authorization"}
          </div>
        </div>
        <FundingMetric label="Actual" value={settled} />
        <FundingMetric label="Committed" value={commitment.amount} emphasized />
        <StatusPill status={commitment.status} />
        <ChevronRight size={14} className="text-neutral-400 transition group-open:rotate-90" />
      </summary>
      <div className="border-t border-neutral-100 bg-neutral-50/50 p-3">
        {taskAllocations.length ? (
          <div className="space-y-2">
            {taskAllocations.map((allocation) => (
              <TaskFundingCard
                key={allocation.id}
                allocation={allocation}
                allCommitmentAllocations={allocations}
                data={data}
                task={taskById.get(allocation.taskId)}
              />
            ))}
          </div>
        ) : (
          <LegacyAllocationWarning />
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
}: {
  allocation: WorkBudgetAllocation;
  allCommitmentAllocations: WorkBudgetAllocation[];
  data: DepartmentBudgetBundle;
  task?: Task;
}) {
  const childAllocations = allCommitmentAllocations.filter(
    (item) => item.taskId === allocation.taskId && item.subtaskId,
  );
  const taskRequests = data.requests.filter(
    (request) => request.allocationId === allocation.id || childAllocations.some((child) => child.id === request.allocationId),
  );
  const position = getAllocationCashPosition(allocation.amount, taskRequests);

  return (
    <details className="group/task rounded-xl border border-neutral-200 bg-white">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-3">
        <ListChecks size={13} className="text-blue-600" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-medium">{task?.title || "Funded task"}</div>
          <div className="mt-0.5 text-[11px] text-neutral-500">
            Task Leader: {task?.assigneeName || "Assigned lead"} · {childAllocations.length} funded subtask(s)
          </div>
        </div>
        <Metric label="Reserved" value={position.reserved} />
        <Metric label="Spent" value={position.spent} />
        <Metric label="Remaining" value={position.remaining} />
        <strong className="text-[12px] tabular-nums">{peso.format(allocation.amount)}</strong>
        <ChevronRight size={12} className="text-neutral-400 transition group-open/task:rotate-90" />
      </summary>
      <div className="border-t border-neutral-100 p-3">
        <AllocationLines allocationId={allocation.id} data={data} />
        <SubtaskFunding allocations={childAllocations} data={data} />
      </div>
    </details>
  );
}

function AllocationLines({ allocationId, data }: { allocationId: string; data: DepartmentBudgetBundle }) {
  const lines = data.allocationLines.filter((line) => line.allocationId === allocationId);
  if (!lines.length) return null;
  return (
    <div className="grid gap-2 lg:grid-cols-2">
      {lines.map((line) => (
        <div key={line.id} className="rounded-lg border border-neutral-100 bg-neutral-50 p-2.5">
          <div className="flex justify-between gap-3 text-[12px]">
            <span>
              <strong>{line.category}</strong>
              <span className="ml-1 text-neutral-400">· {line.particular}</span>
            </span>
            <strong className="tabular-nums">{peso.format(line.amount)}</strong>
          </div>
          <div className="mt-1 text-[11px] text-neutral-500">
            {line.expenseClass} · {line.quantity} {line.unit} × {peso.format(line.unitCost || 0)}
          </div>
        </div>
      ))}
    </div>
  );
}

function SubtaskFunding({ allocations, data }: { allocations: WorkBudgetAllocation[]; data: DepartmentBudgetBundle }) {
  if (!allocations.length) return null;
  return (
    <div className="mt-3 space-y-1.5">
      <div className="text-[11px] uppercase tracking-wide text-neutral-500">Subtask distribution</div>
      {allocations.map((allocation) => {
        const requests = data.requests.filter((request) => request.allocationId === allocation.id);
        const position = getAllocationCashPosition(allocation.amount, requests);
        return (
          <div
            key={allocation.id}
            className="grid items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2 text-[12px] sm:grid-cols-[1fr_auto_auto_auto]"
          >
            <span>{allocation.subtaskTitle || "Funded subtask"}</span>
            <StatusPill status={allocation.status} />
            <span className="tabular-nums">Spent {peso.format(position.spent)}</span>
            <strong className="tabular-nums">{peso.format(allocation.amount)}</strong>
          </div>
        );
      })}
    </div>
  );
}

function LegacyAllocationWarning() {
  return (
    <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-950">
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
      <div>
        <div className="text-[12px] font-medium">Task funding records are pending</div>
        <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-amber-800">
          This proposal remains safely reserved, but it was published before task-linked funding records were available.
          Apply the latest fiscal workflow migrations before petty cash is requested against this proposal.
        </p>
      </div>
    </div>
  );
}

function FundingMetric({ label, value, emphasized = false }: { label: string; value: number; emphasized?: boolean }) {
  return (
    <div className="text-right text-[11px] text-neutral-500">
      <span className="block">{label}</span>
      <strong className={`tabular-nums ${emphasized ? "text-[14px] text-neutral-950" : "text-[12px] text-neutral-800"}`}>{peso.format(value)}</strong>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="hidden text-right text-[11px] text-neutral-500 md:block">
      <span>{label}</span>
      <strong className="ml-1 text-[12px] text-neutral-700 tabular-nums">{peso.format(value)}</strong>
    </div>
  );
}
