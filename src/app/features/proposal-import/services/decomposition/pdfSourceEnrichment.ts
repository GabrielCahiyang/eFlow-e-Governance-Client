import { readAiText, requestAiChat, type AiQueueUpdate } from '../../../ai';
import { applySourceBudgetAssignments, type SourceBudget } from '../sourceBudget';
import type { ProposalDecompositionTask } from '../../types';
import type { SourceAction } from './sourceActions';
import { extractExplicitSubtasks, generateTemplateSubtasks, inferSkillsFromText, mergeSuggestedSubtasks } from './textAnalysis';

interface Suggestion {
  key: string;
  priority: 'low' | 'medium' | 'high';
  estimatedHours: number;
  subtasks?: string[];
}
export interface AuthorizedProjectFundingSource {
  id: string;
  name: string;
  fiscalYear: number;
  available: number;
}
export interface AuthorizedProjectBudgetContext {
  fundingNotRequired: boolean;
  totalAvailable: number;
  sources: AuthorizedProjectFundingSource[];
}
export interface PdfEnrichmentProjectContext {
  title?: string;
  description?: string;
  scope?: string;
  authorizedBudget?: AuthorizedProjectBudgetContext;
}
export interface PdfBudgetAllocationProposal {
  key: string;
  lines: Array<{ sourceId: string; amount: number; particular?: string }>;
}
type EnrichedSourceTask = ProposalDecompositionTask & Omit<Suggestion, 'key'>;

export async function enrichPdfSourceTasksWithMetadata(
  actions: SourceAction[],
  budget: SourceBudget | null,
  onQueueUpdate?: (update: AiQueueUpdate) => void,
  requestId?: string,
  addSubtasks = true,
  projectContext?: PdfEnrichmentProjectContext,
): Promise<{ tasks: EnrichedSourceTask[]; budgetAllocations: PdfBudgetAllocationProposal[] }> {
  if (actions.length > 100) throw new Error('Import up to 100 tasks at a time.');

  const sourceTasks = actions.map((action, index) => ({ key: `task-${index + 1}`, ...action }));
  const hasProjectContext = !!(projectContext && (projectContext.title || projectContext.description || projectContext.scope));
  const enrichmentRequest = {
    schemaVersion: 1 as const,
    tasks: sourceTasks,
    costs: budget?.lines || [],
    ...(hasProjectContext ? {
      projectContext: {
        title: projectContext?.title || '',
        description: projectContext?.description || '',
        scope: projectContext?.scope || '',
      },
      ...(addSubtasks ? { addSubtasks: true } : {}),
    } : {}),
    ...(projectContext?.authorizedBudget ? { authorizedBudget: projectContext.authorizedBudget } : {}),
  };
  const response = await requestAiChat({
    model: 'deepseek-r1:8b',
    messages: [{ role: 'user', content: 'Suggest metadata for the fixed source PDF table.' }],
    pdf_table_enrichment: enrichmentRequest,
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
    const { priority, estimatedHours, subtasks: aiSubtasks } = suggestions.get(action.key)!;
    const shared = action.methodologyScope === 'phase';
    const sourceSteps = shared ? [] : extractExplicitSubtasks(action.methodology);
    const cleanedAiSubtasks = Array.isArray(aiSubtasks)
      ? aiSubtasks.filter((step): step is string => typeof step === 'string' && step.trim().length > 0)
      : [];
    const fallbackSubtasks = cleanedAiSubtasks.length
      ? cleanedAiSubtasks
      : generateTemplateSubtasks(action.title, '', !sourceSteps.length);
    return {
      title: action.title,
      description: `${action.title}\n\nMethodology${shared ? ' (shared group methods)' : ''}:\n${action.methodology.map(method => `• ${method}`).join('\n')}\n\nSchedule: ${action.schedule}`,
      priority,
      estimatedHours,
      requiredSkills: inferSkillsFromText([action.title, ...(!shared ? action.methodology : [])].join(' ')),
      subtasks: addSubtasks ? mergeSuggestedSubtasks(sourceSteps, fallbackSubtasks) : undefined,
      budgetDecision: 'missing',
    };
  });
  if (budget) applySourceBudgetAssignments(budget, tasks, JSON.stringify({ allocations: payload.allocations }));
  const budgetAllocations: PdfBudgetAllocationProposal[] = Array.isArray(payload.budgetAllocations)
    ? payload.budgetAllocations
    : [];
  return { tasks, budgetAllocations };
}

export async function enrichPdfSourceTasks(
  actions: SourceAction[],
  budget: SourceBudget | null,
  onQueueUpdate?: (update: AiQueueUpdate) => void,
  requestId?: string,
  addSubtasks = true,
  projectContext?: PdfEnrichmentProjectContext,
): Promise<EnrichedSourceTask[]> {
  const { tasks } = await enrichPdfSourceTasksWithMetadata(
    actions,
    budget,
    onQueueUpdate,
    requestId,
    addSubtasks,
    projectContext,
  );
  return tasks;
}
