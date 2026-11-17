import { enrichPdfSourceTasks, extractPartSections, readSourceBudget, type ProposalImportOptions } from '../../proposal-import';
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

export async function generatePdfProjectDraft(
  projectId: string,
  source: string,
  name: string,
  anchor: string,
  onQueueUpdate: (update: AiQueueUpdate) => void,
  requestId?: string,
  options: Pick<ProposalImportOptions, "addBudget" | "addSubtasks"> = { addBudget: true, addSubtasks: true },
): Promise<ProjectImportDraft> {
  const parts = extractPartSections(source);
  if (!parts?.every((part) => part.sourceActions?.length)) {
    if (options.addBudget && readSourceBudget(source))
      throw new Error(
        "The budget was read, but this PDF’s numbered work table could not be read safely. Use a text-based proposal with a clear work table.",
      );
    const draft = await generateProjectDraft(projectId, source, name, onQueueUpdate);
    return {
      ...draft,
      groups: draft.groups.map(group => ({ ...group, tasks: group.tasks.map(task => ({
        ...task,
        ...(options.addSubtasks ? {} : { subitems: [] }),
        ...(options.addBudget ? {} : { budgetDecision: "missing" as const, budgetLines: [] }),
      })) })),
    };
  }
  const actions = parts.flatMap((part) => part.sourceActions!);
  if (actions.length > 100 || parts.length > 30)
    throw new Error("Import up to 30 groups and 100 tasks at a time.");
  const budget = options.addBudget ? readSourceBudget(source) : null;
  const canonical = await enrichPdfSourceTasks(actions, budget, onQueueUpdate, requestId, options.addSubtasks);
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
    warnings: budget
      ? [
          "Budget amounts match the PDF. Shared-cost placements are estimates and can be adjusted in the table.",
        ]
      : [],
    sourceBudgetTotal: budget?.total,
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
          budgetDecision: task.budgetDecision || "missing",
          budgetLines: task.budgetLines || [],
        };
      }),
    })),
  };
  return draft;
}
