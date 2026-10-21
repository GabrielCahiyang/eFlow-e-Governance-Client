import {
  extractPartSections,
  readSourceBudget,
  applySourceBudgetAssignments,
  type ProposalDecompositionTask,
} from "../../proposal-import";
import { readAiText, requestAiChat, type AiQueueUpdate } from "../../ai";
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
): Promise<ProjectImportDraft> {
  const parts = extractPartSections(source);
  if (!parts?.every((part) => part.sourceActions?.length)) {
    if (readSourceBudget(source))
      throw new Error(
        "The budget was read, but this PDF’s numbered work table could not be read safely. Use a text-based proposal with a clear work table.",
      );
    return generateProjectDraft(projectId, source, name, onQueueUpdate);
  }
  const actions = parts.flatMap((part) => part.sourceActions!);
  if (actions.length > 100 || parts.length > 30)
    throw new Error("Import up to 30 groups and 100 tasks at a time.");
  const budget = readSourceBudget(source);
  const response = await requestAiChat(
    {
      model: "deepseek-r1:8b",
      messages: [{ role: "user", content: "Suggest metadata for the fixed source PDF table." }],
      pdf_table_enrichment: {
        schemaVersion: 1,
        tasks: actions.map((action, index) => ({ key: `task-${index + 1}`, ...action })),
        costs: budget?.lines || [],
      },
      stream: false,
    },
    { onQueueUpdate, requestId },
  );
  const raw = readAiText(response)
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
  const payload = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || "{}");
  if (!Array.isArray(payload.tasks) || payload.tasks.length !== actions.length)
    throw new Error("The AI server returned an incomplete PDF table. Restart the updated AI server and try again. No work was saved.");
  const suggestions = new Map<
    string,
    { priority: "low" | "medium" | "high"; estimatedHours: number }
  >();
  for (const task of payload.tasks) {
    if (
      !/^task-\d+$/.test(task.key) ||
      Number(task.key.slice(5)) > actions.length ||
      Number(task.key.slice(5)) < 1 ||
      suggestions.has(task.key) ||
      !["low", "medium", "high"].includes(task.priority) ||
      !Number.isFinite(task.estimatedHours) ||
      task.estimatedHours < 0 ||
      task.estimatedHours > 10000
    )
      throw new Error(
        "The AI returned invalid task priorities or effort. Try again.",
      );
    suggestions.set(task.key, task);
  }
  const canonical: ProposalDecompositionTask[] = actions.map((action) => ({
    title: action.title,
    description: `${action.title}\n\nMethodology${action.methodologyScope === "phase" ? " (shared group methods)" : ""}:\n${action.methodology.map((method) => `• ${method}`).join("\n")}\n\nSchedule: ${action.schedule}`,
  }));
  if (budget) {
    applySourceBudgetAssignments(budget, canonical, JSON.stringify({ allocations: payload.allocations }));
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
        const task = canonical[index],
          key = `task-${++index}`,
          suggestion = suggestions.get(key)!;
        return {
          key,
          title: task.title,
          description: task.description,
          priority: suggestion.priority,
          estimatedHours: suggestion.estimatedHours,
          ...sourceMonthDates(action.schedule, anchor),
          officeKey: "",
          dependencies: [],
          subitems: [],
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
