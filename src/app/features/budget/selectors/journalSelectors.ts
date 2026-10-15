import type { GeneralJournalEntry, JournalAdjustmentLineInput } from "../types";

export function getJournalTotals(entries: GeneralJournalEntry[]) {
  return entries.reduce((totals, entry) => {
    entry.lines.forEach((line) => { totals.debit += line.debit; totals.credit += line.credit; });
    totals.delta = totals.debit - totals.credit;
    return totals;
  }, { debit: 0, credit: 0, delta: 0 });
}

export function isBalancedJournalLines(lines: JournalAdjustmentLineInput[], _tolerance = .009) {
  // Retain the optional argument for compatibility, but never let a tolerance
  // authorize fractions that numeric(16,2) would silently round on persistence.
  let debit = 0, credit = 0;
  const cents = (value: number) => {
    const scaled = value * 100, rounded = Math.round(scaled);
    return Number.isFinite(value) && value >= 0 && Number.isSafeInteger(rounded)
      && value === Number((rounded / 100).toFixed(2)) ? rounded : NaN;
  };
  for (const line of lines) {
    const d = cents(line.debit), c = cents(line.credit);
    if (!line.accountCode.trim() || !Number.isFinite(d) || !Number.isFinite(c) || ((d > 0) === (c > 0))) return false;
    debit += d; credit += c;
    if (!Number.isSafeInteger(debit) || !Number.isSafeInteger(credit)) return false;
  }
  return lines.length >= 2 && debit > 0 && debit === credit;
}
