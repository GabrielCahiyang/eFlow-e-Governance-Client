import { diffCentavos, exceedsCentavos, formatPeso, fromCentavos, toCentavos } from '../../shared/currency';
import { INPUT_LIMITS } from '../../shared/inputLimits';
import type { FundingDraft, ProjectFundingSource } from './types';

const overBudgetMessage = (source: string, amount: number, available: number) =>
  `${source}: You entered ${formatPeso(amount)}, but only ${formatPeso(available)} is available. Reduce it by ${formatPeso(diffCentavos(amount, available))}.`;

export interface FundingRowIssue {
  sourceError?: string;
  amountError?: string;
}

export interface FundingHardError {
  title: string;
  detail: string;
}

/**
 * Returns a blocking validation error (over-budget, cumulative FY overrun, duplicate/unavailable source,
 * or over-limit reason) distinctly from quiet "field still blank" guidance hints.
 */
export function fundingHardError(
  lines: FundingDraft[],
  sources: ProjectFundingSource[],
  reason = '',
): FundingHardError | null {
  const seen = new Set<string>();
  const totals = new Map<string, number>();
  const fiscalTotals = new Map<string, { centavos: number; available: number; year: number }>();

  for (const line of lines) {
    if (!line.partitionId) continue;
    const source = sources.find(item => item.id === line.partitionId);
    if (!source) {
      return {
        title: 'Budget source unavailable',
        detail: 'The selected Office Budget source is no longer available. Choose another source.',
      };
    }
    if (seen.has(line.partitionId)) {
      return {
        title: 'Duplicate budget source',
        detail: 'Use each budget source only once.',
      };
    }
    seen.add(line.partitionId);

    if (Number.isFinite(line.amount) && toCentavos(line.amount) > 0) {
      if (exceedsCentavos(line.amount, INPUT_LIMITS.MONEY_MAX_BUDGET)) {
        return {
          title: 'Amount exceeds maximum limit',
          detail: `Maximum funding amount per line is ${formatPeso(INPUT_LIMITS.MONEY_MAX_BUDGET)}.`,
        };
      }
      const lineCentavos = toCentavos(line.amount);
      totals.set(line.partitionId, (totals.get(line.partitionId) || 0) + lineCentavos);
      if (source.fiscalBudgetId && typeof source.fiscalAvailable === 'number') {
        const bucket = fiscalTotals.get(source.fiscalBudgetId) ?? {
          centavos: 0,
          available: source.fiscalAvailable,
          year: source.year,
        };
        bucket.centavos += lineCentavos;
        fiscalTotals.set(source.fiscalBudgetId, bucket);
      }
    }
  }

  for (const source of sources) {
    const amountCentavos = totals.get(source.id) || 0;
    const amount = fromCentavos(amountCentavos);
    if (exceedsCentavos(amount, source.available)) {
      return {
        title: 'Amount exceeds available Office Budget',
        detail: overBudgetMessage(`${source.name} (FY ${source.year})`, amount, source.available),
      };
    }
  }

  for (const bucket of fiscalTotals.values()) {
    const requested = fromCentavos(bucket.centavos);
    if (exceedsCentavos(requested, bucket.available)) {
      return {
        title: `Combined total exceeds FY ${bucket.year} Office Budget`,
        detail: `FY ${bucket.year} Office Budget: Combined total ${formatPeso(requested)} exceeds available ${formatPeso(bucket.available)}. Reduce it by ${formatPeso(diffCentavos(requested, bucket.available))}.`,
      };
    }
  }

  if (reason.trim().length > INPUT_LIMITS.FUNDING_REASON) {
    return {
      title: 'Reason exceeds character limit',
      detail: `Funding reason must be at most ${INPUT_LIMITS.FUNDING_REASON.toLocaleString('en-US')} characters.`,
    };
  }

  return null;
}

