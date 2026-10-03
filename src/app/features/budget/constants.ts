import type { ProposalBudgetDraft } from "./types";

export const DEFAULT_DAILY_PETTY_CASH_RELEASE_LIMIT = 30_000;
export const DEFAULT_PER_RECEIPT_LIMIT = 5_000;
// Compatibility aliases while older budget consumers are migrated.
export const DEFAULT_PETTY_CASH_LIMIT = DEFAULT_DAILY_PETTY_CASH_RELEASE_LIMIT;
export const DEFAULT_PETTY_CASH_REQUEST_LIMIT = DEFAULT_PER_RECEIPT_LIMIT;
export const DEFAULT_UNDERUTILIZATION_THRESHOLD = 75;
export const DEFAULT_LIQUIDATION_DUE_DAYS = 15;
export const DEFAULT_APPROVAL_TIER_THRESHOLD = 1_000;
export const PROPOSAL_FUND_SOURCE = "Office Budget";
export const PROPOSAL_EXPENSE_CLASSES = [
  "Professional Services",
  "Other Expenses",
  "Maintenance and Other Operating Expenses",
  "Capital Outlay",
  "Personnel Services",
] as const;

export function getCurrentFiscalYear() {
  return Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Asia/Manila" }).format(new Date()));
}

export function createBudgetLine(position = 0, draftTaskKey?: string) {
  return {
    id: crypto.randomUUID(),
    ...(draftTaskKey ? { draftTaskKey } : {}),
    expenseClass: "Other Expenses",
    category: "Operating Expenses",
    particular: "",
    quantity: 1,
    unit: "item",
    unitCost: 0,
    amount: 0,
    fundSource: PROPOSAL_FUND_SOURCE,
    position,
  };
}

export function createEmptyProposalBudget(fiscalYear = new Date().getFullYear()): ProposalBudgetDraft {
  return { fiscalYear, totalAmount: 0, lines: [], taskBudgets: [] };
}
