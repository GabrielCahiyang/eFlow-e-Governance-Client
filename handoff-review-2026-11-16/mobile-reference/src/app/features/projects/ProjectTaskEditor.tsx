import { useState } from "react";
import { supabase } from "../../../platform/supabase";
import { nativeWindow } from "../../../platform/webRuntime";
import {
  Button,
  Choice,
  DateField,
  Field,
  Notice,
  Sheet,
} from "../../components/ui";
import { useAction } from "../../shared/useAction";
import { useToast } from "../../components/ui/Toast";
import {
  clearFormDraft,
  formDraftKey,
  useRetainedDraft,
} from "../../shared/formDraftMemory";
import { useFacts } from "../../shared/useFacts";
import {
  PublicMessageError,
  isDeterministicRejection,
} from "../../shared/userMessages";
import { fetchProjectGroups } from "../../../core/web/app/features/project-table/services/workspaceService";
import type { ProjectGroup } from "../../../core/web/app/features/project-table/types";
import { taskDatePatch, taskTimeline } from "../tasks/taskDates";
import type { Task } from "../../../core/web/app/features/tasks/taskTypes";
import { rowToTask } from "../../../core/web/app/features/tasks/services/taskMapper";
import { fetchProject, fetchProjectAnalysisTasks } from "./services";
import { projectEditorAccess, requireProjectSetup } from "./projectAccess";
import { workPriorityOptions } from "../tasks/workPriorityOptions";
import { detailEditError, detailEditingUnavailable, fetchDetailEditState } from "../tasks/workDetailEditing";
import {
  buildTaskPrerequisiteOptions,
  taskPrerequisiteSelectionError,
} from "../tasks/taskPrerequisites";

type Scope = { actor: string; project: string; office: string; task?: Task; canDelegateEdit?: boolean };

async function taskStructureAccess({ actor, project, office, task, canDelegateEdit }: Scope) {
  const [scoped, managesProject, managesTask] = await Promise.all([
    supabase.rpc("can_create_scoped_work", {
      target_org: office,
      caller_id: actor,
    }),
    supabase.rpc("can_manage_project", {
      target_project: project,
      caller_id: actor,
    }),
    task
      ? supabase.rpc("can_manage_task", {
          target_task: task.id,
          caller_id: actor,
        })
      : Promise.resolve({ data: true, error: null }),
  ]);
  const error = scoped.error || managesProject.error || managesTask.error;
  if (error) throw error;
  if (scoped.data === true && managesProject.data === true && managesTask.data === true)
    return "head" as const;
  if (task && canDelegateEdit && await projectEditorAccess(project, office, actor, task))
    return "delegated" as const;
  return null;
}

export function useTaskStructure(scope: Scope, enabled: boolean) {
  return useFacts(
    JSON.stringify([
      "task-structure",
      scope.actor,
      scope.project,
      scope.office,
      scope.task?.id,
      scope.task?.updatedAt,
      scope.task?.status,
      scope.canDelegateEdit,
    ]),
    () => taskStructureAccess(scope),
    enabled,
  );
}

