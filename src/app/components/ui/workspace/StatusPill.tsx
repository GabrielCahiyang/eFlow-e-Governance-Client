export function StatusPill({label, tone = "neutral"}: {label: string; tone?: "neutral" | "info" | "positive" | "warning" | "negative"}) {
  return <span className={`eflow-status-pill eflow-status-pill--${tone}`}>{label}</span>;
}
