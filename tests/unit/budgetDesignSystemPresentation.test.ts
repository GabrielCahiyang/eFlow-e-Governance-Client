import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const cashLiquidation = readFileSync("src/app/features/budget/components/CashLiquidationDialog.tsx", "utf8");
const approvalQueue = readFileSync("src/app/features/budget/components/BudgetApprovalQueue.tsx", "utf8");
const accountingTrail = readFileSync("src/app/features/budget/components/AccountingTrailPanel.tsx", "utf8");
const accountingWorkspace = readFileSync("src/app/features/budget/components/AccountingStaffWorkspace.tsx", "utf8");
const expensesReport = readFileSync("src/app/features/budget/components/BudgetExpensesReport.tsx", "utf8");
const positionSummary = readFileSync("src/app/features/budget/components/BudgetPositionSummary.tsx", "utf8");
const budgetUi = readFileSync("src/app/features/budget/components/budgetUi.tsx", "utf8");
const taskBudgetEditor = readFileSync("src/app/features/budget/components/TaskBudgetEditor.tsx", "utf8");
const taskBudgetDialog = readFileSync("src/app/features/budget/components/TaskBudgetDialog.tsx", "utf8");

describe("budget design-system presentation", () => {
  it("uses the shared dialog foundation for liquidation and approval decisions", () => {
    expect(cashLiquidation).toContain("<Dialog open");
    expect(cashLiquidation).toContain("<DialogFooter");
    expect(cashLiquidation).toContain("sm:max-w-[640px]");
    expect(cashLiquidation).toContain('inputClassName="text-right tabular-nums"');
    expect(approvalQueue).toContain("<Dialog open");
    expect(approvalQueue).toContain("Decision required");
    expect(approvalQueue).not.toContain('fixed inset-0 z-[80] bg-neutral-950/35');
  });

  it("keeps financial surfaces on canonical cards and right-aligned tabular values", () => {
    expect(budgetUi).toContain('import { Card }');
    expect(budgetUi).toContain('text-right text-[20px] font-semibold tabular-nums');
    expect(expensesReport).toContain('rounded-[10px] border border-border bg-card');
    expect(expensesReport).toContain('text-right font-semibold tabular-nums text-foreground');
    expect(expensesReport).toContain('text-right text-primary tabular-nums');
    expect(accountingWorkspace).toContain('text-right text-[20px] font-semibold tabular-nums text-foreground');
    expect(positionSummary).toContain('rounded-[10px] border border-border bg-card');
  });

  it("uses a compact, tokenized accounting inspector with tabular journal amounts", () => {
    expect(accountingTrail).toContain('max-w-[480px]');
    expect(accountingTrail).toContain('<FeatureDialog');
    expect(accountingTrail).toContain('whitespace-nowrap text-right tabular-nums');
    expect(accountingTrail).toContain('rounded-lg border border-border bg-card p-3');
  });

  it("uses teal selectable funding options and a non-card funding status", () => {
    expect(taskBudgetEditor).toContain('sm:grid-cols-2');
    expect(taskBudgetEditor).toContain('minmax(120px,1fr)_68px_64px_88px_88px_30px');
    expect(taskBudgetEditor).toContain('bg-primary/10 text-primary ring-1 ring-primary/15');
    expect(taskBudgetEditor).toContain('rounded-full px-2.5 py-1 font-semibold');
    expect(taskBudgetEditor).not.toContain('border-neutral-900 bg-neutral-950 text-white');
    expect(taskBudgetDialog).toContain('bg-primary px-5 text-[10.5px] font-medium text-primary-foreground');
    expect(taskBudgetDialog).toContain('!w-full !max-w-2xl');
    expect(taskBudgetDialog).not.toContain('w-full max-w-4xl');
  });
});
