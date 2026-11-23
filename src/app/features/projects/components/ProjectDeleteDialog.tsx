import { readableUiError } from '../../../shared/userFacingError';
import * as React from "react";
import * as Icons from "lucide-react";
import { Modal } from "../../../components/ui/Modal";
import { BoundedTextInput, BoundedTextarea } from "../../../components/ui/BoundedInput";
import { FieldValidationTooltip } from "../../../components/ui/FieldValidationTooltip";
import { INPUT_LIMITS } from "../../../shared/inputLimits";
import { Button } from "../../../components/ui/button";
import { deleteProject } from "../services/projectService";
import { fetchProjectDeletionBlockers } from "../services/projectLifecycleService";
import type { ProjectStatus } from "../services/types";
import { projectFlowCall } from '../../project-setup';
import { useGuardedProjectDialog } from '../hooks/useGuardedProjectDialog';

const MIN_DELETE_REASON_LENGTH = 5;

export function ProjectDeleteDialog({
  projectId,
  projectTitle,
  projectStatus,
  draft = false,
  open,
  onClose,
  onDeleted,
  onArchive,
}: {
  projectId: string;
  projectTitle: string;
  projectStatus?: ProjectStatus;
  draft?: boolean;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
  onArchive?: () => void;
}) {
  const [confirmation, setConfirmation] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [reasonTouched, setReasonTouched] = React.useState(false);
  const [confirmTouched, setConfirmTouched] = React.useState(false);
  const [actionTipOpen, setActionTipOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [check, setCheck] = React.useState<{ blockers?: string[]; error?: string; retryable?: boolean }>({});
  const [checkVersion, retryCheck] = React.useReducer((version: number) => version + 1, 0);
  const inFlight = React.useRef(false);
  const reasonRef = React.useRef<HTMLTextAreaElement | null>(null);
  const confirmRef = React.useRef<HTMLInputElement | null>(null);
  const actionAnchorRef = React.useRef<HTMLSpanElement | null>(null);
  const actionTooltipId = React.useId();
  const eligible = check.blockers?.length === 0;
  const close = useGuardedProjectDialog({
    open,
    dirty: eligible && Boolean(reason.trim() || confirmation.trim()),
    pending: deleting,
    pendingCheck: () => inFlight.current,
    label: draft ? 'Discard project draft' : 'Delete project',
    onClose,
    onDiscard: () => {
      setReason('');
      setConfirmation('');
      setReasonTouched(false);
      setConfirmTouched(false);
    },
  });

  React.useEffect(() => {
    if (open) {
      setConfirmation("");
      setReason("");
      setReasonTouched(false);
      setConfirmTouched(false);
      setActionTipOpen(false);
      setError("");
    }
  }, [open, projectId]);

  React.useEffect(() => {
    if (!open) return;
    let current = true;
    setCheck({});
    if (draft) {
      setCheck({ blockers: [] });
      return;
    }
    void fetchProjectDeletionBlockers(projectId).then((blockers) => {
      if (!current) return;
      setCheck(blockers ? { blockers } : { error: "Only the Head responsible for this project can delete it." });
    }).catch((caught: Error) => {
      if (current) setCheck({ error: caught.message, retryable: true });
    });
    return () => { current = false; };
  }, [open, projectId, checkVersion, draft]);

  const trimmedReason = reason.trim();
  const expectedTitle = projectTitle.trim();
  const trimmedConfirm = confirmation.trim();
  const reasonValid = trimmedReason.length >= MIN_DELETE_REASON_LENGTH;
  const confirmValid = trimmedConfirm === expectedTitle;
  const canDelete = eligible && confirmValid && reasonValid;

  const missingChars = Math.max(0, MIN_DELETE_REASON_LENGTH - trimmedReason.length);
  const showReasonError = reasonTouched || reason.length > 0;
  const reasonError = !showReasonError
    ? ""
    : trimmedReason.length === 0
      ? `Reason for deletion is required (minimum ${MIN_DELETE_REASON_LENGTH} characters).`
      : trimmedReason.length < MIN_DELETE_REASON_LENGTH
        ? `Enter at least ${MIN_DELETE_REASON_LENGTH} characters (${missingChars} more needed).`
        : "";

  const showConfirmError = confirmTouched || confirmation.length > 0;
  const confirmError = !showConfirmError
    ? ""
    : trimmedConfirm.length === 0
      ? `Type "${expectedTitle}" to confirm.`
      : !confirmValid
        ? `Must match "${expectedTitle}" exactly.`
        : "";

  const actionTooltipMessage = deleting
    ? ""
    : !canDelete
      ? !reasonValid && !confirmValid
        ? `Enter a reason (min. ${MIN_DELETE_REASON_LENGTH} characters) and type "${expectedTitle}" to enable ${draft ? "discarding" : "deletion"}.`
        : !reasonValid
          ? trimmedReason.length === 0
            ? `Enter a reason for deletion (minimum ${MIN_DELETE_REASON_LENGTH} characters).`
            : `Deletion reason needs ${missingChars} more character${missingChars === 1 ? "" : "s"} (minimum ${MIN_DELETE_REASON_LENGTH}).`
          : `Type "${expectedTitle}" exactly to confirm before ${draft ? "discarding this draft" : "deleting this project"}.`
      : draft
        ? `Warning: Permanently discards "${expectedTitle}". This action cannot be undone.`
        : `Warning: Permanently deletes "${expectedTitle}". This action cannot be undone.`;

  const revealInvalidField = () => {
    setReasonTouched(true);
    setConfirmTouched(true);
    setActionTipOpen(true);
    if (!reasonValid) {
      reasonRef.current?.focus();
    } else if (!confirmValid) {
      confirmRef.current?.focus();
    }
  };

  const handleDelete = async () => {
    if (!canDelete) {
      revealInvalidField();
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setDeleting(true);
    setActionTipOpen(false);
    setError("");
    try {
      if (draft) {
        await projectFlowCall('discard_private_project', {
          p_project: projectId,
          p_title: trimmedConfirm,
          p_reason: trimmedReason,
        });
      } else {
        await deleteProject(projectId, trimmedConfirm, trimmedReason);
      }
      onDeleted();
    } catch (caught) {
      setError(
        readableUiError(caught, "Project deletion failed.", 'write'),
      );
      setCheck({});
      retryCheck();
    } finally {
      inFlight.current = false;
      setDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={deleting ? () => {} : close}
      title={draft ? 'Discard project draft' : 'Permanently delete project'}
      width="max-w-lg"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <button
            type="button"
            onClick={close}
            disabled={deleting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {eligible ? "Cancel" : "Close"}
          </button>
          {eligible && (
            <span
              ref={actionAnchorRef}
              className={`inline-flex ${!canDelete || deleting ? "cursor-not-allowed" : ""}`}
              onMouseEnter={() => setActionTipOpen(true)}
              onMouseLeave={() => setActionTipOpen(false)}
              onClick={() => {
                if (!canDelete && !deleting) revealInvalidField();
              }}
            >
              <button
                type="button"
                aria-describedby={actionTipOpen && actionTooltipMessage ? actionTooltipId : undefined}
                onFocus={() => setActionTipOpen(true)}
                onBlur={() => setActionTipOpen(false)}
                onClick={() => void handleDelete()}
                disabled={!canDelete || deleting}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              >
                {deleting && <Icons.Loader2 size={16} className="animate-spin" />}
                {deleting ? "Deleting…" : draft ? "Discard draft" : "Delete permanently"}
              </button>
              <FieldValidationTooltip
                id={actionTooltipId}
                anchorRef={actionAnchorRef}
                message={actionTooltipMessage}
                open={actionTipOpen && Boolean(actionTooltipMessage)}
                tone="warning"
              />
            </span>
          )}
          {check.blockers && !eligible && onArchive && (
            <Button onClick={onArchive}><Icons.Archive size={16} />Archive project</Button>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        {!check.blockers && !check.error && (
          <div role="status" className="flex items-center gap-2 text-sm text-neutral-600">
            <Icons.Loader2 size={16} className="animate-spin" aria-hidden="true" />
            Checking whether this project can be deleted…
          </div>
        )}
        {check.error && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {check.error}
            {check.retryable && <Button variant="outline" onClick={retryCheck}>Try again</Button>}
          </div>
        )}
        {check.blockers && !eligible && (
          <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <h3 className="flex items-center gap-2 font-semibold">
              <Icons.AlertTriangle size={17} aria-hidden="true" />This project can’t be deleted
            </h3>
            <ul className="list-disc space-y-1 pl-5">
              {check.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
            </ul>
            <p>{projectStatus === "archived" ? "This project is already archived." : projectStatus === "completed" ? "Archive the project to keep its history." : "You can archive the project once it’s complete."}</p>
          </div>
        )}
        {eligible && <>
          {/* Warning Alert Card */}
          <div className="flex items-start gap-3.5 p-4 rounded-xl border bg-rose-50/80 border-rose-200 text-rose-950">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 bg-rose-100 text-rose-600">
              <Icons.AlertTriangle size={18} />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <h4 className="text-sm font-bold tracking-tight text-rose-900">
                This action cannot be undone.
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-rose-700">
                The project, milestones, and membership list will be permanently removed.
                Audit history is retained.
              </p>
            </div>
          </div>

          {/* Reason for deletion */}
          <div className="flex flex-col gap-2">
            <label htmlFor="delete-reason-input" className="text-xs font-semibold text-neutral-700">
              Reason for deletion <span className="text-rose-500 font-bold">*</span>
            </label>
            <BoundedTextarea
              ref={reasonRef}
              id="delete-reason-input"
              maxLength={INPUT_LIMITS.REASON}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onBlur={() => setReasonTouched(true)}
              rows={3}
              disabled={deleting}
              error={reasonError || undefined}
              hint={
                !reasonError
                  ? `Minimum ${MIN_DELETE_REASON_LENGTH} characters. Recorded in the permanent audit log.`
                  : undefined
              }
              placeholder={`Explain why this ${draft ? "draft" : "project"} must be permanently removed (minimum ${MIN_DELETE_REASON_LENGTH} characters)…`}
              className="w-full px-3.5 py-2.5 text-sm text-neutral-900 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--eflow-primary)]/20 focus:border-[var(--eflow-primary)] placeholder:text-neutral-400 transition-all resize-none"
            />
          </div>

          {/* Confirmation project title */}
          <div className="flex flex-col gap-2">
            <label htmlFor="delete-confirm-input" className="text-xs font-semibold text-neutral-700">
              Type <span className="px-1.5 py-0.5 rounded bg-neutral-100 border border-neutral-200 font-bold text-neutral-900">{projectTitle}</span> to confirm <span className="text-rose-500 font-bold">*</span>
            </label>
            <BoundedTextInput
              ref={confirmRef}
              id="delete-confirm-input"
              type="text"
              maxLength={Math.max(INPUT_LIMITS.TITLE, projectTitle.length)}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              onBlur={() => setConfirmTouched(true)}
              disabled={deleting}
              error={confirmError || undefined}
              hint={confirmValid ? "Project title confirmed." : undefined}
              placeholder={`Type "${projectTitle}" to confirm`}
              className="w-full px-3.5 py-2.5 text-sm text-neutral-900 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--eflow-primary)]/20 focus:border-[var(--eflow-primary)] placeholder:text-neutral-400 transition-all"
            />
          </div>
        </>}

        {/* Error message */}
        {error && !check.blockers?.length && (
          <div role="alert" className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            <Icons.AlertCircle size={15} className="shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
