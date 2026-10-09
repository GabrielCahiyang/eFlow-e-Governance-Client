// ─── Subtask Service ──────────────────────────────────────────────
// CRUD + realtime for the subtasks table.

import { supabase } from '../../lib/supabase';
import { createNotification } from './notificationService';

export type SubtaskSource = 'ai_extracted' | 'template' | 'manual';
export type SubtaskStatus = 'todo' | 'in_progress' | 'for_review' | 'changes_requested' | 'completed';

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  status: SubtaskStatus;
  percentComplete: number;
  reviewerId?: string;
  latestSubmissionId?: string;
  completedBy?: string;
  completedAt?: number;
  assignedTo?: string;
  assignedToIds: string[];
  parentSubtaskId?: string;
  leadId?: string;
  siblingOrder?: number;
  position: number;
  isStandalone: boolean;
  dueDate?: string;
  dueDateChangeReason?: string;
  dueDateChangedAt?: number;
  dueDateChangedBy?: string;
  source: SubtaskSource;
  createdBy?: string;
  createdAt: number;
  updatedAt: number;
}

export function rowToSubtask(row: Record<string, unknown>): Subtask {
  const rawIds = row.assigned_to_ids;
  const assignedToIds: string[] = Array.isArray(rawIds)
    ? (rawIds as string[])
    : row.assigned_to
    ? [row.assigned_to as string]
    : [];

  return {
    id: row.id as string,
    taskId: row.task_id as string,
    title: row.title as string,
    isCompleted: (row.is_completed as boolean) || false,
    status: ((row.status as SubtaskStatus) || ((row.is_completed as boolean) ? 'completed' : 'todo')),
    percentComplete: Number(row.percent_complete ?? ((row.is_completed as boolean) ? 100 : 0)),
    reviewerId: (row.reviewer_id as string) || undefined,
    latestSubmissionId: (row.latest_submission_id as string) || undefined,
    completedBy: (row.completed_by as string) || undefined,
    completedAt: row.completed_at ? new Date(row.completed_at as string).getTime() : undefined,
    assignedTo: (row.assigned_to as string) || (assignedToIds[0] || undefined),
    assignedToIds,
    parentSubtaskId: (row.parent_subtask_id as string) || undefined,
    leadId: (row.lead_id as string) || undefined,
    siblingOrder: typeof row.sibling_order === 'number' ? row.sibling_order : undefined,
    position: (row.position as number) || 0,
    isStandalone: row.is_standalone === true,
    dueDate: (row.due_date as string) || undefined,
    dueDateChangeReason: (row.due_date_change_reason as string) || undefined,
    dueDateChangedAt: row.due_date_changed_at ? new Date(row.due_date_changed_at as string).getTime() : undefined,
    dueDateChangedBy: (row.due_date_changed_by as string) || undefined,
    source: (row.source as SubtaskSource) || 'manual',
    createdBy: (row.created_by as string) || undefined,
    createdAt: new Date(row.created_at as string).getTime(),
    updatedAt: new Date(row.updated_at as string).getTime(),
  };
}

// ─── In-Memory Subtask Cache ──────────────────────────────────────
export const subtaskMemoryCache = new Map<string, Subtask[]>();

export function getCachedSubtasks(taskId: string): Subtask[] | undefined {
  return subtaskMemoryCache.get(taskId);
}

export function setCachedSubtasks(taskId: string, subtasks: Subtask[]): void {
  subtaskMemoryCache.set(taskId, subtasks);
}

export function clearSubtaskCache(taskId?: string): void {
  if (taskId) {
    subtaskMemoryCache.delete(taskId);
  } else {
    subtaskMemoryCache.clear();
  }
}

export async function fetchTaskSubtasks(taskId: string): Promise<Subtask[]> {
  const { data, error } = await supabase
    .from('subtasks')
    .select('*')
    .eq('task_id', taskId)
    .order('position', { ascending: true });
  if (error) throw new Error(error.message);
  const subtasks = (data || []).map(rowToSubtask);
  subtaskMemoryCache.set(taskId, subtasks);
  return subtasks;
}

/**
 * Read the subtasks for a visible board slice in one request. This is read-only
 * and leaves the existing per-task cache and mutation contracts untouched.
 */
export async function fetchSubtasksForTasks(taskIds: string[]): Promise<Subtask[]> {
  const ids = Array.from(new Set(taskIds.filter(Boolean)));
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('subtasks')
    .select('*')
    .in('task_id', ids)
    .order('position', { ascending: true });
  if (error) throw new Error(error.message);
  const subtasks = (data || []).map(rowToSubtask);
  const byTask = new Map<string, Subtask[]>();
  for (const subtask of subtasks) {
    const current = byTask.get(subtask.taskId) || [];
    current.push(subtask);
    byTask.set(subtask.taskId, current);
  }
  for (const [taskId, items] of byTask) {
    subtaskMemoryCache.set(taskId, items);
  }
  return subtasks;
}

