import { Flame, AlertTriangle, CheckCircle2, Users } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/button';
import { useMemberWorkloadDetail } from '../hooks/useMemberWorkloadDetail';
import { formatLoadPoints } from '../selectors/workloadProjection';
import { WorkloadCommitmentList } from './WorkloadCommitmentList';
import { WorkloadStatusTag } from './WorkloadStatusTag';
import '../workload.css';

export function MemberWorkloadModal({
  userId,
  userName,
  orgId,
  open,
  onClose,
  onSelectAlternative,
}: {
  userId: string;
  userName?: string;
  orgId?: string | null;
  open: boolean;
  onClose: () => void;
  onSelectAlternative?: (alternativeUserId: string) => void;
}) {
  const detail = useMemberWorkloadDetail(userId, orgId, open);
  const summary = detail.data?.summary;
  const thresholds = detail.data?.thresholds;
  const member = detail.data?.member;
  const displayName = member?.fullName || userName || 'Team member';
  const tier = summary?.tier ?? 'balanced';

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={`${displayName} — Current Workload`}
      description={
        member?.orgName
          ? `${member.orgName}${member.isOfficeHead ? ' · Office Head' : ''}`
          : 'Live active projects, tasks, subtasks, and pending reviews (Philippine Time).'
      }
      width="max-w-3xl"
      footer={
        <div className="flex w-full justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {tier === 'overloaded' ? (
              <Flame size={18} className="text-red-600" aria-hidden="true" />
            ) : tier === 'heavy' ? (
              <AlertTriangle size={18} className="text-amber-600" aria-hidden="true" />
            ) : (
              <CheckCircle2 size={18} className="text-emerald-700" aria-hidden="true" />
            )}
            <WorkloadStatusTag tier={tier} loadPoints={summary?.loadPoints} />
          </div>
          {summary && thresholds && (
            <span className="text-xs text-muted-foreground tabular-nums">
              Overload threshold: {formatLoadPoints(thresholds.overloadPoints)} pts · Max{' '}
              {thresholds.maxActiveProjectLeads} active project leads · Max {thresholds.maxActiveTaskLeads} task leads
            </span>
          )}
        </div>

        {summary && thresholds && (
          <>
            <div className="wl-meter">
              <div className="wl-meter__labels">
                <span>
                  Current load: <strong>{formatLoadPoints(summary.loadPoints)}</strong> /{' '}
                  {formatLoadPoints(thresholds.overloadPoints)} pts
                </span>
                <span>{summary.utilizationPercent}% of overload limit</span>
              </div>
              <div className="wl-meter__track" aria-hidden="true">
                <div
                  className={`wl-meter__fill wl-meter__fill--${summary.tier}`}
                  style={{ width: `${Math.min(100, summary.utilizationPercent)}%` }}
                />
              </div>
            </div>

            <div className="wl-metrics">
              <div className="wl-metric-card">
                <small>Projects led</small>
                <strong>{summary.activeProjectsLed + summary.planningProjectsLed}</strong>
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
                <strong>
                  {summary.subtaskLeads + summary.subtaskContributions + summary.pendingReviews}
                </strong>
                <span>
                  {summary.subtaskLeads + summary.subtaskContributions} subtasks · {summary.pendingReviews} reviews
                </span>
              </div>
              <div className={`wl-metric-card${summary.overdueCount > 0 ? ' wl-metric-card--danger' : ''}`}>
                <small>Deadline risk</small>
                <strong>{summary.overdueCount} overdue</strong>
                <span>
                  {summary.dueSoonCount} due in {thresholds.dueSoonBusinessDays} biz days
                </span>
              </div>
            </div>
          </>
        )}

        {summary?.reasons && summary.reasons.length > 0 && (
          <ul className="wl-reasons" aria-label="Overload triggers">
            {summary.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}

        <WorkloadCommitmentList
          items={detail.data?.items ?? []}
          hiddenCounts={detail.data?.hiddenCounts}
          loading={detail.loading}
          error={detail.error}
        />

        {detail.data?.alternatives && detail.data.alternatives.length > 0 && (
          <div className="wl-alternatives">
            <h4 className="wl-alternatives__title flex items-center gap-1.5">
              <Users size={14} aria-hidden="true" />
              Lighter-loaded teammates in this office
            </h4>
            <div className="wl-alternatives__grid">
              {detail.data.alternatives.map((alt) => (
                <div key={alt.userId} className="wl-alt-card">
                  <div className="wl-alt-card__info">
                    <strong title={alt.fullName}>{alt.fullName}</strong>
                    <small>
                      {formatLoadPoints(alt.loadPoints)} pts ·{' '}
                      {alt.activeProjectsLed + alt.planningProjectsLed} proj ·{' '}
                      {alt.taskLeads + alt.taskContributions} tasks
                    </small>
                    <div className="pt-0.5">
                      <WorkloadStatusTag tier={alt.tier} compact />
                    </div>
                  </div>
                  {onSelectAlternative && (
                    <button
                      type="button"
                      className="wl-alt-card__btn"
                      onClick={() => {
                        onSelectAlternative(alt.userId);
                        onClose();
                      }}
                    >
                      Select
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
