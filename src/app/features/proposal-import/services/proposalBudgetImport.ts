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
    if([line.amount,line.quantity??1,line.unitCost??0].some(value=>typeof value!=='number'||!Number.isFinite(value)||value<0))throw new Error('A proposed budget has an invalid amount, quantity or unit cost. Review the source.');
    const quantity = Math.max(0, Number(line.quantity ?? 1));
    const amount = Math.max(0, Number(line.amount ?? 0));
    const unitCost = Math.max(
      0,
      Number(line.unitCost ?? (quantity > 0 ? amount / quantity : amount)),
    );
    const computed=Math.round(quantity*unitCost*100)/100;
    if(line.unitCost!==undefined&&amount>0&&Math.round(amount*100)!==Math.round(computed*100))throw new Error('A proposed budget quantity and unit cost do not match its stated amount. Review the source.');

    return {
      id: crypto.randomUUID(),
      draftTaskKey: taskKey,
      expenseClass: line.expenseClass || "Other Expenses",
      category: line.category || "Operating Expenses",
      particular: line.particular || "",
      quantity,
      unit: line.unit || "item",
      unitCost,
      amount: quantity > 0 && unitCost > 0 ? computed : amount,
      fundSource: line.fundSource?.trim() || PROPOSAL_FUND_SOURCE,
      position,
    };
  });
}