// ─── subscribeToSubtasks ───────────────────────────────────────────
export function subscribeToSubtasks(
  taskId: string,
  callback: (subtasks: Subtask[]) => void,
): () => void {
  const cached = subtaskMemoryCache.get(taskId);
  if (cached) {
    callback(cached);
  }

  const load = async () => {
    try {
      const items = await fetchTaskSubtasks(taskId);
      callback(items);
    } catch {
      callback(subtaskMemoryCache.get(taskId) || []);
    }
  };
  void load();

  const channelId = `subtasks-${taskId}-${Math.random().toString(36).substring(2, 9)}`;
  const channel = supabase
    .channel(channelId)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'subtasks', filter: `task_id=eq.${taskId}` },
      (payload) => {
        const current = subtaskMemoryCache.get(taskId) || [];
        if (payload.eventType === 'INSERT' && payload.new) {
          const newSubtask = rowToSubtask(payload.new as Record<string, unknown>);
          if (!current.some((item) => item.id === newSubtask.id)) {
            const next = [...current, newSubtask].sort((a, b) => a.position - b.position);
            subtaskMemoryCache.set(taskId, next);
            callback(next);
          }
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          const updated = rowToSubtask(payload.new as Record<string, unknown>);
          const next = current
            .map((item) => (item.id === updated.id ? updated : item))
            .sort((a, b) => a.position - b.position);
          subtaskMemoryCache.set(taskId, next);
          callback(next);
        } else if (payload.eventType === 'DELETE' && payload.old) {
          const deletedId = (payload.old as { id?: string })?.id;
          if (deletedId) {
            const next = current.filter((item) => item.id !== deletedId);
            subtaskMemoryCache.set(taskId, next);
            callback(next);
          }
        }
        void load();
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

// ─── syncTaskSubtaskStats ──────────────────────────────────────────
// ─── createSubtask (single, manual add) ────────────────────────────
export async function createSubtask(
  taskId: string,
  title: string,
  opts?: {
    source?: SubtaskSource;
    position?: number;
    createdBy?: string;
    assignedToIds?: string[];
    assignedTo?: string;
    actorName?: string;
    isStandalone?: boolean;
    dueDate?: string;
  },
): Promise<Subtask> {
  const assignedIds = opts?.assignedToIds || (opts?.assignedTo ? [opts.assignedTo] : []);
  const { data: authData } = await supabase.auth.getUser();
  const createdBy = authData.user?.id || opts?.createdBy;
  if (!createdBy) throw new Error('You must be signed in to create a subtask.');

  const insertRow: Record<string, unknown> = {
    task_id: taskId,
    title,
    source: opts?.source || 'manual',
    position: opts?.position ?? 0,
    created_by: createdBy,
    assigned_to: assignedIds[0] || null,
    assigned_to_ids: assignedIds,
  };
  if (opts?.isStandalone) insertRow.is_standalone = true;
  if (opts?.dueDate) insertRow.due_date = opts.dueDate;

  const { data, error } = await supabase
    .from('subtasks')
    .insert(insertRow)
    .select()
    .single();
  if (error) throw error;

  if (assignedIds.length > 0) {
    const { data: task } = await supabase
      .from('tasks')
      .select('title')
      .eq('id', taskId)
      .maybeSingle();

    const taskTitle = task?.title || 'a task';
    const actorName = opts?.actorName || 'Your Team Lead';

    await Promise.all(
      assignedIds
        .filter((uid) => uid !== createdBy)
        .map((uid) =>
          createNotification(uid, {
            type: 'assignment',
            title: 'New Subtask Assignment',
            message: `${actorName} assigned you to subtask "${title}" in "${taskTitle}".`,
            taskId,
            taskTitle,
          }),
        ),
    );
  }

  return rowToSubtask(data);
}

// ─── createSubtasksBatch (used by ProposalImport right after createTask) ──
export async function createSubtasksBatch(
  taskId: string,
  titles: string[],
  source: SubtaskSource = 'ai_extracted',
): Promise<Subtask[]> {
  if (!titles || titles.length === 0) return [];
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user?.id) throw new Error('You must be signed in to create subtasks.');
  const rows = titles
    .filter((t) => t && t.trim().length > 0)
    .map((title, idx) => ({
      task_id: taskId,
      title: title.trim(),
      source,
      position: idx,
      created_by: authData.user.id,
    }));
  if (rows.length === 0) return [];
  const { data, error } = await supabase.from('subtasks').insert(rows).select();
  if (error) throw error;

  return (data || []).map(rowToSubtask);
}

