import {
  TaskDepartmentLabel,
  deadlineInputParts,
  deadlineFromInputs,
  taskEstimateError,
} from "../../tasks";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  Banknote,
  Check,
  ChevronRight,
  Clock,
  Edit2,
  Trash2,
} from "lucide-react";
import type { Employee } from "../../../services/employeeService";
import type { EmployeeNotesMap } from "../../../services/employeeNotesService";
import { priorityMeta } from "./draftModel";
import type { DraftTask } from "./draftModel";
import { TaskAssignmentSummary } from "./TaskAssignmentSummary";
import { AssignmentExceptionNote } from "./AssignmentExceptionNote";
import { TeamCompositionNote } from "./TeamCompositionNote";
import { getBudgetLineAmount, TaskBudgetDialog } from "../../budget";

export function DraftTaskRow({
  dt,
  employees,
  employeeNotes: _employeeNotes,
  onUpdate,
  onDelete,
  onOpenModal,
  validationMessages = {},
}: {
  dt: DraftTask;
  employees: Employee[];
  employeeNotes?: EmployeeNotesMap;
  onUpdate: (key: string, patch: Partial<DraftTask>) => void;
  onDelete: (key: string) => void;
  onOpenModal: (key: string) => void;
  validationMessages?: Record<string, string>;
}) {
  const [editing, setEditing] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const deadlineParts = deadlineInputParts(dt.deadline);
  const durationError = taskEstimateError(dt.estimatedHours);
  const assignedEmps = dt.assignedMemberIds
    .map((id) => employees.find((e) => e.id === id))
    .filter((emp): emp is Employee => Boolean(emp));
  const pm = priorityMeta[dt.priority] || priorityMeta.medium;
  const budgetTotal = (dt.budgetLines || []).reduce(
    (sum, line) => sum + getBudgetLineAmount(line),
    0,
  );
  const titleError = validationMessages[`${dt.key}-title`];
  const descriptionError = validationMessages[`${dt.key}-description`];
  const deadlineError =
    validationMessages[`${dt.key}-deadline`] ||
    validationMessages[`${dt.key}-deadline-format`];
  const budgetError =
    validationMessages[`${dt.key}-budget-decision`] ||
    validationMessages[`${dt.key}-budget-lines`];

  useEffect(() => {
    if (titleError || descriptionError || deadlineError || durationError)
      setEditing(true);
  }, [deadlineError, descriptionError, titleError, durationError]);

  return (
    <div
      data-testid="manual-task-row"
      data-task-key={dt.key}
      className={`px-6 py-3 flex items-start gap-3 group transition-all ${
        dt.enabled ? "" : "opacity-40"
      } hover:bg-neutral-50/60`}
    >
      {/* Enable checkbox */}
      <button
        onClick={() => onUpdate(dt.key, { enabled: !dt.enabled })}
        className="shrink-0 mt-0.5"
      >
        {dt.enabled ? (
          <div className="w-4 h-4 rounded bg-primary border border-primary flex items-center justify-center">
            <Check size={10} className="text-white" strokeWidth={2.5} />
          </div>
        ) : (
          <div className="w-4 h-4 rounded border-2 border-neutral-300" />
        )}
      </button>

      {/* Priority bar */}
      <div className={`w-1 h-10 rounded-full shrink-0 mt-0.5 ${pm.bar}`} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <TaskDepartmentLabel task={dt} draft />
        {editing ? (
          <div className="space-y-2">
            <div>
              <input
                aria-label="Task title"
                aria-describedby={
                  titleError ? `manual-task-${dt.key}-title-error` : undefined
                }
                aria-invalid={Boolean(titleError)}
                data-testid="manual-task-title"
                autoFocus
                value={dt.title}
                onChange={(e) => onUpdate(dt.key, { title: e.target.value })}
                className={`w-full rounded-lg border px-2.5 py-1.5 text-[13px] font-medium text-neutral-900 outline-none transition focus:ring-2 ${
                  titleError
                    ? "border-destructive focus:border-destructive focus:ring-destructive/15"
                    : "border-neutral-300 focus:border-ring focus:ring-ring/15"
                }`}
              />
              {titleError && (
                <p
                  id={`manual-task-${dt.key}-title-error`}
                  role="alert"
                  className="mt-1 text-[11px] font-medium text-destructive"
                >
                  {titleError}
                </p>
              )}
            </div>
            <div>
              <textarea
                aria-label="Task description"
                aria-describedby={
                  descriptionError
                    ? `manual-task-${dt.key}-description-error`
                    : undefined
                }
                aria-invalid={Boolean(descriptionError)}
                data-testid="manual-task-description"
                rows={2}
                value={dt.description}
                onChange={(e) =>
                  onUpdate(dt.key, { description: e.target.value })
                }
                className={`w-full resize-none rounded-lg border px-2.5 py-1.5 text-[12px] text-neutral-600 outline-none transition focus:ring-2 ${
                  descriptionError
                    ? "border-destructive focus:border-destructive focus:ring-destructive/15"
                    : "border-neutral-200 focus:border-ring focus:ring-ring/15"
                }`}
              />
              {descriptionError && (
                <p
                  id={`manual-task-${dt.key}-description-error`}
                  role="alert"
                  className="mt-1 text-[11px] font-medium text-destructive"
                >
                  {descriptionError}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div>
                <input
                  aria-label="Task deadline"
                  aria-describedby={
                    deadlineError
                      ? `manual-task-${dt.key}-deadline-error`
                      : undefined
                  }
                  aria-invalid={Boolean(deadlineError)}
                  data-testid="manual-task-deadline"
                  type="date"
                  value={deadlineParts.date}
                  onChange={(e) =>
                    onUpdate(dt.key, {
                      deadline: deadlineFromInputs(
                        e.target.value,
                        deadlineParts.time,
                      ),
                    })
                  }
                  className={`rounded-lg border px-2.5 py-1 text-[12px] outline-none transition focus:ring-2 ${
                    deadlineError
                      ? "border-destructive focus:border-destructive focus:ring-destructive/15"
                      : "border-neutral-200 focus:border-ring focus:ring-ring/15"
                  }`}
                />
                {deadlineError && (
                  <p
                    id={`manual-task-${dt.key}-deadline-error`}
                    role="alert"
                    className="mt-1 text-[11px] font-medium text-destructive"
                  >
                    {deadlineError}
                  </p>
                )}
              </div>
              <label className="text-[11px] text-neutral-600">
                Due time (optional)
                <input
                  aria-label="Task due time"
                  type="time"
                  disabled={!deadlineParts.date}
                  value={deadlineParts.time}
                  onChange={(event) =>
                    onUpdate(dt.key, {
                      deadline: deadlineFromInputs(
                        deadlineParts.date,
                        event.target.value,
                      ),
                    })
                  }
                  className="ml-2 rounded-lg border px-2 py-1"
                />
                <span className="ml-2 text-neutral-400">
                  Philippine time; blank means end of day
                </span>
              </label>
              <label className="text-[11px] text-neutral-600">
                Estimated task days
                <input
                  aria-label="Estimated task days"
                  type="number"
                  min="0.125"
                  step="0.125"
                  value={
                    dt.estimatedHours !== undefined ? dt.estimatedHours / 8 : ""
                  }
                  onChange={(event) =>
                    onUpdate(dt.key, {
                      estimatedHours:
                        event.target.value === ""
                          ? undefined
                          : Number(event.target.value) * 8,
                    })
                  }
                  placeholder="e.g. 2"
                  className="ml-2 w-20 rounded-lg border px-2 py-1"
                />
                <span className="ml-2 text-neutral-400">
                  1 day = 8 work hours
                </span>
                {durationError && (
                  <span role="alert" className="block text-red-700">
                    {durationError}
                  </span>
                )}
              </label>
              <select
                aria-label="Task priority"
                value={dt.priority}
                onChange={(e) =>
                  onUpdate(dt.key, {
                    priority: e.target.value as "low" | "medium" | "high",
                  })
                }
                className="text-[12px] border border-neutral-200 rounded-lg px-2.5 py-1 focus:outline-none bg-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <button
                data-testid="manual-task-finish-editing"
                onClick={() => setEditing(false)}
                className="rounded-lg bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground transition hover:bg-primary/90"
              >
                Done
              </button>
              <button
                type="button"
                onClick={() => setBudgetOpen(true)}
                className={`rounded-lg border px-3 py-1 text-[11px] font-medium transition ${
                  budgetError
                    ? "border-destructive bg-destructive/5 text-destructive"
                    : "border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
                }`}
              >
                Set task budget
              </button>
            </div>
            {budgetError && (
              <p
                role="alert"
                className="text-[11px] font-medium text-destructive"
              >
                {budgetError}
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="text-[13px] font-medium text-neutral-900">
              {dt.title}
            </div>
            {dt.description && (
              <div className="text-[11px] text-neutral-500 mt-0.5 line-clamp-1">
                {dt.description}
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className="text-[10px] text-neutral-500">
                {dt.estimatedHours
                  ? String(dt.estimatedHours / 8) + " working day(s)"
                  : "Estimate needed"}
              </span>
              {dt.deadline && (
                <span className="inline-flex items-center gap-1 text-[10px] text-neutral-500 bg-neutral-100 rounded-full px-2 py-0.5">
                  <Clock size={9} />
                  {dt.deadline}
                </span>
              )}
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full ${pm.badge}`}
              >
                {pm.label}
              </span>
              {dt.requiredSkills.slice(0, 2).map((s) => (
                <span
                  key={s}
                  className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full"
                >
                  {s}
                </span>
              ))}
              {dt.burnoutWarning && (
                <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5">
                  <AlertCircle size={9} />
                  Burnout risk
                </span>
              )}
              <button
                type="button"
                onClick={() => setBudgetOpen(true)}
                aria-describedby={
                  budgetError ? `manual-task-${dt.key}-budget-error` : undefined
                }
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition ${budgetError ? "border-destructive bg-destructive/5 text-destructive" : dt.budgetDecision === "funded" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : dt.budgetDecision === "no_cost" ? "border-neutral-200 bg-neutral-100 text-neutral-600" : "border-amber-200 bg-amber-50 text-amber-700"}`}
              >
                <Banknote size={9} />
                {dt.budgetDecision === "funded"
                  ? `Budget ${new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(budgetTotal)}`
                  : dt.budgetDecision === "no_cost"
                    ? "No cost"
                    : "Set task budget"}
              </button>
              {budgetError && (
                <p
                  id={`manual-task-${dt.key}-budget-error`}
                  role="alert"
                  className="w-full text-[11px] font-medium text-destructive"
                >
                  {budgetError}
                </p>
              )}
            </div>
          </>
        )}

        {/* Team and leader assignment */}
        <button
          data-testid="manual-task-assignment"
          onClick={() => onOpenModal(dt.key)}
          className="group/assign mt-3 flex w-full max-w-md items-center gap-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/70 px-3 py-2.5 text-left transition hover:border-primary/50 hover:bg-primary/5"
          aria-label={
            assignedEmps.length === 0
              ? `Assign team and leader for ${dt.title}`
              : `Edit team and leader for ${dt.title}`
          }
        >
          <TaskAssignmentSummary
            employees={assignedEmps}
            leadMemberId={dt.leadMemberId}
          />
          <ChevronRight
            size={13}
            className="ml-auto shrink-0 text-neutral-300 group-hover/assign:text-primary"
          />
        </button>

        {dt.assignmentException && !editing && (
          <AssignmentExceptionNote exception={dt.assignmentException} />
        )}

        {dt.teamComposition && !editing && (
          <TeamCompositionNote composition={dt.teamComposition} />
        )}

        {dt.reasoning &&
          !dt.assignmentException &&
          !dt.teamComposition &&
          !editing && (
            <div className="mt-1.5 text-[10px] text-primary italic line-clamp-1">
              {dt.reasoning}
            </div>
          )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0 mt-0.5">
        <button
          data-testid="manual-task-edit"
          onClick={() => setEditing(!editing)}
          className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition"
          title="Edit task"
        >
          <Edit2 size={12} />
        </button>
        <button
          onClick={() => onDelete(dt.key)}
          className="p-1.5 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-600 transition"
          title="Delete task"
        >
          <Trash2 size={12} />
        </button>
      </div>
      <TaskBudgetDialog
        open={budgetOpen}
        taskKey={dt.key}
        taskTitle={dt.title || "Untitled task"}
        decision={dt.budgetDecision || "missing"}
        noCostReason={dt.budgetNoCostReason}
        lines={dt.budgetLines || []}
        onChange={(patch) => onUpdate(dt.key, patch)}
        onClose={() => setBudgetOpen(false)}
      />
    </div>
  );
}

// ─── Draft Cockpit Component ──────────────────────────────────────
