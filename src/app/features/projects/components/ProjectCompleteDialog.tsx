import { readableUiError } from '../../../shared/userFacingError';
import { formatManilaDateTime } from '../../../shared/calendarDisplay';
import { useRef, useState } from "react";
import { CheckCircle2, ClipboardCheck, Loader2, RotateCcw, Send } from "lucide-react";
import { Modal } from "../../../components/ui/Modal";
import { ActionBlockerGroup, type ActionBlockerItem } from "../../../components/ui/action-blockers";
import { BoundedTextarea } from "../../../components/ui/BoundedInput";
import { INPUT_LIMITS, textLengthError } from "../../../shared/inputLimits";
import {
  completeProject,
  fetchProjectCompletionReadiness,
  requestProjectCompletionReview,
  returnProjectCompletionReview,
} from "../services/projectLifecycleService";
import { assertActionActor } from '../../../shared/actionActor';
import type { Project } from '../services/types';
import { useProjectCompletionAvailability } from '../hooks/useProjectCompletionAvailability';
import { useAuth } from '../../../contexts/AuthContext';
import { ProjectReadinessPanel, type ReadinessDestination } from '../../project-readiness';
import { useGuardedProjectDialog } from '../hooks/useGuardedProjectDialog';
import { CompletionBlockersList } from './CompletionBlockersList';
import { ProjectFinancialCloseoutCard } from './ProjectFinancialCloseoutCard';
import { formatPeso, toCentavos } from '../../../shared/currency';
import { requestNavigation } from '../../../shared/navigationGuard';