export function fundingRowIssues(lines: FundingDraft[], sources: ProjectFundingSource[]): FundingRowIssue[] {
  const seen = new Map<string, number>();
  const fiscalTotals = new Map<string, { centavos: number; available: number; year: number }>();

  const issues: FundingRowIssue[] = lines.map((line, index) => {
    const issue: FundingRowIssue = {};
    const source = sources.find(item => item.id === line.partitionId);

    if (line.partitionId && !source) {
      issue.sourceError = 'Selected budget source is no longer available.';
    } else if (line.partitionId) {
      if (seen.has(line.partitionId)) {
        issue.sourceError = 'Use each budget source only once.';
      } else {
        seen.set(line.partitionId, index);
      }
    }

    if (source && Number.isFinite(line.amount) && line.amount > 0) {
      const amountCentavos = toCentavos(line.amount);
      if (exceedsCentavos(line.amount, source.available)) {
        issue.amountError = `Exceeds available ${formatPeso(source.available)} — reduce by ${formatPeso(diffCentavos(line.amount, source.available))}.`;
      }
      if (source.fiscalBudgetId && typeof source.fiscalAvailable === 'number') {
        const current = fiscalTotals.get(source.fiscalBudgetId) ?? {
          centavos: 0,
          available: source.fiscalAvailable,
          year: source.year,
        };
        current.centavos += amountCentavos;
        fiscalTotals.set(source.fiscalBudgetId, current);
      }
    }
    return issue;
  });

  // Flag cumulative multi-line fiscal budget overrun on rows belonging to that fiscal budget.
  for (const [fiscalBudgetId, bucket] of fiscalTotals.entries()) {
    const requested = fromCentavos(bucket.centavos);
    if (exceedsCentavos(requested, bucket.available)) {
      const msg = `Combined FY ${bucket.year} total (${formatPeso(requested)}) exceeds remaining Office Budget (${formatPeso(bucket.available)}) by ${formatPeso(diffCentavos(requested, bucket.available))}.`;
      lines.forEach((line, index) => {
        const source = sources.find(item => item.id === line.partitionId);
        if (source?.fiscalBudgetId === fiscalBudgetId && !issues[index].amountError) {
          issues[index].amountError = msg;
        }
      });
    }
  }

  return issues;
}

export function fundingEntryError(lines: FundingDraft[], sources: ProjectFundingSource[], reason: string): string {
  const totals = new Map<string, number>();
  const fiscalTotals = new Map<string, { centavos: number; available: number; year: number }>();

  for (const line of lines) {
    const source = sources.find(item => item.id === line.partitionId);
    if (!source) return 'Choose a budget source.';
    if (totals.has(line.partitionId)) return 'Use each budget source only once.';
    if (!Number.isFinite(line.amount) || toCentavos(line.amount) <= 0) return 'Enter an amount greater than zero.';
    if (exceedsCentavos(line.amount, INPUT_LIMITS.MONEY_MAX_BUDGET)) {
      return `Maximum funding amount per line is ${formatPeso(INPUT_LIMITS.MONEY_MAX_BUDGET)}.`;
    }
    const lineCentavos = toCentavos(line.amount);
    totals.set(line.partitionId, (totals.get(line.partitionId) || 0) + lineCentavos);

    if (source.fiscalBudgetId && typeof source.fiscalAvailable === 'number') {
      const bucket = fiscalTotals.get(source.fiscalBudgetId) ?? {
        centavos: 0,
        available: source.fiscalAvailable,
        year: source.year,
      };
      bucket.centavos += lineCentavos;
      fiscalTotals.set(source.fiscalBudgetId, bucket);
    }
  }

  for (const source of sources) {
    const amountCentavos = totals.get(source.id) || 0;
    const amount = fromCentavos(amountCentavos);
    if (exceedsCentavos(amount, source.available)) {
      return overBudgetMessage(`${source.name} (FY ${source.year})`, amount, source.available);
    }
  }

  for (const bucket of fiscalTotals.values()) {
    const requested = fromCentavos(bucket.centavos);
    if (exceedsCentavos(requested, bucket.available)) {
      return `FY ${bucket.year} Office Budget: Combined total ${formatPeso(requested)} exceeds available ${formatPeso(bucket.available)}. Reduce it by ${formatPeso(diffCentavos(requested, bucket.available))}.`;
    }
  }

  if (!reason.trim()) return 'Add a reason for this funding.';
  if (reason.trim().length > INPUT_LIMITS.FUNDING_REASON) {
    return `Funding reason must be at most ${INPUT_LIMITS.FUNDING_REASON.toLocaleString('en-US')} characters.`;
  }
  return '';
}

export function fundingErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Could not update the budget. Try again.';
  const balance = message.match(/^Funding source (.+): requested (\d+(?:\.\d+)?), available (-?\d+(?:\.\d+)?)$/);
  if (balance) return overBudgetMessage(balance[1], Number(balance[2]), Number(balance[3]));
  if (message.startsWith('Funding source ') && message.includes('requested') && message.includes('available')) {
    return 'Not enough money in this budget source. Check the available amount.';
  }
  if (message === 'Office Budget has insufficient available funding') {
    return 'Not enough money left in the Office Budget.';
  }
  return message;
}
