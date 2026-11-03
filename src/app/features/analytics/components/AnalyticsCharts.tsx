import { useId } from "react";
import "../analytics.css";
export const ANALYTICS_COLORS = [
  "#00857a",
  "#3b82f6",
  "#e3a11a",
  "#8758be",
  "#d65a67",
  "#698387",
];
export function AnalyticsDonut({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: { id: string; label: string; value: number; color?: string }[];
  onSelect?: (id: string) => void;
}) {
  const id = useId(),
    total = items.reduce((n, item) => n + item.value, 0);
  let offset = 0;
  return (
    <section className="ea-panel" aria-label={title}>
      <h2>{title}</h2>
      <div className="ea-donut">
        <svg viewBox="0 0 160 160" role="img" aria-labelledby={id}>
          <title id={id}>
            {title}: {total} total
          </title>
          <circle
            cx="80"
            cy="80"
            r="58"
            fill="none"
            stroke="var(--muted)"
            strokeWidth="18"
          />
          {items.map((item, i) => {
            const length = total ? (item.value / total) * 100 : 0,
              start = offset;
            offset += length;
            return (
              <circle
                key={item.id}
                cx="80"
                cy="80"
                r="58"
                fill="none"
                pathLength="100"
                stroke={item.color || ANALYTICS_COLORS[i % 6]}
                strokeWidth="18"
                strokeDasharray={`${length} ${100 - length}`}
                strokeDashoffset={-start}
                transform="rotate(-90 80 80)"
              />
            );
          })}
          <text x="80" y="80" textAnchor="middle" className="ea-donut__number">
            {total}
          </text>
          <text x="80" y="100" textAnchor="middle" className="ea-donut__label">
            total
          </text>
        </svg>
        <div className="ea-legend">
          {items.map((item, i) => (
            <button
              type="button"
              key={item.id}
              disabled={!onSelect}
              onClick={() => onSelect?.(item.id)}
            >
              <i
                style={{ background: item.color || ANALYTICS_COLORS[i % 6] }}
              />
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
export function AnalyticsBars({
  title,
  items,
  onSelect,
  unit = "tasks",
}: {
  title: string;
  items: {
    id: string;
    label: string;
    value: number;
    total?: number;
    secondary?: string;
  }[];
  onSelect?: (id: string) => void;
  unit?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <section className="ea-panel" aria-label={title}>
      <h2>{title}</h2>
      {!items.length ? (
        <p className="ea-empty">No recorded data for these filters.</p>
      ) : (
        <div className="ea-bars">
          {items.map((item) => (
            <button
              type="button"
              key={item.id}
              disabled={!onSelect}
              onClick={() => onSelect?.(item.id)}
              aria-label={`${item.label}: ${item.value} ${unit}${item.secondary ? `, ${item.secondary}` : ""}`}
            >
              <span className="ea-bar-label">
                <span>{item.label}</span>
                <strong>
                  {item.value} <small>{unit}</small>
                </strong>
              </span>
              <span className="ea-bar-track">
                <span
                  style={{
                    width: `${(item.value / Math.max(1, item.total ?? max)) * 100}%`,
                  }}
                />
              </span>
              {item.secondary && <small>{item.secondary}</small>}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
