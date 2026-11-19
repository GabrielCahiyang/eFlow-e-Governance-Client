import { useEffect, useState } from "react";
import { AlertTriangle, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { Modal } from "../../../components/ui/Modal";
import { formatManilaDate } from "../../../shared/calendarDisplay";
import {
  executeProjectPurge,
  fetchProjectPurgePreview,
  formatStorageBytes,
} from "./retentionService";
import type { PublicArchiveMode, RetentionPurgePreview } from "./types";

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

export function RetentionPurgeDialog({
  projectId,
  projectTitle,
  defaultMode,
  onClose,
  onPurged,
}: {
  projectId: string;
  projectTitle: string;
  defaultMode: PublicArchiveMode;
  onClose: () => void;
  onPurged: (message: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<PublicArchiveMode>(defaultMode);
  const [preview, setPreview] = useState<RetentionPurgePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmTitle, setConfirmTitle] = useState("");
  const [reason, setReason] = useState("");
  const [earlyOverride, setEarlyOverride] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void fetchProjectPurgePreview(projectId, mode)
      .then((data) => {
        if (active) setPreview(data);
      })
      .catch((caught) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Could not load purge impact preview.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId, mode]);

  const titleMatches =
    Boolean(preview?.projectTitle) &&
    confirmTitle.trim().toLowerCase() === (preview?.projectTitle || "").trim().toLowerCase();
  const reasonValid = reason.trim().length >= 5;
  const needsEarlyOverride = Boolean(preview && !preview.canPurgeNormally && preview.canPurgeWithEarlyOverride);
  const canExecute =
    Boolean(preview) &&
    !loading &&
    !submitting &&
    titleMatches &&
    reasonValid &&
    (preview!.canPurgeNormally || (needsEarlyOverride && earlyOverride));

  const handlePurge = async () => {
    if (!canExecute || !preview) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await executeProjectPurge(projectId, {
        confirm_title: confirmTitle.trim(),
        reason: reason.trim(),
        early_override: needsEarlyOverride && earlyOverride,
        public_mode: mode,
      });
      const deletedCount = result.storageDrain?.deleted ?? 0;
      await onPurged(
        `Purged "${preview.projectTitle}". ${deletedCount} storage files cleaned; audit, financial ledger, general journal, and Polygon Amoy proof trails were preserved.`,
      );
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not purge archived project.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen
      title={`Purge Archived Project — ${projectTitle}`}
      onClose={onClose}
      preventClose={submitting}
      width="max-w-3xl"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" disabled={submitting} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!canExecute}
            onClick={() => void handlePurge()}
          >
            <Trash2 size={14} aria-hidden="true" />
            {submitting
              ? "Purging…"
              : needsEarlyOverride
                ? "Confirm Early Purge"
                : "Permanently Purge Project"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {loading && (
          <p role="status" className="text-sm text-[var(--eflow-text-muted)]">
            Calculating purge impact and preserved trails…
          </p>
        )}

        {error && (
          <FeedbackState tone="error" title="Purge check error">
            {error}
          </FeedbackState>
        )}

        {preview && !loading && (
          <>
            <label className="block text-xs font-medium">
              Public Verification Archive Handling (EflowPublic)
              <select
                className="mt-1 block w-full rounded-md border border-[var(--eflow-border)] bg-[var(--eflow-surface)] px-3 py-2 text-sm"
                disabled={submitting}
                value={mode}
                onChange={(e) => setMode(e.target.value as PublicArchiveMode)}
              >
                <option value="keep_manifest_purge_files">
                  Keep public manifest JSON, purge receipt &amp; attachment files
                </option>
                <option value="purge_all_public">
                  Purge all public storage files, keep on-chain certificate &amp; hash proof only
                </option>
                <option value="keep_full_public">
                  Purge operational DB &amp; working buckets only (keep full public archive)
                </option>
              </select>
            </label>

            <div className="eflow-retention-split">
              <div className="eflow-retention-panel eflow-retention-panel--purge">
                <h4>Will Be Permanently Purged</h4>
                <dl className="eflow-retention-kv">
                  <dt>Tasks / Subtasks</dt>
                  <dd>
                    {preview.rowsToPurge.tasks ?? 0} / {preview.rowsToPurge.subtasks ?? 0}
                  </dd>
                  <dt>Fund Cash Requests / Liquidations</dt>
                  <dd>
                    {preview.rowsToPurge.cashRequests ?? 0} / {preview.rowsToPurge.liquidations ?? 0}
                  </dd>
                  <dt>Receipt Records</dt>
                  <dd>{preview.rowsToPurge.receipts ?? 0}</dd>
                  <dt>Attachments / Library Files</dt>
                  <dd>
                    {(preview.rowsToPurge.taskAttachments ?? 0) + (preview.rowsToPurge.libraryFiles ?? 0)}
                  </dd>
                  <dt>Comments / Chat Messages</dt>
                  <dd>
                    {(preview.rowsToPurge.comments ?? 0) + (preview.rowsToPurge.chatMessages ?? 0)}
                  </dd>
                  <dt>Storage Files Queued for Deletion</dt>
                  <dd>
                    {preview.storageSummary.totalFiles} ({formatStorageBytes(preview.storageSummary.totalBytes)})
                  </dd>
                </dl>
              </div>

              <div className="eflow-retention-panel eflow-retention-panel--keep">
                <h4 className="flex items-center gap-1.5">
                  <ShieldCheck size={14} aria-hidden="true" />
                  Preserved Permanently (Never Purged)
                </h4>
                <dl className="eflow-retention-kv">
                  <dt>Audit Trail Events</dt>
                  <dd>{preview.trailsPreserved.auditEvents ?? 0} (+1 disposition)</dd>
                  <dt>Budget Ledger Entries</dt>
                  <dd>{preview.trailsPreserved.budgetLedgerEntries ?? 0}</dd>
                  <dt>General Journal Entries</dt>
                  <dd>{preview.trailsPreserved.generalJournalEntries ?? 0}</dd>
                  <dt>Task Status / Field History Trails</dt>
                  <dd>
                    {(preview.trailsPreserved.taskStatusHistory ?? 0) +
                      (preview.trailsPreserved.projectFieldHistory ?? 0)}
                  </dd>
                  <dt>Work Tree / Library Event Trails</dt>
                  <dd>
                    {(preview.trailsPreserved.workTreeEvents ?? 0) +
                      (preview.trailsPreserved.projectLibraryEvents ?? 0)}
                  </dd>
                  <dt>Polygon Amoy Seal Certificates</dt>
                  <dd>{preview.trailsPreserved.blockchainCertificates ?? 0}</dd>
                </dl>
              </div>
            </div>

            {preview.fiscalRollup.length > 0 && (
              <div className="eflow-retention-panel">
                <h4>Fiscal Budget Totals Rolled Up (Zero Budget Drift)</h4>
                {preview.fiscalRollup.map((fy) => (
                  <p key={fy.fiscalBudgetId} className="m-0">
                    FY {fy.fiscalYear} ({fy.budgetStatus}): Committed {peso.format(fy.committedAmount)} · Spent{" "}
                    {peso.format(fy.spentAmount)} will remain locked into annual budget totals.
                  </p>
                ))}
              </div>
            )}

            {needsEarlyOverride && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 space-y-2">
                <p className="m-0 font-semibold flex items-center gap-1.5">
                  <AlertTriangle size={14} aria-hidden="true" />
                  Retention period has not expired yet (expires{" "}
                  {preview.expiresAt ? formatManilaDate(preview.expiresAt, "later") : "later"}).
                </p>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={submitting}
                    checked={earlyOverride}
                    onChange={(e) => setEarlyOverride(e.target.checked)}
                  />
                  <span>
                    Admin Early Purge Override — purge this sealed project ahead of its scheduled retention date
                    (audited as <code>admin_early_override</code>).
                  </span>
                </label>
              </div>
            )}

            <div className="space-y-3">
              <label className="block text-xs font-medium">
                Type exact project title to confirm: <strong>{preview.projectTitle}</strong>
                <input
                  type="text"
                  maxLength={200}
                  disabled={submitting}
                  value={confirmTitle}
                  placeholder={preview.projectTitle}
                  onChange={(e) => setConfirmTitle(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-[var(--eflow-border)] bg-[var(--eflow-surface)] px-3 py-2 text-sm"
                />
              </label>

              <label className="block text-xs font-medium">
                Disposition reason (required, recorded in permanent audit log)
                <textarea
                  rows={2}
                  maxLength={1000}
                  disabled={submitting}
                  value={reason}
                  placeholder="e.g. Retention period expired per COA schedule; blockchain proof verified on Polygon Amoy."
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-[var(--eflow-border)] bg-[var(--eflow-surface)] px-3 py-2 text-sm"
                />
              </label>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
