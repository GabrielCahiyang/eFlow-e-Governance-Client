import { useCallback, useEffect, useState } from "react";
import { Play, RefreshCw } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { DecisionModal } from "../../../components/ui/DecisionModal";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { useToast } from "../../../components/ui/Toast";
import { WorkspaceHeader } from "../../../components/ui/workspace";
import { INPUT_LIMITS } from "../../../shared/inputLimits";
import { DispositionHistoryPanel } from "./DispositionHistoryPanel";
import { RetentionPolicyCard } from "./RetentionPolicyCard";
import { RetentionPurgeDialog } from "./RetentionPurgeDialog";
import { RetentionQueueTable } from "./RetentionQueueTable";
import {
  DEFAULT_RETENTION_POLICY,
  fetchRetentionOverview,
  formatStorageBytes,
  runRetentionMaintenanceNow,
  saveRetentionPolicy,
  updateProjectLegalHold,
} from "./retentionService";
import type { RetentionArchivedProject, RetentionOverview, RetentionPolicy } from "./types";
import "./retentionMaintenance.css";

export function ArchiveRetentionMaintenance({ embedded = false }: { embedded?: boolean }) {
  const { toast } = useToast();
  const [overview, setOverview] = useState<RetentionOverview | null>(null);
  const [draft, setDraft] = useState<RetentionPolicy>(DEFAULT_RETENTION_POLICY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [runningMaintenance, setRunningMaintenance] = useState(false);

  const [holdTarget, setHoldTarget] = useState<RetentionArchivedProject | null>(null);
  const [holdReason, setHoldReason] = useState("");
  const [holdBusy, setHoldBusy] = useState(false);
  const [holdError, setHoldError] = useState("");

  const [purgeTarget, setPurgeTarget] = useState<RetentionArchivedProject | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchRetentionOverview();
      setOverview(data);
      setDraft(data.policy ?? DEFAULT_RETENTION_POLICY);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not load archive retention maintenance data.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const policyDirty =
    Boolean(overview) &&
    JSON.stringify(draft) !== JSON.stringify(overview!.policy ?? DEFAULT_RETENTION_POLICY);

  const handleSavePolicy = async () => {
    setSavingPolicy(true);
    setError("");
    setNotice("");
    try {
      const saved = await saveRetentionPolicy(draft);
      setDraft(saved);
      toast("Archive retention policy saved.", "success");
      setNotice("Retention policy updated and logged in the audit trail.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save retention policy.");
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleRunMaintenance = async () => {
    setRunningMaintenance(true);
    setError("");
    setNotice("");
    try {
      const res = await runRetentionMaintenanceNow();
      const summary = `Retention check complete: ${res.evaluation.purged} auto-purged, ${res.evaluation.notified} alerts sent, ${res.storageDrain.deleted} storage files deleted${res.storageDrain.failed ? `, ${res.storageDrain.failed} storage retries failed` : ""}.`;
      toast("Retention maintenance run finished.", "success");
      setNotice(summary);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not run retention maintenance.");
    } finally {
      setRunningMaintenance(false);
    }
  };

  const handleConfirmHold = async () => {
    if (!holdTarget || holdReason.trim().length < 5) return;
    setHoldBusy(true);
    setHoldError("");
    const nextHold = !holdTarget.legalHold.active;
    try {
      await updateProjectLegalHold(holdTarget.id, nextHold, holdReason.trim());
      toast(nextHold ? "Legal hold placed on archived project." : "Legal hold released.", "success");
      setHoldTarget(null);
      setHoldReason("");
      await load();
    } catch (caught) {
      setHoldError(caught instanceof Error ? caught.message : "Could not update legal hold.");
    } finally {
      setHoldBusy(false);
    }
  };

  const readyCount = (overview?.archivedProjects ?? []).filter((p) => p.status === "ready_for_purge").length;
  const holdCount = (overview?.archivedProjects ?? []).filter((p) => p.legalHold.active).length;

  return (
    <div className="eflow-retention">
      {!embedded && (
        <WorkspaceHeader
          title="Archive & Retention Maintenance"
          description="Manage retention timelines for archived & blockchain-sealed projects, legal holds, and storage cleanup while keeping all audit and accounting trails forever."
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-xs text-[var(--eflow-text-muted)]">
          Daily scheduler runs at 3:00 AM PHT. Storage cleanup runs automatically via the control gateway.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || runningMaintenance}
            onClick={() => void load()}
          >
            <RefreshCw size={14} aria-hidden="true" />
            Refresh
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={loading || runningMaintenance}
            onClick={() => void handleRunMaintenance()}
          >
            <Play size={14} aria-hidden="true" />
            {runningMaintenance ? "Running check…" : "Run retention & storage cleanup now"}
          </Button>
        </div>
      </div>

      {error && (
        <FeedbackState tone="error" title="Archive retention notice">
          {error}
        </FeedbackState>
      )}
      {notice && (
        <FeedbackState tone="success" title="Maintenance updated">
          {notice}
        </FeedbackState>
      )}

      {loading && !overview ? (
        <div className="eflow-admin-card" role="status">
          <p className="m-0 text-sm text-[var(--eflow-text-muted)]">
            Loading archive retention status…
          </p>
        </div>
      ) : (
        overview && (
          <>
            <div className="eflow-retention-metrics" aria-label="Retention summary metrics">
              <div>
                <span>Archived in Queue</span>
                <strong>{overview.archivedProjects.length}</strong>
              </div>
              <div>
                <span>Ready for Purge</span>
                <strong>{readyCount}</strong>
              </div>
              <div>
                <span>Under Legal Hold</span>
                <strong>{holdCount}</strong>
              </div>
              <div>
                <span>Purged (Trails Kept)</span>
                <strong>{overview.dispositions.length}</strong>
              </div>
              <div>
                <span>Storage Reclaimed</span>
                <strong>{formatStorageBytes(overview.storageQueue.bytesReclaimed)}</strong>
              </div>
              <div>
                <span>Storage Queue Pending / Failed</span>
                <strong>
                  {overview.storageQueue.pending} / {overview.storageQueue.failed}
                </strong>
              </div>
            </div>

            <RetentionPolicyCard
              draft={draft}
              dirty={policyDirty}
              saving={savingPolicy}
              onChange={setDraft}
              onSave={() => void handleSavePolicy()}
              onReset={() => setDraft(overview.policy ?? DEFAULT_RETENTION_POLICY)}
            />

            <RetentionQueueTable
              projects={overview.archivedProjects}
              busy={savingPolicy || runningMaintenance || holdBusy}
              onToggleHold={(project) => {
                setHoldTarget(project);
                setHoldReason("");
                setHoldError("");
              }}
              onPreviewPurge={(project) => setPurgeTarget(project)}
            />

            <DispositionHistoryPanel
              dispositions={overview.dispositions}
              onError={(msg) => setError(msg)}
            />
          </>
        )
      )}

      {holdTarget && (
        <DecisionModal
          title={holdTarget.legalHold.active ? "Release legal hold?" : "Place legal hold?"}
          description={
            holdTarget.legalHold.active ? (
              <>
                Releasing the hold on <strong>{holdTarget.title}</strong> restores its normal retention
                schedule. This change is permanently logged in the audit trail.
              </>
            ) : (
              <>
                Placing a legal hold on <strong>{holdTarget.title}</strong> freezes both automatic and manual
                purging until an Admin explicitly releases it (e.g. during a COA audit inquiry).
              </>
            )
          }
          decision={holdTarget.legalHold.active ? "changes" : "approve"}
          reason={holdReason}
          onReasonChange={setHoldReason}
          reasonLabel={
            holdTarget.legalHold.active
              ? "Release justification (minimum 5 characters)"
              : "Legal hold reason (minimum 5 characters)"
          }
          requireReason
          minReasonLength={5}
          maxReasonLength={INPUT_LIMITS.REASON}
          busy={holdBusy}
          warningTooltip={
            holdTarget.legalHold.active
              ? "Releasing this legal hold restores scheduled and manual purging for this archived project."
              : "Places a legal hold freezing automatic and manual purging until an Admin explicitly releases it."
          }
          error={holdError}
          confirmLabel={holdTarget.legalHold.active ? "Release Legal Hold" : "Place Legal Hold"}
          onCancel={() => setHoldTarget(null)}
          onConfirm={() => void handleConfirmHold()}
        />
      )}

      {purgeTarget && (
        <RetentionPurgeDialog
          projectId={purgeTarget.id}
          projectTitle={purgeTarget.title}
          defaultMode={draft.archive_retention_public_mode}
          onClose={() => setPurgeTarget(null)}
          onPurged={async (message) => {
            toast("Archived project purged. Permanent trails preserved.", "success");
            setNotice(message);
            await load();
          }}
        />
      )}
    </div>
  );
}
