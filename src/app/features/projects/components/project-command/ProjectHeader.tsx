import { useState, type ReactNode } from 'react';
import { Check, RotateCcw, ShieldCheck, X } from 'lucide-react';
import type { Organization, UserProfile } from '../../../../types';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  ActionBlockerStopButton,
  ActionBlockersModal,
  type ActionBlockerItem,
} from '../../../../components/ui/action-blockers';
import { Button } from '../../../../components/ui/button';
import { DecisionModal } from '../../../../components/ui/DecisionModal';
import { InlineEditableText } from '../../../../components/ui/workspace';
import { formatManilaDate, formatManilaInstant } from '../../../../shared/calendarDisplay';
import { getPhilippineCalendarDate } from '../../../../shared/calendarDates';
import { INPUT_LIMITS } from '../../../../shared/inputLimits';
import { readableUiError } from '../../../../shared/userFacingError';
import {
  decideNonHeadProjectApproval,
  effectiveProjectLifecycleStatus,
  resubmitProjectForHeadApproval,
  type Project,
} from '../../services/projectService';
import {
  formatProjectTargetDateSubtext,
  manilaDayDiff,
  ProjectUnifiedStatus,
} from '../../presentation/projectPresentation';
import { projectOperationError } from '../../presentation/projectOperationError';
import type { ProjectCommandMetrics } from './types';
import './projectIdentity.css';

