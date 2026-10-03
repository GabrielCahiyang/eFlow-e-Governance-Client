import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTasks } from "../../../hooks/useFirebaseData";
import { withEmployeeDeadlineWorkload, taskEstimateError } from "../../tasks";
import { Layers, Plus } from "lucide-react";
import { useDeptDirectoryEmployees } from "../../members";
import { DraftCockpit } from "../../proposal-import/components/DraftCockpit";
import { AssignmentModal } from "../../proposal-import/components/AssignmentModal";
import type { DraftTask } from "../../proposal-import/components/draftModel";
import {
  addManualActivity,
  addManualProgram,
  addManualProject,
  addManualTask,
  renameManualProgram,
  renameManualProject,
  updateManualActivity,
} from "../../proposal-import/services/manualPlanDraft";
import { CollaborationPlanPanel } from "./CollaborationPlanPanel";
import type { Organization } from "../../../types";
import type { CollaborationDraftSnapshot, CollaborationSnapshotTask } from "../types";
import { withSynchronizedProposalBudget } from "../selectors/snapshotAdapter";

// ─── Adapters ────────────────────────────────────────────────────────────────

function snapshotTaskToDraftTask(task: CollaborationSnapshotTask): DraftTask {
  return {
    key: task.key,
    proposalTitle: task.proposalTitle,
    proposalId: task.proposalId,
    programIdx: task.programIdx,
    projectIdx: task.projectIdx,
    activityIdx: task.activityIdx,
    taskIdx: task.taskIdx,
    programId: task.programId,
    programTitle: task.programTitle,
    projectId: task.projectId,
    projectTitle: task.projectTitle,
    activityId: task.activityId,
    activityTitle: task.activityTitle,
    activitySchedule: task.activitySchedule,
    title: task.title,
    description: task.description,
    deadline: task.deadline,
    estimatedHours: task.estimatedHours,
    primaryOrgId: task.primaryOrgId,
    supportingOrgIds: task.supportingOrgIds,
    activityPrimaryOrgId: task.activityPrimaryOrgId,
    activitySupportingOrgIds: task.activitySupportingOrgIds,
    priority: task.priority,
    requiredSkills: task.requiredSkills,
    assignedMemberIds: task.assignedMemberIds,
    leadMemberId: task.leadMemberId,
    burnoutWarning: task.burnoutWarning,
    reasoning: task.reasoning,
    budgetDecision: task.budgetDecision,
    budgetNoCostReason: task.budgetNoCostReason,
    budgetLines: task.budgetLines,
    enabled: task.enabled,
  };
}

