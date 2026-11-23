import { readableUiError } from '../../../shared/userFacingError';
import { useId, useRef, useState } from "react";
import { CheckCircle2, Send, Trash2 } from "lucide-react";
import { useConfirmation } from "../../../components/ui/useConfirmation";
import { BoundedTextarea } from "../../../components/ui/BoundedInput";
import { FieldValidationTooltip } from "../../../components/ui/FieldValidationTooltip";
import { INPUT_LIMITS } from "../../../shared/inputLimits";
import { canRequestCollaborationApproval } from "../selectors/reviewActions";
import type { CollaborationDraftStatus, CollaborationReadiness as Readiness } from "../types";

const MIN_DRAFT_DELETE_REASON = 5;

export function CollaborationActionRail({ isOwner, status, readiness, busy, hasRevision, onRequestReview, onCommit, onDelete, ownerName, departmentOnly }: {
  isOwner: boolean; status: CollaborationDraftStatus; readiness: Readiness | null; busy: boolean; hasRevision: boolean;
  onRequestReview: () => Promise<void>; onCommit: () => Promise<void>; onDelete: (reason: string) => Promise<void>;
  ownerName?: string; departmentOnly: boolean;
}) {
  const [deleting, setDeleting] = useState(false);
  const [confirmingReview, setConfirmingReview] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonTouched, setReasonTouched] = useState(false);
  const [deleteTipOpen, setDeleteTipOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const reasonRef = useRef<HTMLTextAreaElement | null>(null);
  const deleteAnchorRef = useRef<HTMLSpanElement | null>(null);
  const deleteTipId = useId();
  const { confirm, dialog } = useConfirmation();
  const locked = busy || pending;
  const unpublished = !["committed", "archived", "deleted"].includes(status);
  const trimmedReason = reason.trim();
  const missingChars = Math.max(0, MIN_DRAFT_DELETE_REASON - trimmedReason.length);
  const canDeleteDraft = trimmedReason.length >= MIN_DRAFT_DELETE_REASON;
  const reasonError = (reasonTouched || reason.length > 0) && !canDeleteDraft
    ? trimmedReason.length === 0
      ? `Reason for deletion is required (minimum ${MIN_DRAFT_DELETE_REASON} characters).`
      : `Enter at least ${MIN_DRAFT_DELETE_REASON} characters (${missingChars} more needed).`
    : "";
  const deleteTooltipMessage = locked
    ? ""
    : !canDeleteDraft
      ? trimmedReason.length === 0
        ? `Enter a deletion reason (minimum ${MIN_DRAFT_DELETE_REASON} characters) to delete this draft.`
        : `Deletion reason needs ${missingChars} more character${missingChars === 1 ? "" : "s"} (minimum ${MIN_DRAFT_DELETE_REASON}).`
      : "Warning: Removes this draft from active workspaces. Approval history is retained.";
  const run = async (operation: () => Promise<void>, onSuccess?: () => void) => {
    if (locked) return;
    setPending(true); setError("");
    try { await operation(); onSuccess?.(); }
    catch (failure) { setError(readableUiError(failure, "The action failed. Please retry.", 'write')); }
    finally { setPending(false); }
  };
  return <div className="space-y-3">
    {dialog}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>}
    {canRequestCollaborationApproval(status, isOwner, departmentOnly) && (!confirmingReview ?
      <button type="button" data-testid="request-collaboration-review" disabled={locked || !hasRevision} onClick={() => setConfirmingReview(true)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"><Send size={14} />{status === "draft" ? "Send approval requests" : "Resend approval requests"}</button> :
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3" role="alert">
        <strong className="text-xs">Send this plan for review?</strong><p className="mt-1 text-xs">Participating offices will be notified to review the latest saved plan and confirm their participation.</p>
        <div className="mt-3 flex justify-end gap-2"><button type="button" disabled={locked} onClick={() => setConfirmingReview(false)}>Cancel</button><button type="button" data-testid="confirm-request-collaboration-review" disabled={locked} onClick={() => void run(onRequestReview, () => setConfirmingReview(false))} className="rounded-lg bg-amber-700 px-3 py-2 text-xs text-white">Send for review</button></div>
      </div>)}
    {isOwner && unpublished && (departmentOnly || readiness?.ready) && <button type="button" data-testid="publish-proposal" disabled={locked || !hasRevision || !readiness?.ready} onClick={async () => {
      if (await confirm({ title: "Publish this work plan?", description: "This creates active projects, tasks, and member assignments from the approved plan.", actionLabel: "Publish work plan" })) await run(onCommit);
    }} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-semibold text-white disabled:opacity-50"><CheckCircle2 size={13} />{departmentOnly ? "Publish office proposal" : "Publish proposal"}</button>}
    {!departmentOnly && !isOwner && readiness?.ready && unpublished && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs">Approved and ready to publish. Waiting for {ownerName || "the lead office"} to publish the work plan.</p>}
    {unpublished && <p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800"><strong>Draft assignments are proposed.</strong><br />Projects and tasks become active when the lead office publishes the approved plan.</p>}
    {isOwner && unpublished && (!deleting ? <button type="button" disabled={locked} onClick={() => { setDeleting(true); setReasonTouched(false); }} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 p-3 text-xs font-semibold text-red-700"><Trash2 size={14} />Delete draft</button> :
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-2">
        <strong className="text-xs">Delete this draft?</strong>
        <p className="text-xs">The draft will be removed from active workspaces. Its approval history will be retained. Enter a reason (minimum {MIN_DRAFT_DELETE_REASON} characters).</p>
        <BoundedTextarea
          ref={reasonRef}
          aria-label="Reason for deletion"
          maxLength={INPUT_LIMITS.REASON}
          value={reason}
          disabled={locked}
          onBlur={() => setReasonTouched(true)}
          onChange={(event) => setReason(event.target.value)}
          rows={2}
          error={reasonError || undefined}
          placeholder={`Explain why this draft is being deleted (min. ${MIN_DRAFT_DELETE_REASON} characters)…`}
          className="w-full rounded-lg border border-border bg-white p-2 text-xs text-foreground"
        />
        <div className="flex justify-end gap-2">
          <button type="button" disabled={locked} onClick={() => { setDeleting(false); setReason(""); setReasonTouched(false); }}>Cancel</button>
          <span
            ref={deleteAnchorRef}
            className={`inline-flex ${locked || !canDeleteDraft ? "cursor-not-allowed" : ""}`}
            onMouseEnter={() => setDeleteTipOpen(true)}
            onMouseLeave={() => setDeleteTipOpen(false)}
            onClick={() => {
              if (!canDeleteDraft && !locked) {
                setReasonTouched(true);
                setDeleteTipOpen(true);
                reasonRef.current?.focus();
              }
            }}
          >
            <button
              type="button"
              aria-describedby={deleteTipOpen && deleteTooltipMessage ? deleteTipId : undefined}
              onFocus={() => setDeleteTipOpen(true)}
              onBlur={() => setDeleteTipOpen(false)}
              disabled={locked || !canDeleteDraft}
              onClick={() => void run(() => onDelete(trimmedReason))}
              className="rounded-lg bg-red-600 px-3 py-2 text-xs text-white disabled:opacity-50 disabled:pointer-events-none"
            >
              Delete draft
            </button>
            <FieldValidationTooltip
              id={deleteTipId}
              anchorRef={deleteAnchorRef}
              message={deleteTooltipMessage}
              open={deleteTipOpen && Boolean(deleteTooltipMessage)}
              tone="warning"
            />
          </span>
        </div>
      </div>)}
  </div>;
}
