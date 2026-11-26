import { OctagonAlert } from "lucide-react";
import "./actionBlockers.css";

export interface ActionBlockerStopButtonProps {
  actionLabel: string;
  count: number;
  onClick: () => void;
  compact?: boolean;
  size?: "sm" | "md";
  className?: string;
}

/**
 * High-contrast red Stop trigger rendered ONLY when an action button has active blockers.
 */
export function ActionBlockerStopButton({
  actionLabel,
  count,
  onClick,
  compact = false,
  size = "md",
  className = "",
}: ActionBlockerStopButtonProps) {
  if (count <= 0) return null;

  const ariaLabel = `View ${count} ${count === 1 ? "blocker" : "blockers"}`;

  return (
    <button
      type="button"
      data-slot="action-blocker-stop"
      data-blocker-count={count}
      data-blocker-for={actionLabel || undefined}
      aria-label={ariaLabel}
      aria-haspopup="dialog"
      className={`eflow-stop-blocker-btn eflow-stop-blocker-btn--${size}${compact ? " eflow-stop-blocker-btn--compact" : ""}${className ? ` ${className}` : ""}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
    >
      <OctagonAlert
        size={size === "sm" ? 14 : 15}
        strokeWidth={2.25}
        aria-hidden="true"
      />
      {compact ? (
        count > 1 && (
          <span className="eflow-stop-blocker-btn__count" aria-hidden="true">
            {count}
          </span>
        )
      ) : (
        <span className="eflow-stop-blocker-btn__label">
          {count === 1 ? "Blocked" : `${count} blockers`}
        </span>
      )}
    </button>
  );
}
