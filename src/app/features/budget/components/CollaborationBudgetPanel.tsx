import { useEffect, useMemo, useState } from "react";
import { Button, Label } from "@vibe/core";
import { CheckCircle2, ChevronRight, ShieldAlert } from "lucide-react";
import type {
  CollaborationDraftSnapshot,
  CollaborationSnapshotTask,
} from "../../interdepartment-collaboration";
import {
  buildProposalBudgetFromTasks,
  getBudgetLineAmount,
  getProposalBudgetReadiness,
} from "../selectors/budgetSelectors";
import { peso } from "./budgetUi";
import { ProposalTaskBudgetSummary } from "./ProposalTaskBudgetSummary";
import { TaskBudgetDialog } from "./TaskBudgetDialog";

export function CollaborationBudgetPanel({
  snapshot,
  editable,
  fundingOwnerName,
  onSave,
}: {
  snapshot: CollaborationDraftSnapshot;
  editable: boolean;
  fundingOwnerName?: string;
  onSave: (
    snapshot: CollaborationDraftSnapshot,
    summary: string,
  ) => Promise<void>;
}) {
  const [tasks, setTasks] = useState(snapshot.tasks);
  const [openTaskKey, setOpenTaskKey] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => setTasks(snapshot.tasks), [snapshot]);

  const budget = useMemo(
    () =>
      buildProposalBudgetFromTasks(tasks, snapshot.budget?.fiscalYear),
    [snapshot.budget?.fiscalYear, tasks],
  );
  const readiness = getProposalBudgetReadiness(tasks);
  const dirty =
    JSON.stringify(tasks) !== JSON.stringify(snapshot.tasks) ||
    JSON.stringify(budget) !== JSON.stringify(snapshot.budget);
  const openTask = tasks.find((task) => task.key === openTaskKey);
  const patchTask = (
    taskKey: string,
    patch: Partial<CollaborationSnapshotTask>,
  ) =>
    setTasks((current) =>
      current.map((task) =>
        task.key === taskKey ? { ...task, ...patch } : task,
      ),
    );

  const enabledTasks = tasks.filter((task) => task.enabled !== false);

  return (
    <div className="space-y-4">
      <ProposalTaskBudgetSummary
        tasks={tasks}
        fiscalYear={budget.fiscalYear}
        fundingOwnerName={fundingOwnerName}
      />

      <section className="eflow-section-card">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h2>Delivery task funding schedule</h2>
            <p className="m-0 mt-1 text-xs text-secondary">
              Operational budget allocation for each task in this proposal.
            </p>
          </div>
          <Label text={`${enabledTasks.length} tasks`} color="dark" />
        </header>

        <div className="divide-y divide-neutral-100">
          {enabledTasks.map((task) => {
            const total = (task.budgetLines || []).reduce(
              (sum, line) => sum + getBudgetLineAmount(line),
              0,
            );
            const complete =
              task.budgetDecision === "no_cost" ||
              (task.budgetDecision === "funded" && total > 0);

            return (
              <button
                key={task.key}
                type="button"
                disabled={!editable}
                onClick={() => setOpenTaskKey(task.key)}
                className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-neutral-50/70 disabled:cursor-default"
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      complete
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}
                  >
                    {complete ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <ShieldAlert size={16} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-neutral-900">
                      {task.title}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-secondary">
                      {task.programTitle} · {task.projectTitle} ·{" "}
                      {task.activityTitle}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-neutral-900">
                      {task.budgetDecision === "funded"
                        ? peso.format(total)
                        : task.budgetDecision === "no_cost"
                          ? "No cost"
                          : "Decision needed"}
                    </div>
                    <div className="text-[11px] text-secondary">
                      {task.budgetDecision === "funded"
                        ? `${task.budgetLines?.length || 0} line item(s)`
                        : "Task funding"}
                    </div>
                  </div>
                  {saveError && <p role="alert" className="text-xs text-red-700">{saveError}</p>}
      {editable && (
                    <ChevronRight size={16} className="text-neutral-400" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Funding Notice */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-4 text-xs leading-relaxed text-blue-950">
        <span className="font-semibold">Lead department budget:</span>{" "}
        Publishing reserves {peso.format(budget.totalAmount)} exactly once from{" "}
        {fundingOwnerName ? `${fundingOwnerName}'s` : "the owner's"} locked annual budget and creates matching allocations for every funded task. No-cost tasks create no allocation.
      </div>

      {saveError && <p role="alert" className="text-xs text-red-700">{saveError}</p>}
      {editable && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div
            className={`text-xs font-semibold ${
              readiness.ready ? "text-emerald-700" : "text-amber-700"
            }`}
          >
            {readiness.ready
              ? "Every task has a complete funding decision."
              : "Complete every task budget before publication."}
          </div>
          <Button
            size="small"
            disabled={!dirty || saving}
            onClick={async () => {
              setSaving(true);
              setSaveError("");
              try {
                await onSave(
                  { ...snapshot, tasks, budget },
                  "Task funding schedule updated",
                );
              } catch (error) {
                setSaveError(error instanceof Error ? error.message : "Budget changes could not be saved.");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Publishing…" : "Save budget changes"}
          </Button>
        </div>
      )}

      {openTask && (
        <TaskBudgetDialog
          open
          taskKey={openTask.key}
          taskTitle={openTask.title}
          decision={openTask.budgetDecision || "missing"}
          noCostReason={openTask.budgetNoCostReason}
          lines={openTask.budgetLines || []}
          fundingSource={
            fundingOwnerName
              ? `${fundingOwnerName} Department Budget`
              : undefined
          }
          readOnly={!editable}
          onChange={(patch) => patchTask(openTask.key, patch)}
          onClose={() => setOpenTaskKey(null)}
        />
      )}
    </div>
  );
}
