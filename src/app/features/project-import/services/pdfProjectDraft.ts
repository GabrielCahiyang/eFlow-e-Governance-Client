import {
  enrichPdfSourceTasksWithMetadata,
  extractPartSections,
  readSourceBudget,
  type PdfBudgetAllocationProposal,
  type PdfEnrichmentProjectContext,
  type ProposalImportOptions,
} from '../../proposal-import';
import type { AiQueueUpdate } from '../../ai';
import { isCalendarDate } from "../../../shared/calendarDates";
import { generateProjectDraft } from "./projectImportService";
import type { ProjectImportDraft } from "../types";

/** Month N is an interval relative to the chosen project planning date. */
export function sourceMonthDates(schedule: string, anchor: string) {
  if (!isCalendarDate(anchor))
    throw new Error("Choose a valid schedule start date.");
  const match = schedule.match(/^Month\s+(\d+)(?:\s*[-–]\s*(\d+))?$/i);
  if (!match)
    throw new Error(
      `Review the source schedule before importing: ${schedule || "not specified"}.`,
    );
  const first = Number(match[1]),
    last = Number(match[2] || match[1]);
  if (first < 1 || last < first || last > 120)
    throw new Error("The source month range is invalid.");
  const addMonths = (offset: number) => {
    const [year, month, day] = anchor.split("-").map(Number);
    const end = new Date(Date.UTC(year, month - 1 + offset + 1, 0));
    return new Date(
      Date.UTC(year, month - 1 + offset, Math.min(day, end.getUTCDate())),
    );
  };
  const due = addMonths(last);
  due.setUTCDate(due.getUTCDate() - 1);
  return {
    startDate: addMonths(first - 1)
      .toISOString()
      .slice(0, 10),
    dueDate: due.toISOString().slice(0, 10),
  };
}

function fitTaskBudgetsToAuthorizedSources(
  proposals: PdfBudgetAllocationProposal[],
  authorizedBudget?: PdfEnrichmentProjectContext['authorizedBudget'],
): PdfBudgetAllocationProposal[] {
  if (!authorizedBudget || authorizedBudget.fundingNotRequired || authorizedBudget.totalAvailable <= 0) {
    return [];
  }
  const sourceRemaining = new Map<string, number>(
    authorizedBudget.sources.map((source) => [source.id, Math.max(0, Number(source.available) || 0)]),
  );
  let totalRemaining = Math.max(0, Number(authorizedBudget.totalAvailable) || 0);
  const fitted: PdfBudgetAllocationProposal[] = [];

  for (const proposal of proposals) {
    if (totalRemaining <= 0) break;
    const nextLines: PdfBudgetAllocationProposal['lines'] = [];
    for (const line of proposal.lines || []) {
      if (totalRemaining <= 0) break;
      const availableForSource = sourceRemaining.get(line.sourceId) ?? 0;
      const requested = Math.round((Number(line.amount) || 0) * 100) / 100;
      const capped = Math.round(Math.min(requested, availableForSource, totalRemaining) * 100) / 100;
      if (capped <= 0) continue;
      sourceRemaining.set(line.sourceId, Math.round((availableForSource - capped) * 100) / 100);
      totalRemaining = Math.round((totalRemaining - capped) * 100) / 100;
      nextLines.push({
        sourceId: line.sourceId,
        amount: capped,
        ...(line.particular ? { particular: line.particular } : {}),
      });
    }
    if (nextLines.length) {
      fitted.push({ key: proposal.key, lines: nextLines });
    }
  }
  return fitted;
}

export async function generatePdfProjectDraft(
  projectId: string,
  source: string,
  name: string,
  anchor: string,
  onQueueUpdate: (update: AiQueueUpdate) => void,
  requestId?: string,
  options: Pick<ProposalImportOptions, "addBudget" | "addSubtasks"> & {
    projectContext?: PdfEnrichmentProjectContext;
  } = { addBudget: true, addSubtasks: true },
): Promise<ProjectImportDraft> {
  const authorizedBudget = options.projectContext?.authorizedBudget;
  const blockedByNoFunding = !!authorizedBudget?.fundingNotRequired;
  const blockedByEmptyFunding =
    !!authorizedBudget && !authorizedBudget.fundingNotRequired && authorizedBudget.totalAvailable <= 0;
  const effectiveAddBudget = options.addBudget && !blockedByNoFunding && !blockedByEmptyFunding;
  const parts = extractPartSections(source);
  if (!parts?.every((part) => part.sourceActions?.length)) {
    if (effectiveAddBudget && readSourceBudget(source))
      throw new Error(
        "The budget was read, but this PDF’s numbered work table could not be read safely. Use a text-based proposal with a clear work table.",
      );
    const draft = await generateProjectDraft(
      projectId,
      source,
      name,
      onQueueUpdate,
      options.projectContext ? { ...options.projectContext } : undefined,
    );
    return {
      ...draft,
      groups: draft.groups.map(group => ({ ...group, tasks: group.tasks.map(task => ({
        ...task,
        ...(options.addSubtasks ? {} : { subitems: [] }),
        ...(effectiveAddBudget ? {} : { budgetDecision: "missing" as const, budgetLines: [] }),
      })) })),
    };
  }
  const actions = parts.flatMap((part) => part.sourceActions!);
  if (actions.length > 100 || parts.length > 30)
    throw new Error("Import up to 30 groups and 100 tasks at a time.");
  const budget = effectiveAddBudget ? readSourceBudget(source) : null;
  const { tasks: canonical, budgetAllocations } = await enrichPdfSourceTasksWithMetadata(
    actions,
    budget,
    onQueueUpdate,
    requestId,
    options.addSubtasks,
    options.projectContext,
  );
  const fittedAllocations = effectiveAddBudget
    ? fitTaskBudgetsToAuthorizedSources(budgetAllocations, authorizedBudget)
    : [];
  const warnings: string[] = [];
  if (blockedByNoFunding) {
    warnings.push("This project does not require funding, so AI PDF import skipped task budget amounts.");
  } else if (blockedByEmptyFunding) {
    warnings.push("No remaining Head-authorized project funding is available, so AI PDF import skipped task budget amounts.");
  } else if (budget) {
    warnings.push(
      "Budget amounts match the PDF. Shared-cost placements are estimates and can be adjusted in the table.",
    );
  }
  let index = 0;
  const draft: ProjectImportDraft = {
    schemaVersion: 1,
    project: {
      title: "",
      description: "",
      objectives: "",
      startDate: anchor,
      targetDate: "",
    },
    offices: [],
    warnings,
    sourceBudgetTotal: budget?.total,
    ...(fittedAllocations.length ? { budgetAllocations: fittedAllocations } : {}),
    groups: parts.map((part, partIndex) => ({
      key: `part-${partIndex + 1}`,
      title: part.title,
      color: ["#00838f", "#579bfc", "#00a38d", "#a25ddc"][partIndex % 4],
      existingGroupId: "",
      tasks: part.sourceActions!.map((action) => {
        const task = canonical[index];
        const key = `task-${++index}`;
        return {
          key,
          title: task.title,
          description: task.description,
          priority: task.priority,
          estimatedHours: task.estimatedHours,
          ...sourceMonthDates(action.schedule, anchor),
          officeKey: "",
          dependencies: [],
          subitems: (task.subtasks || []).map(title => ({ title, dueDate: '' })),
          sourceQuote: action.title,
          included: true,
          budgetDecision: effectiveAddBudget ? (task.budgetDecision || "missing") : "missing",
          budgetLines: effectiveAddBudget ? (task.budgetLines || []) : [],
        };
      }),
    })),
  };
  return draft;
}
