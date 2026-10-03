import { withEmployeeDeadlineWorkload } from "../../selectors/employeeDeadlineWorkload";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type Task, type UpdateTaskPayload, undoCompletedTask } from "../../../../services/taskService";
import type { Employee } from "../../../../services/employeeService";
import { cancelTask } from "../../services/taskLifecycleService";
import { archiveTask, unarchiveTask } from "../../services/taskArchiveService";
import {
  offerEmptyProjectCleanup,
} from "../../../projects";
import { buildTaskEditorDraft, uniqueValues, type BoardView, type MondayBoardProps, type TaskEditorDraft } from "./model";

export function useMondayBoardController({
  tasks,
  employees = [],
  allEmployees = [],
  departmentFilter,
  currentUserId,
  currentUserName,
  onSubmit,
  onUpdateTask,
  onDeleteTask,
}: MondayBoardProps) {
  // ── View & composer state ─────────────────────────────────────
  const [boardView, setBoardView] = useState<BoardView>("list");

  // ── Employee lookups ──────────────────────────────────────────
  const deptEmployees = useMemo(() => {
    return withEmployeeDeadlineWorkload(employees || [], tasks);
  }, [employees, tasks]);

  const employeeById = useMemo(
    () => {
      const candidates = allEmployees && allEmployees.length > 0 ? allEmployees : deptEmployees;
      return Object.fromEntries(candidates.map((e) => [e.id, e])) as Record<
        string,
        Employee
      >;
    },
    [deptEmployees, allEmployees],
  );

  const [taskEditorOpen, setTaskEditorOpen] = useState(false);
  const [taskEditorTaskId, setTaskEditorTaskId] = useState<string | null>(null);
  const [taskEditorDraft, setTaskEditorDraft] =
    useState<TaskEditorDraft | null>(null);
  const [taskEditorSaving, setTaskEditorSaving] = useState(false);
  const [taskEditorError, setTaskEditorError] = useState("");
  const [taskEditorAssignOpen, setTaskEditorAssignOpen] = useState(false);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submitModalTask, setSubmitModalTask] = useState<Task | null>(null);
  const [submitNote, setSubmitNote] = useState("");
  const [submitFiles, setSubmitFiles] = useState<File[]>([]);
  const [submitError, setSubmitError] = useState("");
  const [submitSaving, setSubmitSaving] = useState(false);
  const [undoModalOpen, setUndoModalOpen] = useState(false);
  const [undoModalTask, setUndoModalTask] = useState<Task | null>(null);
  const [undoReason, setUndoReason] = useState("");
  const [undoError, setUndoError] = useState("");
  const [undoSaving, setUndoSaving] = useState(false);

  // ── Task filter ───────────────────────────────────────────────
  const deptTasks = useMemo(() => {
    if (!departmentFilter) return tasks;
    return tasks.filter(
      (t) =>
        !t.department ||
        t.department === departmentFilter ||
        t.status === "pending_assignment",
    );
  }, [tasks, departmentFilter]);

  const editingTask = useMemo(
    () =>
      taskEditorTaskId
        ? deptTasks.find((task) => task.id === taskEditorTaskId) || null
        : null,
    [deptTasks, taskEditorTaskId],
  );

  const openTaskEditor = useCallback((task: Task) => {
    setTaskEditorTaskId(task.id);
    setTaskEditorDraft(buildTaskEditorDraft(task));
    setTaskEditorError("");
    setTaskEditorOpen(true);
  }, []);

  const closeTaskEditor = useCallback(() => {
    setTaskEditorOpen(false);
    setTaskEditorTaskId(null);
    setTaskEditorDraft(null);
    setTaskEditorError("");
    setTaskEditorAssignOpen(false);
    setTaskEditorSaving(false);
  }, []);

  const openSubmitModal = useCallback((task: Task) => {
    setSubmitModalTask(task);
    setSubmitNote("");
    setSubmitFiles([]);
    setSubmitError("");
    setSubmitSaving(false);
    setSubmitModalOpen(true);
  }, []);

  const closeSubmitModal = useCallback(() => {
    setSubmitModalOpen(false);
    setSubmitModalTask(null);
    setSubmitNote("");
    setSubmitFiles([]);
    setSubmitError("");
    setSubmitSaving(false);
  }, []);

  const handleRemoveAttachment = useCallback((index: number) => {
    if (window.confirm("Remove this attachment from the submission?")) setSubmitFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmitConfirm = useCallback(async () => {
    if (!submitModalTask) return;
    if (!onSubmit) {
      closeSubmitModal();
      return;
    }
    const trimmedNote = submitNote.trim();
    if (!trimmedNote) {
      setSubmitError("Completion note is required.");
      return;
    }

    setSubmitSaving(true);
    setSubmitError("");
    try {
      await onSubmit(submitModalTask.id, {
        note: trimmedNote,
        attachments: submitFiles,
      });
      closeSubmitModal();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Failed to submit for review. Please try again.",
      );
      setSubmitSaving(false);
    }
  }, [closeSubmitModal, onSubmit, submitFiles, submitModalTask, submitNote]);

  const openUndoModal = useCallback((task: Task) => {
    setUndoModalTask(task);
    setUndoReason("");
    setUndoError("");
    setUndoSaving(false);
    setUndoModalOpen(true);
  }, []);

  const closeUndoModal = useCallback(() => {
    setUndoModalOpen(false);
    setUndoModalTask(null);
    setUndoReason("");
    setUndoError("");
    setUndoSaving(false);
  }, []);

  const handleUndoConfirm = useCallback(async () => {
    if (!undoModalTask) return;
    const trimmedReason = undoReason.trim();
    if (!trimmedReason) {
      setUndoError("Undo reason is required.");
      return;
    }

    setUndoSaving(true);
    setUndoError("");
    try {
      await undoCompletedTask(undoModalTask.id, {
        reason: trimmedReason,
        actor: currentUserId
          ? {
              id: currentUserId,
              name: currentUserName || "Head",
            }
          : undefined,
      });
      closeUndoModal();
    } catch {
      setUndoError("Failed to reopen task. Please try again.");
      setUndoSaving(false);
    }
  }, [
    closeUndoModal,
    currentUserId,
    currentUserName,
    undoModalTask,
    undoReason,
  ]);

  useEffect(() => {
    if (taskEditorOpen && taskEditorTaskId && !editingTask) {
      closeTaskEditor();
    }
  }, [taskEditorOpen, taskEditorTaskId, editingTask, closeTaskEditor]);

  // ── Manual Composer state ─────────────────────────────────────
  const handleTaskEditorSave = async () => {
    if (!onUpdateTask || !editingTask || !taskEditorDraft) return;
    if (!taskEditorDraft.title.trim()) {
      setTaskEditorError("Task title is required.");
      return;
    }
    if (taskEditorDraft.estimatedHours !== undefined && (!Number.isFinite(taskEditorDraft.estimatedHours) || taskEditorDraft.estimatedHours <= 0)) { setTaskEditorError("Estimated task days must be greater than zero."); return; }

    const memberIds = uniqueValues(taskEditorDraft.teamMemberIds);
    const resolvedLeadId =
      (taskEditorDraft.leadMemberId &&
        memberIds.includes(taskEditorDraft.leadMemberId) &&
        taskEditorDraft.leadMemberId) ||
      memberIds[0] ||
      "";
    const leadMember = resolvedLeadId
      ? employeeById[resolvedLeadId]
      : undefined;
    if (
      resolvedLeadId &&
      (taskEditorDraft.reviewerId === resolvedLeadId ||
        taskEditorDraft.backupReviewerId === resolvedLeadId)
    ) {
      setTaskEditorError("The task owner cannot also be a reviewer.");
      return;
    }
    const teamMemberNames = memberIds
      .map((id) => employeeById[id]?.name || "")
      .filter(Boolean);
    const hierarchyPath = [
      taskEditorDraft.proposalTitle,
      taskEditorDraft.programTitle,
      taskEditorDraft.projectTitle,
      taskEditorDraft.activityTitle,
    ]
      .map((value) => value.trim())
      .filter(Boolean)
      .join(" > ");

    const payload: UpdateTaskPayload = {
      estimatedHours: taskEditorDraft.estimatedHours || 0,
      title: taskEditorDraft.title.trim(),
      description: taskEditorDraft.description.trim(),
      deadline: taskEditorDraft.deadline.trim(),
      priority: taskEditorDraft.priority,
      tags: uniqueValues(
        taskEditorDraft.tagsText
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      ),
      proposalTitle: taskEditorDraft.proposalTitle.trim(),
      programTitle: taskEditorDraft.programTitle.trim(),
      projectTitle: taskEditorDraft.projectTitle.trim(),
      activityTitle: taskEditorDraft.activityTitle.trim(),
      activitySchedule: taskEditorDraft.activitySchedule.trim(),
      hierarchyPath,
      teamMemberIds: memberIds,
      teamMemberNames,
      assigneeId: resolvedLeadId,
      assigneeName: leadMember?.name || "",
      recommendedEmployeeIds: memberIds,
      reviewerId: taskEditorDraft.reviewerId || "",
      backupReviewerId: taskEditorDraft.backupReviewerId || "",
      acceptanceCriteria: uniqueValues(
        taskEditorDraft.acceptanceCriteriaText
          .split("\n")
          .map((criterion) => criterion.trim())
          .filter(Boolean),
      ),
      definitionOfDone: taskEditorDraft.definitionOfDone.trim(),
      dependencyIds: uniqueValues(taskEditorDraft.dependencyIds),
      teamId: memberIds.length
        ? leadMember?.department || editingTask.teamId || departmentFilter || ""
        : "",
      teamName: memberIds.length
        ? leadMember?.departmentName ||
          leadMember?.department ||
          editingTask.teamName ||
          departmentFilter ||
          ""
        : "",
    };

    if (editingTask.status === "pending_assignment" && memberIds.length > 0) {
      payload.status = "todo";
    }

    if ((resolvedLeadId !== (editingTask.assigneeId || "") || (editingTask.teamMemberIds || []).some((id) => !memberIds.includes(id))) && !window.confirm("Save these responsibility changes? This changes the task lead or removes members from the assigned team.")) return;

    setTaskEditorSaving(true);
    setTaskEditorError("");
    try {
      await onUpdateTask(editingTask.id, payload);
      closeTaskEditor();
    } catch (error) {
      setTaskEditorError(
        error instanceof Error
          ? error.message
          : "Failed to save task changes. Please try again.",
      );
      setTaskEditorSaving(false);
    }
  };

  const handleTaskDeleteRequest = useCallback(
    async (task: Task) => {
      if (!onDeleteTask) return;
      const confirmed = window.confirm(
        `Delete task "${task.title}"?\n\nThis removes the task only. Its operational project remains unless it becomes empty and you separately confirm project deletion.`,
      );
      if (!confirmed) return;
      try {
        await onDeleteTask(task.id);
        if (taskEditorTaskId === task.id) closeTaskEditor();
      } catch {
        setTaskEditorError("Failed to delete task. Please try again.");
        setTaskEditorOpen(true);
        return;
      }

      if (!task.linkedProjectId) return;
      try {
        const outcome = await offerEmptyProjectCleanup(
          task.linkedProjectId,
          (emptyProject) => window.confirm(
            `Task deleted. The operational project "${emptyProject.title}" now has no remaining tasks.\n\nPermanently delete this empty project container, its milestones, and membership list too?`,
          ),
        );
        if (outcome.status === "deleted") {
          window.alert(`Empty project "${outcome.project.title}" was permanently deleted.`);
        }
      } catch (error) {
        window.alert(
          `The task was deleted, but the empty project container could not be removed. ${
            error instanceof Error ? error.message : "Open Projects and retry the permanent deletion."
          }`,
        );
      }
    },
    [onDeleteTask, taskEditorTaskId, closeTaskEditor],
  );

  const handleTaskCancelRequest = useCallback(
    async (task: Task) => {
      const reason = window.prompt(`Why is "${task.title}" being cancelled?`);
      if (!reason?.trim()) return;
      try {
        await cancelTask(task.id, reason);
        closeTaskEditor();
      } catch (error) {
        setTaskEditorError(error instanceof Error ? error.message : "Failed to cancel task.");
      }
    },
    [closeTaskEditor],
  );

  const handleTaskArchiveRequest = useCallback(async (task: Task) => {
    const shouldArchive = !task.archivedAt;
    if (shouldArchive && !window.confirm(`Archive task "${task.title}"?`)) return;
    try {
      if (shouldArchive) await archiveTask(task.id);
      else await unarchiveTask(task.id);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Task archive update failed.");
    }
  }, []);

  const handleTaskEditorDelete = async () => {
    if (!editingTask) return;
    setTaskEditorSaving(true);
    await handleTaskDeleteRequest(editingTask);
    setTaskEditorSaving(false);
  };




  return {
    boardView,
    setBoardView,
    deptEmployees,
    employeeById,
    taskEditorOpen,
    taskEditorDraft,
    setTaskEditorDraft,
    taskEditorSaving,
    taskEditorError,
    taskEditorAssignOpen,
    setTaskEditorAssignOpen,
    submitModalOpen,
    submitModalTask,
    submitNote,
    setSubmitNote,
    submitFiles,
    setSubmitFiles,
    submitError,
    submitSaving,
    undoModalOpen,
    undoModalTask,
    undoReason,
    setUndoReason,
    undoError,
    undoSaving,
    deptTasks,
    editingTask,
    openTaskEditor,
    closeTaskEditor,
    openSubmitModal,
    closeSubmitModal,
    handleRemoveAttachment,
    handleSubmitConfirm,
    openUndoModal,
    closeUndoModal,
    handleUndoConfirm,
    handleTaskEditorSave,
    handleTaskDeleteRequest,
    handleTaskCancelRequest,
    handleTaskArchiveRequest,
    handleTaskEditorDelete,
  };
}
