import { AlertTriangle, CheckCircle2, Flame } from 'lucide-react';
import type { WorkloadTier } from '../types';
import { formatLoadPoints } from '../selectors/workloadProjection';
import '../workload.css';

export function WorkloadStatusTag({
  tier,
  loadPoints,
  label: customLabel,
  compact = false,
  onClick,
  title,
}: {
  tier: WorkloadTier;
  loadPoints?: number;
  label?: string;
  compact?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  const label =
    customLabel ||
    (tier === 'overloaded'
      ? 'Overloaded'
      : tier === 'heavy'
        ? 'Heavy'
        : 'Balanced');

  const Icon =
    tier === 'overloaded' ? Flame : tier === 'heavy' ? AlertTriangle : CheckCircle2;

  const content = (
    <>
      <Icon size={12} aria-hidden="true" />
      <span>{label}</span>
      {!compact && typeof loadPoints === 'number' && (
        <span>· {formatLoadPoints(loadPoints)} pts</span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        title={title || `Inspect workload (${label})`}
        className={`wl-tag wl-tag--${tier} wl-tag-btn`}
      >
        {content}
      </button>
    );
  }

  return (
    <span className={`wl-tag wl-tag--${tier}`} title={title}>
      {content}
    </span>
  );
}
