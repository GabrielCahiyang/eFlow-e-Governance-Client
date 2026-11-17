export const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
});

export function formatPeso(value: number): string {
  return peso.format(Number.isFinite(value) ? value : 0);
}
