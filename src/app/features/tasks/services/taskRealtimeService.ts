import { supabase } from "../../../../lib/supabase";
import {readAllRows} from '../../../shared/readAllRows';
import type { Task } from "../taskTypes";
import { rowToTask } from "./taskMapper";
import { registerAuthCacheReset } from '../../../shared/authCacheReset';

const taskListeners = new Set<(tasks: Task[]) => void>();
const taskErrorListeners = new Set<(error: Error) => void>();
let taskCache: Task[] | null = null;
let taskLoadPromise: Promise<void> | null = null;
const ACCESS_EVENT='eflow-project-access-changed';
if(typeof window!=='undefined') {
  const refreshActive = () => { if(taskListeners.size)void notifyTaskListeners(); };
  window.addEventListener(ACCESS_EVENT,refreshActive);
  window.addEventListener('focus',refreshActive);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshActive();});
}
let accessRefreshTimer:ReturnType<typeof setInterval>|null=null;
let cacheGeneration = 0;
registerAuthCacheReset(() => {
  ++cacheGeneration; taskCache=null; taskLoadPromise=null;
  taskListeners.forEach(callback=>callback([]));
});

function broadcastTasks(tasks: Task[]) {
  taskCache = tasks;
  taskListeners.forEach((callback) => {
    try { callback(tasks); } catch (error) { console.error(error); }
  });
}

export async function notifyTaskListeners() {
  if (taskLoadPromise) return taskLoadPromise;
  const generation=cacheGeneration;
  taskLoadPromise = (async () => {
    const data = await readAllRows<Record<string,unknown>>((from,to)=>supabase
      .from('tasks')
      .select('*',{count:'exact'})
      .is('deleted_at', null)
      .order('created_at', { ascending: false }).order('id',{ascending:true}).range(from,to));
    if (data && generation===cacheGeneration) {
      broadcastTasks(data.map(rowToTask));
    }
  })()
    .catch((error) => {
      if(generation!==cacheGeneration)return;
      console.error('Error loading tasks:', error);
      taskErrorListeners.forEach(callback => callback(error instanceof Error ? error : new Error('Could not load tasks.')));
    })
    .finally(() => { if(generation===cacheGeneration)taskLoadPromise = null; });
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
  if(!accessRefreshTimer)accessRefreshTimer=setInterval(()=>void notifyTaskListeners(),15_000);
  if (onError) taskErrorListeners.add(onError);
  if (taskCache) callback(taskCache);
  else void notifyTaskListeners();

  // Protected task updates use authorized reads; grants can expire without a row event.

  return () => {
    taskListeners.delete(callback);
    if (onError) taskErrorListeners.delete(onError);
    if(taskListeners.size===0&&accessRefreshTimer){clearInterval(accessRefreshTimer);accessRefreshTimer=null;}
  };
};

// â”€â”€â”€ createTask â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
