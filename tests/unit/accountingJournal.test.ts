import { describe, expect, it } from "vitest";
import { getJournalTotals, isBalancedJournalLines } from "../../src/app/features/budget/selectors/journalSelectors";
import type { GeneralJournalEntry } from "../../src/app/features/budget/types";

const entry = (lines: Array<{ debit: number; credit: number }>): GeneralJournalEntry => ({
  id: "journal-1",
  entryNumber: 1,
  fiscalBudgetId: "budget-1",
  orgId: "org-1",
  entryDate: "2026-09-19",
  referenceNumber: "DV-2026-00001-ABC123",
  sourceType: "cash_release",
  memo: "Cash release",
  postedAt: 1,
  lines: lines.map((line, index) => ({ id: `line-${index}`, lineNumber: index + 1, accountCode: index ? "10102020" : "19901030", accountTitle: index ? "Cash" : "Advance", ...line })),
});

describe("double-entry journal invariants", () => {
  it("reports a zero trial-balance delta for a release and settlement", () => {
    const totals = getJournalTotals([
      entry([{ debit: 1000, credit: 0 }, { debit: 0, credit: 1000 }]),
      entry([{ debit: 800, credit: 0 }, { debit: 200, credit: 0 }, { debit: 0, credit: 1000 }]),
    ]);
    expect(totals).toEqual({ debit: 2000, credit: 2000, delta: 0 });
  });

  it("rejects an unbalanced or one-sided manual adjustment", () => {
    expect(isBalancedJournalLines([{ accountCode: "10102020", debit: 500, credit: 0 }, { accountCode: "19901030", debit: 0, credit: 400 }])).toBe(false);
    expect(isBalancedJournalLines([{ accountCode: "10102020", debit: 500, credit: 500 }, { accountCode: "19901030", debit: 0, credit: 0 }])).toBe(false);
  });

  it("accepts a balanced multi-line correction", () => {
    expect(isBalancedJournalLines([{ accountCode: "50299990", debit: 800, credit: 0 }, { accountCode: "10102020", debit: 200, credit: 0 }, { accountCode: "19901030", debit: 0, credit: 1000 }])).toBe(true);
  });

  it("rejects sub-cent input even when unrounded totals balance", () => {
    expect(isBalancedJournalLines([
      { accountCode: "50299990", debit: 100.004, credit: 0 },
      { accountCode: "50299990", debit: 100.004, credit: 0 },
      { accountCode: "10102020", debit: 0, credit: 200.008 },
    ])).toBe(false);
  });

  it("sums exact cents despite ordinary JavaScript floating point", () => {
    expect(isBalancedJournalLines([
      { accountCode: "50299990", debit: .1, credit: 0 },
      { accountCode: "50299990", debit: .2, credit: 0 },
      { accountCode: "10102020", debit: 0, credit: .3 },
    ])).toBe(true);
  });

  it.each([NaN, Infinity, -Infinity, -.01, .001])("rejects invalid money %s", amount => {
    expect(isBalancedJournalLines([
      { accountCode: "50299990", debit: amount, credit: 0 },
      { accountCode: "10102020", debit: 0, credit: amount },
    ], 100)).toBe(false);
  });
});
