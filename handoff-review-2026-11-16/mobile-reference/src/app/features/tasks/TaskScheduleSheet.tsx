import { useState } from "react";
import {
  Button,
  Choice,
  DateField,
  ErrorState,
  Field,
  Loading,
  Notice,
  Sheet,
} from "../../components/ui";
import { useAction } from "../../shared/useAction";
import { useToast } from "../../components/ui/Toast";
import { formDraftKey, useRetainedDraft } from "../../shared/formDraftMemory";
import { PublicMessageError, isDeterministicRejection } from "../../shared/userMessages";
import { useFacts } from "../../shared/useFacts";
import { useAuth } from "../authentication";
import { fetchVisibleTasks } from "./services";
import type { Task } from "../../../core/web/app/features/tasks/taskTypes";
import { taskDatePatch, taskTimeline } from "./taskDates";
import { canEditProjectTask } from "../../../core/web/app/features/project-table/selectors";
import { fetchProject } from "../projects/services";
import {
  buildTaskPrerequisiteOptions,
  taskPrerequisiteSelectionError,
} from "./taskPrerequisites";
import { supabase } from "../../../platform/supabase";
import { nativeWindow } from "../../../platform/webRuntime";
import { isAppointedOfficeHead } from "../../../core/web/app/shared/officeAuthority";
import { detailEditError, detailEditingUnavailable, fetchDetailEditState } from "./workDetailEditing";
export function TaskScheduleSheet({
  task,
  onClose,
  onSaved,
}: {
  task: Task;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { profile, organization } = useAuth(),
    { toast } = useToast(),
    action = useAction();
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [formDraft, updateFormDraft, clearFormDraft] = useRetainedDraft(
    formDraftKey(profile?.id, "task-schedule:" + task.id),
    true,
    () => ({
      timeline: taskTimeline(task),
      dependencies: task.dependencyIds || [],
      changeReason: "",
    }), { restoreOnOpen: false },
  );
  const { timeline: draft, dependencies } = formDraft;
  const editState = useFacts(`task-schedule-edit:${profile?.id}:${task.id}:${task.updatedAt}`,
    () => fetchDetailEditState(task.id), !!profile?.id);
  const editReady = !editState.loading && !editState.error && !editState.stale;
  const close = () => {
    if (action.busy) return;
    action.clear();
    onClose();
  };
  const tasks = useFacts(
    "task-planning:" + profile?.id + ":" + task.id,
    fetchVisibleTasks,
  );
  const projectDates = useFacts(
    "task-schedule-project:" + task.linkedProjectId,
    () => fetchProject(task.linkedProjectId!),
    !!task.linkedProjectId,
  );
  const projectStart = projectDates.data?.startDate?.slice(0, 10);
  const projectDue = projectDates.data?.targetDate?.slice(0, 10);
  const head = isAppointedOfficeHead(
      profile,
      organization ? [organization] : [],
    ),
    allowed = canEditProjectTask(task, head, profile?.org_id || "");
  const choices = (tasks.data || []).filter(
    (t) =>
      t.id !== task.id &&
      t.linkedProjectId === task.linkedProjectId &&
      t.orgId === task.orgId &&
      !t.archivedAt &&
      t.status !== "cancelled",
  );
  const originalDates = taskTimeline(task);
  const livePrerequisiteError = tasks.data
    ? taskPrerequisiteSelectionError({
        allTasks: tasks.data,
        visibleProjectIds: new Set(
          tasks.data
            .filter(
              (t) =>
                t.linkedProjectId === task.linkedProjectId &&
                t.orgId === task.orgId,
            )
            .map((t) => t.id),
        ),
        taskId: task.id,
        candidateIds: dependencies,

        originalIds: task.dependencyIds || [],
      })
    : "";
  const save = () =>
    action.run(async () => {
      if (unconfirmed) throw new PublicMessageError("The previous save could not be confirmed. Close this form and check Activity before trying again.");
      if (!allowed)
        throw new PublicMessageError(
          "Current Office Head access is required to plan this task.",
        );
      if (!tasks.data || tasks.error)
        throw new PublicMessageError("Refresh the prerequisite tasks before saving.");
      const session = await supabase.auth.getSession();
      if (session.error || !profile?.id || session.data.session?.user.id !== profile.id)
        throw new PublicMessageError("Sign in again to save this task.");
      const currentPolicy = await fetchDetailEditState(task.id);
      if (task.updatedAt && Date.parse(currentPolicy.updated_at || "") !== task.updatedAt)
        throw new PublicMessageError("This task changed. Close the form and refresh before editing it again.");
      const policyError = detailEditError(currentPolicy, {
        planning: draft.start !== originalDates.start ||
          JSON.stringify([...dependencies].sort()) !== JSON.stringify([...(task.dependencyIds || [])].sort()),
        due: draft.end !== originalDates.end,
        reason: formDraft.changeReason,
      });
      if (policyError) throw new PublicMessageError(policyError);
      const datesChanged =
        draft.start !== originalDates.start || draft.end !== originalDates.end;
      if (datesChanged && task.linkedProjectId) {
        const project = await fetchProject(task.linkedProjectId);
        const startBound = project.startDate?.slice(0, 10);
        const dueBound = project.targetDate?.slice(0, 10);
        if (
          !startBound ||
          !dueBound ||
          !draft.start ||
          !draft.end ||
          draft.start < startBound ||
          draft.end > dueBound ||
          draft.end < draft.start
        )
          throw new PublicMessageError("Choose task dates within the project schedule.");
      }
      const visible = new Set(tasks.data.map((t) => t.id));
      const prerequisiteIssue = taskPrerequisiteSelectionError({
        allTasks: tasks.data,
        visibleProjectIds: visible,
        taskId: task.id,
        candidateIds: dependencies,

        originalIds: task.dependencyIds || [],
      });
      if (prerequisiteIssue) throw new PublicMessageError(prerequisiteIssue);
      const patch = {
        ...taskDatePatch(originalDates, draft),
        ...(JSON.stringify([...dependencies].sort()) !== JSON.stringify([...(task.dependencyIds || [])].sort())
          ? { dependency_ids: dependencies } : {}),
        ...(draft.end !== originalDates.end ? { change_reason: formDraft.changeReason?.trim() || "" } : {}),
      };
      setUnconfirmed(true);
      const result = await supabase.rpc("phase3_patch_task", { p_task_id: task.id, p_patch: patch });
      if (result.error) {
        if (isDeterministicRejection(result.error)) { setUnconfirmed(false); throw result.error; }
        throw new PublicMessageError("The save could not be confirmed. Close this form and check the task and Activity before trying again.");
      }
      if (result.data?.id !== task.id)
        throw new PublicMessageError("The save could not be confirmed. Close this form and check the task and Activity before trying again.");
      clearFormDraft();
      toast("Task plan saved.", "success");
      nativeWindow.dispatchEvent({ type: "eflow:work-updated" });
      await onSaved();
      onClose();
    });
  return (
    <Sheet
      actionError={action.error}
      open
      title="Dates and prerequisites"
      description={task.title}
      onClose={close}
      busy={action.busy}
      footer={
        <Button
          busy={action.busy}
          disabled={unconfirmed || !allowed || !editReady || !editState.data?.details || tasks.loading || !!tasks.error}
          onPress={() => void save()}
        >
          Save task plan
        </Button>
      }
    >
      {(!editState.data || editState.error) && <Notice>{detailEditingUnavailable}</Notice>}
      {editState.data?.started && <Notice>Work has started. Start date and prerequisites are locked. An authorized reschedule needs a reason.</Notice>}
      <DateField
        label="Start date"
        value={draft.start}
        min={projectStart}
        max={draft.end || projectDue}
        onChange={(start) =>
          updateFormDraft((old) => ({
            ...old,
            timeline: { ...old.timeline, start },
          }))
        }
        disabled={action.busy || unconfirmed || !allowed || !editReady || !editState.data?.planning}
      />
      <DateField
        label="Due date"
        value={draft.end}
        min={draft.start || projectStart}
        max={projectDue}
        onChange={(end) =>
          updateFormDraft((old) => ({
            ...old,
            timeline: { ...old.timeline, end },
          }))
        }
        disabled={action.busy || unconfirmed || !allowed || !editReady || !editState.data?.due}
      />
      {editState.data?.started && draft.end !== originalDates.end &&
        <Field label="Reason for changing the due date" required multiline maxLength={1000}
          value={formDraft.changeReason || ""} onChangeText={(changeReason) => updateFormDraft({ changeReason })}
          editable={!action.busy && !unconfirmed && allowed && editState.data.due} />}
      <Notice>
        Prerequisites must be completed before dependent work can proceed.
      </Notice>
      {tasks.loading ? (
        <Loading layout="verification" label="Loading current prerequisites…" />
      ) : tasks.error ? (
        <ErrorState error={tasks.error} retry={() => void tasks.refresh()} />
      ) : (
        <Choice
          label="Prerequisite tasks"
          multiple
          value={dependencies}
          error={livePrerequisiteError}
          onChange={(next) => updateFormDraft({ dependencies: next })}
          disabled={action.busy || unconfirmed || !allowed || !editReady || !editState.data?.planning}
          options={buildTaskPrerequisiteOptions({
            choices,
            allTasks: tasks.data ?? [],
            selectedIds: dependencies,

          })}
        />
      )}
    </Sheet>
  );
}
