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

function drawFromAuthorizedSources(
  entries: Array<{ key: string; amountCents: number; particular?: string }>,
  authorizedBudget: NonNullable<PdfEnrichmentProjectContext['authorizedBudget']>,
): PdfBudgetAllocationProposal[] {
  const remainingSources = authorizedBudget.sources
    .map((source) => ({
      id: source.id,
      availableCents: Math.max(0, Math.round((Number(source.available) || 0) * 100)),
    }))
    .filter((source) => source.availableCents > 0);
  const totalCapCents = Math.min(
    Math.max(0, Math.round((Number(authorizedBudget.totalAvailable) || 0) * 100)),
    remainingSources.reduce((sum, src) => sum + src.availableCents, 0),
  );
  if (totalCapCents <= 0 || !remainingSources.length) return [];

  let usedCents = 0;
  const byTask = new Map<string, PdfBudgetAllocationProposal['lines']>();
  for (const entry of entries) {
    let left = Math.min(Math.max(0, entry.amountCents), totalCapCents - usedCents);
    if (left <= 0) continue;
    const taskLines = byTask.get(entry.key) || [];
    for (const src of remainingSources) {
      if (left <= 0) break;
      const take = Math.min(left, src.availableCents);
      if (take <= 0) continue;
      taskLines.push({
        sourceId: src.id,
        amount: Math.round(take) / 100,
        ...(entry.particular ? { particular: entry.particular.slice(0, 200) } : {}),
      });
      src.availableCents -= take;
      usedCents += take;
      left -= take;
    }
    if (taskLines.length) byTask.set(entry.key, taskLines);
  }
  return [...byTask.entries()].map(([key, lines]) => ({ key, lines }));
}

function buildWeightedFallbackAllocations(
  canonical: Array<{ title: string; budgetLines?: Array<{ particular?: string; amount: number }> }>,
  authorizedBudget: NonNullable<PdfEnrichmentProjectContext['authorizedBudget']>,
): PdfBudgetAllocationProposal[] {
  const totalCapCents = Math.min(
    Math.max(0, Math.round((Number(authorizedBudget.totalAvailable) || 0) * 100)),
    authorizedBudget.sources.reduce(
      (sum, src) => sum + Math.max(0, Math.round((Number(src.available) || 0) * 100)),
      0,
    ),
  );
  if (totalCapCents <= 0 || !canonical.length) return [];

  const weighted = canonical.map((task, idx) => {
    const lines = task.budgetLines || [];
    const pdfTotal = lines.reduce((sum, line) => sum + Math.max(0, Number(line.amount) || 0), 0);
    const joined = lines
      .slice(0, 2)
      .map((line) => (line.particular || '').trim())
      .filter(Boolean)
      .join('; ');
    return {
      key: `task-${idx + 1}`,
      weight: pdfTotal,
      particular: joined ? `${joined.slice(0, 155)} (adjusted to authorized funding)` : task.title,
    };
  });
  const positive = weighted.filter((item) => item.weight > 0);
  const targets = positive.length ? positive : weighted.map((item) => ({ ...item, weight: 1 }));
  const weightSum = targets.reduce((sum, item) => sum + item.weight, 0);
  if (weightSum <= 0) return [];

  let allocatedCents = 0;
  const entries = targets.map((item, idx) => {
    const remaining = totalCapCents - allocatedCents;
    const amountCents =
      idx === targets.length - 1
        ? remaining
        : Math.min(Math.round((item.weight / weightSum) * totalCapCents), remaining);
    allocatedCents += amountCents;
    return { key: item.key, amountCents, particular: item.particular };
  });
  return drawFromAuthorizedSources(entries, authorizedBudget);
}

