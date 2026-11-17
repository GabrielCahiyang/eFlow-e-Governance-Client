import {
  ProjectTaskEditor,
  useTaskStructure,
} from "../projects/ProjectTaskEditor";
import { SelectionSheet } from "../../components/ui/SelectionSheet";
import { taskCalendarDate } from "./taskDates";
import { Text } from "../../components/ui/Typography";
import { useCallback, useState } from "react";
import { CustomWorkStatusControl } from "../work-status";
import { useWorkRecordUpdates } from "./useWorkRecordUpdates";
import { View, useWindowDimensions } from "react-native";
import { useTheme } from "../../components/ui/Appearance";
import {
  Button,
  Card,
  EditorialMetadataStrip,
  ErrorState,
  Loading,
  Notice,
  Screen,
} from "../../components/ui";
import { useWorkStatus } from "../../shared/workStatusPresentation";
import { useToast } from "../../components/ui/Toast";
import { workDisplayStatus } from "../../shared/statusLabels";
import { useFacts } from "../../shared/useFacts";
import { useAction } from "../../shared/useAction";
import { SmallProgress } from "../../components/ui/OperationStatus";
import { useAuth } from "../authentication";
import {
  TaskFundingCard,
  fetchTaskApprovalCashBlockers,
} from "../budget";
import { ProjectFiles } from "../projects";
import type { Navigate } from "../../shared/routes";
import { supabase } from "../../../platform/supabase";
import { rowToTask } from "../../../core/web/app/features/tasks/services/taskMapper";
import {
  fetchWorkTree,
  WorkTreeUnavailable,
} from "../../../core/web/app/features/nested-work/services/workTreeService";
import {
  getTaskTeamMemberIds,
} from "../../../core/web/app/features/tasks/selectors/teamMembership";
import { updateTaskStatus } from "../../../core/web/app/features/tasks/services/taskService";
import { isAppointedOfficeHead } from "../../../core/web/app/shared/officeAuthority";
import { selectRootWorkCapability } from "../../../core/web/app/features/nested-work/selectors/capabilities";
import type { WorkTreeSnapshot } from "../../../core/web/app/features/nested-work/types";
import { TaskEvidenceSheet } from "./TaskEvidenceSheet";
import { evidenceScope, type EvidenceRequest } from "./taskEvidence";
import { draftStore } from "../../../platform/draftStore";
import { TaskExecutionSheet } from "./TaskExecutionSheet";
import { TaskReviewPanel } from "./TaskReviewPanel";
import { TaskActivity } from "./TaskActivity";
import { WorkTreePanel } from "./WorkTreePanel";
import { WorkEditorSheet } from "./WorkEditorSheet";
import { hiddenSubtasksMessage, subtasksVisibleForActor } from "./subtaskVisibility";
import { WorkProposalReview, WorkProposalSheet } from "./WorkProposalSheet";
import {
  plannedStartReached,
  subtaskDisplayStatus,
  workScheduleToday,
} from "./subtaskSchedule";
import { getPhilippineCalendarDate } from "../../../core/web/app/shared/calendarDates";
import { PublicMessageError } from "../../shared/userMessages";
import { confirmAction } from "../../shared/confirm";
import { deleteUnstartedTask, taskCanBeDeletedBeforeStart } from "./taskDeletion";
import { notifyTaskListeners } from "../../../core/web/app/features/tasks/services/taskRealtimeService";
import {
  isProjectLeadSubtaskPlanningBlocked,
  isTaskLeadOrContributor,
  taskStaffingCapability,
} from "./workPermissions";
function canPostTaskUpdate(
  task: ReturnType<typeof rowToTask>,
  actorId: string,
) {
  return (
    isTaskLeadOrContributor(task, actorId) &&
    task.status === "in_progress"
  );
}

import { branchRows, branchCompletion, workNodeRoute } from "./branchInspector";
import {
  BentoActionButtons,
  BentoBlockerCard,
  BentoDependenciesCard,
  BentoEditButton,
  BentoDeleteButton,
  BentoProjectOnHoldCard,
  BentoScheduleCards,
  priorityLabel,
  BentoAssignedTeamCard,
  BentoSubtasksCard,
  BentoSupportingGrid,
  CircularProgressRing,
  type DependencyItemData,
  type SubtaskItemData,
} from "./TaskBentoComponents";
import type { WorkPerson } from "../../../core/web/app/features/nested-work/types";

