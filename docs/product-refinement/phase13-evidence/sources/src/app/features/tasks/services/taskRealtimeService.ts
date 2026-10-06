import { supabase } from "../../../../lib/supabase";
import type { Task } from "../taskTypes";
import { rowToTask } from "./taskMapper";

const taskListeners = new Set<(tasks: Task[]) => void>();
const taskErrorListeners = new Set<(error: Error) => void>();
let taskCache: Task[] | null = null;
let taskLoadPromise: Promise<void> | null = null;
let taskRealtimeChannel: ReturnType<typeof supabase.channel> | null = null;

function broadcastTasks(tasks: Task[]) {
  taskCache = tasks;
  taskListeners.forEach((callback) => {
    try { callback(tasks); } catch (error) { console.error(error); }
  });
}

export async function notifyTaskListeners() {
  if (taskLoadPromise) return taskLoadPromise;
  taskLoadPromise = (async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    if (data) {
      broadcastTasks(data.map(rowToTask));
    }
  })()
    .catch((error) => {
      console.error('Error loading tasks:', error);
      taskErrorListeners.forEach(callback => callback(error instanceof Error ? error : new Error('Could not load tasks.')));
    })
    .finally(() => { taskLoadPromise = null; });
  return taskLoadPromise;
}

export async function fetchTaskById(taskId: string): Promise<Record<string, unknown> | null> {
  const { data } = await supabase.from('tasks').select('*').eq('id', taskId).single();
  return data || null;
}

// â”€â”€â”€ subscribeToTasks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

let seedPromise: Promise<void> | null = null;

export const seedTasksIfEmpty = async () => {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    const { count } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null);
    if ((count ?? 0) > 0) return;
    const { TASK_SEED } = await import('../../../services/eflowSeedData');
    const { EMPLOYEE_SEED_BY_ID, getDepartmentLabel } = await import('../../../services/eflowSeedData');
    const rows = TASK_SEED.map((t: any) => {
      const assignee = EMPLOYEE_SEED_BY_ID[t.assignedTo];
      const teamName = getDepartmentLabel(t.department);
      return {
        title: t.title,
        description: t.description || '',
        status: t.status || 'pending_assignment',
        priority: t.priority || 'medium',
        department: t.department || '',
        team_id: t.department || '',
        team_name: teamName || '',
        assigned_to: t.assignedTo || null,
        assignee_name: assignee?.name || '',
        team_member_ids: t.assignedTo ? [t.assignedTo] : [],
        team_member_names: assignee ? [assignee.name] : [],
        deadline: t.dueDate || '',
        due_date: t.dueDate || '',
        tags: t.tags || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });
    await supabase.from('tasks').insert(rows);
    await notifyTaskListeners();
    console.log('Seeded tasks to Supabase.');
  })().finally(() => { seedPromise = null; });
  return seedPromise;
};

export const subscribeToTasks = (callback: (tasks: Task[]) => void, onError?: (error: Error) => void) => {
  taskListeners.add(callback);
  if (onError) taskErrorListeners.add(onError);
  if (taskCache) callback(taskCache);
  else void notifyTaskListeners();

  if (!taskRealtimeChannel) {
    taskRealtimeChannel = supabase
      .channel('tasks-changes-shared')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          if (!taskCache) {
            void notifyTaskListeners();
            return;
          }
          const nextRows = [...taskCache];
          const row = payload.new as Record<string, unknown>;
          const oldRow = payload.old as Record<string, unknown>;
          const changedId = (row.id || oldRow.id) as string | undefined;
          if (!changedId) {
            void notifyTaskListeners();
            return;
          }
          const existingIndex = nextRows.findIndex((task) => task.id === changedId);
          if (payload.eventType === 'DELETE' || row.deleted_at) {
            if (existingIndex >= 0) nextRows.splice(existingIndex, 1);
          } else {
            const mapped = rowToTask(row);
            if (existingIndex >= 0) nextRows[existingIndex] = mapped;
            else nextRows.push(mapped);
          }
          nextRows.sort((a, b) => b.createdAt - a.createdAt);
          broadcastTasks(nextRows);
        },
      )
      .subscribe();
  }

  return () => {
    taskListeners.delete(callback);
    if (onError) taskErrorListeners.delete(onError);
    if (taskListeners.size === 0 && taskRealtimeChannel) {
      void supabase.removeChannel(taskRealtimeChannel);
      taskRealtimeChannel = null;
    }
  };
};

// â”€â”€â”€ createTask â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
