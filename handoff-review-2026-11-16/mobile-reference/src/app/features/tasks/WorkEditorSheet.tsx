import { subtaskDateLimits } from "../../../core/web/app/features/nested-work/selectors/subtaskDates";
import { Text } from "../../components/ui/Typography";
import { useEffect, useRef, useState } from "react";
import ArrowDown from "lucide-react-native/icons/arrow-down";
import ArrowUp from "lucide-react-native/icons/arrow-up";
import {
  Button,
  Choice,
  DateField,
  ErrorState,
  Loading,
  Field,
  Notice,
  Row,
  Sheet,
  SheetModalHost,
  colors,
} from "../../components/ui";
import {
  PostCreateStaffingPromptSheet,
  resolvePostCreateSubtaskStaffing,
  type PostCreateStaffingTarget,
} from "./postCreateStaffingPrompt";
import { useAction } from "../../shared/useAction";
import { useToast } from "../../components/ui/Toast";
import { confirmAction } from "../../shared/confirm";
import {
  clearFormDraft,
  formDraftKey,
  readFormDraft,
  writeFormDraft,
} from "../../shared/formDraftMemory";
import { useAuth } from "../authentication";
import {
  isNativeWorkRecovery,
  recoverWorkRequest,
  workRecoveryCanDiscard,
} from "./workRecovery";
import {
  captureWorkEditorBaseline,
  freezeWorkEditorRequest,
  workEditorCapability,
  workEditorDateError,
  sameWorkEditorScope,
} from "../../../core/web/app/features/nested-work/selectors/editorDraft";
import {
  captureStaffingBaseline,
  staffingDraftError,
  createStaffingRequest,
  staffingCapabilities,
} from "../../../core/web/app/features/nested-work/selectors/staffing";
import { compatibilityWorkWorkerIds, displayedWorkContributorIds } from "../../../core/web/app/features/nested-work/selectors/people";
import {
  fetchWorkImpact,
  fetchWorkTree,
  saveWorkTree,
} from "../../../core/web/app/features/nested-work/services/workTreeService";
import { reparentChoices } from "../../../core/web/app/features/nested-work/selectors/tree";
import type {
  WorkNode,
  WorkTreeSnapshot,
  WorkRequest,
} from "../../../core/web/app/features/nested-work/types";
import {
  WorkRequestFailure,
  type WorkEdit,
  type WorkEditorFields,
} from "../../../core/web/app/features/nested-work/types/editor";
import { draftStore } from "../../../platform/draftStore";
import { personalReviewAllowed } from "./branchInspector";
import {
  isProjectLeadSubtaskPlanningBlocked,
  isSubtaskLeadOrContributor,
  taskStaffingCapability,
} from "./workPermissions";
import {
  nodeSchedule,
  subtaskScheduleError,
  workScheduleToday,
} from "./subtaskSchedule";
import { fetchTaskById } from "../../../core/web/app/features/tasks/services/taskRealtimeService";
import { fetchProject } from "../projects/services";
import { PublicMessageError } from "../../shared/userMessages";
import { useFacts } from "../../shared/useFacts";
import { workEditorReceiptRetryAllowed } from "../../../core/web/app/features/nested-work/selectors/editorDraft";
import { workPriorityOptions } from "./workPriorityOptions";
import { hiddenSubtasksMessage, subtasksVisibleForActor } from "./subtaskVisibility";
import { detailEditError, readDetailEditState } from "./workDetailEditing";
import {
  buildSubtaskPrerequisiteOptions,
  canCreateSubtaskDependencies,
  canEditSubtaskDependencies,
  legacySiblingDependencyIds,
  subtaskDependencies,
  subtaskDependencySelectionError,
  subtaskPrerequisiteSiblings,
  supportsSubtaskDependencies,
  type DependencyNode,
} from "./subtaskDependencies";

type NativeEditorFields = WorkEditorFields & { priority?: string; dependencies?: string[] };

/** Applies selected prerequisite subtasks right after creation because SQL forbids them on insert. */
async function applyCreatedDependencies(
  receipt: WorkTreeSnapshot,
  createdId: string,
  dependencyIds: readonly string[] | undefined,
  actorId: string,
): Promise<{ receipt: WorkTreeSnapshot; warning?: string }> {
  const ids = [...new Set(dependencyIds ?? [])].sort();
  const createdNode = receipt.nodes.find((item) => item.id === createdId) as DependencyNode | undefined;
  if (!supportsSubtaskDependencies(receipt) || !createdNode) {
    return ids.length
      ? { receipt, warning: "The subtask was created, but prerequisites could not be saved. Open Edit subtask to set them." }
      : { receipt };
  }
  if (!canEditSubtaskDependencies(receipt, createdNode)) {
    return ids.length
      ? { receipt, warning: "The subtask was created, but prerequisites could not be set with your current access. Open Edit subtask to check." }
      : { receipt };
  }
  const editBaseline = captureWorkEditorBaseline(
    receipt,
    { command: "edit", node: createdNode },
    actorId,
    createdId,
  );
  const baseRequest = freezeWorkEditorRequest(
    editBaseline,
    editBaseline.fields,
    crypto.randomUUID(),
  );
  const depRequest: WorkRequest = {
    ...baseRequest,
    payload: { ...baseRequest.payload, dependency_ids: ids },
  };
  try {
    return { receipt: await saveWorkTree(receipt.root.id, depRequest) };
  } catch (error) {
    if (!ids.length) return { receipt };
    const reason = error instanceof WorkRequestFailure && error.kind === "confirmed_failure"
      ? error.message
      : "";
    return {
      receipt,
      warning: reason
        ? `The subtask was created, but prerequisites could not be saved: ${reason} Open Edit subtask to set them.`
        : "The subtask was created. Open Edit subtask to confirm or set its prerequisites.",
    };
  }
}

