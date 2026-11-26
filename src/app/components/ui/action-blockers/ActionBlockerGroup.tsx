import { useMemo, useState, type ReactNode } from "react";
import { normalizeBlockers } from "./classifyBlocker";
import { ActionBlockersModal } from "./ActionBlockersModal";
import { ActionBlockerStopButton } from "./ActionBlockerStopButton";
import type { ActionBlockerInput } from "./types";
import "./actionBlockers.css";

export interface ActionBlockerGroupProps {
  /** Human-readable name of the guarded action (shown in the Blockers Modal header). */
  actionLabel: string;
  /** String, array of strings, or structured ActionBlockerItem list. Empty/falsy hides the Stop button. */
  blockers?: ActionBlockerInput;
  /** Suppresses the Stop button during in-flight async loading/saving states. */
  busy?: boolean;
  /** Use compact icon-only red Stop trigger for tight table cells or small icon toolbars. */
  compact?: boolean;
  /** Trigger sizing to visually align with small or standard action buttons. */
  size?: "sm" | "md";
  /** Optional live recheck handler inside the Blockers Modal. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Optional extra class on the inline wrapper. */
  className?: string;
  children: ReactNode;
}

/**
 * Wraps any action button and pairs it with a red Stop Blocker button ONLY when
 * real blockers exist (`!busy && normalized.length > 0`). Clicking the red Stop
 * button opens ActionBlockersModal listing every active blocker.
 */
export function ActionBlockerGroup({
  actionLabel,
  blockers,
  busy = false,
  compact = false,
  size = "md",
  onRefresh,
  refreshing = false,
  className = "",
  children,
}: ActionBlockerGroupProps) {
  const [open, setOpen] = useState(false);
  const normalized = useMemo(
    () => (busy ? [] : normalizeBlockers(blockers)),
    [busy, blockers],
  );

  if (normalized.length === 0) {
    return <>{children}</>;
  }

  return (
    <span
      className={`eflow-action-blocker-group${className ? ` ${className}` : ""}`}
      data-slot="action-blocker-group"
    >
      {children}
      <ActionBlockerStopButton
        actionLabel={actionLabel}
        count={normalized.length}
        compact={compact}
        size={size}
        onClick={() => setOpen(true)}
      />
      <ActionBlockersModal
        open={open}
        actionLabel={actionLabel}
        blockers={normalized}
        onClose={() => setOpen(false)}
        onRefresh={onRefresh}
        refreshing={refreshing}
      />
    </span>
  );
}
