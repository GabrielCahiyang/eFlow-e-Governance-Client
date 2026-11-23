import { readableUiError } from '../../../../shared/userFacingError';
import { Trash2, Users, X } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { BoundedTextInput, BoundedTextarea } from "../../../../components/ui/BoundedInput";
import { WorkspaceTooltip } from "../../../../components/ui/workspace/WorkspaceTooltip";
import { INPUT_LIMITS, textLengthError } from "../../../../shared/inputLimits";
import type { Employee } from "../../../../services/employeeService";
import type { Task } from "../../../../services/taskService";
import { TaskEditorSubtasks, TaskEditorWorkOwner, TaskEditorRootPeople, TaskEditorSaveButton, type LegacyEditorStaffingScope } from "./TaskEditorSubtasks";
import { supportsNestedWork } from '../../../nested-work';
import { TaskBoardDialog } from "./TaskBoardDialog";
import { TaskChatSection } from "./TaskChatSection";
import { TaskChatLink } from '../../../chat-calls';
import { buildTaskEditorDraft, type TaskEditorDraft } from "./model";
import { useEffect, useId, useState } from "react";
import { fetchTaskDetailEditState, type TaskDetailEditState } from "../../services/taskDetailEditService";

// ─── Draft Task Row ───────────────────────────────────────────────

