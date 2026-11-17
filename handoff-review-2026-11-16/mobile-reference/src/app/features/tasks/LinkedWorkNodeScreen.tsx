import { useState } from "react";
import {
  Button,
  EditorialMetadataStrip,
  Empty,
  ErrorState,
  Loading,
  Screen,
} from "../../components/ui";
import { useWorkStatus } from "../../shared/workStatusPresentation";
import { useAuth } from "../authentication";
import { useFacts } from "../../shared/useFacts";
import { PublicMessageError } from "../../shared/userMessages";
import { supabase } from "../../../platform/supabase";
import {
  fetchWorkTree,
  WorkTreeUnavailable,
} from "../../../core/web/app/features/nested-work/services/workTreeService";
import { rowToSubtask } from "../../../core/web/app/features/subtasks";
import { WorkTreePanel } from "./WorkTreePanel";
import { OfficeSubitemActivity } from "./OfficeSubitemActivity";
import { WorkProposalReview } from "./WorkProposalSheet";
import { WorkEditorSheet } from "./WorkEditorSheet";
import { TaskFundingCard } from "../budget/TaskFundingCard";
import { ProjectFiles } from "../projects/ProjectFiles";
import type { AppRoute, Navigate } from "../../shared/routes";
import { fetchProject } from "../projects/services";
import {
  BentoScheduleCards,
  BentoSubtaskSupportingGrid,
  PlanningDetailsView,
  priorityLabel,
} from "./TaskBentoComponents";
import { subtaskDisplayStatus } from "./subtaskSchedule";
import { hiddenSubtasksMessage, subtasksVisibleForActor } from "./subtaskVisibility";
import { useWorkRecordUpdates } from "./useWorkRecordUpdates";
import { personalReviewAllowed, workNodeRoute } from "./branchInspector";
import {
  canDecideSubtaskProposals,
  isSubtaskLeadOrContributor,
} from "./workPermissions";

type TaskPlanningInfo = {
  description?: string | null;
  definitionOfDone?: string | null;
  acceptanceCriteria?: string[] | null;
  startDate?: string | null;
  deadline?: string | null;
  dueDate?: string | null;
  parentStatus?: string;
  parentLead?: string | null;
};

const SUBPAGE_TITLES: Record<string, string> = {
  activity: "Activity",
  review: "Evidence & review",
  budget: "Funding",
  files: "Files",
  planning: "Planning details",
};

async function readTaskPlanning(taskId: string): Promise<TaskPlanningInfo | undefined> {
  if (typeof supabase.from !== "function") return undefined;
  try {
    const res = await supabase
      .from("tasks")
      .select(
        "description, definition_of_done, acceptance_criteria, start_date, deadline, due_date, status, assigned_to, recommendation_lead_id",
      )
      .eq("id", taskId)
      .maybeSingle();
    if (res.error || !res.data) return undefined;
    const row = res.data as Record<string, unknown>;
    return {
      parentStatus: typeof row.status === "string" ? row.status : undefined,
      parentLead: typeof row.assigned_to === "string" ? row.assigned_to : typeof row.recommendation_lead_id === "string" ? row.recommendation_lead_id : null,
      description: typeof row.description === "string" ? row.description : null,
      definitionOfDone:
        typeof row.definition_of_done === "string"
          ? row.definition_of_done
          : null,
      acceptanceCriteria: Array.isArray(row.acceptance_criteria)
        ? row.acceptance_criteria.filter(
            (item): item is string => typeof item === "string",
          )
        : null,
      startDate: typeof row.start_date === "string" ? row.start_date : null,
      deadline: typeof row.deadline === "string" ? row.deadline : null,
      dueDate: typeof row.due_date === "string" ? row.due_date : null,
    };
  } catch {
    return undefined;
  }
}

