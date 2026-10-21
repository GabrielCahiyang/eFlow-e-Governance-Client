import type {
  ProposalDecompositionBudgetLine,
  ProposalDecompositionTask,
} from "../types";
import type { BudgetLineInput, TaskBudgetDecision } from "../../budget";

export interface SourceBudgetLine extends ProposalDecompositionBudgetLine {
  sourceId: string;
  page: number;
}
export interface SourceBudget {
  lines: SourceBudgetLine[];
  total: number;
  warnings: string[];
}
const cents = (value: number) => Math.round(value * 100);
export const matchesSourceLine = (
  line: ProposalDecompositionBudgetLine,
  source: SourceBudgetLine,
) =>
  line.particular === source.particular &&
  line.fundSource === source.fundSource &&
  cents(line.amount) === cents(source.amount);
function sourceDescription(
  description: string,
  lines: SourceBudgetLine[],
): string {
  const base = description.replace(
    /\n\nSource budget \(PDF\):[\s\S]*?These costs are counted once across the proposal; task placement needs review\./,
    "",
  );
  return (
    base +
    (lines.length
      ? `\n\nSource budget (PDF): ${lines.map((line) => `${line.sourceId}, page ${line.page}: ${line.particular} — PHP ${line.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}; source: ${line.fundSource}`).join("; ")}. These costs are counted once across the proposal; task placement needs review.`
      : "")
  );
}

/** Explicit reviewer move, conserving the original budget line ID and amount. */
export function moveSourceBudgetLine<
  T extends {
    key: string;
    description: string;
    budgetDecision?: TaskBudgetDecision;
    budgetLines?: BudgetLineInput[];
  },
>(source: SourceBudget, id: string, destination: string, tasks: T[]): T[] {
  const item = source.lines.find((line) => line.sourceId === id),
    target = tasks.find((task) => task.key === destination);
  if (!item || !target)
    throw new Error("Choose an existing source line and task.");
  const found = tasks
    .flatMap((task) => task.budgetLines || [])
    .filter((line) => matchesSourceLine(line, item));
  if (found.length !== 1)
    throw new Error(
      "This source line was edited or duplicated. Review its task budget before moving it.",
    );
  return tasks.map((task) => {
    const lines = (task.budgetLines || []).filter(
      (line) => !matchesSourceLine(line, item),
    );
    if (task.key === destination)
      lines.push({ ...found[0], draftTaskKey: task.key });
    const changed =
      lines.length !== (task.budgetLines || []).length ||
      task.key === destination;
    if (!changed) return task;
    return {
      ...task,
      budgetLines: lines,
      budgetDecision: lines.length ? "funded" : "missing",
      description: sourceDescription(
        task.description,
        source.lines.filter((sourceLine) =>
          lines.some((line) => matchesSourceLine(line, sourceLine)),
        ),
      ),
    };
  });
}
function money(value: unknown): number {
  if (typeof value !== "string" || !/^\d[\d,]*(?:\.\d{2})?$/.test(value))
    throw new Error(
      "A PDF budget amount could not be read safely. Review the source table.",
    );
  const number = Number(value.replace(/,/g, ""));
  if (!Number.isSafeInteger(cents(number)) || number <= 0)
    throw new Error("A PDF budget amount is invalid.");
  return number;
}
/** Sum detail rows, never the repeated category/subtotal/grand-total columns. */
export function readSourceBudget(source: string): SourceBudget | null {
  const blocks = [
    ...source.matchAll(
      /\[PDF BUDGET TABLE PAGE \d+\]\n([\s\S]*?)\n\[\/PDF BUDGET TABLE\]/g,
    ),
  ];
  if (!blocks.length) return null;
  const lines: SourceBudgetLine[] = [],
    groups = new Map<string, { sum: number; expected: number }>(),
    totals = new Map<string, number>();
  let reported: number | undefined;
  for (const block of blocks)
    for (const raw of block[1].trim().split("\n")) {
      const row = JSON.parse(raw) as Record<string, unknown>;
      if (
        typeof row.category !== "string" ||
        typeof row.particular !== "string" ||
        typeof row.expenseClass !== "string" ||
        typeof row.fundSource !== "string" ||
        !Number.isInteger(row.page)
      )
        throw new Error("Invalid PDF budget row.");
      const amount = money(row.amount),
        category = row.category;
      if (/^TOTAL PROJECT COST$/i.test(category)) {
        if (reported !== undefined && cents(reported) !== cents(amount))
          throw new Error("Conflicting PDF project totals.");
        reported = amount;
        continue;
      }
      if (/^Total\s+/i.test(category)) {
        if (
          totals.has(row.expenseClass) &&
          cents(totals.get(row.expenseClass)!) !== cents(amount)
        )
          throw new Error("Conflicting PDF expense totals.");
        totals.set(row.expenseClass, amount);
        continue;
      }
      if (!row.particular.trim() || !row.fundSource.trim())
        throw new Error(
          "A budget detail is missing its particulars or source fund. Review the PDF.",
        );
      const key = JSON.stringify([row.expenseClass, category, row.fundSource]);
      const expected = money(row.subtotal),
        group = groups.get(key) || { sum: 0, expected };
      if (cents(group.expected) !== cents(expected))
        throw new Error("Conflicting PDF category subtotals.");
      group.sum += cents(amount);
      groups.set(key, group);
      // A merged Amount cell is one source line. Meals + snacks stay one bundle.
      const matches = [
        ...row.particular.matchAll(
          /(\d[\d,]*)\s*(?:pax|pcs|persons?|pieces?)?\s*(?:×|x|@)\s*(?:₱|P)?\s*(\d[\d,]*(?:\.\d{1,2})?)/gi,
        ),
      ];
      const quantity =
        matches.length === 1 ? Number(matches[0][1].replace(/,/g, "")) : 1;
      const unitCost =
        matches.length === 1 ? Number(matches[0][2].replace(/,/g, "")) : amount;
      if (matches.length === 1 && cents(quantity * unitCost) !== cents(amount))
        throw new Error(
          `Quantity and price do not match the source amount for ${row.particular}.`,
        );
      lines.push({
        sourceId: `budget-${lines.length + 1}`,
        page: Number(row.page),
        expenseClass: row.expenseClass,
        category,
        particular: row.particular,
        amount,
        quantity,
        unit: matches.length === 1 ? "unit" : "lot",
        unitCost,
        fundSource: row.fundSource,
      });
    }
  for (const group of groups.values())
    if (group.sum !== cents(group.expected))
      throw new Error(
        "PDF budget detail amounts do not match their category subtotal. Review the document.",
      );
  for (const [expenseClass, total] of totals)
    if (
      lines
        .filter((line) => line.expenseClass === expenseClass)
        .reduce((sum, line) => sum + cents(line.amount), 0) !== cents(total)
    )
      throw new Error(`PDF ${expenseClass} amounts do not match its total.`);
  const sum = lines.reduce((total, line) => total + cents(line.amount), 0);
  if (!lines.length || reported === undefined || sum !== cents(reported))
    throw new Error(
      "PDF budget lines do not match the reported project total. No budget was applied.",
    );
  return {
    lines,
    total: sum / 100,
    warnings: [
      "Source amounts are exact; task placement is an AI suggestion for your review. Shared costs are included once, not once per phase. Source funds are labels, not approved allocations.",
    ],
  };
}

