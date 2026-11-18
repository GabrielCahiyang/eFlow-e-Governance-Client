import { controlPanelFetch } from "../../../shared/controlPanelClient";

export type BackupMode = "operational" | "disaster_recovery";
export type BackupJobStatus = "queued" | "running" | "completed" | "failed";

export interface BackupPreflight {
  configured: boolean;
  database_url_configured: boolean;
  pg_dump_available: boolean;
  encryption_available: boolean;
  retention_hours: number;
  tables: string[];
  table_count: number;
  safe_excluded_data_tables: string[];
  discovery_error?: string | null;
}

export interface BackupJob {
  id: string;
  actor_id: string;
  actor_email: string;
  mode: BackupMode;
  status: BackupJobStatus;
  phase: string;
  progress: number;
  created_at: string;
  completed_at?: string | null;
  expires_at?: string | null;
  archive_name?: string | null;
  archive_size?: number | null;
  archive_sha256?: string | null;
  table_count: number;
  row_count: number;
  error?: string | null;
}

export interface BackupOverview {
  preflight: BackupPreflight;
  jobs: BackupJob[];
}

async function responseError(response: Response, fallback: string): Promise<Error> {
  const payload = await response.json().catch(() => null) as { detail?: string } | null;
  if (response.status === 404) {
    return new Error("The Backup route is not loaded by the running eFlow gateway. Restart the gateway once, then refresh readiness.");
  }
  return new Error(payload?.detail || fallback);
}

export async function fetchBackupOverview(): Promise<BackupOverview> {
  const response = await controlPanelFetch("admin/backups", {}, {
    retryOnEndpointChange: true,
    timeoutMs: 45_000,
  });
  if (!response.ok) throw await responseError(response, "Could not inspect backup readiness.");
  return response.json() as Promise<BackupOverview>;
}

export async function startBackup(input: {
  mode: BackupMode;
  confirmation: string;
  includeStorageManifest: boolean;
  passphrase?: string;
}): Promise<BackupJob> {
  const response = await controlPanelFetch("admin/backups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: input.mode,
      confirmation: input.confirmation,
      include_storage_manifest: input.includeStorageManifest,
      passphrase: input.passphrase || null,
    }),
  }, {
    retryOnEndpointChange: true,
    timeoutMs: 45_000,
  });
  if (!response.ok) throw await responseError(response, "Could not start the backup.");
  return response.json() as Promise<BackupJob>;
}

export async function fetchBackupJob(jobId: string): Promise<BackupJob> {
  const response = await controlPanelFetch(`admin/backups/${jobId}`, {}, {
    retryOnEndpointChange: true,
    timeoutMs: 30_000,
  });
  if (!response.ok) throw await responseError(response, "Could not refresh backup progress.");
  return response.json() as Promise<BackupJob>;
}

export async function deleteBackup(jobId: string): Promise<void> {
  const response = await controlPanelFetch(`admin/backups/${jobId}`, { method: "DELETE" }, {
    retryOnEndpointChange: true,
    timeoutMs: 30_000,
  });
  if (!response.ok) throw await responseError(response, "Could not delete the backup.");
}

export async function downloadBackup(job: BackupJob): Promise<void> {
  const response = await controlPanelFetch(`admin/backups/${job.id}/download`, {}, {
    retryOnEndpointChange: true,
    timeoutMs: 10 * 60_000,
  });
  if (!response.ok) throw await responseError(response, "Could not download the backup.");

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = job.archive_name || `eflow-backup-${job.id}.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
