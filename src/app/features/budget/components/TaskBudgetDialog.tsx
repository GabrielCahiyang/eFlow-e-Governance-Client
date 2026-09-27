import { FeatureDialog } from "../../../components/ui/FeatureDialog";
import type { BudgetLineInput, TaskBudgetDecision } from "../types";
import { TaskBudgetEditor } from "./TaskBudgetEditor";

export function TaskBudgetDialog({
  open,
  taskKey,
  taskTitle,
  decision,
  noCostReason,
  lines,
  fundingSource,
  readOnly = false,
  onChange,
  onClose,
}: {
  open: boolean;
  taskKey: string;
  taskTitle: string;
  decision: TaskBudgetDecision;
  noCostReason?: string;
  lines: BudgetLineInput[];
  fundingSource?: string;
  readOnly?: boolean;
  onChange: (patch: { budgetDecision: TaskBudgetDecision; budgetNoCostReason?: string; budgetLines: BudgetLineInput[] }) => void;
  onClose: () => void;
}) {
  return (
    <FeatureDialog
      open={open}
      onClose={onClose}
      title={`Budget for ${taskTitle}`}
      description="Build the exact categories and particulars this task will consume."
      showCloseButton={false}
      overlayClassName="!z-[11000] !bg-[#152020]/65 !backdrop-blur-sm"
      contentClassName="!z-[11001] !fixed !top-1/2 !left-1/2 !-translate-x-1/2 !-translate-y-1/2 !w-full !max-w-2xl !max-h-[85vh] !rounded-2xl !border !border-neutral-200 !shadow-2xl !overflow-hidden !bg-white"
    >
      <section className="flex h-full max-h-[85vh] w-full flex-col bg-neutral-50 overflow-hidden">
        <header className="flex items-start justify-between gap-4 border-b border-neutral-200 bg-white px-5 py-4 shrink-0">
          <div>
            <div className="text-[9px] uppercase tracking-[.18em] text-neutral-400">Task funding</div>
            <h2 className="mt-1 text-[16px] font-semibold text-neutral-950">{taskTitle}</h2>
            <p className="mt-1 text-[10px] text-neutral-500">Build the exact categories and particulars this task will consume.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-[10.5px] font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 transition-colors"
          >
            Close
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-5">
          <TaskBudgetEditor
            taskKey={taskKey}
            fundingSource={fundingSource}
            readOnly={readOnly}
            value={{ decision, noCostReason, lines }}
            onChange={(next) =>
              onChange({
                budgetDecision: next.decision,
                budgetNoCostReason: next.noCostReason,
                budgetLines: next.lines,
              })
            }
          />
        </div>
        <footer className="flex justify-end border-t border-neutral-200 bg-white px-5 py-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg bg-primary px-5 text-[10.5px] font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Done
          </button>
        </footer>
      </section>
    </FeatureDialog>
  );
}
