import { readableUiError } from '../../../shared/userFacingError';
import { formatManilaDate } from '../../../shared/calendarDisplay';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, CalendarClock, CalendarX2, Check, RefreshCw, Rocket } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { FeedbackState } from '../../../components/ui/FeedbackState';
import { useConfirmation } from '../../../components/ui/useConfirmation';
import { WorkspaceTooltip } from '../../../components/ui/workspace/WorkspaceTooltip';
import { useNavigationBlocker } from '../../../shared/navigationGuard';
import { subscribeProjectChecks } from '../services/readinessSubscription';
import type { Project } from '../../projects';
import {
  activateProjectEarly,
  activateReadyProject,
  cancelScheduledProjectActivation,
  fetchReadiness,
  reviewProject,
  scheduleProjectActivation,
} from '../services/readinessService';
import { readinessResolution, type ReadinessDestination } from '../resolution';
import type { ProjectReadiness, ReviewKind } from '../types';
import { EarlyStartConfirmModal } from './EarlyStartConfirmModal';
import { ReadinessCheckList } from './ReadinessCheckList';
import { SetupReadinessChecks } from './SetupReadinessChecks';
import '../readiness.css';
import '../setupReadiness.css';

/** Required reviews and activation, embedded in the retained Head completion workflow. */
export function ProjectReadinessPanel({
  project,
  canManage,
  onResolve,
  refreshKey = '',
  onUpdated,
  setup,
  footerTarget,
  shortcuts,
  onClose,
  onBusyChange,
}: {
  project: Project;
  canManage: boolean;
  onResolve?: (view: ReadinessDestination) => void;
  refreshKey?: string;
  onUpdated?: () => void;
  setup?: boolean;
  footerTarget?: HTMLElement | null;
  shortcuts?: ReactNode;
  onClose?: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const confirmation = useConfirmation();
  const [state, setState] = useState<{
    key: string;
    data?: ProjectReadiness;
    error?: string;
    loading?: boolean;
  }>({ key: '' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [earlyStartOpen, setEarlyStartOpen] = useState(false);
  const version = useRef(0);
  const pending = useRef(false);

  useEffect(() => {
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);

  const key = `${project.id}:${project.updatedAt}:${project.status}:${refreshKey}`;
  const closed = ['completed', 'archived'].includes(project.status);

  useNavigationBlocker({
    label: 'Project readiness review',
    dirty: false,
    pending: busy,
    pendingCheck: () => pending.current,
    onDiscard: () => {},
  });

  const refresh = useCallback(async () => {
    const request = ++version.current;
    setState((previous) => ({
      key,
      loading: true,
      data: previous.key === key ? previous.data : undefined,
    }));
    try {
      const data = await fetchReadiness(project.id);
      if (request !== version.current) return;
      if (data.projectId !== project.id || !Array.isArray(data.checks)) {
        throw new Error(
          "We couldn't check whether this project is ready. Reload the project checks.",
        );
      }
      setState({ key, data });
    } catch (error) {
      if (request === version.current) {
        setState({
          key,
          error: readableUiError(error, 'Could not load readiness reviews.', 'read'),
        });
      }
    }
  }, [project.id, key]);

  useEffect(() => {
    void refresh();
    return () => {
      ++version.current;
    };
  }, [refresh]);

  const latest = useRef({ refresh, onUpdated });
  latest.current = { refresh, onUpdated };
  useEffect(
    () =>
      subscribeProjectChecks(project.id, () => {
        void latest.current.refresh();
        latest.current.onUpdated?.();
      }),
    [project.id],
  );

  const current = state.key === key ? state : { key, loading: true };
  const data = current.data;
  const checking = Boolean(current.loading || (!data && !current.error));
  const automaticStatus = (
    <span className="readiness-auto-status" role="status">
      <RefreshCw size={14} aria-hidden="true" className={checking ? 'animate-spin' : undefined} />
      {checking ? 'Updating checks…' : 'Updates automatically'}
    </span>
  );

  const run = async (action: () => Promise<void | false>, message: string) => {
    if (pending.current || checking || !canManage || closed || !data || current.error) return;
    pending.current = true;
    setBusy(true);
    setNotice('');
    try {
      if ((await action()) === false) return;
      setNotice(message);
      await refresh();
      onUpdated?.();
    } catch (error) {
      await refresh();
      setState((previous) => ({
        ...previous,
        error: readableUiError(
          error,
          'Review failed. Check the current status before trying again.',
          'write',
        ),
      }));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  const activate = () =>
    void run(async () => {
      if (
        !(await confirmation.confirm({
          title: 'Activate this project?',
          description: `Activate “${project.title}” for delivery. Current approvals, Office participation, schedule and owners are rechecked by the server.`,
          actionLabel: 'Activate project',
        }))
      ) {
        return false;
      }
      const fresh = await fetchReadiness(project.id);
      if (!fresh.canActivate || fresh.governed) {
        throw new Error('Readiness changed. Review the current checks before activation.');
      }
      await activateReadyProject(project.id);
    }, 'Project activated.');

  const scheduleActivation = () =>
    void run(async () => {
      await scheduleProjectActivation(project.id);
      setEarlyStartOpen(false);
    }, `Scheduled to activate automatically on ${scheduledStartLabel || 'the start date'} at 12:00 AM (PHT).`);

  const cancelSchedule = () =>
    void run(async () => {
      await cancelScheduledProjectActivation(project.id);
    }, 'Automatic start-date activation cancelled. Project stays in Waiting for activation.');

  const confirmEarlyStart = (reason: string) =>
    void run(async () => {
      await activateProjectEarly(project.id, reason);
      setEarlyStartOpen(false);
    }, 'Project started ahead of schedule and is now Active.');

  const mayActivate = canManage && !closed && project.status !== 'active' && !data?.governed;
  const scheduledStartLabel = formatManilaDate(data?.startDate || project.startDate, '');
  const daysUntilStart = Math.max(0, data?.daysUntilStart ?? 0);
  const canSchedule = Boolean(data?.canScheduleActivation && scheduledStartLabel);
  const canStartEarly = Boolean(data?.canEarlyActivate && daysUntilStart > 0 && scheduledStartLabel);
  const remainingChecks = data ? data.checks.filter((check) => !check.ok).length : 0;
  const firstUnmetCheck = data?.checks.find((check) => !check.ok);
  const baseBlockedTip = busy
    ? ''
    : checking
      ? 'Checking project readiness…'
      : current.error
        ? 'Readiness checks are unavailable. Reload checks first.'
        : '';
  const cancelScheduleDisabled = busy || checking || Boolean(current.error);
  const cancelScheduleTip = cancelScheduleDisabled
    ? baseBlockedTip
    : `Cancels automatic start-date activation on ${scheduledStartLabel}. The project will remain in Waiting for activation.`;
  const scheduleDisabled = busy || checking || Boolean(current.error);
  const scheduleTip = scheduleDisabled ? baseBlockedTip : '';
  const startEarlyDisabled = busy || checking || Boolean(current.error);
  const startEarlyTip = startEarlyDisabled ? baseBlockedTip : '';
  const activateDisabled = busy || checking || Boolean(current.error) || !data?.canActivate;
  const activateTip = !activateDisabled
    ? ''
    : baseBlockedTip ||
      (remainingChecks > 0
        ? firstUnmetCheck
          ? `${remainingChecks} readiness check${remainingChecks === 1 ? '' : 's'} remaining (next: ${firstUnmetCheck.label}).`
          : `Complete ${remainingChecks} remaining readiness check${remainingChecks === 1 ? '' : 's'} before activating.`
        : 'Confirm all required readiness checks and approvals before activating.');

  const actionButtons = mayActivate ? (
    <>
      {data?.autoActivationScheduled && scheduledStartLabel && (
        <WorkspaceTooltip content={cancelScheduleTip} disabled={!cancelScheduleTip}>
          <span className="inline-flex">
            <Button
              type="button"
              variant="outline"
              disabled={cancelScheduleDisabled}
              onClick={cancelSchedule}
            >
              <CalendarX2 size={15} aria-hidden="true" />
              <span className="ml-1.5">Cancel schedule</span>
            </Button>
          </span>
        </WorkspaceTooltip>
      )}
      {canSchedule && (
        <WorkspaceTooltip content={scheduleTip} disabled={!scheduleTip}>
          <span className="inline-flex">
            <Button
              type="button"
              disabled={scheduleDisabled}
              onClick={scheduleActivation}
            >
              <CalendarClock size={15} aria-hidden="true" />
              <span className="ml-1.5">Schedule for {scheduledStartLabel}</span>
            </Button>
          </span>
        </WorkspaceTooltip>
      )}
      {canStartEarly && (
        <WorkspaceTooltip content={startEarlyTip} disabled={!startEarlyTip}>
          <span className="inline-flex">
            <Button
              type="button"
              variant={canSchedule ? 'outline' : 'default'}
              disabled={startEarlyDisabled}
              onClick={() => setEarlyStartOpen(true)}
            >
              <Rocket size={15} aria-hidden="true" />
              <span className="ml-1.5">Start early</span>
            </Button>
          </span>
        </WorkspaceTooltip>
      )}
      {!canStartEarly && (
        <WorkspaceTooltip content={activateTip} disabled={!activateTip}>
          <span className="inline-flex">
            <Button
              type="button"
              disabled={activateDisabled}
              onClick={activate}
            >
              <Rocket size={15} aria-hidden="true" />
              <span className="ml-1.5">{busy ? 'Updating…' : 'Activate project'}</span>
            </Button>
          </span>
        </WorkspaceTooltip>
      )}
    </>
  ) : null;

  const earlyStartModal = canStartEarly ? (
    <EarlyStartConfirmModal
      open={earlyStartOpen}
      projectTitle={project.title}
      startDateLabel={scheduledStartLabel}
      daysEarly={daysUntilStart}
      busy={busy}
      canScheduleInstead={canSchedule}
      onCancel={() => setEarlyStartOpen(false)}
      onConfirmEarlyStart={confirmEarlyStart}
      onScheduleInstead={scheduleActivation}
    />
  ) : null;

  if (setup) {
    const confirmed = data?.checks.filter((check) => check.ok).length || 0;
    const total = data?.checks.length || 0;
    const remaining = total - confirmed;
    const footerMessage = !data
      ? 'Checking project readiness…'
      : current.error
        ? 'Readiness checks are unavailable.'
        : data.governed
          ? 'Continue through proposal review.'
          : data.canActivate
            ? 'All checks & approvals are complete. Click Activate project to begin delivery.'
            : data.autoActivationScheduled && scheduledStartLabel
              ? `Scheduled to activate automatically on ${scheduledStartLabel} at 12:00 AM (PHT). You can also cancel the schedule or start early.`
              : canStartEarly && scheduledStartLabel
                ? `Approved and waiting for activation (starts ${scheduledStartLabel}). Schedule automatic activation or start early.`
                : `${remaining} check${remaining === 1 ? '' : 's'} to finish before activation.`;

    const footer = (
      <div className="setup-readiness__footer">
        <p>{footerMessage}</p>
        <div className="setup-readiness__footer-actions">
          {onClose && (
            <Button variant="outline" disabled={busy} onClick={onClose}>
              Done for now
            </Button>
          )}
          {actionButtons}
        </div>
      </div>
    );

    return (
      <section className="setup-readiness" aria-label="Project readiness reviews" aria-busy={busy || !data}>
        {confirmation.dialog}
        {earlyStartModal}
        <header className="setup-readiness__summary">
          <div className="setup-readiness__ring">
            <svg viewBox="0 0 72 72" aria-hidden="true">
              <circle cx="36" cy="36" r="30" />
              <circle
                cx="36"
                cy="36"
                r="30"
                pathLength="100"
                strokeDasharray={`${total ? (confirmed / total) * 100 : 0} 100`}
              />
            </svg>
            <strong>
              {confirmed}
              <span className="sr-only"> of </span>
              <span aria-hidden="true">/</span>
              {total || '–'}
            </strong>
          </div>
          <div className="setup-readiness__summary-copy">
            <h3>
              {data?.canActivate
                ? 'Waiting for activation'
                : data?.autoActivationScheduled
                  ? 'Scheduled for start date'
                  : canStartEarly
                    ? 'Waiting for activation'
                    : 'Get your project ready'}
            </h3>
            <p>{total ? `${confirmed} of ${total} checks confirmed` : 'Checking your work plan…'}</p>
          </div>
          {automaticStatus}
        </header>
        {shortcuts && (
          <nav className="setup-readiness__tools" aria-label="Project setup shortcuts">
            {shortcuts}
          </nav>
        )}
        {current.error && (
          <FeedbackState tone="error" title="Plan reviews unavailable" onRetry={() => void refresh()}>
            {current.error}
          </FeedbackState>
        )}
        {!data && !current.error && (
          <p className="setup-readiness__feedback" role="status">
            Loading plan reviews…
          </p>
        )}
        {notice && (
          <p className="setup-readiness__feedback" role="status">
            {notice}
          </p>
        )}
        {data?.governed && (
          <p className="setup-readiness__governed">
            Open the proposal to complete endorsement and approval before starting this project.{' '}
            {onResolve && (
              <button className="p7-link" onClick={() => onResolve('proposal_context')}>
                Open proposal review
              </button>
            )}
          </p>
        )}
        {data && (
          <SetupReadinessChecks
            checks={data.checks}
            actions={(check) => {
              const resolution = readinessResolution(check.key, data.governed);
              const review =
                ['structure', 'dates', 'budget'].includes(check.key) &&
                canManage &&
                !closed &&
                !data.governed;
              return (
                <>
                  {resolution && onResolve && (
                    <Button
                      variant="ghost"
                      disabled={busy}
                      aria-label={resolution.label}
                      onClick={() => onResolve(resolution.view)}
                    >
                      Review
                      <ArrowRight size={14} aria-hidden="true" />
                    </Button>
                  )}
                  {review && (
                    <Button
                      variant="outline"
                      disabled={busy || checking || Boolean(current.error)}
                      aria-label={`Confirm review: ${check.label}`}
                      onClick={() =>
                        void run(
                          () => reviewProject(project.id, check.key as ReviewKind),
                          check.label + ' confirmed.',
                        )
                      }
                    >
                      <Check size={14} aria-hidden="true" />
                      Confirm review
                    </Button>
                  )}
                </>
              );
            }}
          />
        )}
        {footerTarget ? createPortal(footer, footerTarget) : footer}
      </section>
    );
  }

  return (
    <section className="r4-requirements" aria-label="Project readiness reviews">
      {confirmation.dialog}
      {earlyStartModal}
      <header>
        <h3>Plan reviews and activation</h3>
        {automaticStatus}
      </header>
      <p>Review the plan again after significant changes to the work, participating Offices, dates, or budget.</p>
      {current.error && (
        <FeedbackState tone="error" title="Plan reviews unavailable" onRetry={() => void refresh()}>
          {current.error}
        </FeedbackState>
      )}
      {!data && !current.error && <p role="status">Loading plan reviews…</p>}
      {notice && <p role="status">{notice}</p>}
      {data && (
        <>
          <p>
            {data.stage} · {data.checks.filter((check) => check.ok).length} of {data.checks.length} checks confirmed
          </p>
          {data.governed && (
            <p>
              Open the proposal to complete endorsement and approval before starting this project.{' '}
              {onResolve && (
                <button type="button" className="p7-link" onClick={() => onResolve('proposal_context')}>
                  Open proposal review
                </button>
              )}
            </p>
          )}
          <ReadinessCheckList
            checks={data.checks}
            actions={(check) => {
              const resolution = readinessResolution(check.key, data.governed);
              return (
                <div className="flex flex-wrap gap-2">
                  {canManage &&
                    !closed &&
                    !data.governed &&
                    !check.ok &&
                    ['structure', 'dates', 'budget'].includes(check.key) && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy || checking || Boolean(current.error)}
                        onClick={() =>
                          void run(
                            () => reviewProject(project.id, check.key as ReviewKind),
                            check.label + ' confirmed.',
                          )
                        }
                      >
                        Confirm review
                      </Button>
                    )}
                  {!check.ok && resolution && onResolve && (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => onResolve(resolution.view)}
                    >
                      {resolution.label}
                    </Button>
                  )}
                </div>
              );
            }}
          />
          {data.autoActivationScheduled && scheduledStartLabel && (
            <p
              role="status"
              className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-900"
            >
              Scheduled to activate automatically on <strong>{scheduledStartLabel} at 12:00 AM (PHT)</strong>.
            </p>
          )}
          {mayActivate && <footer className="readiness-activation flex flex-wrap gap-2">{actionButtons}</footer>}
        </>
      )}
    </section>
  );
}
