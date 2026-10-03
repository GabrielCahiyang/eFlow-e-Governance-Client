export function StatusPill({label, tone = "neutral"}: {label: string; tone?: "neutral" | "positive" | "warning" | "negative"}) {
  return <span className={`eflow-status-pill eflow-status-pill--${tone}`}>{label}</span>;
}
