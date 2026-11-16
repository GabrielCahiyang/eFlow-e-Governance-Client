import { supabase } from "../../../../lib/supabase";
import type { TaskActivity } from "../taskTypes";

export type BoardActivityItem = TaskActivity & {
  kind: "activity" | "status";
};

/**
 * Load history only for the task ids already scoped by the Task Board. The
 * existing per-task subscription remains the source for inspector timelines.
 */
export async function fetchTaskActivityHistory(taskIds: string[]): Promise<BoardActivityItem[]> {
  const ids = Array.from(new Set(taskIds.filter(Boolean)));
  if (ids.length === 0) return [];

  const [activityResult, statusResult] = await Promise.all([
    supabase
      .from('task_activities')
      .select('*')
      .in('task_id', ids)
      .order('created_at', { ascending: false }),
    supabase
      .from('task_status_history')
      .select('*')
      .in('task_id', ids)
      .order('created_at', { ascending: false }),
  ]);

  if (activityResult.error) throw new Error(activityResult.error.message);
  if (statusResult.error) throw new Error(statusResult.error.message);

  return [
    ...(activityResult.data || []).map((row) => ({
      id: row.id as string,
      taskId: row.task_id as string,
      action: (row.type as string) || "activity",
      details: (row.content as string) || "Updated task activity.",
      userId: (row.actor_id as string) || undefined,
      userName: (row.actor_name as string) || "System",
      timestamp: new Date((row.created_at as string) || Date.now()).getTime(),
      metadata: row.metadata,
      kind: "activity" as const,
    })),
    ...(statusResult.data || []).map((row) => ({
      id: `status-${row.id as string}`,
      taskId: row.task_id as string,
      action: "status_change",
      details: `Status changed to ${(row.to_status as string) || "updated"}.`,
      userName: (row.actor_name as string) || "System",
      timestamp: new Date((row.created_at as string) || Date.now()).getTime(),
      kind: "status" as const,
    })),
  ].sort((a, b) => b.timestamp - a.timestamp);
}

export async function logTaskActivity(
  taskId: string,
  action: string,
  details: string,
  userId?: string,
  userName?: string,
): Promise<void> {
  await supabase.from('task_activities').insert({
    task_id: taskId,
    type: action,
    content: details,
    actor_id: userId || null,
    actor_name: userName || 'System',
  });
}

export function subscribeToTaskActivities(
  taskId: string,
  callback: (activities: TaskActivity[]) => void,
) {
  const load = async () => {
    const { data } = await supabase
      .from('task_activities')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });

    if (data) {
      callback(data.map(row => ({
        id: row.id,
        taskId: row.task_id,
        action: row.type || '',
        details: row.content || '',
        userId: row.actor_id || undefined,
        userName: row.actor_name || undefined,
        timestamp: new Date(row.created_at).getTime(),
        metadata: row.metadata,
      })));
    } else {
      callback([]);
    }
  };
  load();

  const channelId = `task-activities-${taskId}-${Math.random().toString(36).slice(2)}`;
  const channel = supabase
    .channel(channelId)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'task_activities',
      filter: `task_id=eq.${taskId}`,
    }, () => load())
    .subscribe();

  return () => supabase.removeChannel(channel);
}

// ─── archiveTask / unarchiveTask ─────────────────────────────────
// Retains the task but excludes it from active work. Modeled via the
// `archived_at` timestamp (not the status enum) so it is independent of the
// task status CHECK constraint; new screens filter on archivedAt. Writes an
// audit event — archiving is never silent.