export function ProjectHeader({
  project,
  organizations,
  profiles = [],
  metrics,
  editable = false,
  onTitleChange,
  participants,
  utilities,
  hideTitle = false,
}: {
  project: Project;
  organizations: Organization[];
  profiles?: UserProfile[];
  metrics?: ProjectCommandMetrics;
  hideTitle?: boolean;
  editable?: boolean;
  onTitleChange?: (title: string) => Promise<void>;
  participants?: ReactNode;
  utilities?: ReactNode;
}) {
  const { userProfile } = useAuth();
  const [titleNotice, setTitleNotice] = useState('');
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [approvalError, setApprovalError] = useState('');
  const [approvalNotice, setApprovalNotice] = useState('');
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [headerBlockersOpen, setHeaderBlockersOpen] = useState(false);

  const organization = organizations.find((item) => item.id === project.orgId);
  const closed = ['completed', 'archived'].includes(project.status);
  const effectiveStatus = effectiveProjectLifecycleStatus(project);
  const todayManila = getPhilippineCalendarDate();
  const startDiff = manilaDayDiff(project.startDate, todayManila);
  const targetMeta = formatProjectTargetDateSubtext(project, metrics?.nextDeadline, todayManila);

  const isOfficeHead = Boolean(
    userProfile?.is_active !== false &&
      project.orgId &&
      userProfile?.org_id === project.orgId &&
      (organization?.head_user_id === userProfile.id || userProfile.role === 'head'),
  );

  const headerApprovalBlockers: ActionBlockerItem[] = (() => {
    const list: ActionBlockerItem[] = [];
    if (project.status === 'planning' && project.projectApprovalStatus === 'pending_head') {
      list.push({
        id: 'header-project-head',
        category: 'head_approval',
        title: 'Waiting for Office Head approval',
        detail: isOfficeHead
          ? 'Review and approve this non-Head project proposal so it can move to Waiting for activation.'
          : 'Submitted for Office Head approval. Once approved, status moves to Waiting for activation.',
        waitingOn: 'Office Head',
        statusLabel: 'Pending Head',
      });
    }
    if (project.status === 'planning' && project.fundingApprovalStatus === 'pending_head') {
      list.push({
        id: 'header-funding-head',
        category: 'head_approval',
        title: 'Waiting for Office Head funding endorsement',
        detail: 'Step 1 of 2: Project funding requires Office Head endorsement before moving to Financial Officer (Accounting) certification.',
        waitingOn: 'Office Head',
        statusLabel: 'Step 1/2 · Pending Head',
      });
      list.push({
        id: 'header-funding-acct',
        category: 'accounting_approval',
        title: 'Waiting for Financial Officer (Accounting) certification',
        detail: 'Step 2 of 2: Independent Financial Officer (Accounting) certification is required before funds are reserved and the project moves to Waiting for activation.',
        waitingOn: 'Financial Officer (Accounting)',
        statusLabel: 'Step 2/2 · Queued',
      });
    } else if (project.status === 'planning' && project.fundingApprovalStatus === 'pending_accounting') {
      list.push({
        id: 'header-funding-acct-only',
        category: 'accounting_approval',
        title: 'Waiting for Financial Officer (Accounting) certification',
        detail: 'Endorsed by Office Head; pending independent Financial Officer (Accounting) certification before this project moves to Waiting for activation.',
        waitingOn: 'Financial Officer (Accounting)',
        statusLabel: 'Step 2/2 · Pending Financial Officer',
      });
    }
    if (project.status === 'active' && project.completionReviewStatus === 'requested') {
      list.push({
        id: 'header-completion-head',
        category: 'head_approval',
        title: 'Waiting for Office Head final completion approval',
        detail: 'Submitted by the Project Lead for Office Head final completion review before marking complete and archiving.',
        waitingOn: 'Office Head',
        statusLabel: 'Pending Head completion',
      });
    }
    return list;
  })();
  const canResubmitApproval = Boolean(
    userProfile?.id &&
      (project.createdBy === userProfile.id ||
        project.ownerId === userProfile.id ||
        project.projectLeadId === userProfile.id ||
        editable),
  );

  const saveTitle = async (title: string) => {
    setTitleNotice('Saving project name…');
    try {
      await onTitleChange?.(title);
      setTitleNotice('Project name saved.');
    } catch (error) {
      setTitleNotice('');
      throw new Error(projectOperationError(error, 'Could not save the project name.'));
    }
  };

  const handleApproveProject = async () => {
    if (approvalBusy) return;
    setApprovalBusy(true);
    setApprovalError('');
    setApprovalNotice('');
    try {
      await decideNonHeadProjectApproval(project.id, true, '');
      setApprovalNotice('Project approved. Status is now Waiting for activation.');
    } catch (error) {
      setApprovalError(readableUiError(error, 'Could not approve this project.', 'write'));
    } finally {
      setApprovalBusy(false);
    }
  };

  const handleReturnProject = async () => {
    if (approvalBusy || returnReason.trim().length < 5) return;
    setApprovalBusy(true);
    setApprovalError('');
    setApprovalNotice('');
    try {
      await decideNonHeadProjectApproval(project.id, false, returnReason);
      setReturnModalOpen(false);
      setReturnReason('');
      setApprovalNotice('Project returned for revisions.');
    } catch (error) {
      setApprovalError(readableUiError(error, 'Could not return this project.', 'write'));
    } finally {
      setApprovalBusy(false);
    }
  };

  const handleResubmitProject = async () => {
    if (approvalBusy) return;
    setApprovalBusy(true);
    setApprovalError('');
    setApprovalNotice('');
    try {
      await resubmitProjectForHeadApproval(project.id);
      setApprovalNotice('Project resubmitted for Office Head approval.');
    } catch (error) {
      setApprovalError(readableUiError(error, 'Could not resubmit project for approval.', 'write'));
    } finally {
      setApprovalBusy(false);
    }
  };

  const targetDateLabel = project.targetDate
    ? formatManilaDate(project.targetDate, project.targetDate)
    : metrics?.nextDeadline
      ? formatManilaDate(metrics.nextDeadline, metrics.nextDeadline)
      : '';

  return (
    <header className="eflow-project-identity" data-tour-id="project-table-heading">
      <div className="eflow-project-identity__top">
        <div className="eflow-project-identity__identity">
          <p className="eflow-project-identity__office">{organization?.name || 'Office not set'}</p>
          {!hideTitle && (
            <h1 aria-label={project.title}>
              {onTitleChange ? (
                <InlineEditableText
                  revision={project.metadataVersion || project.updatedAt}
                  value={project.title}
                  label="project name"
                  disabled={!editable || closed}
                  onSave={saveTitle}
                />
              ) : (
                project.title
              )}
            </h1>
          )}
          <div className="eflow-project-identity__signals">
            <ProjectUnifiedStatus
              project={project}
              health={metrics?.scheduleHealth}
              layout="inline"
            />
            {headerApprovalBlockers.length > 0 && (
              <>
                <ActionBlockerStopButton
                  actionLabel={project.title}
                  count={headerApprovalBlockers.length}
                  size="sm"
                  onClick={() => setHeaderBlockersOpen(true)}
                />
                <ActionBlockersModal
                  open={headerBlockersOpen}
                  actionLabel={project.title}
                  blockers={headerApprovalBlockers}
                  onClose={() => setHeaderBlockersOpen(false)}
                />
              </>
            )}
            {!closed && targetDateLabel && (
              <span className="eflow-unified-status__meta">
                <span>· Target {targetDateLabel}</span>
                {targetMeta && effectiveStatus === 'active' && <span>({targetMeta.text})</span>}
              </span>
            )}
          </div>
          {metrics && (
            <p>
              {metrics.taskCompleted} / {metrics.taskTotal} tasks completed · {metrics.progress}% complete
              {metrics.overdue && effectiveStatus === 'active' ? ` · ${metrics.overdue} overdue` : ''}
            </p>
          )}
          {project.projectLeadId && (
            <p>
              Project lead:{' '}
              <strong>
                {profiles.find((person) => person.id === project.projectLeadId)?.full_name ||
                  'Assigned project lead'}
              </strong>
            </p>
          )}
          {participants}
        </div>
        {utilities}
      </div>

      {closed && (
        <p role="status">
          {project.status === 'archived' ? 'Archived' : 'Completed'} project details are read-only. History and reports remain available.
        </p>
      )}

      {project.status === 'planning' && project.projectApprovalStatus === 'pending_head' && isOfficeHead && (
        <div className="eflow-project-identity__context" role="status">
          <div className="flex items-start gap-2">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
            <div>
              <span>Pending Office Head approval</span>
              <p>
                {isOfficeHead
                  ? 'Review this non-Head project proposal. Approving moves it to Waiting for activation without starting it automatically.'
                  : 'Submitted for Office Head approval. Once approved, status moves to Waiting for activation.'}
              </p>
            </div>
          </div>
          {isOfficeHead && (
            <div className="eflow-project-identity__context-actions">
              <Button
                type="button"
                size="sm"
                disabled={approvalBusy}
                onClick={() => void handleApproveProject()}
              >
                <Check size={14} aria-hidden="true" />
                <span className="ml-1">{approvalBusy ? 'Approving…' : 'Approve project'}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={approvalBusy}
                onClick={() => {
                  setApprovalError('');
                  setReturnReason('');
                  setReturnModalOpen(true);
                }}
              >
                <X size={14} aria-hidden="true" />
                <span className="ml-1">Return for revisions</span>
              </Button>
            </div>
          )}
        </div>
      )}

      {project.status === 'planning' && project.projectApprovalStatus === 'rejected' && (
        <div className="eflow-project-identity__context" role="status">
          <div>
            <span>Office Head requested revisions</span>
            <p>{project.projectApprovalFeedback || 'Review the project details and resubmit for Office Head approval.'}</p>
          </div>
          {canResubmitApproval && (
            <div className="eflow-project-identity__context-actions">
              <Button
                type="button"
                size="sm"
                disabled={approvalBusy}
                onClick={() => void handleResubmitProject()}
              >
                <RotateCcw size={14} aria-hidden="true" />
                <span className="ml-1">{approvalBusy ? 'Resubmitting…' : 'Resubmit for approval'}</span>
              </Button>
            </div>
          )}
        </div>
      )}

      {effectiveStatus === 'waiting_for_activation' && (
        <p role="status">
          {project.activationScheduledAt && startDiff !== null && startDiff > 0
            ? `Approved and scheduled to activate automatically on ${formatManilaDate(project.startDate, project.startDate!)} at 12:00 AM (PHT). Open Setup & activation to cancel the schedule or start early.`
            : startDiff !== null && startDiff > 0
              ? `Approved and waiting for activation. Scheduled start date is ${formatManilaDate(project.startDate, project.startDate!)} (PHT) — open Setup & activation to schedule start-date activation or start early.`
              : 'Approved and waiting for activation. Open Setup & activation when you are ready to start delivery.'}
        </p>
      )}

      {project.status === 'active' && project.completionReviewStatus === 'requested' && (
        <p role="status">Submitted by Project Lead for Office Head final completion review.</p>
      )}
      {project.status === 'completed' && project.completedAt && (
        <p role="status">
          Auto-archive: {formatManilaInstant(new Date(project.completedAt).getTime() + 30 * 86400000, '—')}. You can archive sooner. Blockchain publication stays manual.
        </p>
      )}
      {approvalError && !returnModalOpen && (
        <p role="alert" className="mt-2 text-xs font-medium text-red-700">
          {approvalError}
        </p>
      )}
      {approvalNotice && (
        <p role="status" className="mt-2 text-xs font-medium text-emerald-700">
          {approvalNotice}
        </p>
      )}
      <span className="sr-only" aria-live="polite">
        {titleNotice}
      </span>

      {returnModalOpen && (
        <DecisionModal
          title="Return project for revisions?"
          description={`Send “${project.title}” back to the creator with feedback before it can move to Waiting for activation.`}
          decision="changes"
          confirmLabel="Return project"
          reasonLabel="Revision feedback (required)"
          reason={returnReason}
          onReasonChange={setReturnReason}
          minReasonLength={5}
          maxReasonLength={INPUT_LIMITS.REASON}
          requireReason
          busy={approvalBusy}
          error={approvalError || undefined}
          onCancel={() => {
            setReturnModalOpen(false);
            setReturnReason('');
            setApprovalError('');
          }}
          onConfirm={() => void handleReturnProject()}
        />
      )}
    </header>
  );
}