export function TaskDetailsScreen({
  id,
  projectId,
  initialView,
  nodeId,
  submissionId,
  financialRecordId,
  navigate,
}: {
  id: string;
  projectId?: string;
  initialView?: string;
  nodeId?: string;
  submissionId?: string;
  financialRecordId?: string;
  navigate: Navigate;
}) {
  const { profile, organization } = useAuth(),
    { toast } = useToast(),
    action = useAction();
  const loadTask = async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (error) throw error;
    const task = rowToTask(data);
    if (projectId && task.linkedProjectId !== projectId)
      throw new PublicMessageError(
        "This task is outside the linked project context.",
      );
    let projectStatus = "active";
    let projectLeadId: string | undefined;
    if (task.linkedProjectId) {
      const project = await supabase
        .from("projects")
        .select("status,project_lead_id")
        .eq("id", task.linkedProjectId)
        .maybeSingle();
      if (project.error) throw project.error;
      projectStatus = project.data?.status || "unavailable";
      projectLeadId =
        typeof (project.data as { project_lead_id?: unknown } | null)
          ?.project_lead_id === "string"
          ? ((project.data as { project_lead_id: string }).project_lead_id)
          : undefined;
    }
    if (projectStatus === "unavailable")
      throw new PublicMessageError("Task unavailable.");
    const dependencyIds = Array.isArray(task.dependencyIds)
      ? task.dependencyIds
      : [];
    let dependencyItems: DependencyItemData[] = [];
    let missingDependencyCount = 0;
    if (dependencyIds.length > 0) {
      const depsResult = await supabase
        .from("tasks")
        .select("id,title,status,linked_project_id")
        .in("id", dependencyIds)
        .is("deleted_at", null);
      if (depsResult.error) {
        missingDependencyCount = dependencyIds.length;
      } else {
        const rows = (depsResult.data || []) as Array<{
          id: string;
          title: string;
          status: string;
          linked_project_id?: string | null;
        }>;
        const byId = new Map(rows.map((r) => [r.id, r]));
        dependencyItems = dependencyIds
          .map((depId) => byId.get(depId))
          .filter((row): row is NonNullable<typeof row> => Boolean(row))
          .map((row) => ({
            id: row.id,
            title: row.title,
            status: row.status,
            completed: row.status === "completed",
            projectId: row.linked_project_id || undefined,
          }));
        missingDependencyCount = Math.max(
          0,
          dependencyIds.length - dependencyItems.length,
        );
      }
    }
    return {
      task,
      projectStatus,
      projectLeadId,
      dependencyItems,
      missingDependencyCount,
    };
  };
  const facts = useFacts(
    "task:" + [profile?.id, id, projectId].join(":"),
    loadTask,
  );
  const tree = useFacts("work-tree:" + profile?.id + ":" + id, () =>
    fetchWorkTree(id),
  );
  const evidence = useFacts(
    "evidence:" + profile?.id + ":" + id,
    () => draftStore.get<EvidenceRequest>(profile!.id, evidenceScope(id)),
    !!profile,
  );
  const view = initialView || "details";
  const legacyBranch = useFacts(
    JSON.stringify(["legacy-funding-branch", profile?.id, id, nodeId]),
    async () => {
      const result = await supabase
        .from("subtasks")
        .select("id,title")
        .eq("task_id", id)
        .eq("id", nodeId!)
        .maybeSingle();
      if (result.error) throw result.error;
      return result.data;
    },
    !!nodeId &&
      view === "budget" &&
      tree.error instanceof WorkTreeUnavailable &&
      !!facts.data &&
      !facts.error,
  );
  const overview = view === "details";
  const palette = useTheme();
  const { fontScale } = useWindowDimensions();
  const resolveStatus = useWorkStatus();
  const [execution, setExecution] = useState<"progress" | "submit">();
  const [proposal, setProposal] = useState<"progress" | "completion">();
  const [editingTask, setEditingTask] = useState(false);
  const [creatingSubtask, setCreatingSubtask] = useState(false);
  const loadedTask = facts.data?.task;
  const taskScope = {
    actor: profile?.id || "",
    project: loadedTask?.linkedProjectId || "",
    office: loadedTask?.orgId || "",
    task: loadedTask,
    canDelegateEdit: !!profile?.org_id && profile.org_id === loadedTask?.orgId,
  };
  const editAccess = useTaskStructure(
    taskScope,
    overview &&
      !!taskScope.project &&
      !!taskScope.office &&
      !!taskScope.actor &&
      (profile?.role === "head" || taskScope.canDelegateEdit) &&
      !facts.error &&
      ["active", "on_hold"].includes(facts.data?.projectStatus ?? "") &&
      !loadedTask?.archivedAt &&
      !["completed", "cancelled"].includes(loadedTask?.status || ""),
  );
  const [staff, setStaff] = useState(false);
  const refresh = useCallback(async () => {
    await Promise.all([facts.refresh(), tree.refresh(), editAccess.refresh()]);
  }, [facts.refresh, tree.refresh, editAccess.refresh]);
  useWorkRecordUpdates(id, refresh);
  if (facts.loading && !facts.data)
    return (
      <Screen>
        <Loading label="Loading task inspector" layout="task" />
      </Screen>
    );
  if (facts.error || !facts.data)
    return (
      <Screen>
        <ErrorState
          error={facts.error || "Task unavailable"}
          retry={() => void refresh()}
        />
      </Screen>
    );
  const { task, projectStatus } = facts.data;
  const mayViewSubtasks = subtasksVisibleForActor({ kind: "office", lead: task.assigneeId || task.recommendationLeadId || null, status: task.status }, profile?.id);
  const today = (tree.data && workScheduleToday(tree.data)) ?? getPhilippineCalendarDate();
  const canStartToday = plannedStartReached(task.startDate, today);
  const taskDependenciesReady = facts.data.missingDependencyCount === 0 &&
    facts.data.dependencyItems.every((dependency) => dependency.completed);
  const isProjectOnHold = projectStatus === "on_hold";
  const canEditTask =
    !editAccess.error &&
    !!editAccess.data;
  const actionsChecking = facts.loading || editAccess.loading;
  const readOnly =
      ["completed", "archived", "unavailable"].includes(projectStatus) ||
      !!task.archivedAt,
    executionBlocked =
      readOnly || isProjectOnHold || !!task.proposedOfficeIdentityId,
    head =
      isAppointedOfficeHead(profile, organization ? [organization] : []) &&
      profile?.org_id === task.orgId,
    participant = isTaskLeadOrContributor(task, profile?.id),
    lead = !!profile?.id && task.assigneeId === profile.id;
  const completion =
    mayViewSubtasks && tree.data && !tree.error
      ? branchCompletion(tree.data, task.status)
      : undefined;
  const context = tree.data
    ? {
        actorId: profile?.id || null,
        rootId: id,
        projectId: tree.data.root.project,
        officeId: tree.data.root.office,
        kind: tree.data.root.kind,
        revision: tree.data.revision,
        readOnly,
      }
    : undefined;
  const mayStaff =
    !tree.error &&
    !!tree.data &&
    !!context &&
    taskStaffingCapability(tree.data, context).allowed;
  const canDeleteTask = !readOnly && !isProjectOnHold && !!profile?.id &&
    (head || facts.data.projectLeadId === profile.id) && taskCanBeDeletedBeforeStart(task);
  const deleteTask = () => void action.run(async () => {
    if (!profile?.id || !(await confirmAction("Delete this task?", `Remove “${task.title}” from active work? Its project will remain.`, "Delete task", true))) return;
    await deleteUnstartedTask(task, profile.id);
    toast("Task deleted.", "success");
    await Promise.allSettled([notifyTaskListeners()]);
    navigate(task.linkedProjectId ? { name: "project", id: task.linkedProjectId, title: "Project" } : { name: "tasks", title: "My Work" });
  });
  const verifyCurrentTask = async () => {
    const session = await supabase.auth.getSession();
    if (
      session.error ||
      !profile ||
      session.data.session?.user.id !== profile.id
    )
      throw new PublicMessageError("Sign in again to verify task access.");
    const latest = await loadTask();
    if (
      latest.task.linkedProjectId !== task.linkedProjectId ||
      latest.task.orgId !== task.orgId ||
      latest.task.archivedAt ||
      ["completed", "archived", "unavailable"].includes(latest.projectStatus)
    )
      throw new PublicMessageError(
        "This task is no longer editable in the current scope.",
      );
    return {
      latest: latest.task,
      dependenciesReady:
        latest.missingDependencyCount === 0 &&
        latest.dependencyItems.every((dependency) => dependency.completed),
      actorId: profile.id,
      projectStatus: latest.projectStatus,
    };
  };
  const verifyExecution = async (mode: "start" | "progress" | "submit") => {
    const {
      latest,
      dependenciesReady,
      actorId,
      projectStatus: currentProjectStatus,
    } = await verifyCurrentTask();
    const status = latest.status;
    if (currentProjectStatus === "on_hold")
      throw new PublicMessageError("This project is on hold. Work can continue once it resumes.");
    if (mode === "start" && status === "todo" && !dependenciesReady)
      throw new PublicMessageError("Complete the task prerequisites before starting work.");
    if (mode === "submit" && !dependenciesReady)
      throw new PublicMessageError(
        "Complete all task prerequisites before marking this task complete.",
      );
    if (mode !== "start" && ["todo", "pending_assignment", "changes_requested"].includes(status))
      throw new PublicMessageError(
        status === "changes_requested"
          ? "The Task Lead must resume work before posting progress or submitting completion."
          : "The Task Lead must start work before posting progress or submitting completion.",
      );
    const allowed =
      !latest.proposedOfficeIdentityId &&
      (mode === "progress"
        ? canPostTaskUpdate(latest, actorId)
        : latest.assigneeId === actorId &&
          (mode === "submit"
            ? status === "in_progress"
            : ["todo", "changes_requested"].includes(status)));
    if (!allowed)
      throw new PublicMessageError(
        "Current task status or responsibility no longer allows this action.",
      );
    if ((mode === "start" && status === "todo") || mode === "submit") {
      const latestTree = await fetchWorkTree(id).catch((error) => {
        if (error instanceof WorkTreeUnavailable) return undefined;
        throw error;
      });
      if (mode === "start" && status === "todo") {
        const workDay = (latestTree && workScheduleToday(latestTree)) ?? getPhilippineCalendarDate();
        if (!plannedStartReached(latest.startDate, workDay))
          throw new PublicMessageError("Start work is available on or after the planned start date.");
      }
      if (
        mode === "submit" &&
        latestTree?.nodes.some((node) => node.task_id === id && node.status !== "completed")
      ) {
        throw new PublicMessageError(
          "Complete all subtasks before marking this task complete.",
        );
      }
    }
    if (mode === "submit") {
      const cashBlockers = await fetchTaskApprovalCashBlockers(id);
      if (cashBlockers.length > 0)
        throw new PublicMessageError(
          "Settle all task and subtask cash requests before marking this task complete.",
        );
    }
  };
  const savedTree = async (_receipt: WorkTreeSnapshot) => {
    await refresh();
  };
  const branch = nodeId
    ? tree.data?.nodes.find((node) => node.id === nodeId && node.task_id === id)
    : undefined;
  const funding = (
    <TaskFundingCard
      task={task}
      subtaskId={nodeId}
      subtaskFinished={branch?.status === "completed"}
      recordId={financialRecordId}
      onOpenLinkedSubitem={
        financialRecordId
          ? (linkedNodeId) =>
              navigate({
                name: "task",
                id,
                projectId: task.linkedProjectId,
                nodeId: linkedNodeId,
                recordId: financialRecordId,
                view: "budget",
                title: "Subtask funding",
              })
          : undefined
      }
      canManage={Boolean(
        profile?.id &&
          (lead ||
            (branch &&
              (branch.lead_id === profile.id ||
                branch.assigned_to_ids?.includes(profile.id)))),
      )}
      readOnly={
        readOnly ||
        !!(nodeId && ((tree.loading && !tree.data) || tree.error || !branch))
      }
    />
  );
  if (nodeId && !mayViewSubtasks) return <Screen><Notice>{hiddenSubtasksMessage}</Notice></Screen>;
  if (initialView === "budget" && (nodeId || financialRecordId))
    return (
      <Screen
        title={
          branch?.title ||
          (!legacyBranch.error && legacyBranch.data?.title) ||
          (nodeId ? "Subtask funding" : task.title)
        }
        description={nodeId ? task.title : "Cash request details"}
      >
        {nodeId &&
        (!branch || tree.error) &&
        (!legacyBranch.data || legacyBranch.error) ? (
          tree.loading || legacyBranch.loading ? (
            <Loading label="Verifying subtask access" layout="task" />
          ) : (
            <ErrorState
              error={
                legacyBranch.error ||
                tree.error ||
                "Subtask funding is unavailable."
              }
              retry={() =>
                void Promise.all([tree.refresh(), legacyBranch.refresh()])
              }
            />
          )
        ) : (
          funding
        )}
      </Screen>
    );
  const isRootOverview = overview && !nodeId;
  const taskBlocker =
    (task as unknown as { blocker?: string | null }).blocker ||
    tree.data?.root.blocker ||
    undefined;
  const taskDisplayStatus = workDisplayStatus(task.status, taskBlocker);
  const taskStatusPresentation = resolveStatus(
    taskDisplayStatus,
    task.customStatusId,
  );

  const { children } = tree.data
    ? branchRows(tree.data, undefined)
    : { children: [] };
  const subtaskItems: SubtaskItemData[] = children.map((child) => {
    const record = tree.data?.nodes.find((item) => item.id === child.id);
    const effectiveStatus = record
      ? workDisplayStatus(subtaskDisplayStatus(record), record.blocker)
      : "todo";
    const subtaskComp =
      record && tree.data
        ? branchCompletion(tree.data, record.status, record.id)
        : { percent: 0 };
    const memberIds = [
      ...new Set([
        ...(record?.lead_id ? [record.lead_id] : []),
        ...(record?.assigned_to_ids || []),
      ]),
    ];
    const members = memberIds
      .map((mId) => tree.data?.people.find((p) => p.id === mId))
      .filter((p): p is WorkPerson => !!p);

    return {
      id: child.id,
      title: child.title,
      status: effectiveStatus,
      customStatusId: record?.custom_status_id,
      percent: isProjectOnHold ? undefined : subtaskComp.percent,
      members,
    };
  });

  const canCreateSubtask =
    mayViewSubtasks &&
    !readOnly &&
    !!tree.data &&
    !!context &&
    !isProjectLeadSubtaskPlanningBlocked(tree.data, profile?.id, {
      projectStatus,
      projectLeadId: facts.data.projectLeadId,
      actorRole: profile?.role,
    }) &&
    selectRootWorkCapability(tree.data, "create_child", context).allowed;

  const contributorList: { id?: string; name: string; office?: string }[] = [];
  const seenContributorNames = new Set<string>();

  if (tree.data) {
    tree.data.root.people
      .filter((mId) => mId !== task.assigneeId)
      .forEach((mId) => {
        const p = tree.data!.people.find((person) => person.id === mId);
        if (p && !seenContributorNames.has(p.name)) {
          contributorList.push(p);
          seenContributorNames.add(p.name);
        }
      });
  }
  (task.teamMemberNames || [])
    .filter((name) => name !== task.assigneeName)
    .forEach((name) => {
      if (!seenContributorNames.has(name)) {
        contributorList.push({ id: name, name });
        seenContributorNames.add(name);
      }
    });

  const subtasksComplete =
    !tree.data ||
    tree.data.nodes.every(
      (node) => node.task_id !== id || node.status === "completed",
    );
  const taskReadyToComplete = taskDependenciesReady && subtasksComplete;
  const completionText = completion?.total
    ? `${completion.completed} of ${completion.total} ${completion.total === 1 ? "subtask" : "subtasks"} completed`
    : task.status === "completed"
      ? "Task completed"
      : `${completion?.percent ?? 0}% completed`;

  return (
    <Screen compact onRefresh={() => refresh()}>
      {isRootOverview ? (
        <>
          {/* 1. Task header */}
          <View style={{ gap: 4, marginBottom: 4 }}>
            <View
              style={{
                flexDirection: fontScale > 1.8 ? "column" : "row",
                alignItems: fontScale > 1.8 ? "flex-start" : "flex-start",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <Text
                accessibilityRole="header"
                style={{
                  flex: fontScale > 1.8 ? undefined : 1,
                  fontSize: 26,
                  fontWeight: "700",
                  color: palette.text,
                  lineHeight: 32,
                }}
              >
                {task.title}
              </Text>
              <View testID="task-detail-actions" style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              {canEditTask && (
                <BentoEditButton
                  accessibilityLabel="Edit task"
                  busy={actionsChecking}
                  disabled={action.busy}
                  onPress={() => setEditingTask(true)}
                />
              )}
              {canDeleteTask && <BentoDeleteButton accessibilityLabel="Delete task" onPress={deleteTask}
                busy={action.busy || actionsChecking} />}
              {actionsChecking && !canEditTask && !canDeleteTask && <SmallProgress label="Checking actions…" />}
              </View>
            </View>
            {!!(task.projectTitle || task.department) && (
              <Text
                style={{
                  fontSize: 14,
                  color: palette.mutedLabel,
                  lineHeight: 20,
                }}
              >
                {task.projectTitle || task.department}
              </Text>
            )}

            {/* Work action buttons immediately below project context */}
            {isProjectOnHold ? (
              <BentoProjectOnHoldCard
                projectId={task.linkedProjectId || tree.data?.root.project}
                style={{ marginTop: 8, marginBottom: 8 }}
              />
            ) : (
              <BentoActionButtons
                actions={[
                  !executionBlocked &&
                  lead &&
                  ["todo", "changes_requested"].includes(task.status)
                  && (task.status === "changes_requested" || (canStartToday && taskDependenciesReady))
                    ? {
                        label:
                          task.status === "todo" ? "Start work" : "Resume work",
                        variant: "secondary",
                        icon: "pencil",
                        busy: action.busy,
                        onPress: () =>
                          void action.run(async () => {
                            const resuming = task.status === "changes_requested";
                            if (!(await confirmAction(resuming ? "Resume this task?" : "Start this task?",
                              resuming ? "Ready to continue this work?" : "Starting this task will make its subtasks visible to authorized project members.",
                              resuming ? "Resume work" : "Start work"))) return;
                            await verifyExecution("start");
                            await updateTaskStatus(id, "in_progress");
                            toast(
                              resuming ? "Work resumed." : "Work started.",
                              "success",
                            );
                            await refresh();
                          }),
                      }
                    : null,
                  !executionBlocked &&
                  profile?.id &&
                  canPostTaskUpdate(task, profile.id)
                    ? {
                        label: "Update progress",
                        variant: "secondary",
                        icon: "pencil",
                        onPress: () => lead ? setExecution("progress") : setProposal("progress"),
                      }
                    : null,
                  !executionBlocked &&
                  participant &&
                  task.status === "in_progress" &&
                  (lead ? taskReadyToComplete : taskDependenciesReady)
                    ? {
                        label: lead ? "Mark as complete" : "Submit for review",
                        variant: "primary",
                        icon: "check",
                        disabled:
                          (evidence.loading && !evidence.data) || !!evidence.error,
                        onPress: () => lead ? setExecution("submit") : setProposal("completion"),
                      }
                    : null,
                ]}
                style={{ marginTop: 8, marginBottom: 8 }}
              />
            )}
            {!executionBlocked &&
              participant &&
              ["todo", "changes_requested"].includes(task.status) &&
              (!lead ||
                (task.status === "todo" &&
                  (!canStartToday || !taskDependenciesReady))) && (
                <Notice>
                  {!lead
                    ? task.status === "changes_requested"
                      ? "The Task Lead must resume work before you can post progress or submit completion."
                      : "The Task Lead must start work before you can post progress or submit completion."
                    : !taskDependenciesReady
                      ? "This task cannot start because its prerequisites are incomplete."
                      : !task.startDate
                        ? "Set a planned start date before starting this task."
                        : "Start work is available on or after the planned start date."}
                </Notice>
              )}
            {!executionBlocked &&
              participant &&
              task.status === "in_progress" &&
              (lead ? !taskReadyToComplete : !taskDependenciesReady) && (
                <Notice>
                  {!taskDependenciesReady
                    ? "Complete all task prerequisites before marking this task complete."
                    : "Complete all subtasks before marking this task complete."}
                </Notice>
              )}

            {/* Editorial Status / Priority metadata strip */}
            <EditorialMetadataStrip
              variant="card"
              items={[
                {
                  label: "Status",
                  value: taskStatusPresentation.label,
                  accent: taskStatusPresentation.color,
                  status: taskDisplayStatus,
                },
                {
                  label: "Priority",
                  value: priorityLabel(task.priority),
                  accent:
                    task.priority === "high" ? palette.danger : palette.text,
                },
              ]}
              style={{ marginTop: 2, marginBottom: 10 }}
            />
          </View>

          {/* 2. Task completion */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginVertical: 12,
            }}
          >
            <View style={{ gap: 4, flex: 1, paddingRight: 12 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: palette.text,
                }}
              >
                Task completion
              </Text>
              <Text style={{ fontSize: 13, color: palette.mutedLabel }}>
                {completionText}
              </Text>
            </View>
            <CircularProgressRing percent={completion?.percent ?? 0} />
          </View>

          {/* 3. Schedule bento cards */}
          <BentoScheduleCards
            startDate={task.startDate}
            dueDate={taskCalendarDate(task.deadline || task.dueDate)}
            workTimezone="Asia/Manila"
          />

          {/* Conditional Dependencies card */}
          <BentoDependenciesCard
            items={facts.data.dependencyItems}
            missingCount={facts.data.missingDependencyCount}
            onPressItem={(dep) =>
              navigate({
                name: "task",
                id: dep.id,
                projectId: dep.projectId || projectId || task.linkedProjectId,
                title: dep.title,
              })
            }
          />

          {/* Conditional Blocker card */}
          {!!(
            (task as unknown as { blocker?: string }).blocker ||
            tree.data?.root.blocker ||
            (task.status === "changes_requested" &&
              (task.feedback || task.rejectionNote))
          ) && (
            <BentoBlockerCard
              blocker={
                (task as unknown as { blocker?: string }).blocker ||
                tree.data?.root.blocker ||
                task.feedback ||
                task.rejectionNote
              }
              onPressActivity={() =>
                navigate({
                  name: "task",
                  id,
                  projectId: task.linkedProjectId,
                  view: "activity",
                  title: "Activity",
                })
              }
            />
          )}

          {/* 4. Assigned team bento card */}
          <BentoAssignedTeamCard
            leadName={task.assigneeName}
            leadRoleLabel="Task Lead"
            contributors={contributorList}
            onChoosePeople={mayStaff ? () => setStaff(true) : undefined}
            peoplePending={tree.loading}
          />

          {/* 5. Subtasks bento card */}
          {mayViewSubtasks ? <BentoSubtasksCard
            subtasks={subtaskItems}
            actionsPending={tree.loading || facts.loading}
            canAdd={canCreateSubtask}
            onAddSubtask={() => setCreatingSubtask(true)}
            onPressSubtask={(item) =>
              navigate(workNodeRoute(tree.data!, item.id, item.title))
            }
          /> : <Notice>{hiddenSubtasksMessage}</Notice>}

          {/* 6. Supporting features 2x2 bento grid */}
          <BentoSupportingGrid
            onPressActivity={() =>
              navigate({
                name: "task",
                id,
                projectId: task.linkedProjectId,
                view: "activity",
                title: "Activity",
              })
            }
            onPressReview={() =>
              navigate({
                name: "task",
                id,
                projectId: task.linkedProjectId,
                view: "review",
                title: "Evidence & review",
              })
            }
            onPressFunding={() =>
              navigate({
                name: "task",
                id,
                projectId: task.linkedProjectId,
                view: "budget",
                title: "Funding",
              })
            }
            onPressFiles={() =>
              navigate({
                name: "task",
                id,
                projectId: task.linkedProjectId,
                view: "files",
                title: "Files",
              })
            }
          />

          {profile?.id &&
            !executionBlocked &&
            (lead || task.teamMemberIds?.includes(profile.id)) &&
            task.linkedProjectId &&
            projectStatus === "active" &&
            task.status === "in_progress" &&
            !taskBlocker && (
              <CustomWorkStatusControl
                actor={profile.id}
                taskId={id}
                customId={task.customStatusId}
              />
            )}

          {readOnly && <Notice>This work is read-only.</Notice>}
          {!!task.feedback && <Notice>{task.feedback}</Notice>}

          {editingTask && (
            <ProjectTaskEditor
              scope={taskScope}
              groups={[]}
              onClose={() => setEditingTask(false)}
              onSaved={refresh}
            />
          )}

          {!!task.description && (
            <View
              style={{
                backgroundColor: palette.surface,
                borderWidth: 1,
                borderColor: palette.border,
                borderRadius: 14,
                padding: 14,
                marginTop: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: palette.mutedLabel,
                  marginBottom: 4,
                  fontWeight: "600",
                }}
              >
                Description
              </Text>
              <Text
                selectable
                style={{ color: palette.text, fontSize: 14, lineHeight: 20 }}
              >
                {task.description}
              </Text>
            </View>
          )}

          {(!!task.definitionOfDone || !!task.acceptanceCriteria?.length) && (
            <Card title="Definition of done">
              {!!task.definitionOfDone && (
                <Text selectable>{task.definitionOfDone}</Text>
              )}
              {task.acceptanceCriteria?.map((criterion, index) => (
                <Text key={index}>• {criterion}</Text>
              ))}
            </Card>
          )}
        </>
      ) : (
        /* When inspecting a subtask (nodeId) or view === "subitems" */
        <>
          {(overview || view === "subitems") &&
            (tree.error ? (
              <ErrorState
                error={tree.error}
                retry={() => void tree.refresh()}
              />
            ) : tree.data ? (
              <WorkTreePanel
                data={tree.data}
                navigate={navigate}
                onSaved={savedTree}
                readOnly={readOnly}
                refreshing={tree.loading || facts.loading}
                projectStatus={projectStatus}
                projectLeadId={facts.data.projectLeadId}
                projectOnHold={isProjectOnHold}
                focusNodeId={nodeId}
                funding={branch ? funding : undefined}
                parentTitle={task.title}
                taskDescription={task.description}
                taskDefinitionOfDone={task.definitionOfDone}
                taskAcceptanceCriteria={task.acceptanceCriteria}
              />
            ) : (
              <Loading label="Loading subtasks" layout="tree" />
            ))}
        </>
      )}
      {!!(view === "activity") && (
        <>
          <Button
            variant="ghost"
            style={{ alignSelf: "flex-start" }}
            onPress={() =>
              navigate({
                name: "messages",
                taskId: id,
                projectId: task.linkedProjectId,
                title: "Task conversation",
              })
            }
          >
            Open task conversation
          </Button>
          <TaskActivity
            taskId={id}
            canDiscuss={participant && !readOnly}
            verifyDiscussion={async () => {
              const { latest, actorId } = await verifyCurrentTask();
              if (!getTaskTeamMemberIds(latest).includes(actorId))
                throw new PublicMessageError(
                  "Current task participation is required.",
                );
            }}
          />
        </>
      )}
      {!!(view === "review") && (
        <>
          {!!evidence.error && (
            <ErrorState
              error={evidence.error}
              retry={() => void evidence.refresh()}
            />
          )}
          {!!evidence.data && (
            <Button variant="outline" onPress={() => setExecution("submit")}>
              Check saved evidence submission
            </Button>
          )}
          <TaskReviewPanel
            task={task}
            initialSubmissionId={submissionId}
            onSaved={refresh}
            readOnly={readOnly}
          />
        </>
      )}
      {view === "budget" && funding}
      {!!(view === "files" && task.linkedProjectId) && (
        <ProjectFiles
          projectId={task.linkedProjectId}
          taskId={id}
          onManage={() =>
            navigate({
              name: "task",
              id,
              projectId: task.linkedProjectId,
              view: "file_management",
              title: "File management",
            })
          }
        />
      )}
      {!!action.error && <ErrorState context="action" error={action.error} />}
      {execution === "submit" && !!profile && (
        <TaskEvidenceSheet
          actor={profile.id}
          taskId={id}
          saved={evidence.data || null}
          verifyAccess={() => verifyExecution("submit")}
          onClose={() => {
            setExecution(undefined);
            void evidence.refresh();
          }}
          onSaved={async () => {
            await refresh();
            if (view !== "review")
              navigate({
                name: "task",
                id,
                projectId: task.linkedProjectId,
                view: "review",
                title: "Evidence & review",
              });
          }}
        />
      )}
      {(isRootOverview || view === "review") && profile && (
        <WorkProposalReview
          actor={profile.id}
          root={id}
          proposalId={view !== "review" ? submissionId : undefined}
          people={tree.data?.people}
          readOnly={executionBlocked}
          canDecideProposals={lead}
          canParticipate={participant}
          onSaved={refresh}
        />
      )}
      {proposal && profile && participant && (
        <WorkProposalSheet
          actor={profile.id}
          root={id}
          kind={proposal}
          currentProgress={task.percentComplete}
          initialBlocker={taskBlocker}
          canParticipate={participant}
          onClose={() => setProposal(undefined)}
          onSaved={refresh}
        />
      )}
      {execution === "progress" && (
        <TaskExecutionSheet
          taskId={id}
          initialBlocker={taskBlocker}
          verifyAccess={() => verifyExecution("progress")}
          onClose={() => setExecution(undefined)}
          onSaved={refresh}
        />
      )}
      {!!(creatingSubtask && tree.data) && (
        <WorkEditorSheet
          data={tree.data}
          edit={{ command: "create" }}
          projectStatus={projectStatus}
          projectLeadId={facts.data.projectLeadId}
          readOnly={readOnly || !!tree.error}
          promptPostCreateStaffing
          onClose={() => setCreatingSubtask(false)}
          onSaved={savedTree}
        />
      )}
      {!!(staff && tree.data) && (
        <WorkEditorSheet
          data={tree.data}
          edit={{ command: "root_lead", root: true }}
          projectStatus={projectStatus}
          projectLeadId={facts.data.projectLeadId}
          readOnly={readOnly || !!tree.error}
          onClose={() => setStaff(false)}
          onSaved={savedTree}
        />
      )}
    </Screen>
  );
}
