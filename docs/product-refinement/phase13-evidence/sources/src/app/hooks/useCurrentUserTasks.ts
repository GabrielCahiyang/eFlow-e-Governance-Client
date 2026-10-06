import { useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTasksData } from "./useSupabaseData";

/**
 * One employee-scope task hook for every personal workspace. Keeping this
 * filter here prevents My Tasks, Deadlines, History, Reports, and Leadership
 * surfaces from each inventing a slightly different idea of "my work".
 */
export function useCurrentUserTasks() {
  const { user } = useAuth();
  const { tasks, loading, error, retry } = useTasksData();

  const currentUserTasks = useMemo(() => {
    if (!user?.id) return [];
    return tasks.filter(
      (task) =>
        task.assigneeId === user.id ||
        task.recommendationLeadId === user.id ||
        (task.teamMemberIds || []).includes(user.id),
    );
  }, [tasks, user?.id]);

  return {
    tasks: currentUserTasks,
    loading,
    error,
    retry,
    userId: user?.id,
  };
}