export function TaskEditorModal({
  open,
  task,
  draft,
  onChange,
  onClose,
  onSave,
  onDelete,
  onOpenTeamEditor,
  saving,
  error,
  employees,
  availableTasks,
  employeeById,
  currentUserId,
  currentUserName,
}: {
  open: boolean;
  task: Task | null;
  draft: TaskEditorDraft | null;
  onChange: (patch: Partial<TaskEditorDraft>) => void;
  onClose: () => void;
  onSave: (legacy?: LegacyEditorStaffingScope, reason?: string) => void;
  onDelete: () => void;
  onOpenTeamEditor: () => void;
  saving: boolean;
  error: string;
  employees: Employee[];
  availableTasks: Task[];
  employeeById: Record<string, Employee>;
  currentUserId?: string;
  currentUserName?: string;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dueDateId = useId();
  const changeReasonId = useId();
  const priorityId = useId();
  const tagsId = useId();
  const acceptanceId = useId();
  const dodId = useId();
  const dependenciesId = useId();
  const proposalId = useId();
  const programId = useId();
  const projectId = useId();
  const activityId = useId();
  const scheduleId = useId();

  const [editState, setEditState] = useState<TaskDetailEditState | null>(null);
  const [editStateError, setEditStateError] = useState("");
  const [editStateLoading, setEditStateLoading] = useState(false);
  const [changeReason, setChangeReason] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [reasonTouched, setReasonTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open || !task) return;
    let active = true;
    setEditState(null);
    setEditStateError("");
    setChangeReason("");
    setTitleTouched(false);
    setReasonTouched(false);
    setSubmitted(false);
    setEditStateLoading(true);
    void fetchTaskDetailEditState(task.id).then((state) => {
      if (active) setEditState(state);
    }).catch((err) => {
      if (active) setEditStateError(readableUiError(err, "Task editing access could not be verified.", 'write'));
    }).finally(() => { if (active) setEditStateLoading(false); });
    return () => { active = false; };
  }, [open, task?.id]);

  const verified = !editStateLoading && !editStateError && !!editState;
  const detailsWritable = verified && !!editState?.details;
  const planningWritable = detailsWritable && !!editState?.planning;
  const titlePriorityWritable = detailsWritable;
  const dueWritable = detailsWritable && !!editState?.due;
  if (!open || !task || !draft) return null;

  const initialDeadline = buildTaskEditorDraft(task).deadline;
  const requiresChangeReason = Boolean(editState?.started && dueWritable && draft.deadline !== initialDeadline);
  const titleError = titlePriorityWritable
    ? textLengthError(draft.title, "Task title", { required: true, max: INPUT_LIMITS.TASK_TITLE })
    : "";
  const visibleTitleError = titleTouched || submitted || !draft.title.trim() ? titleError : "";

  const reasonError = requiresChangeReason
    ? textLengthError(changeReason, "Reason for due-date change", { required: true, min: 5, max: INPUT_LIMITS.REASON })
    : "";
  const visibleReasonError = requiresChangeReason && (reasonTouched || submitted || changeReason.trim().length > 0)
    ? reasonError
    : "";

  const saveDisabledReason = editStateLoading
    ? "Checking current task editing access…"
    : editStateError || !verified
      ? (editStateError || "Task editing access could not be verified.")
      : !detailsWritable
        ? "Task details are read-only for your current authority or workflow state."
        : titleError
          ? titleError
          : reasonError
            ? reasonError
            : "";

  const teamMembers = draft.teamMemberIds
    .map((id) => employeeById[id])
    .filter((member): member is Employee => Boolean(member));
  const leadName =
    (draft.leadMemberId ? employeeById[draft.leadMemberId]?.name : "") ||
    teamMembers[0]?.name ||
    "Unassigned";
  const reviewerCandidates = employees.filter(
    (employee) => employee.id !== (supportsNestedWork(task) ? task.assigneeId : draft.leadMemberId),
  );

  const inputClass = "mt-1 h-[40px] w-full rounded-xl border border-neutral-200 bg-white px-3 text-[13px] text-neutral-900 outline-none focus:border-neutral-400";
  const compactInputClass = "mt-1 h-[38px] w-full rounded-xl border border-neutral-200 bg-white px-3 text-[12px] text-neutral-900 outline-none focus:border-neutral-400";
  const textareaClass = "mt-1 w-full resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-[12px] text-neutral-900 outline-none focus:border-neutral-400";

  return (
    <TaskEditorWorkOwner task={task}><TaskBoardDialog
      eyebrow="Task editor"
      maxWidthClassName="max-w-[640px]"
      onClose={onClose}
      open={open}
      title={task.title}
      footer={
        <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <WorkspaceTooltip content="Permanently deletes this task and its subtasks. You will be asked to confirm.">
              <Button type="button" onClick={onDelete} size="sm" variant="destructive">
                <Trash2 />
                Delete task
              </Button>
            </WorkspaceTooltip>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" onClick={onClose} variant="outline">
              Cancel
            </Button>
            <TaskEditorSaveButton
              task={task}
              saving={saving}
              disabled={Boolean(saveDisabledReason)}
              disabledReason={saveDisabledReason}
              onSave={(legacy) => {
                setSubmitted(true);
                if (saveDisabledReason) return;
                if (changeReason.trim()) onSave(legacy, changeReason.trim());
                else onSave(legacy);
              }}
            />
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {editStateLoading && <p role="status" className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">Checking current task editing access…</p>}
        {editStateError && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{editStateError} Editing is unavailable until access can be verified.</p>}
        {editState?.started && <p role="status" className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">Work is already in progress. Start date and prerequisites cannot be changed. Authorized editors can correct the title and priority; due-date changes require supervising authority and a reason.</p>}
        {editState && !editState.details && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Task details are read-only for your current authority or workflow state.</p>}
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</div>}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor={titleId} className="text-[10px] uppercase tracking-[0.12em] text-neutral-400">
              Task Title <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">*</span>
            </label>
            <BoundedTextInput
              id={titleId}
              aria-label="Task title"
              aria-required="true"
              maxLength={INPUT_LIMITS.TASK_TITLE}
              value={draft.title}
              error={visibleTitleError || undefined}
              disabled={!titlePriorityWritable}
              onBlur={() => setTitleTouched(true)}
              onChange={(e) => onChange({ title: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor={descriptionId} className="text-[10px] uppercase tracking-[0.12em] text-neutral-400">
              Description
            </label>
            <BoundedTextarea
              id={descriptionId}
              rows={3}
              aria-label="Task description"
              maxLength={INPUT_LIMITS.DESCRIPTION}
              value={draft.description}
              disabled={!planningWritable}
              onChange={(e) => onChange({ description: e.target.value })}
              className="mt-1 w-full resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-[13px] text-neutral-900 outline-none focus:border-neutral-400"
            />
          </div>
          <div>
            <label htmlFor={dueDateId} className="text-[10px] uppercase tracking-[0.12em] text-neutral-400">
              Due Date / Schedule
            </label>
            <BoundedTextInput
              id={dueDateId}
              maxLength={INPUT_LIMITS.SHORT_TAG}
              value={draft.deadline}
              disabled={!dueWritable}
              onChange={(e) => onChange({ deadline: e.target.value })}
              placeholder="e.g. 2026-07-15 or Month 1"
              className={inputClass}
            />
            {requiresChangeReason && (
              <div className="mt-2">
                <label htmlFor={changeReasonId} className="block text-xs text-neutral-600">
                  Reason for due-date change <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">*</span>
                </label>
                <BoundedTextarea
                  id={changeReasonId}
                  aria-label="Due-date change reason"
                  aria-required="true"
                  rows={2}
                  value={changeReason}
                  maxLength={INPUT_LIMITS.REASON}
                  error={visibleReasonError || undefined}
                  onBlur={() => setReasonTouched(true)}
                  onChange={(event) => setChangeReason(event.target.value)}
                  className="mt-1 w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[12px] text-neutral-900 outline-none focus:border-neutral-400"
                  placeholder="Required when changing the due date (min. 5 characters)"
                />
              </div>
            )}
          </div>
          <div>
            <label htmlFor={priorityId} className="text-[10px] uppercase tracking-[0.12em] text-neutral-400">
              Priority
            </label>
            <select
              id={priorityId}
              value={draft.priority}
              disabled={!titlePriorityWritable}
              onChange={(e) =>
                onChange({
                  priority: e.target.value as "low" | "medium" | "high",
                })
              }
              className={inputClass}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label htmlFor={tagsId} className="text-[10px] uppercase tracking-[0.12em] text-neutral-400">
              Tags
            </label>
            <BoundedTextInput
              id={tagsId}
              maxLength={INPUT_LIMITS.TAGS_LIST}
              value={draft.tagsText}
              disabled={!planningWritable}
              onChange={(e) => onChange({ tagsText: e.target.value })}
              placeholder="comma-separated tags"
              className={inputClass}
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor={acceptanceId} className="text-[10px] uppercase tracking-[0.12em] text-neutral-400">
              Acceptance Criteria
            </label>
            <BoundedTextarea
              id={acceptanceId}
              rows={3}
              maxLength={INPUT_LIMITS.DESCRIPTION}
              value={draft.acceptanceCriteriaText}
              disabled={!planningWritable}
              onChange={(event) =>
                onChange({ acceptanceCriteriaText: event.target.value })
              }
              placeholder="One testable criterion per line"
              className={textareaClass}
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor={dodId} className="text-[10px] uppercase tracking-[0.12em] text-neutral-400">
              Definition of Done
            </label>
            <BoundedTextarea
              id={dodId}
              rows={2}
              maxLength={INPUT_LIMITS.COMMENT}
              value={draft.definitionOfDone}
              disabled={!planningWritable}
              onChange={(event) =>
                onChange({ definitionOfDone: event.target.value })
              }
              placeholder="Evidence, approval, or quality standard required for completion"
              className={textareaClass}
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor={dependenciesId} className="text-[10px] uppercase tracking-[0.12em] text-neutral-400">
              Dependencies
            </label>
            <select
              id={dependenciesId}
              value=""
              disabled={!planningWritable}
              onChange={(event) => {
                if (
                  event.target.value &&
                  !draft.dependencyIds.includes(event.target.value)
                ) {
                  onChange({
                    dependencyIds: [...draft.dependencyIds, event.target.value],
                  });
                }
              }}
              className="mt-1 h-[40px] w-full rounded-xl border border-neutral-200 bg-white px-3 text-[12px] text-neutral-900 outline-none focus:border-neutral-400"
            >
              <option value="">Add a prerequisite task…</option>
              {availableTasks
                .filter(
                  (candidate) =>
                    candidate.id !== task.id &&
                    !draft.dependencyIds.includes(candidate.id),
                )
                .map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.title}
                  </option>
                ))}
            </select>
            {draft.dependencyIds.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {draft.dependencyIds.map((dependencyId) => {
                  const dependency = availableTasks.find(
                    (candidate) => candidate.id === dependencyId,
                  );
                  return (
                    <button
                      type="button"
                      key={dependencyId}
                      disabled={!planningWritable}
                      onClick={() =>
                        onChange({
                          dependencyIds: draft.dependencyIds.filter(
                            (id) => id !== dependencyId,
                          ),
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-1 text-[10.5px] text-neutral-600 hover:bg-neutral-100"
                    >
                      {dependency?.title || "Unavailable task"} <X size={10} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[14px] border border-border bg-muted/50 p-3">
          <TaskEditorRootPeople task={task} readOnly={saving} fallback={
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[10px] uppercase tracking-[0.12em] text-neutral-400">
                  Team Assignment
                </div>
                <div className="text-[12px] text-neutral-700 mt-0.5">
                  Lead: {leadName}
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5">
                  {teamMembers.length > 0
                    ? `Team of ${teamMembers.length}: ${teamMembers.map((member) => member.name).join(", ")}`
                    : "No team members assigned yet."}
                </div>
              </div>
              <WorkspaceTooltip
                content={employees.length === 0 ? "No office employees are available to assign." : ""}
                disabled={employees.length > 0}
              >
                <span className="inline-flex">
                  <button
                    type="button"
                    onClick={onOpenTeamEditor}
                    disabled={employees.length === 0}
                    className="inline-flex items-center gap-1 h-8 px-3 rounded-full border border-neutral-200 bg-white text-[11px] font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 transition"
                  >
                    <Users size={11} />
                    Edit Team
                  </button>
                </span>
              </WorkspaceTooltip>
            </div>
          } />
          <div className="mt-3 grid gap-3 border-t border-neutral-200 pt-3 md:grid-cols-2">
            <label className="text-[10px] uppercase tracking-[0.12em] text-neutral-400">
              Primary Reviewer
              <select
                value={draft.reviewerId || ""}
                disabled={!planningWritable}
                onChange={(event) =>
                  onChange({ reviewerId: event.target.value || null })
                }
                className="mt-1 h-[38px] w-full rounded-xl border border-neutral-200 bg-white px-3 text-[12px] normal-case tracking-normal text-neutral-900 outline-none focus:border-neutral-400"
              >
                <option value="">Use office reviewer</option>
                {reviewerCandidates
                  .filter((employee) => employee.id !== draft.backupReviewerId)
                  .map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-[10px] uppercase tracking-[0.12em] text-neutral-400">
              Backup Reviewer
              <select
                value={draft.backupReviewerId || ""}
                disabled={!planningWritable}
                onChange={(event) =>
                  onChange({ backupReviewerId: event.target.value || null })
                }
                className="mt-1 h-[38px] w-full rounded-xl border border-neutral-200 bg-white px-3 text-[12px] normal-case tracking-normal text-neutral-900 outline-none focus:border-neutral-400"
              >
                <option value="">No backup reviewer</option>
                {reviewerCandidates
                  .filter((employee) => employee.id !== draft.reviewerId)
                  .map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label htmlFor={proposalId} className="text-[10px] uppercase tracking-[0.12em] text-neutral-400">
              Proposal
            </label>
            <BoundedTextInput
              id={proposalId}
              maxLength={INPUT_LIMITS.TITLE}
              value={draft.proposalTitle}
              disabled={!planningWritable}
              onChange={(e) => onChange({ proposalTitle: e.target.value })}
              className={compactInputClass}
            />
          </div>
          <div>
            <label htmlFor={programId} className="text-[10px] uppercase tracking-[0.12em] text-neutral-400">
              Program
            </label>
            <BoundedTextInput
              id={programId}
              maxLength={INPUT_LIMITS.TITLE}
              value={draft.programTitle}
              disabled={!planningWritable}
              onChange={(e) => onChange({ programTitle: e.target.value })}
              className={compactInputClass}
            />
          </div>
          <div>
            <label htmlFor={projectId} className="text-[10px] uppercase tracking-[0.12em] text-neutral-400">
              Project
            </label>
            <BoundedTextInput
              id={projectId}
              maxLength={INPUT_LIMITS.TITLE}
              value={draft.projectTitle}
              disabled={!planningWritable}
              onChange={(e) => onChange({ projectTitle: e.target.value })}
              className={compactInputClass}
            />
          </div>
          <div>
            <label htmlFor={activityId} className="text-[10px] uppercase tracking-[0.12em] text-neutral-400">
              Activity
            </label>
            <BoundedTextInput
              id={activityId}
              maxLength={INPUT_LIMITS.TITLE}
              value={draft.activityTitle}
              disabled={!planningWritable}
              onChange={(e) => onChange({ activityTitle: e.target.value })}
              className={compactInputClass}
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor={scheduleId} className="text-[10px] uppercase tracking-[0.12em] text-neutral-400">
              Activity Schedule
            </label>
            <BoundedTextInput
              id={scheduleId}
              maxLength={INPUT_LIMITS.SHORT_TAG}
              value={draft.activitySchedule}
              disabled={!planningWritable}
              onChange={(e) => onChange({ activitySchedule: e.target.value })}
              className={compactInputClass}
            />
          </div>
        </div>

        <TaskEditorSubtasks task={task} employees={employees} readOnly={saving} />
        <TaskChatLink taskId={task.id} />
        <TaskChatSection
          taskId={task.id}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
        />
      </div>
    </TaskBoardDialog></TaskEditorWorkOwner>
  );
}
