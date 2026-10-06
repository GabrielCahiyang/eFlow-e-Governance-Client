/** Session-only receipts prevent a repeated write after a lost response, including after reopening a dialog. */
const outcomes = new Map<string, "saved" | "uncertain">();
export const financialOutcome = (key: string) => outcomes.get(key);
export const recordFinancialOutcome = (
  key: string,
  outcome: "saved" | "uncertain",
) => outcomes.set(key, outcome);
export function financialFailureIsUncertain(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  if (
    /network|fetch|timeout|connection|abort|gateway|unavailable|response|ECONN/i.test(
      message,
    )
  )
    return true;
  // These are explicit server/validation rejections, rather than an absent response.
  return !/only |required|cannot|not allowed|must |insufficient|does not balance|unbalanced|exceeds|ceiling exceeded|not pending|already |not found|not installed|permission|unauthorized|forbidden|invalid|denied|reason|limit|schema cache/i.test(
    message,
  );
}
export const financialErrorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "The financial operation returned no confirmed result.";

interface JournalProof {
  ids: string[];
  fingerprint: string;
}
const journalProofs = new Map<string, JournalProof>();
export function journalFingerprint(entry: {
  entryDate: string;
  referenceNumber: string;
  memo: string;
  lines: { accountCode: string; debit: number; credit: number }[];
}) {
  return JSON.stringify([
    entry.entryDate,
    entry.referenceNumber,
    entry.memo,
    entry.lines
      .map((line) => [
        line.accountCode,
        Number(line.debit),
        Number(line.credit),
      ])
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  ]);
}
export const rememberJournalAttempt = (key: string, proof: JournalProof) =>
  journalProofs.set(key, proof);
export const journalAttempt = (key: string) => journalProofs.get(key);
