import * as React from "react";
import { AlertTriangle, CheckCircle2, Send, Trash2 } from "lucide-react";
import type { CollaborationDraftStatus, CollaborationReadiness as Readiness } from "../types";

export function CollaborationActionRail({
  isOwner,
  status,
  readiness,
  busy,
  hasRevision,
  onRequestReview,
  onCommit,
  onDelete,
  ownerName,
  departmentOnly,
}: {
  isOwner: boolean;
  status: CollaborationDraftStatus;
  readiness: Readiness | null;
  busy: boolean;
  hasRevision: boolean;
  onRequestReview: () => Promise<void>;
  onCommit: () => Promise<void>;
  onDelete: (reason: string) => Promise<void>;
  ownerName?: string;
  departmentOnly: boolean;
}) {
  const [deleting, setDeleting] = React.useState(false);
  const [confirmingReview, setConfirmingReview] = React.useState(false);
  const [reason, setReason] = React.useState("");
  return <div className="space-y-3">
    {isOwner && !departmentOnly && status === "draft" && (!confirmingReview ? <button type="button" data-testid="request-collaboration-review" disabled={busy} onClick={() => setConfirmingReview(true)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-[12px] font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"><Send size={14} /> Request collaboration review</button> : <div className="rounded-xl border border-amber-200 bg-amber-50 p-3" role="alert"><div className="flex items-start gap-2"><AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-700" /><div><div className="text-[12px] font-semibold text-amber-900">Send this plan for review?</div><p className="mt-1 text-[11px] leading-relaxed text-amber-800">Participating offices will be notified and the draft will move into the review workflow.</p></div></div><div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setConfirmingReview(false)} className="rounded-lg px-3 py-2 text-[11px] font-medium text-neutral-600 hover:bg-white">Cancel</button><button type="button" data-testid="confirm-request-collaboration-review" disabled={busy} onClick={async () => { await onRequestReview(); setConfirmingReview(false); }} className="rounded-lg bg-amber-700 px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-50">Send for review</button></div></div>)}
    {isOwner && (departmentOnly || readiness?.ready) && status !== "committed" && status !== "archived" && <button type="button" data-testid="publish-proposal" disabled={busy || !hasRevision || !readiness?.ready} onClick={onCommit} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-[11px] font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"><CheckCircle2 size={13} /> {departmentOnly ? "Publish department proposal" : "Publish proposal"}</button>}
    {!departmentOnly && !isOwner && readiness?.ready && status !== "committed" && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-[10px] leading-relaxed text-emerald-800"><strong>Approved and ready to publish.</strong><br />Waiting for {ownerName || "the owning office"} Head or Assistant Head to publish the operational work.</div>}
    {status !== "committed" && <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-3 text-[10px] leading-relaxed text-blue-800"><strong>Proposed work is not assigned.</strong><br />{departmentOnly ? "Publishing creates the operational projects, tasks, and employee assignments for your department." : "No project, task, or employee assignment becomes operational until the collaboration approval gate succeeds."}</div>}
    {isOwner && status !== "committed" && (!deleting ? <button type="button" onClick={() => setDeleting(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-[12px] font-semibold text-red-700 hover:bg-red-50"><Trash2 size={14} /> Delete draft</button> : <div className="rounded-xl border border-red-200 bg-red-50 p-3" role="alert"><div className="flex items-center gap-2 text-[12px] font-semibold text-red-900"><Trash2 size={14} /> Soft-delete this draft</div><div className="mt-1 text-[12px] leading-relaxed text-red-700">The draft is removed from active workspaces and its governance history is retained. Restoration availability follows the configured retention policy; a reason is required for the governance audit.</div><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} placeholder="Reason for deletion" className="mt-2 w-full resize-none rounded-lg border border-red-200 bg-white px-3 py-2 text-[12px] outline-none" /><div className="mt-2 flex justify-end gap-2"><button type="button" onClick={() => { setDeleting(false); setReason(""); }} className="rounded-lg px-3 py-2 text-[12px] font-medium text-neutral-600 hover:bg-white">Cancel</button><button type="button" disabled={busy || !reason.trim()} onClick={() => onDelete(reason)} className="rounded-lg bg-red-600 px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-40">Delete draft</button></div></div>)}
  </div>;
}
