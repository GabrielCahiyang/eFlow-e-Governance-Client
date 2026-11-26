import { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, CalendarClock, Flame, Rocket } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { ActionBlockerGroup } from '../../../components/ui/action-blockers';
import { Button } from '../../../components/ui/button';
import { BoundedTextarea } from '../../../components/ui/BoundedInput';
import { FieldValidationTooltip } from '../../../components/ui/FieldValidationTooltip';
import { WorkspaceTooltip } from '../../../components/ui/workspace/WorkspaceTooltip';

export type EarlyStartTier = 'near' | 'weeks' | 'far';

export interface EarlyStartModalConfig {
  tier: EarlyStartTier;
  daysEarly: number;
  title: string;
  headline: string;
  description: string;
  requireReason: boolean;
  requireAcknowledge: boolean;
  confirmLabel: string;
}

export const EARLY_START_MIN_REASON_CHARS = 10;
export const EARLY_START_MAX_REASON_CHARS = 500;

/**
 * Escalates confirmation copy, severity, and validation requirements based on
 * how far ahead of the scheduled start date (Philippine Time) the manager is activating.
 */
export function getEarlyStartConfig(
  daysEarly: number,
  projectTitle: string,
  startDateLabel: string,
): EarlyStartModalConfig {
  const safeDays = Math.max(1, Math.round(daysEarly));

  if (safeDays >= 30) {
    const approxMonths = Math.max(1, Math.round(safeDays / 30));
    const unit = approxMonths === 1 ? 'month' : 'months';
    return {
      tier: 'far',
      daysEarly: safeDays,
      title: `Are you sure? Start date is still ${safeDays} days (~${approxMonths} ${unit}) away`,
      headline: 'Very far ahead of scheduled start date',
      description: `“${projectTitle}” is scheduled to start on ${startDateLabel} — still ${safeDays} days away from schedule (Philippine Time). Starting this far in advance immediately marks the project Active and dispatches work assignments. Consider scheduling automatic start-date activation instead.`,
      requireReason: true,
      requireAcknowledge: true,
      confirmLabel: 'Confirm early start',
    };
  }

  if (safeDays >= 7) {
    const approxWeeks = Math.max(1, Math.round(safeDays / 7));
    const unit = approxWeeks === 1 ? 'week' : 'weeks';
    return {
      tier: 'weeks',
      daysEarly: safeDays,
      title: `Start project ${safeDays} days (~${approxWeeks} ${unit}) early?`,
      headline: 'Start date is still weeks away',
      description: `“${projectTitle}” isn’t scheduled to begin until ${startDateLabel} (${safeDays} days from today, Philippine Time). Starting weeks ahead of schedule opens delivery tasks and notifications immediately. Record a brief justification for the audit log.`,
      requireReason: true,
      requireAcknowledge: false,
      confirmLabel: `Yes, start ${safeDays} days early`,
    };
  }

  const dayUnit = safeDays === 1 ? 'day' : 'days';
  return {
    tier: 'near',
    daysEarly: safeDays,
    title: `Start project ${safeDays} ${dayUnit} ahead of schedule?`,
    headline: 'Starting slightly ahead of schedule',
    description: `“${projectTitle}” is scheduled to start on ${startDateLabel} (${safeDays} ${dayUnit} from today, Philippine Time). Starting now immediately moves the project to Active and alerts assigned team members.`,
    requireReason: false,
    requireAcknowledge: false,
    confirmLabel: 'Start project now',
  };
}

