export type SealState =
  | "preparing"
  | "review_ready"
  | "queued"
  | "uploading"
  | "broadcast"
  | "confirming"
  | "confirmed"
  | "failed"
  | "simulation"
  | "cancelled";
export interface ArchiveFile {
  section: string;
  record_id: string;
  name: string;
  mime_type: string;
  sha256: string;
  size: number;
  path: string;
  publication_copy_of?: string;
  publication_copy_note?: string;
}
export interface ArchiveManifest {
  schema_version: 1;
  snapshot_id: string;
  project_id: string;
  version: number;
  prepared_at: string;
  source_hash: string;
  previous_certificate: string | null;
  correction_note?: string | null;
  records: Record<string, unknown>;
  files: ArchiveFile[];
}
export interface ProjectSeal {
  id: string;
  project_id: string;
  version: number;
  state: SealState;
  manifest: string | null;
  manifest_hash: string | null;
  approved_at: string | null;
  archive_uri: string | null;
  storage_kind: string | null;
  tx_hash: string | null;
  chain_id: number | null;
  contract_address: string | null;
  block_number: number | null;
  block_hash: string | null;
  publisher: string | null;
  error: string | null;
}
export interface SealStatus {
  project_id: string;
  completed_at: string | null;
  auto_archive_at: string | null;
  snapshot: ProjectSeal | null;
}
export interface SealConfiguration {
  mode: "simulation" | "live";
  chain_id: number;
  configured: boolean;
  worker_enabled: boolean;
  message: string;
}
export interface PublicCertificate {
  id: string;
  project_id: string;
  version: number;
  title: string;
  manifest_hash: string;
  archive_uri: string;
  storage_kind: string;
  chain_id: number;
  contract_address: string;
  tx_hash: string;
  block_number: number;
  block_hash: string;
  publisher: string;
  sealed_at: string;
  previous_id: string | null;
}