export function workEditorActionLabel(
  command: WorkEdit["command"],
  progress?: number,
): string {
  switch (command) {
    case "create":
      return "Add subtask";
    case "edit":
      return "Save subtask";
    case "delete":
      return "Delete subtask";
    case "staff":
    case "root_lead":
    case "contributors":
      return "Save team";
    case "move":
      return "Move subtask";
    case "order":
      return "Save order";
    case "progress":
      return "Post update";
    case "submit":
      return "Submit for review";
    case "review":
      return progress === 100 ? "Approve subtask" : "Request changes";
  }
}

export function workEditorSuccessMessage(
  command: WorkEdit["command"],
  progress?: number,
): string {
  switch (command) {
    case "create":
      return "Subtask added.";
    case "edit":
      return "Subtask saved.";
    case "delete":
      return "Subtask deleted.";
    case "staff":
    case "contributors":
    case "root_lead":
      return "Team updated.";
    case "move":
      return "Subtask moved.";
    case "order":
      return "Subtask order updated.";
    case "progress":
      return "Work update posted.";
    case "submit":
      return "Subtask submitted for review.";
    case "review":
      return progress === 100 ? "Subtask approved." : "Changes requested.";
  }
}

export function WorkEditorSheet(
  props: Omit<
    Parameters<typeof WorkEditorForm>[0],
    "rejectedCreate" | "onPostCreateHandoff"
  > & {
    skipRecovery?: boolean;
    promptPostCreateStaffing?: boolean;
  },
) {
  const { profile } = useAuth(),
    { toast } = useToast(),
    { data, readOnly = false } = props,
    action = useAction();
  const [recoveredDone, setRecoveredDone] = useState(false);
  const [handoff, setHandoff] = useState<{
    stage: "prompt" | "staff";
    target: Extract<PostCreateStaffingTarget, { kind: "subtask" }>;
  }>();
  const scopeKey = `${data.root.id}:${props.edit.command}:${props.edit.node?.id || props.edit.parent || (props.edit.root ? "root" : "new")}`;
  useEffect(() => {
    setHandoff(undefined);
  }, [scopeKey]);
  const [rejectedCreate, setRejectedCreate] = useState<{
    fields: NativeEditorFields;
    error: unknown;
    start?: string;
  }>();
  const context = {
    actorId: profile?.id || null,
    rootId: data.root.id,
    projectId: data.root.project,
    officeId: data.root.office,
    kind: data.root.kind,
    revision: data.revision,
    readOnly,
  };
  const retained = useFacts(
    `work-recovery:${profile?.id}:${data.root.id}`,
    async () => {
      const saved = await draftStore.get<unknown>(
        profile!.id,
        "work." + data.root.id,
      );
      return isNativeWorkRecovery(saved, context) ? saved : null;
    },
    !!profile && !props.skipRecovery && !handoff,
  );
  const needsDates = ["create", "edit"].includes(props.edit.command) &&
    data.root.kind === "office" && !data.root.scheduleBounds && !!workScheduleToday(data);
  const taskDates = useFacts("work-editor-schedule:" + data.root.id, async () => {
    const [task, project] = await Promise.all([
      fetchTaskById(data.root.id),
      data.root.project
        ? Promise.resolve().then(() => fetchProject(data.root.project!)).catch(() => undefined)
        : Promise.resolve(undefined),
    ]);
    if (!task) throw new PublicMessageError("The parent task dates could not be loaded.");
    const projectId =
      typeof task.linked_project_id === "string"
        ? task.linked_project_id
        : data.root.project;
    const resolvedProject =
      project || !projectId
        ? project
        : await Promise.resolve().then(() => fetchProject(projectId)).catch(() => undefined);
    return {
      projectStart: resolvedProject?.startDate?.slice(0, 10) || undefined,
      projectDue: resolvedProject?.targetDate?.slice(0, 10) || undefined,
      taskStart: typeof task.start_date === "string" ? task.start_date : undefined,
      taskDue: data.root.due ?? undefined,
    };
  }, needsDates && !handoff && (!retained.data || !!rejectedCreate));

  const content = handoff ? (
    handoff.stage === "prompt" ? (
      <PostCreateStaffingPromptSheet
        kind="subtask"
        title={handoff.target.title}
        onChoosePeople={() =>
          setHandoff({ stage: "staff", target: handoff.target })
        }
        onClose={props.onClose}
      />
    ) : (
      <WorkEditorForm
        key={`post-create-staff:${handoff.target.node.id}`}
        data={handoff.target.tree}
        edit={{ command: "staff", node: handoff.target.node }}
        projectStatus={props.projectStatus}
        projectLeadId={props.projectLeadId}
        readOnly={props.readOnly}
        onClose={props.onClose}
        onSaved={props.onSaved}
      />
    )
  ) : !props.skipRecovery && !rejectedCreate && retained.loading ? (
      <Sheet open title="Checking saved work changes" onClose={props.onClose}>
        <Loading
          layout="verification"
          label="Checking the original work request…"
        />
      </Sheet>
  ) : !props.skipRecovery && !rejectedCreate && retained.error ? (
      <Sheet
        open
        title="Saved work changes unavailable"
        onClose={props.onClose}
      >
        <ErrorState
          error={retained.error}
          retry={() => void retained.refresh()}
        />
      </Sheet>
  ) : !props.skipRecovery && !rejectedCreate && retained.data ? (() => {
    const saved = retained.data;
    const canCheck = workEditorReceiptRetryAllowed(data, context);
    const rejected = workRecoveryCanDiscard(action.error);
    return (
      <Sheet
        actionError={action.error}
        open
        title="Check previous changes"
        description={saved.fields.title || undefined}
        onClose={props.onClose}
        busy={action.busy}
        footer={
          <>
            <Button
              busy={action.busy}
              disabled={!recoveredDone && (!canCheck || rejected)}
              onPress={() => {
                if (recoveredDone) {
                  props.onClose();
                  return;
                }
                void action.run(async () => {
                  let receipt: WorkTreeSnapshot;
                  try {
                    receipt = await recoverWorkRequest(
                      data.root.id,
                      saved.request,
                      profile!.id,
                    );
                  } catch (error) {
                    if (
                      saved.request.command !== "create" ||
                      props.edit.command !== "create" ||
                      (props.edit.parent ?? "") !== saved.fields.parent ||
                      !workRecoveryCanDiscard(error)
                    ) throw error;
                    await draftStore.remove(profile!.id, "work." + data.root.id);
                    const start = saved.request.payload.start;
                    setRejectedCreate({
                      fields: {
                        ...saved.fields,
                        priority: workPriorityOptions.find((option) =>
                          option.value === saved.request.payload.priority)?.value,
                      },
                      error,
                      start: typeof start === "string" ? start : undefined,
                    });
                    return;
                  }
                  await draftStore.remove(profile!.id, "work." + data.root.id);
                  if (saved.request.command === "create") {
                    const followUp = await applyCreatedDependencies(
                      receipt,
                      saved.baseline.createdId,
                      saved.fields.dependencies,
                      profile!.id,
                    );
                    receipt = followUp.receipt;
                    if (followUp.warning) {
                      setRecoveredDone(true);
                      await Promise.allSettled([props.onSaved(receipt)]);
                      throw new PublicMessageError(followUp.warning);
                    }
                  }
                  toast(
                    workEditorSuccessMessage(
                      saved.request.command,
                      saved.request.command === "review"
                        ? typeof saved.request.payload.progress === "number"
                          ? saved.request.payload.progress
                          : Number(saved.fields.progress) || 0
                        : undefined,
                    ),
                    "success",
                  );
                  props.onClose();
                  await props.onSaved(receipt);
                });
              }}
            >
              {recoveredDone ? "Close work form" : workEditorActionLabel(saved.request.command)}
            </Button>
            {rejected && (
              <Button
                variant="outline"
                disabled={action.busy}
                onPress={() =>
                  void action.run(async () => {
                    if (
                      !(await confirmAction(
                        "Discard rejected work request?",
                        "These changes were not saved. Discard this attempt and review the current work before trying again.",
                        "Discard rejected request",
                      ))
                    )
                      return;
                    await draftStore.remove(
                      profile!.id,
                      "work." + data.root.id,
                    );
                    await retained.refresh();
                    action.clear();
                  })
                }
              >
                Discard rejected request
              </Button>
            )}
          </>
        }
      >
        {!action.error && (
          <Text>
            {canCheck
              ? "An earlier save still needs to be confirmed. Use the button below to check its result."
              : "Refresh the task or reopen it with an account that can make this change."}
          </Text>
        )}
      </Sheet>
    );
  })() : needsDates && !taskDates.data ? (
      <Sheet open title="Parent task schedule" onClose={props.onClose}>
        {taskDates.error
          ? <ErrorState error={taskDates.error} retry={() => void taskDates.refresh()} />
          : <Loading label="Loading parent task dates" layout="form" />}
      </Sheet>
  ) : (
    <WorkEditorForm
      {...props}
      dateBounds={data.root.scheduleBounds ?? taskDates.data}
      rejectedCreate={rejectedCreate}
      onPostCreateHandoff={
        props.promptPostCreateStaffing
          ? (target) => setHandoff({ stage: "prompt", target })
          : undefined
      }
    />
  );

  return (
    <SheetModalHost open onClose={props.onClose} busy={action.busy}>
      {content}
    </SheetModalHost>
  );
}
function WorkEditorForm({
  data: initialData,
  edit,
  onClose,
  onSaved,
  onCreatedSubtask,
  onPostCreateHandoff,
  readOnly = false,
  projectStatus,
  projectLeadId,
  rejectedCreate,
  dateBounds,
}: {
  data: WorkTreeSnapshot;
  edit: WorkEdit;
  onClose: () => void;
  onSaved: (receipt: WorkTreeSnapshot) => Promise<void>;
  onCreatedSubtask?: (created: { tree: WorkTreeSnapshot; node: WorkNode }) => void;
  onPostCreateHandoff?: (target: Extract<PostCreateStaffingTarget, { kind: "subtask" }>) => void;
  readOnly?: boolean;
  projectStatus?: string;
  projectLeadId?: string;
  rejectedCreate?: { fields: NativeEditorFields; error: unknown; start?: string };
  dateBounds?: WorkTreeSnapshot["root"]["scheduleBounds"];
}) {
  const { profile } = useAuth();
  const [data, setData] = useState(initialData);
  const [newer, setNewer] = useState<WorkTreeSnapshot>();
  const [committed, setCommitted] = useState(false);
  const dateTree = dateBounds ? { ...data, root: { ...data.root, scheduleBounds: dateBounds } } : data;
  const [baseline, setBaseline] = useState(
      () =>
        captureWorkEditorBaseline(
          dateTree,
          edit,
          profile?.id || null,
          crypto.randomUUID(),
        ),
    ),
    staffing = useRef(
      captureStaffingBaseline(data, edit.root ? null : edit.node?.id || null, {
        actorId: profile?.id || null,
        rootId: data.root.id,
        projectId: data.root.project,
        officeId: data.root.office,
        kind: data.root.kind,
        revision: data.revision,
        readOnly,
      }),
    ).current;
  const draftKey = formDraftKey(
    profile?.id,
    "work-editor:" +
      data.root.id +
      ":" +
      edit.command +
      ":" +
      (edit.node?.id || edit.parent || (edit.root ? "root" : "new")),
  );
  const [fields, setFields] = useState<NativeEditorFields>(() => {
    if (rejectedCreate)
      return {
        ...rejectedCreate.fields,
        start: rejectedCreate.start ?? rejectedCreate.fields.start,
      };
    // Ordinary edits start from the current snapshot. Explicit request recovery
    // above remains separate and preserves original submitted terms.
    const savedDraft = edit.command === "create" ? readFormDraft<NativeEditorFields>(draftKey) : undefined;
    if (savedDraft) return savedDraft;
    return {
      ...baseline.fields,
      lead: edit.command === "create" ? "" : baseline.fields.lead,
      people: edit.command === "create" ? [] : baseline.fields.people,
      start:
        edit.command === "create"
          ? subtaskDateLimits(dateTree, baseline.fields.parent).earliest ??
            workScheduleToday(data)
          : baseline.fields.start,
    };
  });
  const originalStart =
    nodeSchedule(data.nodes.find((item) => item.id === baseline.nodeId))
      ?.start_date || "";
  const today = workScheduleToday(data);
  const sharedDates = !!dateTree.root.scheduleBounds || !!today;
  const start = fields.start || originalStart;
  const dateLimits = sharedDates ? subtaskDateLimits(dateTree, fields.parent) : undefined;
  const startMax = [dateLimits?.latest, fields.due].filter((date): date is string => !!date).sort()[0];
  const dueMin = [dateLimits?.earliest, start].filter((date): date is string => !!date).sort().at(-1);
  const invalidRange = !!(dateLimits?.earliest && dateLimits.latest && dateLimits.earliest > dateLimits.latest);
  const changedStart =
    (sharedDates || !!today) && edit.command === "edit" && start !== originalStart;
  const request = useRef<WorkRequest | undefined>(undefined),
    { toast } = useToast(),
    action = useAction();
  const [rejectedError, setRejectedError] = useState(rejectedCreate?.error);
  const context = {
    actorId: profile?.id || null,
    rootId: data.root.id,
    projectId: data.root.project,
    officeId: data.root.office,
    kind: data.root.kind,
    revision: data.revision,
    readOnly,
  };
  const node: DependencyNode | undefined = data.nodes.find((n) => n.id === baseline.nodeId);
  const isStaff =
      edit.command === "staff" ||
      edit.command === "root_lead" ||
      edit.command === "contributors";
  const supportsDependencies = supportsSubtaskDependencies(data);
  const showPriority = supportsDependencies &&
    (edit.command === "create" || edit.command === "edit");
  const originalPriority = nodeSchedule(node)?.priority;
  const priority = fields.priority ?? (edit.command === "create" ? "medium" : originalPriority ?? "");
  const changedPriority = showPriority && fields.priority !== undefined &&
    fields.priority !== (edit.command === "create" ? "medium" : originalPriority);
  const dependencyParentId = edit.command === "create"
    ? (fields.parent || null)
    : (node?.parent_subtask_id ?? null);
  const siblingNodes = ["create", "edit"].includes(edit.command)
    ? subtaskPrerequisiteSiblings(
        data,
        dependencyParentId,
        edit.command === "edit" ? node?.id : null,
      )
    : [];
  const legacyDependencies = edit.command === "edit" && node && node.dependency_ids == null
    ? legacySiblingDependencyIds(data, node)
    : [];
  const selectedDependencies = fields.dependencies ??
    (edit.command === "create"
      ? []
      : Array.isArray(node?.dependency_ids)
        ? node.dependency_ids
        : legacyDependencies);
  const effectiveLiveStart = start || nodeSchedule(node)?.start_date || "";
  const prerequisiteOptions = buildSubtaskPrerequisiteOptions({
    siblings: siblingNodes,
    nodes: data.nodes,
    selectedIds: selectedDependencies,

  });
  const livePrerequisiteError = ["create", "edit"].includes(edit.command) && supportsDependencies
    ? subtaskDependencySelectionError({
        nodes: data.nodes,
        siblings: siblingNodes,
        nodeId: edit.command === "edit" ? (node?.id ?? "__edit__") : "__new__",
        candidateIds: selectedDependencies,

        originalIds: Array.isArray(node?.dependency_ids) ? node.dependency_ids : legacyDependencies,
      })
    : "";
  const changedDependencies = fields.dependencies !== undefined &&
    JSON.stringify([...new Set(fields.dependencies)].sort()) !==
      JSON.stringify(Array.isArray(node?.dependency_ids) ? [...new Set(node.dependency_ids)].sort() : null);
  const missingDependencies = edit.command === "edit" && node
    ? subtaskDependencies(data, node).missingCount
    : 0;
  const canEditDependencies = edit.command === "create"
    ? canCreateSubtaskDependencies(data)
    : canEditSubtaskDependencies(data, node);
  const staffCapabilities = isStaff
    ? staffingCapabilities(
        data,
        edit.root ? null : node?.id || null,
        context,
        fields.lead,
      )
    : undefined;
  const capability = staffCapabilities?.appointment ?? workEditorCapability(data, baseline, context);
  const editPolicy = readDetailEditState((node as (WorkNode & { detail_edit?: unknown }) | undefined)?.detail_edit,
    data.root.id, node?.id ?? null);
  const startedEdit = edit.command === "edit" && data.root.kind === "office" &&
    (editPolicy?.started || !!nodeSchedule(node)?.started_at || node?.status !== "todo" || !!node?.percent_complete);
  const scheduleChanged = edit.command === "edit" &&
    ((start || "") !== (baseline.fields.start || "") || fields.due !== baseline.fields.due);
  const taskStaffingAccess = isStaff && !baseline.nodeId
    ? taskStaffingCapability(data, context)
    : undefined;
  const taskStaffingDenied = !!taskStaffingAccess && !taskStaffingAccess.allowed;
  const update = <K extends keyof NativeEditorFields>(
    key: K,
    value: NativeEditorFields[K],
  ) => {
    if (action.busy || request.current) return;
    action.clear();
    setFields((old) => {
      const next = { ...old, [key]: value };
      writeFormDraft(draftKey, next);
      return next;
    });
  };
  const save = () =>
    action.run(async () => {
      setRejectedError(undefined);
      if (committed) return;
      if (!profile) throw new PublicMessageError("Sign in again.");
      const wasPending = !!request.current;
      if (!request.current) {
        if (edit.command === "review") {
          if (!fields.note.trim())
            throw new PublicMessageError("Enter the reason for your decision.");
          const approve = fields.progress === 100;
          if (
            !(await confirmAction(
              approve ? "Approve this subtask?" : "Return this subtask?",
              fields.note.trim(),
              approve ? "Approve subtask" : "Request changes",
            ))
          )
            return;
        }
        const latest = await fetchWorkTree(data.root.id);
        if (!edit.root && !subtasksVisibleForActor(latest.root, profile.id)) throw new PublicMessageError(hiddenSubtasksMessage);
        if (isStaff && !baseline.nodeId) {
          const access = taskStaffingCapability(latest, context,
            fields.lead !== staffing.leadId ? "appoint_lead" : "manage_contributors");
          if (!access.allowed)
            throw new PublicMessageError(access.disabledReason || "Current task staffing access is required.");
        }
        const latestNode = baseline.nodeId
          ? latest.nodes.find((item) => item.id === baseline.nodeId)
          : undefined;
        if (edit.command === "delete" && (
          !latestNode || latestNode.status !== "todo" || !!nodeSchedule(latestNode)?.started_at || !!latestNode.percent_complete ||
          (latest.root.kind === "office" && latest.root.lead !== profile.id)
        )) throw new PublicMessageError("Only the Task Lead can delete an unstarted subtask. Refresh the work before continuing.");
        if (
          isProjectLeadSubtaskPlanningBlocked(latest, profile.id, {
            projectStatus,
            projectLeadId,
            actorRole: profile.role,
          }) &&
          !(edit.command === "staff" && latestNode?.lead_id === profile.id && fields.lead === latestNode.lead_id) &&
          ["create", "edit", "staff", "move", "order", "delete"].includes(
            edit.command,
          )
        ) {
          throw new PublicMessageError(
            "Only the Task Lead can manage subtasks or assign people once the project is active.",
          );
        }
        if (
          ["progress", "submit"].includes(edit.command) &&
          (!latestNode ||
            !isSubtaskLeadOrContributor(latest, latestNode, profile.id))
        ) {
          throw new PublicMessageError(
            "Only the Lead or contributors of this task or subtask can update or complete this work.",
          );
        }
        if (
          readOnly ||
          latest.root.project !== context.projectId ||
          latest.root.office !== context.officeId ||
          latest.root.kind !== context.kind
        )
          throw new Error(
            "Work access or revision changed. Reopen the editor and review the current work.",
          );
        if (latest.revision !== baseline.revision) {
          if (edit.command === "edit") setNewer(latest);
          throw new Error(
            "Work changed. Review the latest details before saving your draft.",
          );
        }
        if (
          edit.command === "review" &&
          (!baseline.nodeId ||
            !personalReviewAllowed(
              latest,
              baseline.nodeId,
              profile.id,
              readOnly,
            ))
        )
          throw new PublicMessageError("Current independent review access is required.");
        const datedEdit = sharedDates && ["create", "edit"].includes(edit.command);
        const needsFreshBounds =
          datedEdit && !latest.root.scheduleBounds && latest.root.kind === "office";
        const freshTask = needsFreshBounds ? await fetchTaskById(latest.root.id) : undefined;
        if (freshTask === null) throw new PublicMessageError("The parent task dates could not be verified.");
        const freshProjectId =
          typeof freshTask?.linked_project_id === "string"
            ? freshTask.linked_project_id
            : latest.root.project;
        const freshProject =
          needsFreshBounds && freshProjectId
            ? await Promise.resolve().then(() => fetchProject(freshProjectId)).catch(() => undefined)
            : undefined;
        const freshDateTree = latest.root.scheduleBounds || !datedEdit ? latest : {
          ...latest,
          root: {
            ...latest.root,
            scheduleBounds: {
              projectStart: freshProject?.startDate?.slice(0, 10) || undefined,
              projectDue: freshProject?.targetDate?.slice(0, 10) || undefined,
              taskStart: typeof freshTask?.start_date === "string" ? freshTask.start_date : undefined,
              taskDue: latest.root.due ?? undefined,
            },
          },
        };
        const issue = isStaff
          ? staffingDraftError(
              latest,
              context,
              staffing,
              fields.lead || null,
              fields.people,
            )
          : datedEdit
            ? workEditorDateError(freshDateTree, baseline, { ...fields, start })
            : subtaskScheduleError(latest, baseline, fields);
        if (issue) throw new PublicMessageError(issue);
        const current = workEditorCapability(latest, baseline, context);
        if (!isStaff && !current.allowed)
          throw new PublicMessageError(
            current.disabledReason || "Current work access is required.",
          );
        if (edit.command === "edit" && latest.root.kind === "office") {
          const latestNode = latest.nodes.find(item => item.id === baseline.nodeId);
          const policy = readDetailEditState((latestNode as (WorkNode & { detail_edit?: unknown }) | undefined)?.detail_edit,
            latest.root.id, baseline.nodeId);
          const hasStarted = !!nodeSchedule(latestNode)?.started_at || latestNode?.status !== "todo" || !!latestNode?.percent_complete;
          if (policy || hasStarted) {
            const policyError = detailEditError(policy, {
              planning: (start || "") !== (baseline.fields.start || "") || changedDependencies ||
                fields.standalone !== baseline.fields.standalone,
              due: fields.due !== baseline.fields.due,
              reason: fields.note,
            });
            if (policyError) throw new PublicMessageError(policyError);
          }
          if (scheduleChanged && !fields.note.trim())
            throw new PublicMessageError("Enter a reason for the schedule change.");
        }
        if (["create", "edit"].includes(edit.command) && !fields.title.trim())
          throw new PublicMessageError("Enter a subtask name.");
        if (
          ["progress", "submit", "review"].includes(edit.command) &&
          !fields.note.trim()
        )
          throw new PublicMessageError("A work note is required.");
        const createCanEditDeps = edit.command === "create" && canCreateSubtaskDependencies(latest);
        const createDeps = [...new Set(selectedDependencies)].sort();
        const requestFields =
          edit.command === "create"
            ? {
                ...fields,
                lead: "",
                people: [],
                ...(supportsDependencies
                  ? {
                      standalone: createCanEditDeps
                        ? createDeps.length === 0
                        : fields.standalone,
                    }
                  : {}),
              }
            : fields;
        let next = isStaff
          ? createStaffingRequest(staffing, fields.lead, fields.people)
          : freezeWorkEditorRequest(baseline, requestFields, crypto.randomUUID());
        if (datedEdit && start)
          next = { ...next, payload: { ...next.payload, start } };
        if (showPriority && (edit.command === "create" || changedPriority)) {
          if (!supportsSubtaskDependencies(latest) || !workPriorityOptions.some((option) => option.value === priority))
            throw new PublicMessageError("Subtask priority is currently unavailable. Refresh the work and try again.");
          next = { ...next, payload: { ...next.payload, priority } };
        }
        if (edit.command === "create" && supportsDependencies) {
          if (!createCanEditDeps && createDeps.length > 0)
            throw new PublicMessageError("Prerequisites can no longer be set with your current access. Refresh this task.");
          if (createCanEditDeps) {
            const latestSiblings = subtaskPrerequisiteSiblings(latest, fields.parent || null);
            if (createDeps.length > 100)
              throw new PublicMessageError("Choose at most 100 prerequisites.");
            const depIssue = subtaskDependencySelectionError({
              nodes: latest.nodes,
              siblings: latestSiblings,
              nodeId: "__new__",
              candidateIds: createDeps,

            });
            if (depIssue.startsWith("One prerequisite"))
              throw new PublicMessageError("Choose available prerequisites under the same parent.");
            if (depIssue) throw new PublicMessageError(depIssue);
          }
        }
        if (
          edit.command === "edit" &&
          supportsDependencies &&
          (changedDependencies ||
            (selectedDependencies.length > 0 &&
              (canEditDependencies || (datedEdit && changedStart))))
        ) {
          const freshNode: DependencyNode | undefined = latest.nodes.find((item) => item.id === baseline.nodeId);
          const ids = [...new Set(selectedDependencies)].sort();
          const latestSiblings = freshNode
            ? subtaskPrerequisiteSiblings(latest, freshNode.parent_subtask_id ?? null, freshNode.id)
            : [];
          if (
            changedDependencies &&
            (!canEditDependencies || !freshNode || !canEditSubtaskDependencies(latest, freshNode))
          )
            throw new PublicMessageError("Prerequisites changed or are no longer editable. Refresh this subtask.");
          if (changedDependencies && ids.length > 100)
            throw new PublicMessageError("Choose at most 100 prerequisites.");
          const effectiveStart = datedEdit ? start : nodeSchedule(freshNode)?.start_date;
          const depIssue = freshNode
            ? subtaskDependencySelectionError({
                nodes: latest.nodes,
                siblings: latestSiblings,
                nodeId: freshNode.id,
                candidateIds: ids,

                originalIds: Array.isArray(freshNode.dependency_ids) ? freshNode.dependency_ids : [],
              })
            : "";
          if (changedDependencies && depIssue.startsWith("One prerequisite"))
            throw new PublicMessageError("Prerequisites changed or are no longer editable. Refresh this subtask.");
          if (depIssue) throw new PublicMessageError(depIssue);
          if (changedDependencies)
            next = { ...next, payload: { ...next.payload, dependency_ids: ids } };
        }
        const needsImpact =
          ["move", "order", "delete"].includes(edit.command) ||
          (edit.command === "edit" &&
            (changedStart ||
              fields.due !== baseline.fields.due ||
              fields.standalone !== baseline.fields.standalone)) ||
          (isStaff && fields.lead !== staffing.leadId && !!staffing.leadId);
        if (needsImpact) {
          const impact = await fetchWorkImpact(data.root.id, next);
          if (impact.current_revision !== next.revision)
            throw new PublicMessageError(
              "Work changed. Reopen the editor and review current work.",
            );
          if (!impact.allowed)
            throw new PublicMessageError(
              "Existing work or current permissions block this change.",
            );
          if (
            !(await confirmAction(
              "Review affected work",
              `${impact.selected_count} selected items, ${impact.descendant_count} descendants, ${impact.affected_appointment_count} appointments.\n${impact.before_path.join(" / ")}\n→ ${impact.after_path.join(" / ")}`,
              workEditorActionLabel(edit.command, fields.progress),
              edit.command === "delete",
            ))
          )
            return;
          next = { ...next, impactFingerprint: impact.fingerprint };
        }
        request.current = next;
        await draftStore.set(profile.id, "work." + data.root.id, {
          request: next,
          fields: requestFields,
          baseline,
        });
      }
      let receipt: WorkTreeSnapshot;
      try {
        receipt = wasPending
          ? await recoverWorkRequest(data.root.id, request.current, profile.id)
          : await saveWorkTree(data.root.id, request.current);
      } catch (error) {
        if (edit.command === "create" && workRecoveryCanDiscard(error)) {
          await draftStore.remove(profile.id, "work." + data.root.id);
          request.current = undefined;
        }
        if (edit.command === "edit" && workRecoveryCanDiscard(error)) {
          const latest = await fetchWorkTree(data.root.id);
          if (latest.revision !== baseline.revision) setNewer(latest);
        }
        throw error;
      }
      await draftStore.remove(profile.id, "work." + data.root.id);
      clearFormDraft(draftKey);
      request.current = undefined;
      if (edit.command === "create") {
        const followUp = await applyCreatedDependencies(
          receipt,
          baseline.createdId,
          selectedDependencies,
          profile.id,
        );
        receipt = followUp.receipt;
        if (followUp.warning) {
          setCommitted(true);
          await Promise.allSettled([onSaved(receipt)]);
          throw new PublicMessageError(followUp.warning);
        }
      }
      setCommitted(true);
      action.clear();
      toast(
        workEditorSuccessMessage(
          edit.command,
          edit.command === "review" ? Number(fields.progress) || 0 : undefined,
        ),
        "success",
      );
      const createdNode =
        edit.command === "create"
          ? receipt.nodes.find((item) => item.id === baseline.createdId)
          : undefined;
      if (edit.command === "create" && createdNode && onPostCreateHandoff) {
        const handoffTarget = resolvePostCreateSubtaskStaffing({
          tree: receipt,
          node: createdNode,
          actorId: profile.id,
          actorRole: profile.role,
          projectStatus,
          projectLeadId,
          readOnly,
        });
        if (handoffTarget && handoffTarget.kind === "subtask") {
          onPostCreateHandoff(handoffTarget);
          void onSaved(receipt);
          return;
        }
      }
      onClose();
      if (edit.command === "create" && createdNode && onCreatedSubtask) {
        onCreatedSubtask({ tree: receipt, node: createdNode });
      }
      await onSaved(receipt);
    });
  const reviewLatest = () =>
    action.run(async () => {
      if (!profile || !newer || readOnly) return;
      const latest = await fetchWorkTree(data.root.id);
      const latestNode = latest.nodes.find(
        (item) => item.id === baseline.nodeId,
      );
      const nextScope = {
        ...context,
        projectId: latest.root.project,
        officeId: latest.root.office,
        kind: latest.root.kind,
        revision: latest.revision,
      };
      const nextBaseline = captureWorkEditorBaseline(
        latest,
        { ...edit, node: latestNode },
        profile.id,
        baseline.createdId,
      );
      if (
        !latestNode ||
        !sameWorkEditorScope(baseline, nextScope) ||
        !workEditorCapability(latest, nextBaseline, nextScope).allowed
      )
        throw new PublicMessageError("You no longer have access to edit this subtask.");
      if (
        !(await confirmAction(
          "Review latest subtask details",
          `Current title: ${latestNode.title}\nCurrent due date: ${latestNode.due_date || "None"}\nYour edited fields will stay in the draft for review.`,
          "Keep draft",
        ))
      )
        return;
      if (request.current)
        await draftStore.remove(profile.id, "work." + data.root.id);
      request.current = undefined;
      const merged = {
        ...nextBaseline.fields,
        title:
          fields.title === baseline.fields.title
            ? nextBaseline.fields.title
            : fields.title,
        due:
          fields.due === baseline.fields.due
            ? nextBaseline.fields.due
            : fields.due,
        start:
          fields.start === baseline.fields.start
            ? nextBaseline.fields.start
            : fields.start,
        standalone:
          fields.standalone === baseline.fields.standalone
            ? nextBaseline.fields.standalone
            : fields.standalone,
        note: fields.note,
        priority: changedPriority ? fields.priority : undefined,
        dependencies: changedDependencies ? fields.dependencies : undefined,
      };
      setFields(merged);
      writeFormDraft(draftKey, merged);
      setData(latest);
      setBaseline(nextBaseline);
      setNewer(undefined);
    });
  const close = () => {
    if (action.busy) return;
    action.clear();
    onClose();
  };
  return (
    <Sheet
      actionError={action.error ?? rejectedError}
      open
      title={
        edit.root
          ? "Task lead and contributors"
          : `${edit.command === "create" ? "Add subtask" : edit.command === "staff" ? "Choose people" : edit.command === "review" ? "Review subtask" : edit.command === "order" ? "Reorder subtasks" : edit.command === "move" ? "Move subtask" : edit.command === "delete" ? "Delete subtask" : "Edit subtask"}`
      }
      description={node?.title}
      onClose={() => void close()}
      busy={action.busy}
      footer={
        <Button
          style={{ width: "100%" }}
          busy={action.busy}
          disabled={(taskStaffingDenied || (edit.command === "edit" && !capability.allowed)) && !request.current && !committed}
          variant={edit.command === "delete" && !committed ? "danger" : "primary"}
          onPress={() =>
            void (committed ? onClose() : newer ? reviewLatest() : save())
          }
        >
          {committed
            ? "Close work form"
            : newer
              ? "Review latest details"
              : workEditorActionLabel(edit.command, fields.progress)}
        </Button>
      }
    >
      {!!["create", "edit"].includes(edit.command) && (
        <>
          <Field
            label="Subtask name"
            required
            value={fields.title}
            onChangeText={(v) => update("title", v)}
            editable={!request.current && !action.busy && capability.allowed}
          />
          {data.root.kind === "office" && <Notice>Subtasks use the parent Task’s group.</Notice>}
          {startedEdit && <Notice>Work has started. Authorized name and priority corrections remain available. Start date, prerequisites and structure are locked.</Notice>}
          {showPriority && (
            <Choice
              label="Priority"
              value={priority}
              searchable={false}
              options={workPriorityOptions}
              onChange={(value) => update("priority", value)}
              disabled={!!request.current || action.busy || !capability.allowed}
            />
          )}
          {invalidRange && (
            <ErrorState context="action" error="The parent dates leave no valid subtask date range. Update the parent schedule first." />
          )}
          {sharedDates ? (
            <DateField
              label="Start date"
              value={start}
              min={dateLimits?.earliest}
              max={startMax && dateLimits?.earliest && startMax < dateLimits.earliest ? dateLimits.latest : startMax}
              onChange={(value) => update("start", value)}
              disabled={
                !!request.current ||
                action.busy ||
                invalidRange ||
                !!startedEdit ||
                !!nodeSchedule(node)?.started_at
              }
            />
          ) : edit.command === "create" ? (
            <Notice>Subtask start dates are currently unavailable.</Notice>
          ) : null}
          <DateField
            label="Due date"
            value={fields.due}
            min={dueMin}
            max={dateLimits?.latest}
            onChange={(v) => update("due", v)}
            disabled={!!request.current || action.busy || invalidRange || (edit.command === "edit" && (editPolicy ? !editPolicy.due : !!startedEdit)) || !!(dueMin && dateLimits?.latest && dueMin > dateLimits.latest)}
          />
          {scheduleChanged && data.root.kind === "office" &&
            <Field label="Reason for the schedule change" required multiline maxLength={1000}
              value={fields.note} onChangeText={(value) => update("note", value)}
              editable={!request.current && !action.busy} />}
          <Choice
            label="Prerequisite subtasks"
            multiple
            value={selectedDependencies}
            options={prerequisiteOptions}
            placeholder="No prerequisites selected"
            error={livePrerequisiteError}
            onChange={(value) => update("dependencies", value)}
            disabled={!!request.current || action.busy || !!startedEdit || !capability.allowed || !canEditDependencies}
          />
          {data.root.kind !== "office" ? (
            <Notice>Prerequisite selection is only available on project tasks.</Notice>
          ) : !supportsDependencies ? (
            <Notice>Prerequisite selection is unavailable in this view.</Notice>
          ) : edit.command === "edit" && missingDependencies > 0 ? (
            <Notice>
              {missingDependencies} restricted prerequisite(s). The list is read-only.
            </Notice>
          ) : !canEditDependencies ? (
            <Notice>
              {edit.command === "edit" &&
              (node?.status !== "todo" ||
                !!nodeSchedule(node)?.started_at ||
                !!node?.percent_complete)
                ? "Prerequisites cannot be changed after work starts."
                : "Prerequisites are read-only in this view."}
            </Notice>
          ) : null}
        </>
      )}
      {taskStaffingDenied && <Notice>{taskStaffingAccess.disabledReason}</Notice>}
      {!!isStaff && !taskStaffingDenied && (
        <>
          <Choice
            label="Appointed Lead"
            confirmSelection
            confirmationLabel="Confirm Lead"
            value={fields.lead}
            onChange={(v) => update("lead", v)}
            disabled={!!request.current || action.busy || !staffCapabilities?.appointment.allowed}
            options={data.people.map((p) => ({
              value: p.id,
              label: p.name,
              disabled: p.eligible === false,
            }))}
          />
          <Choice
            label="Contributors"
            confirmSelection
            confirmationLabel="Confirm contributors"
            value={displayedWorkContributorIds(fields.lead || null, fields.people)}
            multiple
            onChange={(v) => update("people", compatibilityWorkWorkerIds(fields.lead || null, v))}
            disabled={!!request.current || action.busy || !staffCapabilities?.contributors.allowed}
            options={data.people.filter((p) => p.id !== fields.lead).map((p) => ({
              value: p.id,
              label: p.name,
              disabled: p.eligible === false,
            }))}
          />
        </>
      )}
      {!!(edit.command === "move") && (
        <Choice
          label="Move under"
          value={fields.parent}
          onChange={(v) => update("parent", v)}
          disabled={!!request.current || action.busy}
          options={[
            { value: "", label: "Task root" },
            ...(node ? reparentChoices(data.nodes, node) : []).map((n) => ({
              value: n.id,
              label: n.title,
            })),
          ]}
        />
      )}
      {!!(edit.command === "order") &&
        fields.order.map((id, index) => (
          <Row key={id}>
            <Text style={{ flex: 1, color: colors.text }}>
              {data.nodes.find((n) => n.id === id)?.title || "Subtask"}
            </Text>
            <Button
              variant="outline"
              disabled={index === 0 || !!request.current}
              onPress={() => {
                const ids = [...fields.order];
                [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
                update("order", ids);
              }}
              icon={<ArrowUp size={16} color={colors.text} />}
            >
              Up
            </Button>
            <Button
              variant="outline"
              disabled={index === fields.order.length - 1 || !!request.current}
              onPress={() => {
                const ids = [...fields.order];
                [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
                update("order", ids);
              }}
              icon={<ArrowDown size={16} color={colors.text} />}
            >
              Down
            </Button>
          </Row>
        ))}
      {!!(edit.command === "progress") && (
        <Field
          label="Progress (0–99%)"
          required
          keyboardType="number-pad"
          value={String(fields.progress)}
          onChangeText={(v) => update("progress", Number(v))}
          editable={!request.current}
        />
      )}
      {!!(edit.command === "review") && (
        <Choice
          label="Review decision"
          required
          searchable={false}
          value={fields.progress === 100 ? "approve" : "changes"}
          onChange={(v) => update("progress", v === "approve" ? 100 : 0)}
          options={[
            { value: "approve", label: "Approve completed work" },
            { value: "changes", label: "Request changes" },
          ]}
          disabled={!!request.current}
        />
      )}
      {!!["progress", "submit", "review"].includes(edit.command) && (
        <Field
          label="Work note"
          required
          value={fields.note}
          onChangeText={(v) => update("note", v)}
          multiline
          editable={!request.current}
        />
      )}
      {!!(edit.command === "delete") && (
        <Notice>
          The current subtree and retained work history will be checked before
          deletion. Started work cannot be silently erased.
        </Notice>
      )}
    </Sheet>
  );
}
