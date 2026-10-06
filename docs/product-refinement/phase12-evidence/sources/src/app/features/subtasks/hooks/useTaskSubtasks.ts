import { useEffect, useState } from "react";
import { getCachedSubtasks, subscribeToSubtasks, type Subtask } from "../../../services/subtaskService";

export function useTaskSubtasks(taskId?: string | null) {
  const [subtasks, setSubtasks] = useState<Subtask[]>(() => {
    if (!taskId) return [];
    return typeof getCachedSubtasks === "function" ? (getCachedSubtasks(taskId) ?? []) : [];
  });

  useEffect(() => {
    if (!taskId) {
      setSubtasks([]);
      return;
    }
    const cached = typeof getCachedSubtasks === "function" ? getCachedSubtasks(taskId) : undefined;
    setSubtasks(cached || []);
    let active = true;
    const unsubscribe = subscribeToSubtasks(taskId, rows => { if (active) setSubtasks(rows); });
    return () => { active = false; unsubscribe(); };
  }, [taskId]);

  return { subtasks: subtasks.filter(row => row.taskId === taskId), setSubtasks };
}
