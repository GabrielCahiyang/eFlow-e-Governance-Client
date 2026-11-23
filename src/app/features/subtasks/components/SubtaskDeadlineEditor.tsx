import { readableUiError } from '../../../shared/userFacingError';
import { useEffect, useId, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, Save } from "lucide-react";
import type { Task } from "../../../services/taskService";
import { setSubtaskDueDate, type Subtask } from "../../../services/subtaskService";
import { useToast } from "../../../components/ui/Toast";
import { DateInput } from "../../../components/ui/DateInput";
import { BoundedTextarea } from "../../../components/ui/BoundedInput";
import { WorkspaceTooltip } from "../../../components/ui/workspace/WorkspaceTooltip";
import { calendarMinDate, scheduledDateError } from "../../../shared/calendarDates";
import { INPUT_LIMITS, textLengthError } from "../../../shared/inputLimits";
import { formatDate } from "../../../components/workflow/primitives";
import { getSubtaskDeadlineState, parentTaskDueDate } from "../selectors/deadlines";

const TONE = {
  none: "border-neutral-200 bg-neutral-50 text-neutral-600",
  on_track: "border-blue-100 bg-blue-50 text-blue-700",
  due_soon: "border-amber-200 bg-amber-50 text-amber-800",
  overdue: "border-red-200 bg-red-50 text-red-800",
  completed: "border-emerald-100 bg-emerald-50 text-emerald-700",
} as const;

export function SubtaskDeadlineEditor({
  subtask,
  parentTask,
  canManage,
  onSaved,
}: {
  subtask: Subtask;
  parentTask?: Task;
  canManage: boolean;
  onSaved: () => void | Promise<void>;
}) {
  const dueDateId = useId();
  const reasonId = useId();
  const [dueDate, setDueDate] = useState(subtask.dueDate || "");
  const [reason, setReason] = useState("");
  const [reasonTouched, setReasonTouched] = useState(false);
  const [dateInvalidText, setDateInvalidText] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const state = useMemo(() => getSubtaskDeadlineState(subtask), [subtask]);
  const parentDue = parentTaskDueDate(parentTask?.deadline, parentTask?.dueDate);
  const minDate = calendarMinDate(subtask.dueDate || "");
  const changed = dueDate !== (subtask.dueDate || "");
  const started = subtask.status !== "todo" || subtask.percentComplete > 0;
  const requiresReason = started && changed;

  useEffect(() => {
    setDueDate(subtask.dueDate || "");
    setReason("");
    setReasonTouched(false);
    setDateInvalidText(false);
  }, [subtask.id, subtask.dueDate]);

  const dueDateError = dateInvalidText
    ? "Enter a valid deadline in MM/DD/YYYY format."
    : !dueDate
      ? "Choose a subtask deadline."
      : scheduledDateError(dueDate, {
          original: subtask.dueDate || "",
          latest: parentDue || "",
          label: "Subtask deadline",
        });
  const visibleDateError = dateInvalidText || changed ? dueDateError : "";

  const reasonError = requiresReason
    ? textLengthError(reason, "Reason", { required: true, min: 5, max: INPUT_LIMITS.REASON })
    : "";
  const visibleReasonError = requiresReason && (reasonTouched || reason.trim().length > 0) ? reasonError : "";

  const saveDisabledReason = saving
    ? "Saving deadline…"
    : dateInvalidText
      ? "Enter a valid deadline in MM/DD/YYYY format."
      : !dueDate
        ? "Choose a deadline."
        : !changed
          ? "Choose a new deadline to save."
          : dueDateError
            ? dueDateError
            : reasonError
              ? reasonError
              : "";
  const saveDisabled = Boolean(saveDisabledReason);

  const save = async () => {
    setReasonTouched(true);
    if (saveDisabled) return;
    setSaving(true);
    try {
      await setSubtaskDueDate(subtask.id, dueDate, reason.trim());
      toast("Subtask deadline updated and assigned contributors were notified.", "success");
      await onSaved();
    } catch (error) {
      toast(readableUiError(error, "Could not update the subtask deadline.", 'write'), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={`rounded-xl border p-3 ${TONE[state.tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em]"><CalendarClock size={12} /> Subtask deadline</div>
          <div className="mt-1 text-[12px] font-semibold">{subtask.dueDate ? formatDate(subtask.dueDate) : "No due date assigned"}</div>
        </div>
        <span className="rounded-full bg-white/70 px-2 py-1 text-[9.5px] font-semibold">{state.label}</span>
      </div>

      {canManage && !["for_review", "completed"].includes(parentTask?.status || "") && (
        <div className="mt-3 border-t border-current/10 pt-3">
          <label htmlFor={dueDateId} className="text-[9.5px] font-medium">Change deadline</label>
          <div className="mt-1 flex gap-2">
            <DateInput
              id={dueDateId}
              value={dueDate}
              min={minDate}
              max={parentDue}
              hasError={Boolean(visibleDateError)}
              errorMessage={visibleDateError || undefined}
              onInvalidTextChange={setDateInvalidText}
              onChange={(event) => setDueDate(event.target.value)}
              className="h-9 min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-2.5 text-[11px] text-neutral-800 outline-none focus:border-neutral-400"
            />
            <WorkspaceTooltip content={saveDisabledReason} disabled={!saveDisabledReason}>
              <span className="inline-flex">
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saveDisabled}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-neutral-900 px-3 text-[10.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Save size={11} /> {saving ? "Saving…" : "Save"}
                </button>
              </span>
            </WorkspaceTooltip>
          </div>
          {visibleDateError && <p role="alert" className="eflow-field-error mt-1 text-[10.5px]">{visibleDateError}</p>}
          {parentDue && <p className="mt-1 text-[9px] opacity-70">Must be on or before the parent task deadline: {formatDate(parentDue)}.</p>}
          {requiresReason && (
            <div className="mt-2">
              <label htmlFor={reasonId} className="flex items-center gap-1 text-[9.5px] font-medium">
                <AlertTriangle size={10} /> Reason required because work has started <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">*</span>
              </label>
              <BoundedTextarea
                id={reasonId}
                aria-required="true"
                maxLength={INPUT_LIMITS.REASON}
                value={reason}
                error={visibleReasonError || undefined}
                onBlur={() => setReasonTouched(true)}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explain why this deadline is changing (min. 5 characters)…"
                rows={2}
                className="mt-1 w-full resize-none rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-[10.5px] text-neutral-800 outline-none focus:border-neutral-400"
              />
            </div>
          )}
        </div>
      )}

      {subtask.dueDateChangeReason && (
        <p className="mt-2 border-t border-current/10 pt-2 text-[9.5px] leading-relaxed opacity-80"><strong>Latest change:</strong> {subtask.dueDateChangeReason}</p>
      )}
    </section>
  );
}
