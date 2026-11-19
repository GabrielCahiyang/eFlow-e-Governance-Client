import * as XLSX from "xlsx";
import { getPhilippineCalendarDate } from "../../../shared/calendarDates";
import {
  AiServiceUnavailableError,
  ControlPanelUnavailableError,
  controlPanelFetch,
} from "../../../shared/controlPanelClient";

export type BackupMode = "operational" | "disaster_recovery";
export type BackupScope = "full" | "important" | "selected";
export type BackupExportFormat = "archive" | "sql_dump";
export type BackupJobStatus = "queued" | "running" | "completed" | "failed";
export type TableExportFormat = "csv" | "xlsx" | "json" | "jsonl" | "sql";
export type TableExportScope = "page" | "filtered" | "all";

export interface BackupDomainInfo {
  id: string;
  label: string;
  description: string;
}

export interface BackupPreflight {
  configured: boolean;
  database_url_configured: boolean;
  pg_dump_available: boolean;
  encryption_available: boolean;
  retention_hours: number;
  tables: string[];
  table_count: number;
  important_tables?: string[];
  important_table_count?: number;
  domains?: BackupDomainInfo[];
  safe_excluded_data_tables: string[];
  discovery_error?: string | null;
}

export interface BackupJob {
  id: string;
  actor_id: string;
  actor_email: string;
  mode: BackupMode;
  scope?: BackupScope;
  export_format?: BackupExportFormat;
  selected_tables?: string[];
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

export interface BackupTableEntry {
  name: string;
  domain: string;
  domain_label: string;
  important: boolean;
  sensitive: boolean;
  column_count: number;
  has_date_column: boolean;
  row_count: number | null;
  api_readable: boolean;
}

export interface BackupTableListResponse {
  items: BackupTableEntry[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  domains: BackupDomainInfo[];
  important_count: number;
  total_discovered: number;
}

export interface BackupColumnSchema {
  name: string;
  type: string;
  format: string;
  is_date: boolean;
  is_text: boolean;
  is_uuid: boolean;
  is_bool: boolean;
  is_numeric: boolean;
  searchable: boolean;
  filterable: boolean;
  sortable: boolean;
  redacted: boolean;
}

export interface BackupTableRowsResponse {
  name: string;
  domain: string;
  domain_label: string;
  important: boolean;
  sensitive: boolean;
  columns: BackupColumnSchema[];
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  sort_by: string | null;
  sort_dir: "asc" | "desc";
}

export interface TableQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string | null;
  sortDir?: "asc" | "desc";
  filterCol?: string;
  filterVal?: string;
  dateCol?: string;
  dateFrom?: string;
  dateTo?: string;
}

export class BackupServiceError extends Error {
  status?: number;
  gatewayUnavailable: boolean;

