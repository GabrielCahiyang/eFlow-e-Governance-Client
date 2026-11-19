import { Download, FileCheck2 } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { StatusPill } from "../../../components/ui/workspace/StatusPill";
import { fetchDispositionCertificate, formatStorageBytes } from "./retentionService";
import type { RetentionDisposition } from "./types";

const MODE_LABELS: Record<string, string> = {
  keep_manifest_purge_files: "Manifest kept · Receipt binaries purged",
  purge_all_public: "All storage purged · On-chain hash kept",
  keep_full_public: "Internal purged · Public archive kept",
};

const TRIGGER_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  admin_manual: "Admin manual",
  admin_early_override: "Admin early override",
};

export function DispositionHistoryPanel({
  dispositions,
  onError,
}: {
  dispositions: RetentionDisposition[];
  onError: (message: string) => void;
}) {
  const downloadCertificate = async (item: RetentionDisposition) => {
    try {
      const detail = await fetchDispositionCertificate(item.id);
      const blob = new Blob([JSON.stringify(detail, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `eflow-disposition-${item.projectId.slice(0, 8)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Could not download disposition certificate.");
    }
  };

  return (
    <section className="eflow-admin-card space-y-3" aria-label="Purged project disposition ledger">
      <div className="eflow-admin-card__title-row">
        <span className="eflow-admin-icon-chip" aria-hidden="true">
          <FileCheck2 size={16} />
        </span>
        <div>
          <h2>Permanent Disposition Ledger ({dispositions.length})</h2>
          <p className="eflow-admin-copy">
            Immutable record of every purged project, reclaimed storage, preserved trails, and Polygon Amoy
            blockchain anchor.
          </p>
        </div>
      </div>

      {!dispositions.length ? (
        <EmptyState
          size="compact"
          illustration="budget"
          title="No projects have been purged yet."
          description="Completed disposition records and certificates will be listed permanently here."
        />
      ) : (
        <div className="eflow-retention-table-wrap" role="region" aria-label="Disposition ledger table" tabIndex={0}>
          <table className="eflow-retention-table">
            <thead>
              <tr>
                <th scope="col">Purged Project</th>
                <th scope="col">Blockchain Proof</th>
                <th scope="col">Storage Cleanup</th>
                <th scope="col">Executed By</th>
                <th scope="col">Certificate</th>
              </tr>
            </thead>
            <tbody>
              {dispositions.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.projectTitle}</strong>
                    <span className="eflow-retention-sub">
                      {item.orgName} · {MODE_LABELS[item.publicArchiveMode] ?? item.publicArchiveMode}
                    </span>
                    <span className="eflow-retention-sub">Reason: {item.reason}</span>
                  </td>
                  <td>
                    {item.txHash ? (
                      <>
                        <code className="text-xs">
                          {item.txHash.slice(0, 12)}…{item.txHash.slice(-8)}
                        </code>
                        <span className="eflow-retention-sub">
                          {item.blockNumber ? `Block #${item.blockNumber.toLocaleString()}` : "Confirmed"}
                        </span>
                      </>
                    ) : (
                      <span className="eflow-retention-sub">Unsealed override</span>
                    )}
                  </td>
                  <td>
                    <StatusPill
                      label={
                        item.storageFailed > 0
                          ? `${item.storageFailed} failed`
                          : item.storagePending > 0
                            ? `${item.storagePending} pending`
                            : `${item.storageDeleted} cleaned`
                      }
                      tone={item.storageFailed > 0 ? "negative" : item.storagePending > 0 ? "warning" : "positive"}
                    />
                    <span className="eflow-retention-sub">
                      {formatStorageBytes(item.storageBytesQueued)} across {item.storageObjectsQueued} files
                    </span>
                  </td>
                  <td>
                    <span>{item.purgedByName}</span>
                    <span className="eflow-retention-sub">
                      {TRIGGER_LABELS[item.purgeTrigger] ?? item.purgeTrigger} ·{" "}
                      {new Date(item.purgedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </td>
                  <td>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void downloadCertificate(item)}
                    >
                      <Download size={13} aria-hidden="true" />
                      JSON
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
