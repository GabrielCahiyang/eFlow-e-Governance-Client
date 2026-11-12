import { supabase } from '../../../lib/supabase';
import { duplicateWorkNameError } from '../../shared/workNames';

export type ProjectTaskGroup = { title: string; tasks: { title: string; subtasks: string[] }[] };
export type ProjectTaskTemplate = { id: string; name: string; groups: ProjectTaskGroup[] };

function title(value: unknown, max: number) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new Error(`Enter a name between 1 and ${max} characters.`);
  }
  return value.trim();
}

export function parseProjectTaskGroups(value: unknown): ProjectTaskGroup[] {
  if (!Array.isArray(value) || !value.length || value.length > 30) {
    throw new Error('Add between 1 and 30 task groups.');
  }
  const groups = value.map(group => {
    if (!Array.isArray(group?.tasks) || !group.tasks.length || group.tasks.length > 100) {
      throw new Error('Each group needs at least one task.');
    }
    const tasks = group.tasks.map((task: ProjectTaskGroup['tasks'][number]) => {
      if (!Array.isArray(task?.subtasks) || task.subtasks.length > 30) {
        throw new Error('Use up to 30 subtasks per task.');
      }
      return { title: title(task.title, 300), subtasks: task.subtasks.map(item => title(item, 300)) };
    });
    return { title: title(group.title, 120), tasks } as ProjectTaskGroup;
  });
  if (groups.reduce((count, group) => count + group.tasks.length, 0) > 100) {
    throw new Error('Add up to 100 tasks at once.');
  }
  for (const group of groups) {
    const issue = duplicateWorkNameError(group.title, groups.filter(other => other !== group), 'Group');
    if (issue) throw new Error(issue);
    for (const task of group.tasks) {
      const taskIssue = duplicateWorkNameError(task.title, group.tasks.filter(other => other !== task), 'Task');
      if (taskIssue) throw new Error(taskIssue);
      const names = task.subtasks.map(name => ({ title: name }));
      for (const name of names) {
        const subtaskIssue = duplicateWorkNameError(name.title, names.filter(other => other !== name), 'Subtask');
        if (subtaskIssue) throw new Error(subtaskIssue);
      }
    }
  }
  return groups;
}

export async function listProjectTaskTemplates(): Promise<ProjectTaskTemplate[]> {
  const { data, error } = await supabase.from('project_task_templates').select('id,name,groups').eq('retired', false).order('name');
  if (error) throw new Error(error.message);
  return (data ?? []).map(template => ({ ...template, groups: parseProjectTaskGroups(template.groups) }));
}

export async function saveProjectTaskTemplate(name: string, groups: ProjectTaskGroup[], id?: string) {
  const values = { name: title(name, 120), groups: parseProjectTaskGroups(groups) };
  const table = supabase.from('project_task_templates');
  const result = await (id ? table.update(values).eq('id', id).eq('retired', false) : table.insert(values)).select('id').single();
  if (result.error) throw new Error(result.error.code === '23505' ? 'A template already has that name.' : result.error.message);
}

export async function retireProjectTaskTemplate(id: string) {
  const { error } = await supabase.from('project_task_templates').update({ retired: true }).eq('id', id).select('id').single();
  if (error) throw new Error(error.message);
}
