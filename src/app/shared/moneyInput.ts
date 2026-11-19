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

export function parseMoneyInput(text: string, maxIntegerDigits = 13): string | null {
  const raw = text.trim().replace(/^₱\s*/, '').replace(/,/g, '');
  if (!/^\d*(?:\.\d{0,2})?$/.test(raw)) return null;
  const normalized = (raw.startsWith('.') ? `0${raw}` : raw).replace(/^0+(?=\d)/, '');
  const intPart = normalized.split('.')[0] || '';
  if (intPart.length > maxIntegerDigits) return null;
  return normalized;
}
export function formatMoneyInput(raw: string) {
  const [integer, fraction] = raw.split('.');
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction === undefined ? '' : `.${fraction}`);
}
export function moneyInputError(raw: string, min = 0, max = 90_000_000_000) {
  if (!raw) return '';
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < min || amount > max) return `Enter an amount from ${min.toLocaleString('en-PH')} to ${max.toLocaleString('en-PH')}.`;
  return '';
}
