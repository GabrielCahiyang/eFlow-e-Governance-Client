import { useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { MondayBoard } from "../../features/tasks";
import { PageHeader } from "../workflow/primitives";
import { useAuth } from "../../contexts/AuthContext";
import { useCurrentUserTasks } from "../../hooks/useCurrentUserTasks";
import {
  submitTaskForReview,
  updateTaskStatus,
} from "../../services/taskService";
import {
  subscribeToNotifications,
  type Notification,
} from "../../services/notificationService";
import { useProjectsData } from "../../hooks/useSupabaseData";
import { TaskDetailDrawer } from "../workflow/TaskDetailDrawer";
import { useNotificationNavigationIntent } from "../../features/notifications";

export function EmployeeTaskWorkspace() {
  const { tasks, loading } = useCurrentUserTasks();
  const { user, userProfile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { projects } = useProjectsData();
  const [notificationTask, setNotificationTask] = useState<(typeof tasks)[number] | null>(null);

  useNotificationNavigationIntent(
    (intent) => intent.kind === "task",
    (intent) => {
      if (loading) return false;
      const match = tasks.find((task) => task.id === intent.taskId);
      if (match) setNotificationTask(match);
      return true;
    },
    [loading, tasks],
  );

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      return;
    }
    const unsubscribe = subscribeToNotifications(
      user.id,
      setNotifications,
    );
    return () => {
      void unsubscribe();
    };
  }, [user?.id]);

  const assignmentBanner = useMemo(() => {
    const unreadAssignment = notifications.find(
      (notification) =>
        !notification.read && notification.type === "assignment",
    );
    const referencedTask = unreadAssignment?.taskId
      ? tasks.find((task) => task.id === unreadAssignment.taskId)
      : undefined;
    const newestTodo = [...tasks]
      .filter((task) => task.status === "todo")
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    const task = referencedTask || newestTodo;

    if (!task && !unreadAssignment) return null;
    return {
      title: task?.title || unreadAssignment?.taskTitle || "New assignment",
      project: task?.linkedProjectId
        ? projects.find((project) => project.id === task.linkedProjectId)?.title || task.projectTitle
        : task?.projectTitle,
      lead: task?.assigneeName || "To be confirmed",
      due: task?.deadline || task?.dueDate,
    };
  }, [notifications, projects, tasks]);

  const startTask = async (taskId: string) => {
    await updateTaskStatus(taskId, "in_progress", {
      id: user?.id,
      name: userProfile?.full_name || "Member",
    });
  };

  const submitTask = async (
    taskId: string,
    submission: { note: string; attachments: File[] },
  ) => {
    if (!user?.id) throw new Error("You must be signed in.");
    await submitTaskForReview(taskId, {
      note: submission.note,
      attachments: submission.attachments,
      submitterId: user.id,
      submitterName:
        userProfile?.full_name || user.email || "Member",
    });
  };

  return (
    <div className="eflow-operational-workspace min-h-full p-2">
      <PageHeader
        eyebrow="My Workspace"
        title="My Tasks"
        subtitle="One synchronized workspace for List, Kanban, Timeline, and Hierarchy."
      />

      {assignmentBanner && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Bell size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-medium uppercase tracking-wider text-amber-700">
              New assignment
            </div>
            <div className="truncate text-[13px] font-medium text-neutral-900">
              {assignmentBanner.title}
            </div>
            <div className="mt-0.5 text-[11px] text-neutral-600">
              {assignmentBanner.project
                ? `${assignmentBanner.project} · `
                : ""}
              Lead: {assignmentBanner.lead}
              {assignmentBanner.due
                ? ` · Due ${assignmentBanner.due}`
                : ""}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-[12px] text-neutral-500">
          Loading your tasks…
        </div>
      ) : (
        <MondayBoard
          tasks={tasks}
          role="member"
          currentUserId={user?.id}
          currentUserName={userProfile?.full_name || ""}
          onExecute={startTask}
          onSubmit={submitTask}
        />
      )}
      <TaskDetailDrawer
        task={notificationTask}
        onClose={() => setNotificationTask(null)}
        canPostProgress
        canDiscuss
        onChanged={() => {}}
      />
    </div>
  );
}
