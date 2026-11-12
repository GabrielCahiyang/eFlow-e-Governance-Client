export function StatusPill({label, color, tone = "neutral"}: {label: string; color?: string; tone?: "neutral" | "info" | "positive" | "warning" | "negative"}) {
  return <span className={`eflow-status-pill eflow-status-pill--${tone}`} style={color ? { borderColor: color } : undefined}>{label}</span>;
}