function buildExactPdfAuthorizedAllocations(
  canonical: Array<{ title: string; budgetLines?: Array<{ particular?: string; amount: number }> }>,
  authorizedBudget: NonNullable<PdfEnrichmentProjectContext['authorizedBudget']>,
): PdfBudgetAllocationProposal[] {
  const entries: Array<{ key: string; amountCents: number; particular?: string }> = [];
  canonical.forEach((task, idx) => {
    const key = `task-${idx + 1}`;
    for (const line of task.budgetLines || []) {
      const amountCents = Math.max(0, Math.round((Number(line.amount) || 0) * 100));
      if (amountCents > 0) {
        entries.push({
          key,
          amountCents,
          particular: (line.particular || task.title || '').trim(),
        });
      }
    }
  });
  return drawFromAuthorizedSources(entries, authorizedBudget);
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
  const hasAuthorizedSources = Boolean(
    effectiveAddBudget &&
    authorizedBudget &&
    !authorizedBudget.fundingNotRequired &&
    authorizedBudget.totalAvailable > 0 &&
    authorizedBudget.sources.length > 0,
  );
  const pdfExceedsAuthorized = Boolean(
    hasAuthorizedSources &&
    budget &&
    Math.round(budget.total * 100) > Math.round(authorizedBudget!.totalAvailable * 100),
  );
  const { tasks: canonical, budgetAllocations, budgetRebudgeted } = await enrichPdfSourceTasksWithMetadata(
    actions,
    budget,
    onQueueUpdate,
    requestId,
    options.addSubtasks,
    options.projectContext,
  );
  let fittedAllocations = effectiveAddBudget
    ? fitTaskBudgetsToAuthorizedSources(budgetAllocations, authorizedBudget)
    : [];
  if (pdfExceedsAuthorized && !fittedAllocations.length && authorizedBudget) {
    fittedAllocations = buildWeightedFallbackAllocations(canonical, authorizedBudget);
  } else if (hasAuthorizedSources && budget && !pdfExceedsAuthorized && !fittedAllocations.length && authorizedBudget) {
    fittedAllocations = buildExactPdfAuthorizedAllocations(canonical, authorizedBudget);
  }
  const rebudgetedToAuthorized = Boolean(
    pdfExceedsAuthorized || (budgetRebudgeted && fittedAllocations.length > 0),
  );
  const allocatedByTask = new Map<string, number>(
    fittedAllocations.map((alloc) => [
      alloc.key,
      Math.round(alloc.lines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100,
    ]),
  );
  const warnings: string[] = [];
  if (blockedByNoFunding) {
    warnings.push("This project does not require funding, so AI PDF import skipped task budget amounts.");
  } else if (blockedByEmptyFunding) {
    warnings.push("No remaining Head-authorized project funding is available, so AI PDF import skipped task budget amounts.");
  } else if (rebudgetedToAuthorized && budget && authorizedBudget) {
    warnings.push(
      `The PDF budget (₱${budget.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}) exceeds the remaining Head-authorized project funding (₱${authorizedBudget.totalAvailable.toLocaleString("en-US", { minimumFractionDigits: 2 })}). AI estimated fair task allocations strictly within the authorized ceiling.`,
    );
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
    sourceBudgetTotal: rebudgetedToAuthorized ? undefined : budget?.total,
    ...(fittedAllocations.length ? { budgetAllocations: fittedAllocations } : {}),
    groups: parts.map((part, partIndex) => ({
      key: `part-${partIndex + 1}`,
      title: part.title,
      color: ["#00838f", "#579bfc", "#00a38d", "#a25ddc"][partIndex % 4],
      existingGroupId: "",
      tasks: part.sourceActions!.map((action) => {
        const task = canonical[index];
        const key = `task-${++index}`;
        const allocatedAmount = allocatedByTask.get(key) || 0;
        const description =
          rebudgetedToAuthorized && budget && authorizedBudget && allocatedAmount > 0
            ? `${task.description}\n\nAuthorized project budget allocation: PHP ${allocatedAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })} (estimated within the PHP ${authorizedBudget.totalAvailable.toLocaleString("en-US", { minimumFractionDigits: 2 })} Head-authorized project ceiling; PDF proposed PHP ${budget.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}).`
            : task.description;
        return {
          key,
          title: task.title,
          description,
          priority: task.priority,
          ...sourceMonthDates(action.schedule, anchor),
          officeKey: "",
          dependencies: [],
          subitems: (task.subtasks || []).map(title => ({ title, dueDate: '' })),
          sourceQuote: action.title,
          included: true,
          budgetDecision:
            effectiveAddBudget && !rebudgetedToAuthorized
              ? (task.budgetDecision || "missing")
              : "missing",
          budgetLines:
            effectiveAddBudget && !rebudgetedToAuthorized
              ? (task.budgetLines || [])
              : [],
        };
      }),
    })),
  };
  return draft;
}
