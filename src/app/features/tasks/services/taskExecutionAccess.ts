import { supabase } from '../../../../lib/supabase';
import { assertActionActor } from '../../../shared/actionActor';
import { fetchTaskById } from './taskRealtimeService';

export async function checkTaskExecution(taskId: string, actor: string, statuses: readonly string[]) {
  await assertActionActor(actor);
  const task = await fetchTaskById(taskId);
  if (!task || task.deleted_at || task.archived_at || !statuses.includes(String(task.status)) ||
      (task.assigned_to ?? task.recommendation_lead_id) !== actor) {
    throw new Error('The task or your access changed. Only the current Task Lead can take this action.');
  }
  if (task.linked_project_id) {
    const { data, error } = await supabase.from('projects').select('id,status').eq('id', task.linked_project_id).single();
    if (error || data?.status !== 'active') throw new Error('Current execution requires an active project.');
  }
  if (Array.isArray(task.dependency_ids) && task.dependency_ids.length) {
    const { data, error } = await supabase.from('tasks').select('id,status,linked_project_id')
      .in('id', task.dependency_ids).is('deleted_at', null);
    const completed = new Set(data?.filter(row => row.status === 'completed' && row.linked_project_id === (task.linked_project_id ?? null)).map(row => row.id));
    if (error || task.dependency_ids.some(id => !completed.has(id))) throw new Error('Complete every task prerequisite before continuing.');
  }
  await assertActionActor(actor);
  return task;
}
