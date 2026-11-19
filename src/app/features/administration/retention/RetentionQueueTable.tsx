import { Archive, Eye, Lock, ShieldAlert, Trash2, Unlock } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { StatusPill } from "../../../components/ui/workspace/StatusPill";
import { formatStorageBytes } from "./retentionService";
import { formatManilaDate } from "../../../shared/calendarDisplay";
import type { RetentionArchivedProject, RetentionProjectStatus } from "./types";

const STATUS_META: Record<
  RetentionProjectStatus,
  { label: string; tone: "neutral" | "info" | "positive" | "warning" | "negative" }
> = {
  on_hold: { label: "Legal Hold", tone: "warning" },
  blocked_unsealed: { label: "Unsealed — Blocked", tone: "negative" },
  ready_for_purge: { label: "Ready for purge", tone: "info" },
  expiring_soon: { label: "Expiring soon", tone: "warning" },
  retained: { label: "Retained", tone: "positive" },
};

function formatDate(iso?: string | null): string {
  return formatManilaDate(iso, "—");
}

export function RetentionQueueTable({
  projects,
  busy,
  onToggleHold,
  onPreviewPurge,
}: {
  projects: RetentionArchivedProject[];
  busy: boolean;
  onToggleHold: (project: RetentionArchivedProject) => void;
  onPreviewPurge: (project: RetentionArchivedProject) => void;
}) {
  return (
    <section className="eflow-admin-card space-y-3" aria-label="Archived projects retention queue">
      <div className="eflow-admin-card__title-row">
        <span className="eflow-admin-icon-chip" aria-hidden="true">
          <Archive size={16} />
        </span>
        <div>
          <h2>Archived Projects Retention Queue ({projects.length})</h2>
          <p className="eflow-admin-copy">
            Monitor retention countdowns, blockchain seal verification, storage footprint, and legal holds for
            all archived projects.
          </p>
        </div>
      </div>

      {!projects.length ? (
        <EmptyState
          size="compact"
          illustration="budget"
          title="No archived projects currently in retention."
          description="Archived projects appear here automatically once completed projects are archived."
        />
      ) : (
        <div className="eflow-retention-table-wrap" role="region" aria-label="Archived projects retention records" tabIndex={0}>
          <table className="eflow-retention-table">
            <thead>
              <tr>
                <th scope="col">Project &amp; Office</th>
                <th scope="col">Blockchain Seal</th>
                <th scope="col">Retention Schedule</th>
                <th scope="col">Status</th>
                <th scope="col">Footprint</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => {
                const meta = STATUS_META[project.status] ?? STATUS_META.retained;
                const canOpenPurge = project.status !== "on_hold" && project.status !== "blocked_unsealed";
                return (
                  <tr key={project.id}>
                    <td>
                      <strong>{project.title}</strong>
                      <span className="eflow-retention-sub">
                        {project.orgName} · Archived {formatDate(project.archivedAt)}
                      </span>
                      {project.legalHold.active && project.legalHold.reason && (
                        <span className="eflow-retention-sub">
                          Hold reason: {project.legalHold.reason}
                        </span>
                      )}
                    </td>
                    <td>
                      {project.isSealed ? (
                        <>
                          <StatusPill
                            label={`Sealed v${project.latestSealVersion ?? 1}`}
                            tone="positive"
                          />
                          <span className="eflow-retention-sub">
                            {formatDate(project.sealedAt)}
                            {project.blockNumber ? ` · Block #${project.blockNumber.toLocaleString()}` : ""}
                          </span>
                        </>
                      ) : (
                        <>
                          <StatusPill label="Not sealed" tone="negative" />
                          <span className="eflow-retention-sub">
                            <ShieldAlert size={11} className="inline mr-1" aria-hidden="true" />
                            Seal on Polygon Amoy first
                          </span>
                        </>
                      )}
                    </td>
                    <td>
                      {project.expiresAt ? (
                        <>
                          <strong>{formatDate(project.expiresAt)}</strong>
                          <span className="eflow-retention-sub">
                            {project.isExpired
                              ? `Expired (${Math.abs(project.daysRemaining ?? 0)}d past due)`
                              : `${project.daysRemaining ?? 0} days remaining`}
                          </span>
                        </>
                      ) : (
                        <span className="eflow-retention-sub">Waiting for blockchain seal</span>
                      )}
                    </td>
                    <td>
                      <StatusPill label={meta.label} tone={meta.tone} />
                    </td>
                    <td>
                      <span>
                        {project.taskCount} {project.taskCount === 1 ? "task" : "tasks"} ·{" "}
                        {project.receiptCount} {project.receiptCount === 1 ? "receipt" : "receipts"}
                      </span>
                      <span className="eflow-retention-sub">
                        {project.storageObjectCount} files · {formatStorageBytes(project.storageBytes)}
                      </span>
                    </td>
                    <td>
                      <div className="eflow-retention-actions">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => onToggleHold(project)}
                        >
                          {project.legalHold.active ? (
                            <>
                              <Unlock size={13} aria-hidden="true" />
                              Release Hold
                            </>
                          ) : (
                            <>
                              <Lock size={13} aria-hidden="true" />
                              Legal Hold
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant={project.isExpired && canOpenPurge ? "destructive" : "outline"}
                          size="sm"
                          disabled={busy || !canOpenPurge}
                          onClick={() => onPreviewPurge(project)}
                        >
                          {project.isExpired ? (
                            <>
                              <Trash2 size={13} aria-hidden="true" />
                              Review &amp; Purge
                            </>
                          ) : (
                            <>
                              <Eye size={13} aria-hidden="true" />
                              Preview Purge
                            </>
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
