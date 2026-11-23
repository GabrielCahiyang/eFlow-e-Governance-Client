export const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPeso(value: number): string {
  return peso.format(Number.isFinite(value) ? value : 0);
}

/** Converts a PHP amount to exact integer centavos to avoid IEEE-754 float drift. */
export function toCentavos(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

/** Converts integer centavos back to a PHP decimal number. */
export function fromCentavos(centavos: number): number {
  return Number.isFinite(centavos) ? Math.round(centavos) / 100 : 0;
}

/** Sums PHP amounts using exact integer centavos. */
export function sumCentavos(values: readonly number[]): number {
  let total = 0;
  for (const value of values) total += toCentavos(value);
  return fromCentavos(total);
}

/** Subtracts two PHP amounts using exact integer centavos (`a - b`). */
export function diffCentavos(a: number, b: number): number {
  return fromCentavos(toCentavos(a) - toCentavos(b));
}

/** Returns true when `amount` strictly exceeds `ceiling` in exact centavos. */
export function exceedsCentavos(amount: number, ceiling: number): boolean {
  return toCentavos(amount) > toCentavos(ceiling);
}
