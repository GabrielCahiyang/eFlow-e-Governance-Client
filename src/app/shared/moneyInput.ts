import { diffCentavos, exceedsCentavos, formatPeso, toCentavos } from './currency';

export type MoneyRejectionReason = 'negative' | 'too_many_decimals' | 'max_digits' | 'non_numeric';

/** Canonical editing strings never contain grouping characters or currency symbols. */
export function moneyMaxIntegerDigits(max = 90_000_000_000): number {
  if (!Number.isFinite(max) || max <= 0) return 11;
  return Math.min(13, Math.max(1, String(Math.floor(max)).length));
}

export function moneyMaxFormattedLength(max = 90_000_000_000): number {
  const intDigits = moneyMaxIntegerDigits(max);
  const commas = Math.floor((intDigits - 1) / 3);
  return intDigits + commas + 3; // includes ".00"
}

export function parseMoneyInputDetailed(
  text: string,
  maxIntegerDigits = 13,
): { value: string | null; reason?: MoneyRejectionReason } {
  const stripped = text.trim().replace(/^(?:₱|php)\s*/i, '').replace(/,/g, '');
  if (stripped === '') return { value: '' };
  if (stripped.startsWith('-')) return { value: null, reason: 'negative' };
  if (/^\d*\.\d{3,}$/.test(stripped)) return { value: null, reason: 'too_many_decimals' };
  if (!/^\d*(?:\.\d{0,2})?$/.test(stripped)) return { value: null, reason: 'non_numeric' };
  const normalized = (stripped.startsWith('.') ? `0${stripped}` : stripped).replace(/^0+(?=\d)/, '');
  const intPart = normalized.split('.')[0] || '';
  if (intPart.length > maxIntegerDigits) return { value: null, reason: 'max_digits' };
  return { value: normalized };
}

export function parseMoneyInput(text: string, maxIntegerDigits = 13): string | null {
  return parseMoneyInputDetailed(text, maxIntegerDigits).value;
}

export function moneyRejectionMessage(reason: MoneyRejectionReason, maxAmount?: number): string {
  switch (reason) {
    case 'negative':
      return 'Negative amounts are not allowed.';
    case 'too_many_decimals':
      return 'Up to 2 decimal places only (centavos).';
    case 'max_digits':
      return maxAmount !== undefined && Number.isFinite(maxAmount)
        ? `Maximum allowed is ${formatPeso(maxAmount)}.`
        : 'Maximum number of digits reached.';
    case 'non_numeric':
    default:
      return 'Numbers only (e.g., 25,000.00).';
  }
}

export function formatMoneyInput(raw: string) {
  const [integer, fraction] = raw.split('.');
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction === undefined ? '' : `.${fraction}`);
}

export function moneyInputError(raw: string, min = 0, max = 90_000_000_000) {
  if (!raw) return '';
  const amount = Number(raw);
  if (!Number.isFinite(amount)) return 'Enter a valid numeric amount.';
  if (toCentavos(amount) < toCentavos(min)) {
    return `Enter an amount of at least ₱${min.toLocaleString('en-PH', { minimumFractionDigits: min > 0 && min < 1 ? 2 : 0, maximumFractionDigits: 2 })}.`;
  }
  if (exceedsCentavos(amount, max)) {
    const excess = diffCentavos(amount, max);
    return `Exceeds maximum ${formatPeso(max)} — reduce by ${formatPeso(excess)}.`;
  }
  return '';
}