/** Model supplies references only. Amounts, names and funds always come from the source table. */
export function applySourceBudgetAssignments(
  budget: SourceBudget,
  tasks: ProposalDecompositionTask[],
  raw: string,
): void {
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match)
    throw new Error(
      "Budget placement returned no usable result. Retry analysis.",
    );
  const payload = JSON.parse(match[0]);
  if (
    !Array.isArray(payload.allocations) ||
    payload.allocations.length !== budget.lines.length
  )
    throw new Error(
      "Every source budget line must be placed exactly once. Retry analysis.",
    );
  const seen = new Set<string>(),
    mapped = new Map<number, SourceBudgetLine[]>();
  for (const row of payload.allocations) {
    const line = budget.lines.find((line) => line.sourceId === row?.sourceId);
    const task =
      typeof row?.taskId === "string" && /^task-\d+$/.test(row.taskId)
        ? Number(row.taskId.slice(5)) - 1
        : -1;
    if (
      !line ||
      seen.has(line.sourceId) ||
      !Number.isInteger(task) ||
      task < 0 ||
      task >= tasks.length
    )
      throw new Error(
        "Budget placement duplicated a source line or referenced unknown work. Retry analysis.",
      );
    seen.add(line.sourceId);
    mapped.set(task, [...(mapped.get(task) || []), line]);
  }
  tasks.forEach((task, index) => {
    const lines = mapped.get(index) || [];
    task.budgetLines = lines.map(
      ({ sourceId: _id, page: _page, ...line }) => line,
    );
    task.budgetDecision = lines.length ? "funded" : "missing";
    task.budgetNoCostReason = undefined;
    task.description = sourceDescription(task.description, lines);
  });
}
