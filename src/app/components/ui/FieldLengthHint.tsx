/** Subtle eFlow-themed character counter shown cleanly as a field approaches or reaches its limit. */
export function FieldLengthHint({
  length,
  max,
  alwaysShow = false,
  className = "",
}: {
  length: number;
  max: number;
  alwaysShow?: boolean;
  className?: string;
}) {
  if (!alwaysShow && length < Math.floor(max * 0.75)) return null;
  const atLimit = length >= max;
  const nearLimit = length >= Math.floor(max * 0.9);
  const tone = atLimit
    ? "text-red-600 font-medium"
    : nearLimit
      ? "text-amber-600"
      : "text-neutral-400";

  return (
    <span
      className={`inline-block text-[11px] tabular-nums ${tone} ${className}`.trim()}
      aria-live={atLimit ? "polite" : undefined}
    >
      {length.toLocaleString("en-US")} / {max.toLocaleString("en-US")}
    </span>
  );
}
