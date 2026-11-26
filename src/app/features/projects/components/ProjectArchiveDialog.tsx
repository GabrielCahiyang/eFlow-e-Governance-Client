import * as React from "react";
import * as Icons from "lucide-react";
import { Modal } from "../../../components/ui/Modal";
import { BoundedTextarea } from "../../../components/ui/BoundedInput";
import { FieldValidationTooltip } from "../../../components/ui/FieldValidationTooltip";
import { INPUT_LIMITS } from "../../../shared/inputLimits";
import { formatPeso, toCentavos } from "../../../shared/currency";
import { archiveProject, fetchProjectFinancialCloseoutSummary, restoreProject } from "../services/projectService";
import type { ProjectFinancialCloseoutSummary } from "../../project-setup";
import { ProjectFinancialCloseoutCard } from "./ProjectFinancialCloseoutCard";
import { useGuardedProjectDialog } from '../hooks/useGuardedProjectDialog';

export function ProjectArchiveDialog({
  projectId,
  projectTitle,
  isArchived,
  open,
  onClose,
  onSuccess,
}: {
  projectId: string;
  projectTitle: string;
  isArchived: boolean;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [actionTipOpen, setActionTipOpen] = React.useState(false);
  const [error, setError] = React.useState("");
  const [closeoutSummary, setCloseoutSummary] = React.useState<ProjectFinancialCloseoutSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = React.useState(false);
  const [summaryError, setSummaryError] = React.useState("");
  const inFlight = React.useRef(false);
  const actionAnchorRef = React.useRef<HTMLSpanElement | null>(null);
  const actionTooltipId = React.useId();
  const close = useGuardedProjectDialog({ open, dirty: Boolean(reason.trim()), pending: submitting, pendingCheck: () => inFlight.current, label: isArchived ? 'Restore project' : 'Archive project', onClose, onDiscard: () => setReason('') });

  React.useEffect(() => {
    if (!open) return;
    setReason("");
    setActionTipOpen(false);
    setError("");
    setSummaryError("");
    if (isArchived) {
      setCloseoutSummary(null);
      setSummaryLoading(false);
      return;
    }
    let active = true;
    setSummaryLoading(true);
    void fetchProjectFinancialCloseoutSummary(projectId)
      .then((summary) => {
        if (active) setCloseoutSummary(summary);
      })
      .catch((caught) => {
        if (active) {
          setCloseoutSummary(null);
          setSummaryError(
            caught instanceof Error ? caught.message : "Could not load project financial closeout summary.",
          );
        }
      })
      .finally(() => {
        if (active) setSummaryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, projectId, isArchived]);

  const unreturnedCents = !isArchived && closeoutSummary ? toCentavos(closeoutSummary.unreturnedBalance) : 0;
  const archiveBlockedByFunds = !isArchived && unreturnedCents > 0;
  const submitDisabled = submitting || (!isArchived && summaryLoading) || archiveBlockedByFunds;

  const handleSubmit = async () => {
    if (inFlight.current || submitDisabled) return;
    inFlight.current = true;
    setSubmitting(true);
    setActionTipOpen(false);
    setError("");
    try {
      if (isArchived) {
        await restoreProject(projectId, reason.trim() || "Restored from project workspace");
      } else {
        await archiveProject(projectId, reason.trim() || undefined);
      }
      onSuccess();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : `Failed to ${isArchived ? "restore" : "archive"} project.`,
      );
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const actionTooltipMessage = isArchived
    ? `Restores "${projectTitle}" to active status so team members can resume work.`
    : archiveBlockedByFunds && closeoutSummary
      ? `Blocked: Return ${formatPeso(closeoutSummary.unreturnedBalance)} in unused project funding to the Office Budget before archiving.`
      : `Warning: Moves "${projectTitle}" to Archived projects as read-only and seals its financial closeout record.`;

  return (
    <Modal
      isOpen={open}
      onClose={submitting ? () => {} : close}
      title={isArchived ? "Restore project" : "Archive project"}
      width={isArchived ? "max-w-lg" : "max-w-xl"}
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <button
            type="button"
            onClick={close}
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <span
            ref={actionAnchorRef}
            className="inline-flex"
            onMouseEnter={() => setActionTipOpen(true)}
            onMouseLeave={() => setActionTipOpen(false)}
          >
            <button
              type="button"
              aria-describedby={actionTipOpen && !submitting ? actionTooltipId : undefined}
              onFocus={() => setActionTipOpen(true)}
              onBlur={() => setActionTipOpen(false)}
              onClick={() => void handleSubmit()}
              disabled={submitDisabled}
              className={`inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                isArchived
                  ? "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
                  : "bg-amber-600 hover:bg-amber-700 active:bg-amber-800"
              }`}
            >
              {submitting && <Icons.Loader2 size={16} className="animate-spin" />}
              {isArchived ? (submitting ? "Restoring…" : "Restore project") : (submitting ? "Archiving…" : "Archive project")}
            </button>
            <FieldValidationTooltip
              id={actionTooltipId}
              anchorRef={actionAnchorRef}
              message={actionTooltipMessage}
              open={actionTipOpen && !submitting}
              tone={archiveBlockedByFunds ? "error" : "warning"}
            />
          </span>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Banner Alert Card */}
        <div
          className={`flex items-start gap-3.5 p-4 rounded-xl border ${
            isArchived
              ? "bg-blue-50/80 border-blue-200 text-blue-900"
              : "bg-amber-50/80 border-amber-200 text-amber-900"
          }`}
        >
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${
              isArchived ? "bg-blue-100 text-blue-600" : "bg-amber-100 text-amber-600"
            }`}
          >
            {isArchived ? <Icons.RotateCcw size={18} /> : <Icons.Archive size={18} />}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h4 className="text-sm font-bold tracking-tight">
              {isArchived ? `Restore "${projectTitle}"` : `Archive "${projectTitle}"`}
            </h4>
            <p className={`mt-1 text-xs leading-relaxed ${isArchived ? "text-blue-700" : "text-amber-800"}`}>
              {isArchived
                ? "Restoring will reactivate this project. Team members will be able to edit tasks, milestones, and project details again."
                : "Only completed projects with zero unreturned funding can be archived. This project will move to Archived projects as read-only with its financial closeout record and audit trail preserved."}
            </p>
          </div>
        </div>

        {!isArchived && (
          <ProjectFinancialCloseoutCard
            summary={closeoutSummary}
            loading={summaryLoading}
            error={summaryError}
            mode="archive"
          />
        )}

        {archiveBlockedByFunds && closeoutSummary && (
          <div role="alert" className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            <Icons.AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-500" />
            <span>
              {formatPeso(closeoutSummary.unreturnedBalance)} in unused project funding has not been returned to the Office Budget yet. Return all unused funds in the project Budget tab before archiving.
            </span>
          </div>
        )}

        {/* Reason field */}
        <div className="flex flex-col gap-2">
          <label htmlFor="archive-reason-input" className="text-xs font-semibold text-neutral-700">
            Reason for {isArchived ? "restoration" : "archiving"} <span className="font-normal text-neutral-400">(optional)</span>
          </label>
          <BoundedTextarea
            id="archive-reason-input"
            maxLength={INPUT_LIMITS.REASON}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            disabled={submitting}
            hint="Optional audit note recorded in the project history."
            placeholder={
              isArchived
                ? "Explain why this project is being reactivated (recorded in audit log)…"
                : "Explain why this project is being archived (recorded in audit log)…"
            }
            className="w-full px-3.5 py-2.5 text-sm text-neutral-900 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--eflow-primary)]/20 focus:border-[var(--eflow-primary)] placeholder:text-neutral-400 transition-all resize-none"
          />
        </div>

        {/* Error message */}
        {error && (
          <div role="alert" className="flex items-center gap-2 whitespace-pre-line p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            <Icons.AlertCircle size={15} className="shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
