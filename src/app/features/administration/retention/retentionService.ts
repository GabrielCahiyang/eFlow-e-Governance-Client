import { jsonRequest, phase2Request } from "../../../shared/phase2Api";
import type {
  PublicArchiveMode,
  RetentionOverview,
  RetentionPolicy,
  RetentionPurgePreview,
} from "./types";

export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  project_auto_archive_days: 30,
  archive_retention_days: 1825,
  archive_retention_notice_days: 30,
  archive_retention_require_seal: true,
  archive_retention_auto_purge: false,
  archive_retention_public_mode: "keep_manifest_purge_files",
};

export function fetchRetentionOverview(): Promise<RetentionOverview> {
  return phase2Request<RetentionOverview>("/admin/retention/overview", {
    method: "GET",
  });
}

export function saveRetentionPolicy(
  policy: RetentionPolicy,
): Promise<RetentionPolicy> {
  return phase2Request<RetentionPolicy>(
    "/admin/retention/policy",
    jsonRequest("PUT", policy),
  );
}

export function fetchProjectPurgePreview(
  projectId: string,
  publicMode?: PublicArchiveMode,
): Promise<RetentionPurgePreview> {
  const qs = publicMode ? `?public_mode=${encodeURIComponent(publicMode)}` : "";
  return phase2Request<RetentionPurgePreview>(
    `/admin/retention/projects/${encodeURIComponent(projectId)}/preview${qs}`,
    { method: "GET" },
  );
}

export function updateProjectLegalHold(
  projectId: string,
  hold: boolean,
  reason: string,
): Promise<{ projectId: string; legalHold: boolean; saved: boolean }> {
  return phase2Request(
    `/admin/retention/projects/${encodeURIComponent(projectId)}/legal-hold`,
    jsonRequest("POST", { hold, reason }),
  );
}

export function executeProjectPurge(
  projectId: string,
  payload: {
    confirm_title: string;
    reason: string;
    early_override: boolean;
    public_mode?: PublicArchiveMode;
  },
): Promise<{
  disposition: Record<string, unknown>;
  storageDrain: { claimed: number; deleted: number; failed: number };
}> {
  return phase2Request(
    `/admin/retention/projects/${encodeURIComponent(projectId)}/purge`,
    jsonRequest("POST", payload),
  );
}

export function runRetentionMaintenanceNow(): Promise<{
  evaluation: {
    purged: number;
    notified: number;
    blockedUnsealed: number;
    autoPurgeEnabled: boolean;
  };
  storageDrain: { claimed: number; deleted: number; failed: number };
}> {
  return phase2Request("/admin/retention/run-maintenance", { method: "POST" });
}

export function fetchDispositionCertificate(
  dispositionId: string,
): Promise<Record<string, unknown>> {
  return phase2Request(
    `/admin/retention/dispositions/${encodeURIComponent(dispositionId)}/certificate`,
    { method: "GET" },
  );
}

export function formatStorageBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value >= 10 || idx === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[idx]}`;
}