export function validateEarlyStartInput(
  config: EarlyStartModalConfig,
  acknowledged: boolean,
  reason: string,
): { acknowledgeError: string; reasonError: string } {
  const trimmed = reason.trim();
  const acknowledgeError =
    config.requireAcknowledge && !acknowledged
      ? 'Confirm that you reviewed how far away the scheduled start date is before proceeding.'
      : '';
  let reasonError = '';
  if (config.requireReason) {
    if (!trimmed) {
      reasonError = 'Enter a short justification for starting ahead of schedule.';
    } else if (trimmed.length < EARLY_START_MIN_REASON_CHARS) {
      reasonError = `Enter at least ${EARLY_START_MIN_REASON_CHARS} characters explaining why this project is starting early.`;
    }
  }
  if (!reasonError && trimmed.length > EARLY_START_MAX_REASON_CHARS) {
    reasonError = `Justification may contain up to ${EARLY_START_MAX_REASON_CHARS} characters.`;
  }
  return { acknowledgeError, reasonError };
}

export function EarlyStartConfirmModal({
  open,
  projectTitle,
  startDateLabel,
  daysEarly,
  busy = false,
  canScheduleInstead = false,
  onCancel,
  onConfirmEarlyStart,
  onScheduleInstead,
}: {
  open: boolean;
  projectTitle: string;
  startDateLabel: string;
  daysEarly: number;
  busy?: boolean;
  canScheduleInstead?: boolean;
  onCancel: () => void;
  onConfirmEarlyStart: (reason: string) => Promise<void> | void;
  onScheduleInstead?: () => Promise<void> | void;
}) {
  const [reason, setReason] = useState('');
  const [reasonTouched, setReasonTouched] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [checkFocused, setCheckFocused] = useState(false);
  const [checkHovered, setCheckHovered] = useState(false);
  const checkRef = useRef<HTMLInputElement | null>(null);
  const reasonId = useId();
  const checkId = useId();
  const checkTipId = useId();
  const checkErrId = useId();

  useEffect(() => {
    if (open) {
      setReason('');
      setReasonTouched(false);
      setAcknowledged(false);
      setAttempted(false);
    }
  }, [open]);

  if (!open) return null;

  const config = getEarlyStartConfig(daysEarly, projectTitle, startDateLabel);
  const validation = validateEarlyStartInput(config, acknowledged, reason);
  const visibleAckError = attempted ? validation.acknowledgeError : '';
  const showCheckTip = Boolean(visibleAckError) && (checkFocused || checkHovered);
  const visibleReasonError = attempted || reasonTouched || reason.length > 0 ? validation.reasonError : '';
  const confirmBlockers = [
    validation.acknowledgeError,
    validation.reasonError,
  ].filter(Boolean);
  const confirmEnabledTip =
    !busy && confirmBlockers.length === 0
      ? `Immediately activates “${projectTitle}” ${config.daysEarly} ${config.daysEarly === 1 ? 'day' : 'days'} ahead of schedule and notifies assigned team members.`
      : '';
  const bannerClasses =
    config.tier === 'far'
      ? 'border-red-300 bg-red-50/90 text-red-900 dark:border-red-900/70 dark:bg-red-950/50 dark:text-red-100'
      : config.tier === 'weeks'
        ? 'border-amber-300 bg-amber-50/90 text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-100'
        : 'border-amber-200 bg-amber-50/60 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100';

  const handleConfirm = () => {
    if (busy) return;
    setAttempted(true);
    setReasonTouched(true);
    if (validation.acknowledgeError || validation.reasonError) return;
    void onConfirmEarlyStart(reason.trim());
  };

  return (
    <Modal
      isOpen={open}
      onClose={() => {
        if (!busy) onCancel();
      }}
      preventClose={busy}
      title={config.title}
      description={`Scheduled start date: ${startDateLabel} (Philippine Time)`}
      width="max-w-xl"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            {canScheduleInstead && onScheduleInstead && (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void onScheduleInstead()}
              >
                <CalendarClock size={14} aria-hidden="true" />
                <span className="ml-1.5">Schedule for {startDateLabel} instead</span>
              </Button>
            )}
            <ActionBlockerGroup
              actionLabel={config.confirmLabel}
              blockers={confirmBlockers}
              busy={busy}
            >
              <WorkspaceTooltip content={confirmEnabledTip} disabled={!confirmEnabledTip}>
                <span className="inline-flex">
                  <Button
                    type="button"
                    variant={config.tier === 'far' ? 'destructive' : 'default'}
                    disabled={busy}
                    onClick={handleConfirm}
                  >
                    <Rocket size={14} aria-hidden="true" />
                    <span className="ml-1.5">{busy ? 'Starting…' : config.confirmLabel}</span>
                  </Button>
                </span>
              </WorkspaceTooltip>
            </ActionBlockerGroup>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div
          role="alert"
          className={`flex items-start gap-3 rounded-lg border px-3.5 py-3 text-xs leading-relaxed ${bannerClasses}`}
        >
          {config.tier === 'far' ? (
            <Flame size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
          ) : (
            <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
          )}
          <div className="space-y-1">
            <strong className="block text-[13px] font-semibold">{config.headline}</strong>
            <p>{config.description}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 rounded-lg border border-border bg-muted/30 p-3 text-xs">
          <div>
            <span className="block text-[11px] text-muted-foreground">Scheduled start date</span>
            <strong className="tabular-nums text-foreground">{startDateLabel} · 12:00 AM PHT</strong>
          </div>
          <div>
            <span className="block text-[11px] text-muted-foreground">Ahead of schedule by</span>
            <strong className="tabular-nums text-foreground">
              {config.daysEarly} {config.daysEarly === 1 ? 'day' : 'days'}
            </strong>
          </div>
        </div>

        {config.requireAcknowledge && (
          <div className="space-y-1">
            <label
              htmlFor={checkId}
              className={`flex cursor-pointer items-start gap-2.5 rounded-lg border bg-background p-3 text-xs font-medium text-foreground ${
                visibleAckError
                  ? 'border-destructive ring-2 ring-destructive/10'
                  : 'border-red-200 dark:border-red-900/60'
              }`}
              onMouseEnter={() => setCheckHovered(true)}
              onMouseLeave={() => setCheckHovered(false)}
            >
              <input
                ref={checkRef}
                id={checkId}
                type="checkbox"
                checked={acknowledged}
                disabled={busy}
                aria-required="true"
                aria-invalid={Boolean(visibleAckError) || undefined}
                aria-describedby={
                  [visibleAckError ? checkErrId : undefined, showCheckTip ? checkTipId : undefined]
                    .filter(Boolean)
                    .join(' ') || undefined
                }
                onFocus={() => setCheckFocused(true)}
                onBlur={() => setCheckFocused(false)}
                onChange={(event) => setAcknowledged(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-red-600"
              />
              <span>
                I understand “{projectTitle}” is still {config.daysEarly} days away from its scheduled start date (
                {startDateLabel}) and still need to activate it today.
              </span>
            </label>
            <FieldValidationTooltip
              id={checkTipId}
              anchorRef={checkRef}
              message={visibleAckError}
              open={showCheckTip}
              tone="error"
            />
            {visibleAckError && (
              <p id={checkErrId} role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
                {visibleAckError}
              </p>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor={reasonId} className="block text-xs font-semibold text-foreground">
            {config.requireReason ? (
              <>
                Early start justification{' '}
                <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
                  *
                </span>
              </>
            ) : (
              'Optional note for audit log'
            )}
          </label>
          <BoundedTextarea
            id={reasonId}
            rows={3}
            disabled={busy}
            aria-required={config.requireReason || undefined}
            maxLength={EARLY_START_MAX_REASON_CHARS}
            value={reason}
            error={visibleReasonError || undefined}
            placeholder={
              config.requireReason
                ? `Explain why this project must start ${config.daysEarly} days before ${startDateLabel} (min. 10 characters)…`
                : 'Optional context for starting ahead of the planned start date…'
            }
            onChange={(event) => {
              setReason(event.target.value);
              if (!reasonTouched) setReasonTouched(true);
            }}
            onBlur={() => setReasonTouched(true)}
          />
        </div>
      </div>
    </Modal>
  );
}