// ─── toggleSubtask ──────────────────────────────────────────────────
export async function toggleSubtask(
  subtaskId: string,
  isCompleted: boolean,
  actorId?: string,
): Promise<void> {
  void subtaskId;
  void isCompleted;
  void actorId;
  throw new Error('Direct subtask check-off is disabled. Open the subtask and submit evidence for independent review.');
}

// ─── updateSubtask ──────────────────────────────────────────────────
export async function updateSubtask(
  subtaskId: string,
  updates: {
    title?: string;
    position?: number;
    assignedTo?: string;
    assignedToIds?: string[];
    isStandalone?: boolean;
  },
  actor?: { id: string; name: string },
): Promise<void> {
  const { data: current } = await supabase
    .from('subtasks')
    .select('task_id, title, assigned_to_ids')
    .eq('id', subtaskId)
    .maybeSingle();

  const row: Record<string, unknown> = {};
  if (updates.title !== undefined) row.title = updates.title;
  if (updates.position !== undefined) row.position = updates.position;
  if (updates.isStandalone !== undefined) row.is_standalone = updates.isStandalone;

  let newAssignedIds: string[] | undefined = updates.assignedToIds;
  if (newAssignedIds === undefined && updates.assignedTo !== undefined) {
    newAssignedIds = updates.assignedTo ? [updates.assignedTo] : [];
  }

  if (newAssignedIds !== undefined) {
    row.assigned_to_ids = newAssignedIds;
    row.assigned_to = newAssignedIds[0] || null;
  }

  const { error } = await supabase
    .from('subtasks')
    .update(row)
    .eq('id', subtaskId);
  if (error) throw error;

  if (current?.task_id) {
    if (newAssignedIds && newAssignedIds.length > 0) {
      const oldIds: string[] = Array.isArray(current.assigned_to_ids) ? current.assigned_to_ids : [];
      const addedIds = newAssignedIds.filter((id) => !oldIds.includes(id) && id !== actor?.id);

      if (addedIds.length > 0) {
        const { data: task } = await supabase
          .from('tasks')
          .select('title')
          .eq('id', current.task_id)
          .maybeSingle();

        const subTitle = updates.title || current.title || 'a subtask';
        const taskTitle = task?.title || 'a task';
        const actorName = actor?.name || 'Your Team Lead';

        await Promise.all(
          addedIds.map((uid) =>
            createNotification(uid, {
              type: 'assignment',
              title: 'New Subtask Assignment',
              message: `${actorName} assigned you to subtask "${subTitle}" in "${taskTitle}".`,
              taskId: current.task_id,
              taskTitle,
              actorId: actor?.id,
              actorName,
            }),
          ),
        );
      }
    }
  }
}

export async function setSubtaskDueDate(
  subtaskId: string,
  dueDate: string,
  reason?: string,
): Promise<Subtask> {
  const { data, error } = await supabase.rpc('set_subtask_due_date', {
    p_subtask_id: subtaskId,
    p_due_date: dueDate || null,
    p_reason: reason?.trim() || null,
  });
  if (error) {
    if (error.code === 'PGRST202' || error.message.includes('set_subtask_due_date')) {
      throw new Error('Apply the hierarchical deadline database migration, then try again.');
    }
    throw new Error(error.message);
  }
  return rowToSubtask(data as Record<string, unknown>);
}

// ─── deleteSubtask ──────────────────────────────────────────────────
export async function deleteSubtask(subtaskId: string): Promise<void> {
  const { error } = await supabase
    .from('subtasks')
    .delete()
    .eq('id', subtaskId);
  if (error) throw error;

  for (const [taskId, list] of subtaskMemoryCache.entries()) {
    if (list.some((item) => item.id === subtaskId)) {
      subtaskMemoryCache.set(taskId, list.filter((item) => item.id !== subtaskId));
    }
  }
}

// ─── reorderSubtasks ────────────────────────────────────────────────
export async function reorderSubtasks(orderedIds: string[]): Promise<void> {
  if (orderedIds.length === 0) return;
  const { data: rows, error: lookupError } = await supabase
    .from('subtasks')
    .select('id,task_id')
    .in('id', orderedIds);
  if (lookupError) throw lookupError;
  const taskIds = new Set((rows || []).map((row) => row.task_id as string));
  if ((rows || []).length !== orderedIds.length || taskIds.size !== 1) {
    throw new Error('Every reordered subtask must belong to the same parent task.');
  }
  const taskId = Array.from(taskIds)[0];
  const { error } = await supabase.rpc('reorder_task_subtasks', {
    p_task_id: taskId,
    p_ordered_ids: orderedIds,
  });
  if (error) throw error;
}