export function ProjectTaskEditor({
  scope,
  groups,
  onClose,
  onCreated,
  onSaved,
}: {
  scope: Scope;
  groups: ProjectGroup[];
  onClose: () => void;
  onCreated?: (task: { id: string; title: string }) => void;
  onSaved: () => Promise<unknown>;
}) {
  const [task] = useState(scope.task);
  const { toast } = useToast();
  const [createdTaskId, setCreatedTaskId] = useState<string>();
  const draftKey = formDraftKey(
    scope.actor,
    "project-task-editor:" + scope.project + ":" + (task?.id ?? "new"),
  );
  const [draft, updateDraft, clearDraft] = useRetainedDraft(
    draftKey,
    true,
    () => ({
      title: task?.title ?? "",
      priority: task?.priority ?? "medium",
      changeReason: "",
      dependencies: task?.dependencyIds ?? [],
      timeline: task ? taskTimeline(task) : { start: "", end: "" },
      group:
        (groups.find((item) => item.isDefault) || groups[0])?.id ?? "",
    }), { restoreOnOpen: !task },
  );
  const { title, priority, dependencies, timeline, group } = draft;
  const editState = useFacts(
    `task-detail-edit:${scope.actor}:${task?.id}:${task?.updatedAt}`,
    () => fetchDetailEditState(task!.id),
    !!task,
  );
  const editReady = !editState.loading && !editState.error && !editState.stale;
  const detailsAllowed = !task || (editReady && editState.data?.details === true);
  const dependencyChanged = JSON.stringify([...dependencies].sort()) !==
    JSON.stringify([...(task?.dependencyIds ?? [])].sort());
  const structure = useTaskStructure(scope, !!task);
  const showPrerequisites = !task || (structure.data === "head" && !structure.error);
  const prerequisiteFacts = useFacts(
    `task-prerequisites:${scope.actor}:${scope.project}:${task?.id}`,
    () => fetchProjectAnalysisTasks(scope.project),
    showPrerequisites,
  );
  const prerequisiteOptions = (prerequisiteFacts.data ?? []).filter((item) =>
    item.id !== task?.id && item.linkedProjectId === scope.project &&
    ((!item.archivedAt && item.status !== "cancelled") || task?.dependencyIds?.includes(item.id)),
  );
  const restrictedPrerequisites = (task?.dependencyIds ?? []).filter((id) =>
    !prerequisiteOptions.some((item) => item.id === id),
  ).length;
  const projectDates = useFacts("task-project-dates:" + scope.project,
    () => fetchProject(scope.project), true);
  const projectStart = projectDates.data?.startDate?.slice(0, 10);
  const projectDue = projectDates.data?.targetDate?.slice(0, 10);
  const today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
  const defaultStart =
    !task && projectStart && projectDue && projectStart < today && projectDue >= today
      ? today
      : !task
        ? projectStart
        : undefined;
  const start = timeline.start || defaultStart || "";
  const due = timeline.end || (!task ? projectDue : undefined) || "";
  const originalDates = task ? taskTimeline(task) : { start: "", end: "" };
  const livePrerequisiteError = prerequisiteFacts.data
    ? taskPrerequisiteSelectionError({
        allTasks: prerequisiteFacts.data,
        visibleProjectIds: new Set(
          prerequisiteFacts.data
            .filter((item) => item.linkedProjectId === scope.project)
            .map((item) => item.id),
        ),
        taskId: task?.id,
        candidateIds: dependencies,

        originalIds: task?.dependencyIds ?? [],
      })
    : "";
  const [unconfirmed, setUnconfirmed] = useState(false);
  const action = useAction();
  const close = () => {
    if (action.busy) return;
    if (createdTaskId) clearDraft();
    action.clear();
    onClose();
  };

  const save = () =>
    void action.run(async () => {
      const name = title.trim();
      if (!name || name.length > 300)
        throw new PublicMessageError(
          "Enter a task title of up to 300 characters.",
        );
      const session = await supabase.auth.getSession();
      if (session.error || session.data.session?.user.id !== scope.actor)
        throw new PublicMessageError("Sign in again to save this task.");
      const project = await fetchProject(scope.project);
      const editable = project.status === "active" || (!!task && project.status === "on_hold");
      const access = editable ? await taskStructureAccess(scope) : null;
      if (!access || (access === "delegated" && project.sourceCollaborationDraftId))
        throw new PublicMessageError(
          "Current project access does not allow this change.",
        );
      await requireProjectSetup(scope.project);
      if ((!task || priority !== task.priority) &&
          !workPriorityOptions.some((option) => option.value === priority))
        throw new PublicMessageError("Choose Low, Medium or High priority.");
      if (dependencyChanged || (dependencies.length > 0 && start !== originalDates.start)) {
        if (dependencyChanged && access !== "head")
          throw new PublicMessageError("Current Head access is required to change task prerequisites.");
        const currentTasks = await fetchProjectAnalysisTasks(scope.project);
        const visible = new Set(currentTasks.filter((item) => item.linkedProjectId === scope.project).map((item) => item.id));
        if (dependencyChanged && (task?.dependencyIds ?? []).some((id) => !visible.has(id)))
          throw new PublicMessageError("Choose available prerequisites in this project without a circular dependency.");
        const prerequisiteIssue = taskPrerequisiteSelectionError({
          allTasks: currentTasks,
          visibleProjectIds: visible,
          taskId: task?.id,
          candidateIds: dependencies,

          originalIds: task?.dependencyIds ?? [],
        });
        if (prerequisiteIssue) throw new PublicMessageError(prerequisiteIssue);
      }
      const datesChanged = !task || start !== originalDates.start || due !== originalDates.end;
      if (datesChanged && (!project.startDate || !project.targetDate || !start || !due ||
        start < project.startDate.slice(0, 10) || due > project.targetDate.slice(0, 10) || due < start))
        throw new PublicMessageError("Choose task dates within the project schedule.");
      if (!task && start < today)
        throw new PublicMessageError("Choose today or a future start date.");
      if (!task && due < today)
        throw new PublicMessageError("Choose today or a future due date.");
      if (
        !task &&
        !(await fetchProjectGroups(scope.project)).some(
          (item) => item.id === group,
        )
      )
        throw new PublicMessageError("Choose a current group in this project.");

      if (task) {
        const current = await supabase
          .from("tasks")
          .select("*")
          .eq("id", task.id)
          .is("deleted_at", null)
          .maybeSingle();
        if (current.error) throw current.error;
        const latest = current.data ? rowToTask(current.data) : undefined;
        if (
          !latest ||
          latest.linkedProjectId !== scope.project ||
          latest.orgId !== scope.office ||
          latest.updatedAt !== task.updatedAt ||
          latest.archivedAt ||
          (access === "delegated" && (latest.proposedOfficeIdentityId || latest.status === "for_review")) ||
          ["for_review", "completed", "cancelled"].includes(latest.status)
        )
          throw new PublicMessageError(
            "This task changed. Close the form and refresh before editing it again.",
          );
        const policy = await fetchDetailEditState(task.id);
        const policyError = detailEditError(policy, {
          planning: start !== originalDates.start || dependencyChanged,
          due: due !== originalDates.end,
          reason: draft.changeReason,
        });
        if (policyError) throw new PublicMessageError(policyError);
      }
      let schedule = {};
      if (task && timeline) {
        const original = taskTimeline(task);
        if (
          timeline.start !== original.start ||
          timeline.end !== original.end
        ) {
          try {
            schedule = taskDatePatch(original, timeline);
          } catch (error) {
            throw new PublicMessageError(
              error instanceof Error ? error.message : "Check the task dates.",
            );
          }
        }
      }

      // The Web create RPC has no request ID. Once a write is attempted, only
      // a confirmed rejection permits another submission from this editor.
      setUnconfirmed(true);
      const result = task
        ? await supabase.rpc(access === "delegated" ? "edit_selected_project_task" : "phase3_patch_task", {
            p_task_id: task.id,
            p_patch: {
              title: name, ...schedule,
              ...(priority !== task.priority ? { priority } : {}),
              ...(dependencyChanged ? { dependency_ids: dependencies } : {}),
              ...(due !== originalDates.end ? { change_reason: draft.changeReason?.trim() || "" } : {}),
            },
          })
        : await supabase.rpc("m7_create_scheduled_task", {
            p_project: scope.project,
            p_group: group,
            p_title: name,
            p_start: start,
            p_due: due,
          });
      if (result.error) {
        const code = result.error.code || "";
        if (
          isDeterministicRejection(result.error) ||
          /^(22|23)/.test(code) ||
          ["42501", "42883", "PGRST202", "P0001"].includes(code)
        ) {
          setUnconfirmed(false);
          if (code === "42883" || code === "PGRST202")
            throw new PublicMessageError(
              "Task editing is unavailable. The project workspace service is missing.",
            );
          throw result.error;
        }
        throw new PublicMessageError(
          "The save could not be confirmed. Close this form and check the task list before trying again.",
        );
      }
      if (
        !result.data ||
        result.data.linked_project_id !== scope.project ||
        typeof result.data.id !== "string" ||
        (task && result.data.id !== task.id)
      )
        throw new PublicMessageError(
          "The save could not be confirmed. Close this form and check the task list before trying again.",
        );
      if (!task) {
        setCreatedTaskId(result.data.id);
        clearFormDraft(draftKey);
        if (priority !== "medium" || dependencyChanged) {
          try {
            const currentSession = await supabase.auth.getSession();
            if (currentSession.error || currentSession.data.session?.user.id !== scope.actor)
              throw new Error("The active account changed.");
            const update = await supabase.rpc("phase3_patch_task", {
              p_task_id: result.data.id,
              p_patch: {
                ...(priority !== "medium" ? { priority } : {}),
                ...(dependencyChanged ? { dependency_ids: dependencies } : {}),
              },
            });
            const savedDependencies = update.data?.dependency_ids;
            if (update.error || update.data?.id !== result.data.id ||
                (priority !== "medium" && update.data?.priority !== priority) ||
                (dependencyChanged && (!Array.isArray(savedDependencies) ||
                  JSON.stringify([...savedDependencies].sort()) !== JSON.stringify([...dependencies].sort()))))
              throw new Error("Task planning fields could not be confirmed.");
          } catch {
            nativeWindow.dispatchEvent({ type: "eflow:work-updated" });
            await Promise.allSettled([onSaved()]);
            throw new PublicMessageError("The task was created. Open Edit task to check its priority and prerequisites.");
          }
        }
        clearDraft();
      }
      clearDraft();
      toast(task ? "Task saved." : "Task added.", "success");
      nativeWindow.dispatchEvent({ type: "eflow:work-updated" });
      onClose();
      if (!task && typeof result.data.id === "string") {
        onCreated?.({ id: result.data.id, title: title.trim() });
      }
      await onSaved();
    });
  return (
    <Sheet
      actionError={action.error ?? projectDates.error}
      open
      title={task ? "Edit task" : "Add task"}
      onClose={close}
      busy={action.busy}
    >
      {task && editState.data?.started && <Notice>Work has started. You can correct its name and priority. Start date, prerequisites and structure are locked. Rescheduling requires supervising authority and a reason.</Notice>}
      <Field
        label="Task name"
        required
        value={title}
        onChangeText={(next) => updateDraft({ title: next })}
        maxLength={300}
        editable={!action.busy && !unconfirmed && detailsAllowed}
      />
      <Choice
        label="Priority"
        value={priority}
        searchable={false}
        options={workPriorityOptions}
        onChange={(next) => updateDraft({ priority: next })}
        disabled={action.busy || unconfirmed || !detailsAllowed}
      />
      {!task && <Notice>Start and due dates default to the project schedule.</Notice>}
      {task && (!editState.data || editState.error) && <Notice>{detailEditingUnavailable}</Notice>}
      {timeline && (
        <>
          <DateField
            label="Start date"
            value={start}
            min={projectStart}
            max={due || projectDue}
            onChange={(next) =>
              updateDraft((old) => ({
                ...old,
                timeline: { ...old.timeline, start: next },
              }))
            }
            disabled={action.busy || unconfirmed || (task ? !detailsAllowed || !editState.data?.planning : !projectStart || !projectDue)}
          />
          <DateField
            label="Due date"
            value={due}
            min={start || projectStart}
            max={projectDue}
            onChange={(next) =>
              updateDraft((old) => ({
                ...old,
                timeline: { ...old.timeline, end: next },
              }))
            }
            disabled={action.busy || unconfirmed || (task ? !detailsAllowed || !editState.data?.due : !projectStart || !projectDue)}
          />
        </>
      )}
      {task && due !== originalDates.end && editState.data?.started && (
        <Field label="Reason for changing the due date" required multiline maxLength={1000}
          value={draft.changeReason || ""} onChangeText={(changeReason) => updateDraft({ changeReason })}
          editable={!action.busy && !unconfirmed && !!editState.data?.due} />
      )}
      {!task && (
        <Choice
          label="Group"
          required
          options={groups.map((item) => ({
            value: item.id,
            label: item.title,
          }))}
          value={group}
          onChange={(next) => updateDraft({ group: next })}
          disabled={action.busy || unconfirmed}
        />
      )}
      {showPrerequisites && (
        <>
          <Choice
            label="Prerequisite tasks"
            multiple
            value={dependencies}
            placeholder="No prerequisites selected"
            options={buildTaskPrerequisiteOptions({
              choices: prerequisiteOptions,
              allTasks: prerequisiteFacts.data ?? [],
              selectedIds: dependencies,

            })}
            error={livePrerequisiteError}
            onChange={(next) => updateDraft({ dependencies: next })}
            disabled={action.busy || unconfirmed || (!!task && (!detailsAllowed || !editState.data?.planning)) || prerequisiteFacts.loading ||
              !!prerequisiteFacts.error || restrictedPrerequisites > 0}
          />
          {!!prerequisiteFacts.error && <Notice>Task prerequisites are unavailable.</Notice>}
          {!prerequisiteFacts.loading && !prerequisiteFacts.error && restrictedPrerequisites > 0 &&
            <Notice>{restrictedPrerequisites} restricted prerequisite(s). The list is read-only.</Notice>}
        </>
      )}
      {task && structure.data === "delegated" && (task.dependencyIds?.length ?? 0) > 0 && (
        <Notice>See the Task details for its prerequisites. An authorized Head can edit them.</Notice>
      )}
      <Button
        busy={action.busy}
        disabled={!createdTaskId && (unconfirmed || !detailsAllowed || !title.trim() || (!task && !group))}
        onPress={createdTaskId ? close : save}
      >
        {createdTaskId ? "Close task form" : task ? "Save task" : "Add task"}
      </Button>
    </Sheet>
  );
}
