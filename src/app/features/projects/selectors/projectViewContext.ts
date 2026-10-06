import type { ProjectCommandData } from '../components/project-command/types';
import type { Task } from '../../tasks';
import { getTaskScopedBudgetBundle } from '../../budget';
import { buildProjectCommandMetrics } from './projectCommandSelectors';
/** Every view scopes task facts, attention and finances with the same canonical IDs. */
export function scopeProjectViewData(data: ProjectCommandData, tasks: Task[]): ProjectCommandData {
  const ids = new Set(tasks.map(task => task.id));
  const facts = {
    subtasks: data.facts.subtasks.filter(f => ids.has(f.taskId)),
    progress: data.facts.progress.filter(f => ids.has(f.taskId)),
    submissions: data.facts.submissions.filter(f => ids.has(f.taskId)),
    statusHistory: data.facts.statusHistory.filter(f => ids.has(f.taskId)),
    evidence: data.facts.evidence.filter(f => ids.has(f.taskId)),
  };
  const attention = data.attention.filter(item => ids.has(item.taskId));
  return { ...data, tasks, facts, attention, metrics: buildProjectCommandMetrics(data.project, tasks, data.milestones, facts, attention), financial: getTaskScopedBudgetBundle(data.financial, [...ids]) };
}
