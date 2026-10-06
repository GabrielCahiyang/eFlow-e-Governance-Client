import { notifyTaskListeners } from "../../services/taskRealtimeService";
import { useRef } from "react";
import type { Task } from "../../taskTypes";
import { cancelTask } from "../../services/taskLifecycleService";
import { archiveTask, unarchiveTask } from "../../services/taskArchiveService";
import { offerEmptyProjectCleanup } from "../../../projects";
import { useReviewedMutation } from "../../../../shared/useReviewedMutation";

export function useTaskLifecycleActions({
  tasks,
  context,
  onDeleteTask,
  onDeleted,
}: {
  tasks: Task[];
  context: string;
  onDeleteTask?: (id: string) => Promise<void>;
  onDeleted: (task: Task) => void;
}) {
  const latest = useRef(tasks);
  latest.current = tasks;
  const safety = useReviewedMutation(context);
  const validate = (task: Task) => {
    const current = latest.current.find((row) => row.id === task.id);
    if (
      !current ||
      current.updatedAt !== task.updatedAt ||
      current.status !== task.status ||
      current.archivedAt !== task.archivedAt
    ) {
      throw new Error(
        "The task changed while confirmation was open. Review its current state before continuing.",
      );
    }
  };
  const remove = async (task: Task) => {
    if (!onDeleteTask) return;
    const saved = await safety.run({
      key: `${task.id}:delete`,
      validate: () => validate(task),
      confirmation: {
        title: "Delete task?",
        description: `Remove “${task.title}” from active work. This screen has no restore action for a deleted task. Its operational project remains unless you separately confirm removal of an empty project.`,
        actionLabel: "Delete task",
        danger: true,
        confirmationText: task.title,
      },
      operation: () => onDeleteTask(task.id),
      success: `Task “${task.title}” deleted.`,
      onSaved: () => onDeleted(task),
    });
    if (!saved || !task.linkedProjectId) return;
    // Cleanup has its own confirmation and outcome; never replay the successful task deletion.
    await safety.run({
      key: `${task.linkedProjectId}:empty-cleanup`,
      success: `Task “${task.title}” deleted. The separate project cleanup review finished.`,
      operation: () =>
        offerEmptyProjectCleanup(task.linkedProjectId!, async (project) => {
          // This nested confirmation happens within the already locked cleanup operation.
          return await safety.confirm({
            title: "Delete the empty project too?",
            description: `“${project.title}” has no remaining tasks. Permanently remove its container, milestones and membership list?`,
            danger: true,
            actionLabel: "Delete empty project",
            confirmationText: project.title,
          });
        }),
    });
  };
  const cancel = async (task: Task) => {
    let reason = "";
    await safety.run({
      key: `${task.id}:cancel:${task.updatedAt}`,
      validate: () => validate(task),
      confirmation: {
        title: "Cancel task?",
        description: `Record why “${task.title}” is being cancelled. The server checks your authority and the current workflow.`,
        actionLabel: "Cancel task",
        danger: true,
        reason: {
          label: "Cancellation reason",
          onAccept: (value) => {
            reason = value;
          },
        },
      },
      operation: () => cancelTask(task.id, reason),
      success: `Task “${task.title}” cancelled.`,
      refresh: notifyTaskListeners,
      onSaved: () => onDeleted(task),
    });
  };
  const archive = async (task: Task) => {
    const archived = !task.archivedAt;
    await safety.run({
      key: `${task.id}:archive:${task.updatedAt}:${Boolean(task.archivedAt)}`,
      validate: () => validate(task),
      confirmation: {
        title: archived ? "Archive task?" : "Restore task?",
        description: `“${task.title}” ${archived ? "will leave the active board. Use Archived tasks to restore it." : "will return to the active board."}`,
        actionLabel: archived ? "Archive task" : "Restore task",
      },
      operation: () =>
        archived ? archiveTask(task.id) : unarchiveTask(task.id),
      success: `Task “${task.title}” ${archived ? "archived" : "restored"}.`,
    });
  };
  return { ...safety, remove, cancel, archive };
}