export function ProjectCompleteDialog({ projectId, projectTitle, project, onClose, onSuccess, onOpenTask, onOpenGovernance, onResolve, archiveReview = false }: {
  projectId: string;
  projectTitle: string;
  onClose: () => void;
  onSuccess: () => void;
  onOpenTask: (taskId: string) => void;
  onOpenGovernance: (draftId: string) => void;
  project?: Project;
  archiveReview?: boolean;
  onResolve?: (view: ReadinessDestination) => void;
}) {
  const { userProfile } = useAuth();
  const isOfficeHead =
    userProfile?.role === 'head' &&
    userProfile.is_active !== false &&
    (!project || Boolean(project.sourceCollaborationDraftId) || project.orgId === userProfile.org_id);
  const isNonHeadProjectLead = Boolean(
    !isOfficeHead &&
      userProfile?.id &&
      userProfile.is_active !== false &&
      project?.projectLeadId === userProfile.id,
  );
  const allowed = isOfficeHead || isNonHeadProjectLead;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [note, setNote] = useState("");
  const [returnMode, setReturnMode] = useState(false);
  const [returnFeedback, setReturnFeedback] = useState("");
  const [returnFeedbackTouched, setReturnFeedbackTouched] = useState(false);
  const checks = useProjectCompletionAvailability(project || {id:projectId,status:'active',updatedAt:0},allowed,`${userProfile?.id}:${userProfile?.org_id}:${userProfile?.role}`, '', archiveReview);
  const { readiness, loading } = checks;
  const inFlight = useRef(false);
  const close = useGuardedProjectDialog({
    dirty: Boolean(note.trim() || returnFeedback.trim()),
    pending: busy,
    pendingCheck: () => inFlight.current,
    label: isNonHeadProjectLead ? 'Completion review request' : 'Project completion note',
    onClose,
    onDiscard: () => {
      setNote('');
      setReturnFeedback('');
      setReturnFeedbackTouched(false);
      setReturnMode(false);
    },
  });

  const leadBlockers = readiness
    ? readiness.blockers.filter(
        (blocker) =>
          blocker.kind !== 'lead_review' &&
          !(blocker.kind === 'funding' && blocker.status === 'unreturned_project_funding'),
      )
    : [];
  const unreturnedFundingBlocker = readiness?.blockers.find(
    (blocker) => blocker.kind === 'funding' && blocker.status === 'unreturned_project_funding',
  );
  const completionReviewStatus =
    readiness?.completionReviewStatus ?? project?.completionReviewStatus ?? 'none';
  const requiresHeadCompletionReview = Boolean(readiness?.requiresHeadCompletionReview);
  const canSubmitLeadReview = Boolean(
    isNonHeadProjectLead &&
      !archiveReview &&
      readiness &&
      !loading &&
      !checks.error &&
      leadBlockers.length === 0 &&
      (readiness.canRequestCompletionReview ??
        (readiness.status === 'active' && completionReviewStatus !== 'requested')),
  );
  const headReviewingSubmission = Boolean(
    isOfficeHead &&
      !archiveReview &&
      requiresHeadCompletionReview &&
      completionReviewStatus === 'requested',
  );

  const confirm = async () => {
    if (!isOfficeHead || !checks.enabled || error || inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError(""); setNotice("");
    try {
      if (!userProfile?.id) throw new Error('Sign in again before completing this project.');
      await assertActionActor(userProfile.id);
      const current = await fetchProjectCompletionReadiness(projectId);
      if (current.projectId !== projectId || !current.canComplete || current.blockers.length) {
        throw new Error('Project readiness changed. Review the current requirements.');
      }
      await assertActionActor(userProfile.id);
      try { await completeProject(projectId, note); }
      catch (error) {
        await assertActionActor(userProfile.id);
        const saved = await fetchProjectCompletionReadiness(projectId).catch(() => undefined);
        if (saved?.projectId !== projectId || saved.status !== 'completed') throw error;
      }
    }
    catch (caught) {
      setError(readableUiError(caught, "Project could not be completed.", 'write'));
      void checks.refresh();
      setBusy(false); inFlight.current = false;
      return;
    }
    onSuccess();
  };

  const submitForHeadReview = async () => {
    if (!canSubmitLeadReview || inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError(""); setNotice("");
    try {
      if (!userProfile?.id) throw new Error('Sign in again before requesting completion review.');
      await assertActionActor(userProfile.id);
      await requestProjectCompletionReview(projectId, note);
      setNote("");
      setNotice("Submitted to the Office Head for final completion review.");
      await checks.refresh();
    } catch (caught) {
      setError(readableUiError(caught, "Could not submit project for completion review.", 'write'));
      void checks.refresh();
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  };

  const returnFeedbackError = textLengthError(returnFeedback, 'Return feedback', {
    required: true,
    min: 5,
    max: INPUT_LIMITS.REASON,
  });
  const visibleReturnFeedbackError =
    returnFeedbackTouched || returnFeedback.length > 0 ? returnFeedbackError : '';

  const sendBackForChanges = async () => {
    setReturnFeedbackTouched(true);
    if (!headReviewingSubmission || inFlight.current) return;
    if (returnFeedbackError) {
      setError(returnFeedbackError);
      return;
    }
    inFlight.current = true;
    setBusy(true); setError(""); setNotice("");
    try {
      if (!userProfile?.id) throw new Error('Sign in again before returning completion review.');
      await assertActionActor(userProfile.id);
      await returnProjectCompletionReview(projectId, returnFeedback);
      setReturnFeedback("");
      setReturnFeedbackTouched(false);
      setReturnMode(false);
      setNotice("Returned to the Project Lead with your requested changes.");
      await checks.refresh();
    } catch (caught) {
      setError(readableUiError(caught, "Could not return completion review.", 'write'));
      void checks.refresh();
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  };

  const displayedBlockers = isNonHeadProjectLead ? leadBlockers : (readiness?.blockers ?? []);
  const toModalBlockers = (items: typeof displayedBlockers): ActionBlockerItem[] =>
    items.map((blocker, idx) => {
      const isUnreturned = blocker.status === 'unreturned_project_funding';
      const isCash = blocker.kind === 'cash';
      const isGov = blocker.kind === 'governance';
      return {
        id: `${blocker.kind}-${blocker.id || idx}`,
        category: isUnreturned
          ? 'financial_gate'
          : isCash
            ? 'accounting_approval'
            : isGov
              ? 'partner_approval'
              : 'readiness',
        title: blocker.title,
        detail:
          blocker.kind === 'cash' && blocker.status === 'pending_department_settlement'
            ? 'Settle this advance in Accounting → Settlements (Financial Officer). If no independent Financial Officer is available, the Office Head can approve and post it in Reviews → Budget.'
            : blocker.detail,
        waitingOn: isUnreturned
          ? 'Office Head (Return to Office Budget)'
          : isCash
            ? 'Financial Officer (Accounting)'
            : isGov
              ? 'Partner Office Head'
              : undefined,
        statusLabel: isUnreturned
          ? 'Unreturned Office Budget'
          : isCash && blocker.status === 'pending_department_settlement'
            ? 'Pending Financial Officer'
            : blocker.status.replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase()),
        amount: blocker.amount,
        actionLabel:
          isUnreturned && onResolve
            ? 'Open Budget tab'
            : blocker.kind === 'task' && blocker.id
              ? 'Open task'
              : blocker.kind === 'governance' && blocker.id
                ? 'Open governance'
                : undefined,
        onAction:
          isUnreturned && onResolve
            ? () => onResolve('budget')
            : blocker.kind === 'task' && blocker.id
              ? () => onOpenTask(blocker.id)
              : blocker.kind === 'governance' && blocker.id
                ? () => onOpenGovernance(blocker.id)
                : undefined,
      };
    });

  const submitLeadDisabled = busy || !canSubmitLeadReview || Boolean(error);
  const submitLeadBlockers: ActionBlockerItem[] | string[] = !submitLeadDisabled || busy || loading
    ? []
    : error
      ? [error]
      : checks.error
        ? [checks.error]
        : leadBlockers.length > 0
          ? toModalBlockers(leadBlockers)
          : [checks.reason || 'Completion review cannot be submitted right now.'];
  const sendChangesDisabled = busy || Boolean(returnFeedbackError);
  const sendChangesBlockers = !sendChangesDisabled || busy ? [] : [returnFeedbackError];
  const confirmDisabled = busy || !checks.enabled || Boolean(error);
  const confirmBlockers: ActionBlockerItem[] | string[] = !confirmDisabled || busy || loading
    ? []
    : error
      ? [error]
      : checks.error
        ? [checks.error]
        : displayedBlockers.length > 0
          ? toModalBlockers(displayedBlockers)
          : [checks.reason || 'This project is not ready to be marked complete yet.'];
  const dialogTitle = archiveReview
    ? 'Archive requirements'
    : isNonHeadProjectLead
      ? 'Request project completion review'
      : headReviewingSubmission
        ? 'Review project completion'
        : 'Mark project complete';

  return <Modal isOpen onClose={() => { if (!inFlight.current) close(); }} title={dialogTitle} width="max-w-2xl" footer={
    <div className="flex w-full flex-wrap justify-end gap-2">
      <button type="button" onClick={close} disabled={busy} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">{archiveReview ? 'Close' : 'Cancel'}</button>
      {!archiveReview && isNonHeadProjectLead && completionReviewStatus !== 'requested' && (
        <ActionBlockerGroup
          actionLabel="Submit for Head completion review"
          blockers={submitLeadBlockers}
          busy={busy || loading}
          onRefresh={() => void checks.refresh()}
          refreshing={loading}
        >
          <button
            type="button"
            disabled={submitLeadDisabled}
            aria-describedby="project-completion-reason"
            onClick={() => void submitForHeadReview()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#00006b] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {busy ? 'Submitting…' : 'Submit for Head completion review'}
          </button>
        </ActionBlockerGroup>
      )}
      {!archiveReview && headReviewingSubmission && !returnMode && (
        <button
          type="button"
          disabled={busy}
          onClick={() => { setReturnMode(true); setReturnFeedbackTouched(false); setError(""); }}
          className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 disabled:opacity-40"
        >
          <RotateCcw size={15} /> Request changes
        </button>
      )}
      {!archiveReview && headReviewingSubmission && returnMode && (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => { setReturnMode(false); setReturnFeedback(""); setReturnFeedbackTouched(false); setError(""); }}
            className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40"
          >
            Back
          </button>
          <ActionBlockerGroup
            actionLabel="Send change request"
            blockers={sendChangesBlockers}
            busy={busy}
          >
            <button
              type="button"
              disabled={sendChangesDisabled}
              onClick={() => void sendBackForChanges()}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
              {busy ? 'Sending…' : 'Send change request'}
            </button>
          </ActionBlockerGroup>
        </>
      )}
      {!archiveReview && isOfficeHead && !returnMode && (
        <ActionBlockerGroup
          actionLabel={headReviewingSubmission ? 'Approve & mark complete' : 'Confirm completion'}
          blockers={confirmBlockers}
          busy={busy || loading}
          onRefresh={() => void checks.refresh()}
          refreshing={loading}
        >
          <button
            type="button"
            disabled={confirmDisabled}
            aria-describedby="project-completion-reason"
            onClick={() => void confirm()}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            {headReviewingSubmission ? 'Approve & mark complete' : 'Confirm completion'}
          </button>
        </ActionBlockerGroup>
      )}
    </div>
  }>
    <div className="space-y-4">
      {archiveReview ? (
        <p className="text-sm text-neutral-700">Current closeout checks for <strong>{projectTitle}</strong>.</p>
      ) : isNonHeadProjectLead ? (
        <p className="text-sm text-neutral-700">
          As Project Lead, verify that all tasks, subtasks, and financial settlements for <strong>{projectTitle}</strong> are complete, then submit this project to the Office Head for final completion review. Only the Office Head can mark the project complete, archive it, and seal it on the blockchain.
        </p>
      ) : headReviewingSubmission ? (
        <p className="text-sm text-neutral-700">
          Review the Project Lead’s completion submission for <strong>{projectTitle}</strong>. Approving marks this project complete so you can proceed to archiving and blockchain sealing.
        </p>
      ) : (
        <p className="text-sm text-neutral-700">
          Complete <strong>{projectTitle}</strong>? This changes only this project—not other projects in the work plan. All unused project funding must be manually returned to the Office Budget before this project can be marked complete. Archiving and blockchain sealing remain separate steps.
        </p>
      )}

      {!archiveReview && isNonHeadProjectLead && unreturnedFundingBlocker && (
        <div role="status" className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-950">
          <strong>Office Budget return pending Office Head closeout:</strong>{' '}
          <span className="tabular-nums font-semibold">
            {formatPeso(unreturnedFundingBlocker.amount ?? readiness?.unreturnedProjectFunding ?? 0)}
          </span>{' '}
          in unallocated project funding remains. You can submit delivery handover once all tasks and cash liquidations are settled; the Office Head must manually return these funds to the Office Budget before marking the project complete.
        </div>
      )}

      {!archiveReview && completionReviewStatus === 'requested' && (
        <div role="status" className="rounded-lg border border-blue-200 bg-blue-50/70 p-3.5 text-sm text-blue-950 space-y-1">
          <p className="flex items-center gap-2 font-semibold">
            <ClipboardCheck size={16} aria-hidden="true" />
            Submitted for Office Head final completion review
          </p>
          <p className="text-xs text-blue-900/90">
            Requested by <strong>{readiness?.completionRequestedByName || readiness?.projectLeadName || 'Project Lead'}</strong>
            {readiness?.completionRequestedAt ? ` on ${formatManilaDateTime(readiness.completionRequestedAt)}` : ''}
          </p>
          {readiness?.completionRequestNote && (
            <p className="pt-1 text-xs text-neutral-800">
              <span className="font-medium">Project Lead note:</span> {readiness.completionRequestNote}
            </p>
          )}
        </div>
      )}

      {!archiveReview && completionReviewStatus === 'changes_requested' && readiness?.completionReviewFeedback && (
        <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-950 space-y-1">
          <p className="font-semibold">Office Head requested changes</p>
          <p className="text-xs text-amber-900">
            {readiness.completionReviewedByName ? `${readiness.completionReviewedByName}` : 'Office Head'}
            {readiness.completionReviewedAt ? ` · ${formatManilaDateTime(readiness.completionReviewedAt)}` : ''}
          </p>
          <p className="pt-1 text-xs text-neutral-800">{readiness.completionReviewFeedback}</p>
        </div>
      )}

      <p id="project-completion-reason" role="status" className="flex items-center gap-2 text-sm text-neutral-600">
        {loading
          ? <><Loader2 size={15} className="animate-spin" />Checking work, cash settlement, and required approvals…</>
          : readiness && !checks.error
            ? `${displayedBlockers.length} completion requirement(s) remain.`
            : checks.reason}
      </p>

      {notice && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      {(error || checks.error) && <div role="alert" className="whitespace-pre-line rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><p>{error || checks.error}</p><button type="button" disabled={busy || loading} onClick={()=>{setError('');void checks.refresh();}} className="mt-2 underline">Retry checks</button></div>}

      {readiness && <>
        {(readiness.canComplete || archiveReview || (isNonHeadProjectLead && displayedBlockers.length === 0)) && displayedBlockers.length === 0 ? (
          <div className="space-y-3">
            <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
              {archiveReview
                ? 'No outstanding closeout requirements.'
                : isNonHeadProjectLead
                  ? completionReviewStatus === 'requested'
                    ? 'All work and settlement checks passed. Awaiting Office Head final completion approval.'
                    : 'All work, subtask, and financial settlement checks passed. Ready to submit for Office Head completion review.'
                  : headReviewingSubmission
                    ? 'All completion checks passed and Project Lead handover is submitted. Ready to approve and mark complete.'
                    : 'All completion checks passed. This project is ready to complete.'}
            </p>
            {readiness.financialCloseoutSummary &&
              (!isNonHeadProjectLead || toCentavos(readiness.financialCloseoutSummary.unreturnedBalance) === 0) && (
                <ProjectFinancialCloseoutCard
                  summary={readiness.financialCloseoutSummary}
                  mode="completion"
                />
              )}
          </div>
        ) : (
          <div className="space-y-3">
            <h4 className="font-semibold text-neutral-900">
              {archiveReview
                ? 'Blocking automatic archive'
                : readiness.status === "archived"
                  ? "This project is already archived."
                  : readiness.status === "completed"
                    ? "This project is already completed."
                    : `${displayedBlockers.length} item(s) still holding up completion`}
            </h4>
            <CompletionBlockersList
              blockers={displayedBlockers}
              highlightId={archiveReview ? displayedBlockers[0]?.id : undefined}
              busy={busy}
              project={project}
              onOpenTask={onOpenTask}
              onOpenGovernance={onOpenGovernance}
              onResolve={onResolve}
            />
          </div>
        )}
      </>}

      {!archiveReview && isOfficeHead && project && <ProjectReadinessPanel project={project} canManage={isOfficeHead} onUpdated={()=>{setError('');void checks.refresh();}} onResolve={onResolve ? view=>{void requestNavigation(()=>onResolve(view));} : undefined} />}

      {!archiveReview && returnMode && headReviewingSubmission && (
        <div className="space-y-1.5">
          <label htmlFor="completion-return-feedback" className="block text-sm font-medium text-neutral-900">
            Changes requested for Project Lead <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">*</span>
          </label>
          <BoundedTextarea
            id="completion-return-feedback"
            value={returnFeedback}
            aria-required="true"
            onChange={(event) => {
              setReturnFeedback(event.target.value);
              if (!returnFeedbackTouched) setReturnFeedbackTouched(true);
              if (error) setError("");
            }}
            onBlur={() => setReturnFeedbackTouched(true)}
            disabled={busy}
            rows={3}
            maxLength={INPUT_LIMITS.REASON}
            error={visibleReturnFeedbackError || undefined}
            placeholder="Explain what needs to be reviewed or corrected before this project can be marked complete (at least 5 characters)."
          />
        </div>
      )}

      {!archiveReview && !returnMode && ((isOfficeHead) || (isNonHeadProjectLead && completionReviewStatus !== 'requested')) && (
        <div className="space-y-1.5">
          <label htmlFor="project-completion-note" className="block text-sm font-medium text-neutral-900">
            {isNonHeadProjectLead ? 'Handover summary for Office Head (optional)' : 'Completion note (optional)'}
          </label>
          <BoundedTextarea
            id="project-completion-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={busy || !allowed}
            rows={2}
            maxLength={INPUT_LIMITS.COMMENT}
            placeholder={
              isNonHeadProjectLead
                ? 'Summarize completed deliverables or notes for the Office Head…'
                : 'Optional completion note recorded in the project audit log…'
            }
          />
        </div>
      )}
    </div>
  </Modal>;
}
