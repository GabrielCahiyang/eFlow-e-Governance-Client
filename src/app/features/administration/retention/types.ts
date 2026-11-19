export type PublicArchiveMode =
  | "keep_manifest_purge_files"
  | "purge_all_public"
  | "keep_full_public";

export interface RetentionPolicy {
  project_auto_archive_days: number;
  archive_retention_days: number;
  archive_retention_notice_days: number;
  archive_retention_require_seal: boolean;
  archive_retention_auto_purge: boolean;
  archive_retention_public_mode: PublicArchiveMode;
}

export interface LegalHoldState {
  active: boolean;
  reason?: string | null;
  placedAt?: string | null;
  placedByName?: string | null;
}

export type RetentionProjectStatus =
  | "on_hold"
  | "blocked_unsealed"
  | "ready_for_purge"
  | "expiring_soon"
  | "retained";

export interface RetentionArchivedProject {
  id: string;
  title: string;
  orgId: string;
  orgName: string;
  completedAt?: string | null;
  archivedAt: string;
  isSealed: boolean;
  latestCertificateId?: string | null;
  latestSealVersion?: number | null;
  sealedAt?: string | null;
  txHash?: string | null;
  blockNumber?: number | null;
  manifestHash?: string | null;
  retentionAnchorAt?: string | null;
  expiresAt?: string | null;
  daysRemaining?: number | null;
  isExpired: boolean;
  legalHold: LegalHoldState;
  status: RetentionProjectStatus;
  taskCount: number;
  receiptCount: number;
  storageObjectCount: number;
  storageBytes: number;
}

export interface RetentionDisposition {
  id: string;
  projectId: string;
  projectTitle: string;
  orgId?: string | null;
  orgName: string;
  archivedAt?: string | null;
  sealedAt?: string | null;
  latestCertificateId?: string | null;
  manifestHash?: string | null;
  txHash?: string | null;
  blockNumber?: number | null;
  retentionDaysApplied: number;
  publicArchiveMode: PublicArchiveMode;
  purgeTrigger: "scheduled" | "admin_manual" | "admin_early_override";
  purgedByName: string;
  purgedAt: string;
  reason: string;
  rowCounts: Record<string, number>;
  preservedTrailCounts: Record<string, number>;
  storageObjectsQueued: number;
  storageBytesQueued: number;
  storagePending: number;
  storageDeleted: number;
  storageFailed: number;
}

export interface RetentionStorageQueueSummary {
  pending: number;
  deleted: number;
  failed: number;
  bytesReclaimed: number;
  bytesPending: number;
}

export interface RetentionOverview {
  policy: RetentionPolicy;
  archivedProjects: RetentionArchivedProject[];
  dispositions: RetentionDisposition[];
  storageQueue: RetentionStorageQueueSummary;
}

export interface RetentionPurgePreview {
  projectId: string;
  projectTitle: string;
  orgName: string;
  status: string;
  archivedAt?: string | null;
  isSealed: boolean;
  sealedAt?: string | null;
  txHash?: string | null;
  manifestHash?: string | null;
  legalHoldActive: boolean;
  legalHoldReason?: string | null;
  expiresAt?: string | null;
  isExpired: boolean;
  publicArchiveMode: PublicArchiveMode;
  canPurgeNormally: boolean;
  canPurgeWithEarlyOverride: boolean;
  rowsToPurge: Record<string, number>;
  trailsPreserved: Record<string, number>;
  storageSummary: {
    totalFiles: number;
    totalBytes: number;
    byBucket: Array<{ bucket: string; files: number; bytes: number }>;
  };
  fiscalRollup: Array<{
    fiscalBudgetId: string;
    fiscalYear: number;
    budgetStatus: string;
    committedAmount: number;
    spentAmount: number;
  }>;
}
