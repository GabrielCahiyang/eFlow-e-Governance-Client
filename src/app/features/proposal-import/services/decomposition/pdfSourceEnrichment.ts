import { readAiText, requestAiChat, type AiQueueUpdate } from '../../../ai';
import { applySourceBudgetAssignments, type SourceBudget } from '../sourceBudget';
import type { ProposalDecompositionTask } from '../../types';
import type { SourceAction } from './sourceActions';
import { extractExplicitSubtasks, generateTemplateSubtasks, inferSkillsFromText, mergeSuggestedSubtasks } from './textAnalysis';

interface Suggestion {
  key: string;
  priority: 'low' | 'medium' | 'high';
  estimatedHours: number;
}
type EnrichedSourceTask = ProposalDecompositionTask & Omit<Suggestion, 'key'>;

export async function enrichPdfSourceTasks(
  actions: SourceAction[],
  budget: SourceBudget | null,
  onQueueUpdate?: (update: AiQueueUpdate) => void,
  requestId?: string,
  addSubtasks = true,
): Promise<EnrichedSourceTask[]> {
  if (actions.length > 100) throw new Error('Import up to 100 tasks at a time.');

  const sourceTasks = actions.map((action, index) => ({ key: `task-${index + 1}`, ...action }));
  const response = await requestAiChat({
    model: 'deepseek-r1:8b',
    messages: [{ role: 'user', content: 'Suggest metadata for the fixed source PDF table.' }],
    pdf_table_enrichment: { schemaVersion: 1, tasks: sourceTasks, costs: budget?.lines || [] },
    stream: false,
  }, { onQueueUpdate, requestId });
  const raw = readAiText(response).replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const payload = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}');
  if (!Array.isArray(payload.tasks) || payload.tasks.length !== actions.length) {
    throw new Error('The AI server returned an incomplete PDF table. Restart the updated AI server and try again. No work was saved.');
  }

  const sourceKeys = new Set(sourceTasks.map(task => task.key));
  const suggestions = new Map<string, Suggestion>();
  for (const item of payload.tasks) {
    if (!item || !sourceKeys.has(item.key) || suggestions.has(item.key) ||
      !['low', 'medium', 'high'].includes(item.priority) ||
      !Number.isFinite(item.estimatedHours) || item.estimatedHours < 0 || item.estimatedHours > 10000) {
      throw new Error('The AI returned invalid task priorities or effort. Try again.');
    }
    suggestions.set(item.key, item);
  }

  const tasks = sourceTasks.map((action): EnrichedSourceTask => {
    const { priority, estimatedHours } = suggestions.get(action.key)!;
    const shared = action.methodologyScope === 'phase';
    const sourceSteps = shared ? [] : extractExplicitSubtasks(action.methodology);
    return {
      title: action.title,
      description: `${action.title}\n\nMethodology${shared ? ' (shared group methods)' : ''}:\n${action.methodology.map(method => `• ${method}`).join('\n')}\n\nSchedule: ${action.schedule}`,
      priority,
      estimatedHours,
      requiredSkills: inferSkillsFromText([action.title, ...(!shared ? action.methodology : [])].join(' ')),
      subtasks: addSubtasks ? mergeSuggestedSubtasks(sourceSteps, generateTemplateSubtasks(action.title, '', !sourceSteps.length)) : undefined,
      budgetDecision: 'missing',
    };
  });
  if (budget) applySourceBudgetAssignments(budget, tasks, JSON.stringify({ allocations: payload.allocations }));
  return tasks;
}