export function LinkedWorkNodeScreen({
  route,
  navigate,
}: {
  route: AppRoute;
  navigate: Navigate;
}) {
  const { profile } = useAuth();
  const actor = profile?.id;
  const resolveStatus = useWorkStatus();
  const [personalReviewOpen, setPersonalReviewOpen] = useState(false);
  const personal = route.name === "personal_project";
  const rootId = personal ? route.taskId : route.id;
  const nodeId = route.nodeId;
  const projectId = personal ? route.id : route.projectId;
  const facts = useFacts(
    "linked-node:" + [actor, rootId, nodeId, projectId].join(":"),
    async () => {
      if (!rootId || !nodeId)
        throw new PublicMessageError(
          "This link is missing its task or subtask ID.",
        );
      try {
        const tree = await fetchWorkTree(rootId);
        if (
          tree.root.kind !== (personal ? "personal" : "office") ||
          (projectId && tree.root.project !== projectId)
        )
          throw new PublicMessageError(
            "This subtask is outside the linked project context.",
          );
        if (!subtasksVisibleForActor(tree.root, actor)) throw new PublicMessageError(hiddenSubtasksMessage);
        let projectStatus: string | undefined;
        let projectLeadId: string | undefined;
        if (!personal && tree.root.project) {
          const proj = await fetchProject(tree.root.project);
          projectStatus = proj?.status;
          projectLeadId = proj?.projectLeadId;
        }
        const node = tree.nodes.find(
          (item) => item.id === nodeId && item.task_id === rootId,
        );
        const taskPlanning = !personal ? await readTaskPlanning(rootId) : undefined;
        return { tree, node, projectStatus, projectLeadId, taskPlanning };
      } catch (error) {
        if (!(error instanceof WorkTreeUnavailable) || personal) throw error;
        let legacyProjectId: string | null | undefined;
        {
          const parent = await supabase
            .from("tasks")
            .select("linked_project_id")
            .eq("id", rootId)
            .maybeSingle();
          if (
            parent.error ||
            !parent.data ||
            (projectId && parent.data.linked_project_id !== projectId)
          )
            throw new PublicMessageError(
              "The linked project context could not be verified.",
            );
          legacyProjectId = parent.data.linked_project_id as
            | string
            | null
            | undefined;
          if (legacyProjectId)
            await fetchProject(legacyProjectId);
        }
        // Older Office feeds can carry a legacy subtask. Read only that exact record under RLS.
        const result = await supabase
          .from("subtasks")
          .select("*")
          .eq("task_id", rootId)
          .eq("id", nodeId)
          .maybeSingle();
        if (result.error) throw result.error;
        const taskPlanning = await readTaskPlanning(rootId);
        if (!subtasksVisibleForActor({ kind: "office", lead: taskPlanning?.parentLead ?? null, status: taskPlanning?.parentStatus }, actor))
          throw new PublicMessageError(hiddenSubtasksMessage);
        return {
          legacy: result.data ? rowToSubtask(result.data) : undefined,
          legacyProjectId,
          legacyStart: result.data?.start_date as string | null | undefined,
          legacyStartedAt: result.data?.started_at as string | null | undefined,
          legacyPriority: result.data?.priority as string | null | undefined,
          customStatusId:
            typeof result.data?.custom_status_id === "string"
              ? result.data.custom_status_id
              : undefined,
          taskPlanning,
        };
      }
    },
  );
  useWorkRecordUpdates(rootId, facts.refresh, personal);
  const data = facts.data;
  const legacyStatus =
    data?.legacy &&
    subtaskDisplayStatus({
      status: data.legacy.status,
      started_at: data.legacyStartedAt,
    });
  const legacyPresentation =
    legacyStatus && resolveStatus(legacyStatus, data?.customStatusId);

  const view = route.view;
  const isOverview = !view || view === "details" || view === "subitems";
  const subpageTitle = view ? SUBPAGE_TITLES[view] : undefined;
  const itemTitle = data?.node?.title || data?.legacy?.title;

  const branch =
    data?.tree && data.node
      ? {
          tree: data.tree,
          node: data.node,
          projectStatus: data.projectStatus,
          projectLeadId: data.projectLeadId,
          taskPlanning: data.taskPlanning,
        }
      : null;

  const effectiveReadOnly = branch
    ? branch.projectStatus
      ? ["completed", "archived", "unavailable"].includes(branch.projectStatus)
      : !branch.tree.root.open
    : false;
  const executionBlocked = branch?.projectStatus === "on_hold";
  const isNodeWorkerOrLead = Boolean(
    branch &&
      actor &&
      isSubtaskLeadOrContributor(branch.tree, branch.node, actor),
  );
  const canReviewProposals = Boolean(
    branch && actor && canDecideSubtaskProposals(branch.tree, branch.node, actor),
  );

  const branchFunding =
    branch && !personal && branch.tree.root.office ? (
      <TaskFundingCard
        key={branch.node.id}
        task={{
          id: branch.tree.root.id,
          orgId: branch.tree.root.office,
          linkedProjectId: branch.tree.root.project ?? undefined,
          startDate:
            branch.taskPlanning?.startDate ??
            branch.tree.root.scheduleBounds?.taskStart ??
            undefined,
          deadline:
            branch.taskPlanning?.deadline ??
            branch.tree.root.scheduleBounds?.taskDue ??
            undefined,
          dueDate:
            branch.taskPlanning?.dueDate ??
            branch.tree.root.scheduleBounds?.taskDue ??
            undefined,
          status:
            branch.tree.root.status === "completed" ||
            branch.tree.root.status === "cancelled"
              ? branch.tree.root.status
              : undefined,
        }}
        subtaskId={branch.node.id}
        recordId={route.recordId}
        onOpenLinkedSubitem={
          route.recordId
            ? (linkedNodeId) =>
                navigate({
                  ...workNodeRoute(branch.tree, linkedNodeId, "Subtask funding"),
                  view: "budget",
                  recordId: route.recordId,
                })
            : undefined
        }
        canManage={isNodeWorkerOrLead}
        subtaskFinished={branch.node.status === "completed"}
        readOnly={effectiveReadOnly}
      />
    ) : null;

  return (
    <Screen
      compact
      title={
        isOverview && branch
          ? undefined
          : subpageTitle || itemTitle || "Linked subtask"
      }
      description={subpageTitle ? itemTitle || route.title : undefined}
      onRefresh={() => facts.refresh()}
    >
      {facts.error ? (
        <ErrorState error={facts.error} retry={() => void facts.refresh()} />
      ) : !data ? (
        <Loading label="Loading linked subtask" layout="task" />
      ) : branch ? (
        isOverview ? (
          <WorkTreePanel
            data={branch.tree}
            navigate={navigate}
            focusNodeId={branch.node.id}
            proposalId={
              route.recordType === "work_proposal" ||
              (personal && route.recordId)
                ? route.recordId
                : undefined
            }
            readOnly={!branch.tree.root.open}
            refreshing={facts.loading}
            projectStatus={branch.projectStatus}
            projectLeadId={branch.projectLeadId}
            projectOnHold={executionBlocked}
            taskDescription={branch.taskPlanning?.description}
            taskDefinitionOfDone={branch.taskPlanning?.definitionOfDone}
            taskAcceptanceCriteria={branch.taskPlanning?.acceptanceCriteria}
            onSaved={async () => {
              await facts.refresh();
            }}
          />
        ) : view === "activity" ? (
          <OfficeSubitemActivity
            tree={branch.tree}
            nodeId={branch.node.id}
            actorId={actor || null}
          />
        ) : view === "review" ? (
          <>
            {actor &&
              personalReviewAllowed(
                branch.tree,
                branch.node.id,
                actor,
                effectiveReadOnly || executionBlocked,
              ) && (
                <Button onPress={() => setPersonalReviewOpen(true)}>
                  Review subtask
                </Button>
              )}
            {actor ? (
              <WorkProposalReview
                key={"proposals:" + branch.node.id}
                actor={actor}
                root={branch.tree.root.id}
                node={branch.node.id}
                proposalId={route.recordId}
                people={branch.tree.people}
                readOnly={effectiveReadOnly || executionBlocked}
                canDecideProposals={canReviewProposals}
                canParticipate={isNodeWorkerOrLead}
                officeSubtask={branch.tree.root.kind === "office"}
                showEmpty
                onOpenCash={
                  !personal && branch.tree.root.office
                    ? (recordId) =>
                        navigate({
                          ...workNodeRoute(
                            branch.tree,
                            branch.node.id,
                            "Cash request",
                          ),
                          view: "budget",
                          recordId,
                        })
                    : undefined
                }
                onSaved={async () => {
                  await facts.refresh();
                }}
              />
            ) : (
              <Empty
                title="Review unavailable"
                description="Sign in to view evidence and work submissions."
              />
            )}
            {personalReviewOpen && (
              <WorkEditorSheet
                data={branch.tree}
                edit={{ command: "review", node: branch.node }}
                projectStatus={branch.projectStatus}
                projectLeadId={branch.projectLeadId}
                readOnly={effectiveReadOnly || executionBlocked}
                onClose={() => setPersonalReviewOpen(false)}
                onSaved={async () => {
                  setPersonalReviewOpen(false);
                  await facts.refresh();
                }}
              />
            )}
          </>
        ) : view === "budget" ? (
          branchFunding ?? (
            <Empty
              title="Funding unavailable"
              description="Only office subtasks have task funding controls."
            />
          )
        ) : view === "files" ? (
          branch.tree.root.project ? (
            <ProjectFiles
              projectId={branch.tree.root.project}
              taskId={branch.tree.root.id}
              onManage={
                !personal
                  ? () =>
                      navigate({
                        name: "task",
                        id: branch.tree.root.id,
                        projectId: branch.tree.root.project,
                        view: "file_management",
                        title: "File management",
                      })
                  : undefined
              }
            />
          ) : (
            <Empty
              title="Files unavailable"
              description="No project is linked to this subtask."
            />
          )
        ) : view === "planning" ? (
          <PlanningDetailsView
            description={branch.taskPlanning?.description}
            definitionOfDone={branch.taskPlanning?.definitionOfDone}
            acceptanceCriteria={branch.taskPlanning?.acceptanceCriteria}
          />
        ) : (
          <WorkTreePanel
            data={branch.tree}
            navigate={navigate}
            focusNodeId={branch.node.id}
            proposalId={
              route.recordType === "work_proposal" ||
              (personal && route.recordId)
                ? route.recordId
                : undefined
            }
            readOnly={!branch.tree.root.open}
            refreshing={facts.loading}
            projectStatus={branch.projectStatus}
            projectLeadId={branch.projectLeadId}
            projectOnHold={executionBlocked}
            taskDescription={branch.taskPlanning?.description}
            taskDefinitionOfDone={branch.taskPlanning?.definitionOfDone}
            taskAcceptanceCriteria={branch.taskPlanning?.acceptanceCriteria}
            onSaved={async () => {
              await facts.refresh();
            }}
          />
        )
      ) : data.legacy && legacyPresentation ? (
        view === "activity" ? (
          <OfficeSubitemActivity
            rootId={rootId}
            nodeId={data.legacy.id}
            actorId={actor || null}
          />
        ) : view === "budget" ? (
          rootId ? (
            <TaskFundingCard
              key={data.legacy.id}
              task={{
                id: rootId,
                linkedProjectId: data.legacyProjectId ?? undefined,
                startDate: data.taskPlanning?.startDate ?? undefined,
                deadline: data.taskPlanning?.deadline ?? undefined,
                dueDate: data.taskPlanning?.dueDate ?? undefined,
              }}
              subtaskId={data.legacy.id}
              recordId={route.recordId}
              canManage={false}
              readOnly
            />
          ) : (
            <Empty title="Funding unavailable" />
          )
        ) : view === "files" ? (
          data.legacyProjectId && rootId ? (
            <ProjectFiles projectId={data.legacyProjectId} taskId={rootId} />
          ) : (
            <Empty
              title="Files unavailable"
              description="No project is linked to this subtask."
            />
          )
        ) : view === "planning" ? (
          <PlanningDetailsView
            description={data.taskPlanning?.description}
            definitionOfDone={data.taskPlanning?.definitionOfDone}
            acceptanceCriteria={data.taskPlanning?.acceptanceCriteria}
          />
        ) : view === "review" ? (
          <Empty
            title="No review submissions"
            description="Extended work submissions are unavailable for archived subtasks."
          />
        ) : (
          <>
            <EditorialMetadataStrip
              items={[
                {
                  label: "Status",
                  value: legacyPresentation.label,
                  accent: legacyPresentation.color,
                  status: legacyStatus,
                },
                {
                  label: "Priority",
                  value: data.legacyPriority
                    ? priorityLabel(data.legacyPriority)
                    : "—",
                },
                {
                  label: "Progress",
                  value:
                    data.legacy.status === "completed" ? "100%" : "Unavailable",
                },
              ]}
            />
            <BentoScheduleCards
              startDate={data.legacyStart}
              dueDate={data.legacy.dueDate}
              workTimezone="Asia/Manila"
            />
            {!!rootId && (
              <BentoSubtaskSupportingGrid
                onPressActivity={() =>
                  navigate({
                    name: "task",
                    id: rootId,
                    projectId,
                    nodeId: data.legacy!.id,
                    view: "activity",
                    title: "Activity",
                  })
                }
                onPressReview={() =>
                  navigate({
                    name: "task",
                    id: rootId,
                    projectId,
                    nodeId: data.legacy!.id,
                    view: "review",
                    title: "Evidence & review",
                  })
                }
                onPressFunding={() =>
                  navigate({
                    name: "task",
                    id: rootId,
                    projectId,
                    nodeId: data.legacy!.id,
                    view: "budget",
                    title: "Funding",
                  })
                }
                onPressFiles={() =>
                  navigate({
                    name: "task",
                    id: rootId,
                    projectId,
                    nodeId: data.legacy!.id,
                    view: "files",
                    title: "Files",
                  })
                }
                onPressPlanning={() =>
                  navigate({
                    name: "task",
                    id: rootId,
                    projectId,
                    nodeId: data.legacy!.id,
                    view: "planning",
                    title: "Planning details",
                  })
                }
              />
            )}
          </>
        )
      ) : (
        <Empty
          title="This subtask is no longer available"
          description="The linked task or branch may have changed, or access may have been withdrawn."
        />
      )}
    </Screen>
  );
}
