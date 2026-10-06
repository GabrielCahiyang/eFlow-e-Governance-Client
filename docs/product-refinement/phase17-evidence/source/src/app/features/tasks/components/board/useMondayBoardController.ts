import { withEmployeeDeadlineWorkload } from "../../selectors/employeeDeadlineWorkload";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type Task,
  type UpdateTaskPayload,
  undoCompletedTask,
} from "../../../../services/taskService";
import type { Employee } from "../../../../services/employeeService";
import { requestNavigation } from "../../../../shared/navigationGuard";
import { useExplicitDraft } from "../../../../shared/useExplicitDraft";
import { useTaskLifecycleActions } from "./useTaskLifecycleActions";
import {
  buildTaskEditorDraft,
  uniqueValues,
  type BoardView,
  type MondayBoardProps,
  type TaskEditorDraft,
} from "./model";

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

  const employeeById = useMemo(() => {
    const candidates =
      allEmployees && allEmployees.length > 0 ? allEmployees : deptEmployees;
    return Object.fromEntries(candidates.map((e) => [e.id, e])) as Record<
      string,
      Employee
    >;
  }, [deptEmployees, allEmployees]);

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

  const [editorBaseline, setEditorBaseline] = useState<TaskEditorDraft | null>(
    null,
  );
  const editorGuard = useExplicitDraft(
    "Task details",
    taskEditorOpen &&
      JSON.stringify(taskEditorDraft) !== JSON.stringify(editorBaseline),
    taskEditorSaving,
    () => setTaskEditorDraft(editorBaseline),
    taskEditorTaskId || undefined,
  );
  const submitGuard = useExplicitDraft(
    "Task submission",
    submitModalOpen && Boolean(submitNote || submitFiles.length),
    submitSaving,
    () => {
      setSubmitNote("");
      setSubmitFiles([]);
    },
    submitModalTask?.id,
  );
  const undoGuard = useExplicitDraft(
    "Task reopening reason",
    undoModalOpen && Boolean(undoReason),
    undoSaving,
    () => setUndoReason(""),
    undoModalTask?.id,
  );
  const editorSource = useRef<Task | null>(null);
  const latestTasks = useRef(tasks);
  latestTasks.current = tasks;

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
    void requestNavigation(() => {
      editorSource.current = task;
      setTaskEditorTaskId(task.id);
      setTaskEditorDraft(buildTaskEditorDraft(task));
      setEditorBaseline(buildTaskEditorDraft(task));
      setTaskEditorError("");
      setTaskEditorOpen(true);
    });
  }, []);

  const resetTaskEditor = useCallback(() => {
    setTaskEditorOpen(false);
    setTaskEditorTaskId(null);
    setTaskEditorDraft(null);
    setTaskEditorError("");
    setTaskEditorAssignOpen(false);
    setTaskEditorSaving(false);
  }, []);

  const openSubmitModal = useCallback((task: Task) => {
    void requestNavigation(() => {
      setSubmitModalTask(task);
      setSubmitNote("");
      setSubmitFiles([]);
      setSubmitError("");
      setSubmitSaving(false);
      setSubmitModalOpen(true);
    });
  }, []);

  const resetSubmitModal = useCallback(() => {
    setSubmitModalOpen(false);
    setSubmitModalTask(null);
    setSubmitNote("");
    setSubmitFiles([]);
    setSubmitError("");
    setSubmitSaving(false);
  }, []);

  const closeTaskEditor = () => {
    void requestNavigation(resetTaskEditor);
  };
  const closeSubmitModal = () => {
    void requestNavigation(resetSubmitModal);
  };
  const closeUndoModal = () => {
    void requestNavigation(resetUndoModal);
  };
  const lifecycle = useTaskLifecycleActions({
    tasks,
    context: `${currentUserId || ""}:${departmentFilter || ""}`,
    onDeleteTask: onDeleteTask
      ? async (id) => {
          await onDeleteTask(id);
        }
      : undefined,
    onDeleted: () => {
      editorGuard.markClean();
      resetTaskEditor();
    },
  });

  const handleRemoveAttachment = useCallback((index: number) => {
    setSubmitFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmitConfirm = useCallback(async () => {
    if (!submitModalTask || submitGuard.pendingRef.current) return;
    if (!onSubmit) {
      submitGuard.markClean();
      resetSubmitModal();
      return;
    }
    const trimmedNote = submitNote.trim();
    if (!trimmedNote) {
      setSubmitError("Completion note is required.");
      return;
    }

    submitGuard.pendingRef.current = true;
    setSubmitSaving(true);
    setSubmitError("");
    try {
      await lifecycle.run({
        key: `${submitModalTask.id}:submit:${submitModalTask.updatedAt}`,
        confirmation: {
          title: "Submit task for review?",
          description: `“${submitModalTask.title}” will enter its assigned review workflow with this completion note and ${submitFiles.length} attachment(s).`,
          actionLabel: "Submit for review",
          impact: trimmedNote,
        },
        validate: () => {
          const current = latestTasks.current.find(
            (task) => task.id === submitModalTask.id,
          );
          if (
            !current ||
            current.status !== submitModalTask.status ||
            current.updatedAt !== submitModalTask.updatedAt
          )
            throw new Error(
              "The task changed. Review its current state before submitting evidence.",
            );
        },
        operation: async () => {
          try {
            await onSubmit(submitModalTask.id, {
              note: trimmedNote,
              attachments: submitFiles,
            });
          } catch (error) {
            setSubmitError(
              error instanceof Error
                ? error.message
                : "Submission result needs verification.",
            );
            throw error;
          }
        },
        success: "Task submitted for review.",
        onSaved: () => {
          submitGuard.markClean();
          resetSubmitModal();
        },
      });
    } finally {
      submitGuard.pendingRef.current = false;
      setSubmitSaving(false);
    }
  }, [
    resetSubmitModal,
    onSubmit,
    submitFiles,
    submitModalTask,
    submitNote,
    lifecycle,
  ]);

  const openUndoModal = useCallback((task: Task) => {
    void requestNavigation(() => {
      setUndoModalTask(task);
      setUndoReason("");
      setUndoError("");
      setUndoSaving(false);
      setUndoModalOpen(true);
    });
  }, []);

  const resetUndoModal = useCallback(() => {
    setUndoModalOpen(false);
    setUndoModalTask(null);
    setUndoReason("");
    setUndoError("");
    setUndoSaving(false);
  }, []);

  const handleUndoConfirm = useCallback(async () => {
    if (!undoModalTask || undoGuard.pendingRef.current) return;
    const trimmedReason = undoReason.trim();
    if (!trimmedReason) {
      setUndoError("Undo reason is required.");
      return;
    }

    undoGuard.pendingRef.current = true;
    setUndoSaving(true);
    setUndoError("");
    try {
      await lifecycle.run({
        key: `${undoModalTask.id}:reopen:${undoModalTask.updatedAt}`,
        confirmation: {
          title: "Reopen completed task?",
          description: `“${undoModalTask.title}” will return to work. Its existing history remains and the reason is recorded.`,
          actionLabel: "Reopen task",
          impact: trimmedReason,
        },
        validate: () => {
          const current = latestTasks.current.find(
            (task) => task.id === undoModalTask.id,
          );
          if (
            !current ||
            current.status !== undoModalTask.status ||
            current.updatedAt !== undoModalTask.updatedAt
          )
            throw new Error(
              "The task changed. Review its current state before reopening.",
            );
        },
        operation: async () => {
          try {
            await undoCompletedTask(undoModalTask.id, {
              reason: trimmedReason,
              actor: currentUserId
                ? { id: currentUserId, name: currentUserName || "Head" }
                : undefined,
            });
          } catch (error) {
            setUndoError(
              error instanceof Error
                ? error.message
                : "Reopening result needs verification.",
            );
            throw error;
          }
        },
        success: "Task reopened.",
        onSaved: () => {
          undoGuard.markClean();
          resetUndoModal();
        },
      });
    } finally {
      undoGuard.pendingRef.current = false;
      setUndoSaving(false);
    }
  }, [
    resetUndoModal,
    currentUserId,
    currentUserName,
    undoModalTask,
    undoReason,
    lifecycle,
  ]);

  useEffect(() => {
    if (taskEditorOpen && taskEditorTaskId && !editingTask) {
      setTaskEditorError(
        "This task is no longer available in the current board. Your draft is retained until you discard it.",
      );
    }
  }, [taskEditorOpen, taskEditorTaskId, editingTask]);

  // ── Manual Composer state ─────────────────────────────────────
  const handleTaskEditorSave = async () => {
    if (!onUpdateTask || !editingTask || !taskEditorDraft) return;
    if (!taskEditorDraft.title.trim()) {
      setTaskEditorError("Task title is required.");
      return;
    }
    if (
      taskEditorDraft.estimatedHours !== undefined &&
      (!Number.isFinite(taskEditorDraft.estimatedHours) ||
        taskEditorDraft.estimatedHours <= 0)
    ) {
      setTaskEditorError("Estimated task days must be greater than zero.");
      return;
    }

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

    if (editorGuard.pendingRef.current || lifecycle.pending) return;
    editorGuard.pendingRef.current = true;
    const responsibilityChanged =
      resolvedLeadId !== (editingTask.assigneeId || "") ||
      (editingTask.teamMemberIds || []).some((id) => !memberIds.includes(id));
    setTaskEditorSaving(true);
    setTaskEditorError("");
    try {
      await lifecycle.run({
        key: `${editingTask.id}:edit:${editingTask.updatedAt}`,
        confirmation: responsibilityChanged
          ? {
              title: "Save task responsibility changes?",
              description: `Review changes to “${editingTask.title}”. The server retains task and Office authority checks.`,
              actionLabel: "Save changes",
              impact: `Lead: ${editingTask.assigneeName || "Unassigned"} → ${leadMember?.name || "Unassigned"}. Members: ${memberIds.filter((id) => !(editingTask.teamMemberIds || []).includes(id)).length} added, ${(editingTask.teamMemberIds || []).filter((id) => !memberIds.includes(id)).length} removed.`,
            }
          : undefined,
        validate: () => {
          const current = latestTasks.current.find(
            (task) => task.id === editingTask.id,
          );
          if (
            !current ||
            current.updatedAt !== editorSource.current?.updatedAt ||
            current.orgId !== editorSource.current?.orgId ||
            current.title !== editorSource.current?.title ||
            current.description !== editorSource.current?.description ||
            current.assigneeId !== editingTask.assigneeId ||
            JSON.stringify(current.teamMemberIds) !==
              JSON.stringify(editingTask.teamMemberIds)
          ) {
            setTaskEditorError(
              "The task changed. Reopen it to review the current details.",
            );
            throw new Error(
              "The task changed. Reopen it to review the current details.",
            );
          }
        },
        operation: async () => {
          try {
            await onUpdateTask(editingTask.id, payload);
          } catch (error) {
            setTaskEditorError(
              error instanceof Error
                ? error.message
                : "Task save result needs verification.",
            );
            throw error;
          }
        },
        success: "Task changes saved.",
        onSaved: () => {
          editorGuard.markClean();
          resetTaskEditor();
        },
      });
    } finally {
      editorGuard.pendingRef.current = false;
      setTaskEditorSaving(false);
    }
  };

  const handleTaskDeleteRequest = lifecycle.remove;
  const handleTaskCancelRequest = lifecycle.cancel;
  const handleTaskArchiveRequest = lifecycle.archive;
  const handleTaskEditorDelete = async () => {
    if (editingTask) await lifecycle.remove(editingTask);
  };

  return {
    lifecycle,
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
