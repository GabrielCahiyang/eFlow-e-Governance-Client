import {
  PROPOSAL_FUND_SOURCE,
  type BudgetLineInput,
} from "../../budget";
import type { ProposalDecompositionBudgetLine } from "../types";

export function normalizeImportedTaskBudgetLines(
  taskKey: string,
  lines: ProposalDecompositionBudgetLine[] = [],
): BudgetLineInput[] {
  return lines.map((line, position) => {
    const quantity = Math.max(0, Number(line.quantity ?? 1));
    const amount = Math.max(0, Number(line.amount ?? 0));
    const unitCost = Math.max(
      0,
      Number(line.unitCost ?? (quantity > 0 ? amount / quantity : amount)),
    );

    return {
      id: crypto.randomUUID(),
      draftTaskKey: taskKey,
      expenseClass: line.expenseClass || "Other Expenses",
      category: line.category || "Operating Expenses",
      particular: line.particular || "",
      quantity,
      unit: line.unit || "item",
      unitCost,
      amount: quantity > 0 && unitCost > 0 ? quantity * unitCost : amount,
      fundSource: PROPOSAL_FUND_SOURCE,
      position,
    };
  });
}
