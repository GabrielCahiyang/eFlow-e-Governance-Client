import { useEffect, useId, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Flame, Users } from 'lucide-react';
import { BoundedTextarea } from '../../../components/ui/BoundedInput';
import { useMemberWorkloadDetail } from '../hooks/useMemberWorkloadDetail';
import {
  formatLoadPoints,
  OVERLOAD_OVERRIDE_MAX_CHARS,
  overloadOverrideValidationError,
  projectMemberWorkload,
} from '../selectors/workloadProjection';
import type {
  MemberWorkloadSummary,
  OverloadOverrideState,
  ProposedAssignmentRole,
  WorkloadThresholds,
} from '../types';
import { WorkloadCommitmentList } from './WorkloadCommitmentList';
import { WorkloadStatusTag } from './WorkloadStatusTag';
import '../workload.css';

export function OverloadMitigationPanel({
  userId,
  orgId,
  summary,
  thresholds,
  proposedRole,
  alreadyAssignedInRole = false,
  excludedAlternativeIds = [],
  override,
  onOverrideChange,
  onSwitchMember,
  showValidation = false,
}: {
  userId?: string | null;
  orgId?: string | null;
  summary?: MemberWorkloadSummary;
  thresholds: WorkloadThresholds;
  proposedRole: ProposedAssignmentRole;
  alreadyAssignedInRole?: boolean;
  excludedAlternativeIds?: readonly string[];
  override: OverloadOverrideState;
  onOverrideChange: (next: OverloadOverrideState) => void;
  onSwitchMember?: (userId: string) => void;
  showValidation?: boolean;
}) {
  const projection = projectMemberWorkload(summary, proposedRole, thresholds, {
    alreadyAssignedInRole,
  });

  const isOverloaded = projection?.projectedTier === 'overloaded';
  const isHeavy = projection?.projectedTier === 'heavy';
  const shouldDisplay = Boolean(userId && summary && projection && (isOverloaded || isHeavy));

  const [expanded, setExpanded] = useState(Boolean(isOverloaded));
  const detail = useMemberWorkloadDetail(userId, orgId, shouldDisplay && expanded);
  const reasonId = useId();
  const checkId = useId();

  useEffect(() => {
    setExpanded(Boolean(isOverloaded));
  }, [userId, isOverloaded]);

  if (!shouldDisplay || !summary || !projection) return null;

  const excludedSet = new Set(excludedAlternativeIds);
  const alternatives = (detail.data?.alternatives ?? []).filter(
    (alt) => alt.userId !== userId && !excludedSet.has(alt.userId),
  );
  const overrideError = showValidation
    ? overloadOverrideValidationError(projection, override)
    : '';

  const headline = isOverloaded
    ? projection.tipsIntoOverload
      ? `Assigning ${summary.fullName} will overload their workload`
      : `${summary.fullName} is overloaded`
    : `${summary.fullName} is near capacity`;

  const subtitle = projection.addedPoints > 0
    ? `Current load ${formatLoadPoints(projection.currentPoints)} pts → ${formatLoadPoints(projection.projectedPoints)} pts (+${formatLoadPoints(projection.addedPoints)} as ${projection.roleLabel}).`
    : `Current load is ${formatLoadPoints(projection.currentPoints)} pts across active projects, tasks, subtasks, and reviews.`;

  const totalProjects = summary.activeProjectsLed + summary.planningProjectsLed;
  const totalSubtasks = summary.subtaskLeads + summary.subtaskContributions;

  return (
    <section
      className={`wl-panel wl-panel--${isOverloaded ? 'overloaded' : 'heavy'}`}
      role={isOverloaded ? 'alert' : 'status'}
      aria-label={`Workload warning for ${summary.fullName}`}
    >
      <div className="wl-panel__head">
        <div className="wl-panel__title-group">
          <span className="wl-panel__icon" aria-hidden="true">
            {isOverloaded ? <Flame size={17} /> : <AlertTriangle size={17} />}
          </span>
          <div className="min-w-0">
            <h4 className="wl-panel__title">{headline}</h4>
            <p className="wl-panel__subtitle">{subtitle}</p>
          </div>
        </div>
        <button
          type="button"
          className="wl-panel__toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
          {expanded ? 'Hide commitments' : 'Inspect full workload'}
        </button>
      </div>

      <div className="wl-meter">
        <div className="wl-meter__labels">
          <span>
            Projected load: <strong>{formatLoadPoints(projection.projectedPoints)}</strong> /{' '}
            {formatLoadPoints(thresholds.overloadPoints)} pts
          </span>
          <span>{projection.projectedUtilizationPercent}% of overload limit</span>
        </div>
        <div className="wl-meter__track" aria-hidden="true">
          <div
            className={`wl-meter__fill wl-meter__fill--${projection.projectedTier}`}
            style={{ width: `${Math.min(100, projection.projectedUtilizationPercent)}%` }}
          />
        </div>
      </div>

      <div className="wl-metrics">
        <div className={`wl-metric-card${isOverloaded ? ' wl-metric-card--danger' : ''}`}>
          <small>Projects led</small>
          <strong>{totalProjects}</strong>
          <span>
            {summary.activeProjectsLed} active · {summary.planningProjectsLed} planning
          </span>
        </div>
        <div className="wl-metric-card">
          <small>Tasks</small>
          <strong>{summary.taskLeads + summary.taskContributions}</strong>
          <span>
            {summary.taskLeads} lead · {summary.taskContributions} support
          </span>
        </div>
        <div className="wl-metric-card">
          <small>Subtasks &amp; reviews</small>
          <strong>{totalSubtasks + summary.pendingReviews}</strong>
          <span>
            {totalSubtasks} subtasks · {summary.pendingReviews} reviews
          </span>
        </div>
        <div className={`wl-metric-card${summary.overdueCount > 0 ? ' wl-metric-card--danger' : ''}`}>
          <small>Deadline risk</small>
          <strong>{summary.overdueCount} overdue</strong>
          <span>{summary.dueSoonCount} due in {thresholds.dueSoonBusinessDays} biz days</span>
        </div>
      </div>

      {projection.reasons.length > 0 && (
        <ul className="wl-reasons" aria-label="Overload triggers">
          {projection.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}

      {expanded && (
        <WorkloadCommitmentList
          items={detail.data?.items ?? []}
          hiddenCounts={detail.data?.hiddenCounts}
          loading={detail.loading}
          error={detail.error}
        />
      )}

      {onSwitchMember && expanded && alternatives.length > 0 && (
        <div className="wl-alternatives">
          <h5 className="wl-alternatives__title flex items-center gap-1.5">
            <Users size={14} aria-hidden="true" />
            Lighter-loaded teammates available in this office
          </h5>
          <div className="wl-alternatives__grid">
            {alternatives.map((alt) => (
              <div key={alt.userId} className="wl-alt-card">
                <div className="wl-alt-card__info">
                  <strong title={alt.fullName}>{alt.fullName}</strong>
                  <small>
                    {formatLoadPoints(alt.loadPoints)} pts · {alt.activeProjectsLed + alt.planningProjectsLed} proj ·{' '}
                    {alt.taskLeads + alt.taskContributions} tasks
                  </small>
                  <div className="pt-0.5">
                    <WorkloadStatusTag tier={alt.tier} compact />
                  </div>
                </div>
                <button
                  type="button"
                  className="wl-alt-card__btn"
                  onClick={() => onSwitchMember(alt.userId)}
                >
                  Assign instead
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {projection.requiresOverride && (
        <div className="wl-override">
          <label htmlFor={checkId} className="wl-override__check">
            <input
              id={checkId}
              type="checkbox"
              checked={override.acknowledged}
              onChange={(event) =>
                onOverrideChange({ ...override, acknowledged: event.target.checked })
              }
            />
            <span>
              I reviewed {summary.fullName}’s active projects, tasks, and deadlines and still need to assign them as{' '}
              {projection.roleLabel}.
            </span>
          </label>
          <div>
            <label htmlFor={reasonId} className="wl-override__label">
              Overload override justification *
            </label>
            <BoundedTextarea
              id={reasonId}
              rows={2}
              maxLength={OVERLOAD_OVERRIDE_MAX_CHARS}
              value={override.reason}
              error={overrideError || undefined}
              placeholder="Explain why this assignment is necessary (recorded in audit log, min. 10 characters)…"
              onChange={(event) =>
                onOverrideChange({ ...override, reason: event.target.value })
              }
            />
          </div>
        </div>
      )}
    </section>
  );
}
