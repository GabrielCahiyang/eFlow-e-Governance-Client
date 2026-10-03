import { describe, expect, it } from "vitest";
import { normalizeImportedTaskBudgetLines } from "../../src/app/features/proposal-import/services/proposalBudgetImport";

describe("AI proposal budget import", () => {
  it("preserves a source total when quantity is greater than one", () => {
    const [line] = normalizeImportedTaskBudgetLines("task-1", [{
      expenseClass: "Professional Services",
      category: "Honoraria",
      particular: "Research assistants",
      quantity: 2,
      unit: "person",
      amount: 120_000,
    }]);

    expect(line).toMatchObject({
      draftTaskKey: "task-1",
      quantity: 2,
      unitCost: 60_000,
      amount: 120_000,
      fundSource: "Office Budget",
    });
  });

  it("uses an explicit unit cost to calculate the authoritative amount", () => {
    const [line] = normalizeImportedTaskBudgetLines("task-2", [{
      expenseClass: "Other Expenses",
      category: "Meals",
      particular: "Workshop meals",
      quantity: 25,
      unit: "person",
      unitCost: 200,
      amount: 0,
    }]);

    expect(line.amount).toBe(5_000);
  });
});