  constructor(message: string, options: { status?: number; gatewayUnavailable?: boolean } = {}) {
    super(message);
    this.name = "BackupServiceError";
    this.status = options.status;
    this.gatewayUnavailable = Boolean(options.gatewayUnavailable);
  }
}

export function isBackupGatewayUnavailableError(error: unknown): boolean {
  if (error instanceof BackupServiceError) return error.gatewayUnavailable;
  if (
    error instanceof AiServiceUnavailableError ||
    error instanceof ControlPanelUnavailableError
  ) {
    return true;
  }
  if (error instanceof TypeError) return true;
  if (error instanceof Error) {
    return /gateway|route is not loaded|unreachable|offline|could not inspect backup readiness/i.test(
      error.message,
    );
  }
  return false;
}

async function responseError(response: Response, fallback: string): Promise<BackupServiceError> {
  const payload = (await response.json().catch(() => null)) as {
    detail?: string;
    code?: string;
  } | null;
  if (response.status === 404) {
    return new BackupServiceError(
      payload?.detail ||
        "The Backup route is not loaded by the running eFlow gateway. Restart the gateway once, then refresh readiness.",
      { status: 404, gatewayUnavailable: true },
    );
  }
  const gatewayUnavailable =
    response.status >= 500 || payload?.code === "gateway_offline";
  return new BackupServiceError(payload?.detail || fallback, {
    status: response.status,
    gatewayUnavailable,
  });
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function sanitizeSpreadsheetCell(value: unknown): string | number | boolean {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return value;
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (
    text.length > 0 &&
    (/^[=+@]/.test(text) || (/^-/.test(text) && !/^-\d+(?:\.\d+)?$/.test(text)))
  ) {
    return `'${text}`;
  }
  return text.length > 32_000 ? `${text.slice(0, 32_000)}…` : text;
}

function buildTableQuerySearchParams(params: TableQueryParams): URLSearchParams {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("page_size", String(params.pageSize));
  if (params.search?.trim()) qs.set("search", params.search.trim());
  if (params.sortBy) qs.set("sort_by", params.sortBy);
  if (params.sortDir) qs.set("sort_dir", params.sortDir);
  if (params.filterCol && params.filterVal?.trim()) {
    qs.set("filter_col", params.filterCol);
    qs.set("filter_val", params.filterVal.trim());
  }
  if (params.dateCol) qs.set("date_col", params.dateCol);
  if (params.dateFrom) qs.set("date_from", params.dateFrom);
  if (params.dateTo) qs.set("date_to", params.dateTo);
  return qs;
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
  scope?: BackupScope;
  exportFormat?: BackupExportFormat;
  tables?: string[];
}): Promise<BackupJob> {
  const response = await controlPanelFetch("admin/backups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: input.mode,
      confirmation: input.confirmation,
      include_storage_manifest: input.includeStorageManifest,
      passphrase: input.passphrase || null,
      scope: input.scope || "full",
      export_format: input.exportFormat || "archive",
      tables: input.tables || [],
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
  const fallbackExt = job.export_format === "sql_dump" && job.mode === "operational" ? "sql" : "zip";
  triggerBlobDownload(blob, job.archive_name || `eflow-backup-${job.id}.${fallbackExt}`);
}

export async function fetchBackupTables(input: {
  search?: string;
  category?: string;
  importance?: string;
  page?: number;
  pageSize?: number;
  includeCounts?: boolean;
} = {}): Promise<BackupTableListResponse> {
  const qs = new URLSearchParams();
  if (input.search?.trim()) qs.set("search", input.search.trim());
  if (input.category && input.category !== "all") qs.set("category", input.category);
  if (input.importance && input.importance !== "all") qs.set("importance", input.importance);
  qs.set("page", String(input.page ?? 1));
  qs.set("page_size", String(input.pageSize ?? 15));
  qs.set("include_counts", String(input.includeCounts ?? true));

  const response = await controlPanelFetch(`admin/backups/tables?${qs.toString()}`, {}, {
    retryOnEndpointChange: true,
    timeoutMs: 45_000,
  });
  if (!response.ok) throw await responseError(response, "Could not load database tables.");
  return response.json() as Promise<BackupTableListResponse>;
}

export async function fetchTableRows(
  tableName: string,
  params: TableQueryParams = {},
): Promise<BackupTableRowsResponse> {
  const qs = buildTableQuerySearchParams(params);
  const response = await controlPanelFetch(
    `admin/backups/tables/${encodeURIComponent(tableName)}/rows?${qs.toString()}`,
    {},
    {
      retryOnEndpointChange: true,
      timeoutMs: 45_000,
    },
  );
  if (!response.ok) throw await responseError(response, `Could not browse rows in "${tableName}".`);
  return response.json() as Promise<BackupTableRowsResponse>;
}

export async function downloadTableExport(
  tableName: string,
  format: TableExportFormat,
  scope: TableExportScope,
  params: TableQueryParams = {},
): Promise<{ filename: string; rowCount: number; truncated: boolean }> {
  const qs = buildTableQuerySearchParams(params);
  qs.set("format", format === "xlsx" ? "json" : format);
  qs.set("scope", scope);

  const response = await controlPanelFetch(
    `admin/backups/tables/${encodeURIComponent(tableName)}/export?${qs.toString()}`,
    {},
    {
      retryOnEndpointChange: true,
      timeoutMs: 120_000,
    },
  );
  if (!response.ok) throw await responseError(response, `Could not export "${tableName}".`);

  const rowCount = Number(response.headers.get("X-Export-Row-Count") || "0");
  const truncated = response.headers.get("X-Export-Truncated") === "true";

  if (format === "xlsx") {
    const payload = (await response.json()) as {
      table: string;
      rows: Record<string, unknown>[];
      row_count: number;
    };
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    const safeRows = rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, sanitizeSpreadsheetCell(value)]),
      ),
    );
    const worksheet = XLSX.utils.json_to_sheet(
      safeRows.length > 0 ? safeRows : [{ info: `No rows exported from ${tableName}` }],
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, tableName.slice(0, 31));
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    const filename = `eflow-${tableName}-${scope}-${getPhilippineCalendarDate()}.xlsx`;
    triggerBlobDownload(
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      filename,
    );
    return { filename, rowCount: payload.row_count ?? rows.length, truncated };
  }

  const disposition = response.headers.get("Content-Disposition") || "";
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const filename =
    match?.[1] || `eflow-${tableName}-${scope}-${getPhilippineCalendarDate()}.${format}`;
  const blob = await response.blob();
  triggerBlobDownload(blob, filename);
  return { filename, rowCount, truncated };
}

export function exportBackupJobsHistory(
  jobs: BackupJob[],
  format: "csv" | "json" | "xlsx",
): string {
  const dateStamp = getPhilippineCalendarDate();
  if (format === "json") {
    const filename = `eflow-backup-history-${dateStamp}.json`;
    triggerBlobDownload(
      new Blob([JSON.stringify({ exported_at: new Date().toISOString(), jobs }, null, 2)], {
        type: "application/json;charset=utf-8",
      }),
      filename,
    );
    return filename;
  }

  const records = jobs.map((job) => ({
    JobID: job.id,
    ArchiveName: job.archive_name || "",
    Mode: job.mode,
    Scope: job.scope || "full",
    Format: job.export_format || "archive",
    Status: job.status,
    Phase: job.phase,
    Tables: job.table_count,
    Rows: job.row_count,
    SizeBytes: job.archive_size ?? "",
    SHA256: job.archive_sha256 || "",
    CreatedAt: job.created_at,
    CompletedAt: job.completed_at || "",
    ExpiresAt: job.expires_at || "",
    Error: job.error || "",
  }));

  if (format === "xlsx") {
    const safeRecords = records.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, sanitizeSpreadsheetCell(value)]),
      ),
    );
    const worksheet = XLSX.utils.json_to_sheet(safeRecords);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Backup History");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    const filename = `eflow-backup-history-${dateStamp}.xlsx`;
    triggerBlobDownload(
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      filename,
    );
    return filename;
  }

  const headers = Object.keys(records[0] || { JobID: "" });
  const lines = [
    headers.join(","),
    ...records.map((row) =>
      headers
        .map((key) => {
          const cell = String(sanitizeSpreadsheetCell((row as Record<string, unknown>)[key]));
          return /[",\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
        })
        .join(","),
    ),
  ];
  const filename = `eflow-backup-history-${dateStamp}.csv`;
  triggerBlobDownload(
    new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" }),
    filename,
  );
  return filename;
}