function draftTasksToSnapshotTasks(
  draftTasks: DraftTask[],
  original: CollaborationSnapshotTask[],
): CollaborationSnapshotTask[] {
  return draftTasks.map((dt): CollaborationSnapshotTask => {
    const orig = original.find((t) => t.key === dt.key);
    return {
      key: dt.key,
      proposalTitle: dt.proposalTitle,
      proposalId: dt.proposalId,
      programIdx: dt.programIdx,
      projectIdx: dt.projectIdx,
      activityIdx: dt.activityIdx,
      taskIdx: dt.taskIdx,
      programId: dt.programId,
      programTitle: dt.programTitle,
      projectId: dt.projectId,
      projectTitle: dt.projectTitle,
      activityId: dt.activityId,
      activityTitle: dt.activityTitle,
      activitySchedule: dt.activitySchedule,
      // preserve org responsibility from original; falls back to ownerOrg
      activityPrimaryOrgId: orig?.activityPrimaryOrgId ?? "",
      activitySupportingOrgIds: orig?.activitySupportingOrgIds ?? [],
      primaryOrgId: orig?.primaryOrgId ?? "",
      supportingOrgIds: orig?.supportingOrgIds ?? [],
      title: dt.title,
      description: dt.description,
      deadline: dt.deadline,
      estimatedHours: dt.estimatedHours,
      priority: dt.priority,
      requiredSkills: dt.requiredSkills,
      assignedMemberIds: dt.assignedMemberIds,
      leadMemberId: dt.leadMemberId,
      burnoutWarning: dt.burnoutWarning,
      reasoning: dt.reasoning,
      enabled: dt.enabled,
      budgetDecision: dt.budgetDecision,
      budgetNoCostReason: dt.budgetNoCostReason,
      budgetLines: dt.budgetLines,
    };
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CollaborationPlanEditPanel({
  snapshot,
  organizations,
  editable,
  onSave,
}: {
  snapshot: CollaborationDraftSnapshot;
  organizations: Organization[];
  editable: boolean;
  onSave: (snapshot: CollaborationDraftSnapshot, summary: string) => Promise<void>;
}) {
  // When not editable, delegate to the existing read-only panel
  if (!editable) {
    return (
      <CollaborationPlanPanel
        snapshot={snapshot}
        organizations={organizations}
        editable={false}
        onSave={onSave}
      />
    );
  }

  return (
    <CollaborationPlanEditPanelInner
      snapshot={snapshot}
      organizations={organizations}
      onSave={onSave}
    />
  );
}

function CollaborationPlanEditPanelInner({
  snapshot,
  onSave,
}: {
  snapshot: CollaborationDraftSnapshot;
  organizations: Organization[];
  onSave: (snapshot: CollaborationDraftSnapshot, summary: string) => Promise<void>;
}) {
  const { allEmployees: directoryEmployees } = useDeptDirectoryEmployees({
    scope: "exact",
    includeCurrentUser: true,
    includeDepartmentHeads: true,
    activeOnly: true,
    excludeAdmins: true,
  });

  const { tasks: liveTasks } = useTasks();
  const allEmployees = useMemo(() => withEmployeeDeadlineWorkload(directoryEmployees, liveTasks), [directoryEmployees, liveTasks]);

  // Initialize draftTasks from snapshot; re-sync when snapshot changes from the outside
  const [draftTasks, setDraftTasks] = useState<DraftTask[]>(() =>
    snapshot.tasks.map(snapshotTaskToDraftTask),
  );
  const snapshotRef = useRef(snapshot);
  useEffect(() => {
    // Only reset if the snapshot changed from an external save (not from our own edits)
    if (snapshotRef.current !== snapshot) {
      snapshotRef.current = snapshot;
      setDraftTasks(snapshot.tasks.map(snapshotTaskToDraftTask));
    }
  }, [snapshot]);

  const [assignModalTaskKey, setAssignModalTaskKey] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");

  const currentDraftTask = useMemo(
    () => (assignModalTaskKey ? draftTasks.find((dt) => dt.key === assignModalTaskKey) : null),
    [assignModalTaskKey, draftTasks],
  );

  const handleUpdate = useCallback((key: string, patch: Partial<DraftTask>) => {
    setDraftTasks((prev) =>
      prev.map((dt) => (dt.key === key ? { ...dt, ...patch } : dt)),
    );
  }, []);

  const handleDelete = useCallback((key: string) => {
    setDraftTasks((prev) => prev.filter((dt) => dt.key !== key));
  }, []);

  const handleAddTask = useCallback(
    (programIdx: number, projectIdx: number, activityIdx: number) =>
      setDraftTasks((prev) => addManualTask(prev, programIdx, projectIdx, activityIdx)),
    [],
  );

  const handleAddProgram = useCallback(
    () =>
      setDraftTasks((prev) =>
        addManualProgram(prev, snapshot.title || "Untitled proposal"),
      ),
    [snapshot.title],
  );

  const handleAddProject = useCallback(
    (programIdx: number) =>
      setDraftTasks((prev) => addManualProject(prev, programIdx)),
    [],
  );

  const handleAddActivity = useCallback(
    (programIdx: number, projectIdx: number) =>
      setDraftTasks((prev) => addManualActivity(prev, programIdx, projectIdx)),
    [],
  );

  const handleRenameProgram = useCallback(
    (programIdx: number, title: string) =>
      setDraftTasks((prev) => renameManualProgram(prev, programIdx, title)),
    [],
  );

  const handleRenameProject = useCallback(
    (programIdx: number, projectIdx: number, title: string) =>
      setDraftTasks((prev) => renameManualProject(prev, programIdx, projectIdx, title)),
    [],
  );

  const handleUpdateActivity = useCallback(
    (
      programIdx: number,
      projectIdx: number,
      activityIdx: number,
      title: string,
      schedule: string,
    ) =>
      setDraftTasks((prev) =>
        updateManualActivity(prev, programIdx, projectIdx, activityIdx, {
          activityTitle: title,
          activitySchedule: schedule,
        }),
      ),
    [],
  );


  const handleCommit = useCallback(async () => {
    const invalidEstimate = draftTasks.find((task) => task.enabled && taskEstimateError(task.estimatedHours));
    if (invalidEstimate) { setCommitMessage(`${invalidEstimate.title}: ${taskEstimateError(invalidEstimate.estimatedHours)}`); return; }
    setCommitting(true);
    try {
      const updatedTasks = draftTasksToSnapshotTasks(draftTasks, snapshot.tasks);
      const updatedSnapshot = withSynchronizedProposalBudget(snapshot, updatedTasks);
      await onSave(updatedSnapshot, "Work breakdown updated");
      snapshotRef.current = updatedSnapshot;
      setCommitMessage("Plan saved successfully.");
    } catch (error) {
      setCommitMessage(error instanceof Error ? error.message : "The plan could not be saved.");
    } finally {
      setCommitting(false);
    }
  }, [draftTasks, snapshot, onSave]);

  // When draftTasks is empty (e.g. all deleted), show add-program prompt
  if (draftTasks.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 px-6 py-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-card text-primary shadow-sm">
          <Layers size={22} />
        </div>
        <h2 className="mt-4 text-sm font-bold text-neutral-800">Add a Program to start</h2>
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-neutral-500">
          A Program contains Projects. Each Project contains Activities and Tasks.
        </p>
        <button
          type="button"
          onClick={handleAddProgram}
          className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 cursor-pointer"
        >
          <Plus size={14} /> Add first Program
        </button>
      </section>
    );
  }

  return (
    <>
      <DraftCockpit
        source="manual"
        proposalTitle={snapshot.title || "Untitled proposal"}
        draftTasks={draftTasks}
        employees={allEmployees}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onAdd={handleAddTask}
        onOpenModal={setAssignModalTaskKey}
        onCommit={() => void handleCommit()}
        committing={committing}
        commitMessage={commitMessage}
        autoSaveState={undefined}
        onAddProgram={handleAddProgram}
        onAddProject={handleAddProject}
        onAddActivity={handleAddActivity}
        onRenameProgram={handleRenameProgram}
        onRenameProject={handleRenameProject}
        onUpdateActivity={handleUpdateActivity}
      />

      <AssignmentModal
        open={Boolean(assignModalTaskKey)}
        onClose={() => setAssignModalTaskKey(null)}
        employees={allEmployees}
        selectedIds={currentDraftTask?.assignedMemberIds ?? []}
        leadId={currentDraftTask?.leadMemberId ?? null}
        onConfirm={(memberIds, leadMemberId) => {
          if (assignModalTaskKey) {
            handleUpdate(assignModalTaskKey, { assignedMemberIds: memberIds, leadMemberId });
          }
          setAssignModalTaskKey(null);
        }}
      />
    </>
  );
}
