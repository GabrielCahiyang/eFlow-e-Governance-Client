import { useState } from "react";
import { CheckCircle2, Send, Trash2 } from "lucide-react";
import { useConfirmation } from "../../../components/ui/useConfirmation";
import { canRequestCollaborationApproval } from "../selectors/reviewActions";
import type { CollaborationDraftStatus, CollaborationReadiness as Readiness } from "../types";

export function CollaborationActionRail({ isOwner, status, readiness, busy, hasRevision, onRequestReview, onCommit, onDelete, ownerName, departmentOnly }: {
  isOwner: boolean; status: CollaborationDraftStatus; readiness: Readiness | null; busy: boolean; hasRevision: boolean;
  onRequestReview: () => Promise<void>; onCommit: () => Promise<void>; onDelete: (reason: string) => Promise<void>;
  ownerName?: string; departmentOnly: boolean;
}) {
  const [deleting, setDeleting] = useState(false);
  const [confirmingReview, setConfirmingReview] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const { confirm, dialog } = useConfirmation();
  const locked = busy || pending;
  const unpublished = !["committed", "archived", "deleted"].includes(status);
  const run = async (operation: () => Promise<void>, onSuccess?: () => void) => {
    if (locked) return;
    setPending(true); setError("");
    try { await operation(); onSuccess?.(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "The action failed. Please retry."); }
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
    {isOwner && unpublished && (!deleting ? <button type="button" disabled={locked} onClick={() => setDeleting(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 p-3 text-xs font-semibold text-red-700"><Trash2 size={14} />Delete draft</button> :
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3"><strong className="text-xs">Delete this draft?</strong><p className="mt-1 text-xs">The draft will be removed from active workspaces. Its approval history will be retained. Enter a reason.</p><textarea aria-label="Reason for deletion" value={reason} onChange={(event) => setReason(event.target.value)} rows={2} className="mt-2 w-full rounded-lg border p-2 text-xs" /><div className="mt-2 flex justify-end gap-2"><button type="button" disabled={locked} onClick={() => { setDeleting(false); setReason(""); }}>Cancel</button><button type="button" disabled={locked || !reason.trim()} onClick={() => void run(() => onDelete(reason))} className="rounded-lg bg-red-600 px-3 py-2 text-xs text-white disabled:opacity-50">Delete draft</button></div></div>)}
  </div>;
}
