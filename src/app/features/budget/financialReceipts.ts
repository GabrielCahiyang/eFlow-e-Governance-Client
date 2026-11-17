import { readableUiError } from '../../shared/userFacingError';

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
  return !/only |required|cannot|not allowed|must |insufficient|does not balance|unbalanced|exceeds|ceiling exceeded|not pending|already |not found|not installed|permission|unauthorized|forbidden|invalid|denied|reason|limit|schema cache|map every purchased-item source to an active journal expense account before settlement/i.test(
    message,
  );
}
export const financialErrorMessage = (error: unknown, fallback = "We couldn’t complete this financial action.", operation: 'read' | 'write' = 'write') =>
  readableUiError(error, fallback, operation);

/** Use workflow evidence for the outcome. Error text alone cannot confirm a write. */
export function financialWriteFeedback(error: unknown, context: {
  outcome?: 'saved' | 'uncertain';
  submitted: boolean;
  action: string;
  record: string;
  draft?: string;
}) {
  const { outcome, submitted, action, record, draft } = context;
  if (outcome === 'saved') return `${action} was saved. We couldn’t refresh ${record}. Reload the records before continuing.`;
  if (outcome === 'uncertain') return `We couldn’t confirm whether ${action.toLowerCase()} was saved. Check ${record} before submitting again.`;
  const summary = submitted ? `${action} was not saved.` : `${action} was not submitted.`;
  const fallback = 'Review the form or contact your administrator if the problem continues.';
  const detail = financialErrorMessage(error, fallback, 'read');
  const sentence = /[.!?]$/.test(detail) ? detail : `${detail}.`;
  return [summary, sentence, draft].filter(Boolean).join(' ');
}

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
