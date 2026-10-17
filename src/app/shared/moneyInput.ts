/** Canonical editing strings never contain grouping characters or currency symbols. */
export function parseMoneyInput(text: string): string | null {
  const raw = text.trim().replace(/^₱\s*/, '').replace(/,/g, '');
  if (!/^\d*(?:\.\d{0,2})?$/.test(raw)) return null;
  return (raw.startsWith('.') ? `0${raw}` : raw).replace(/^0+(?=\d)/, '');
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
