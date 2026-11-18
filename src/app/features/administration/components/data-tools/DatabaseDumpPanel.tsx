import { useMemo, useState } from "react";
import {
  Archive,
  Download,
  FileCode2,
  HardDriveDownload,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

import { Button } from "../../../../components/ui/button";
import { DateInput } from "../../../../components/ui/DateInput";
import {
  Card,
  SearchInput,
  WButton,
  WSelect,
} from "../../../../components/workflow/primitives";
import { requestNavigation } from "../../../../shared/navigationGuard";
import {
  DEFAULT_BACKUP_JOB_FILTERS,
  IMPORTANT_DATA_PRESETS,
  filterBackupJobs,
  hasBackupJobFilters,
  paginateItems,
  type BackupJobFilters,
} from "../../selectors/backupSelectors";
import {
  exportBackupJobsHistory,
  type BackupExportFormat,
  type BackupJob,
  type BackupMode,
  type BackupOverview,
  type BackupScope,
} from "../../services/backupService";
import { BackupJobCard } from "./BackupJobCard";
import { PaginationBar } from "./PaginationBar";

export function DatabaseDumpPanel({
  overview,
  refreshing,
  busy,
  uncertain,
  activeJob,
  mode,
  onModeChange,
  scope,
  onScopeChange,
  exportFormat,
  onExportFormatChange,
  selectedTables,
  onSelectedTablesChange,
  confirmation,
  onConfirmationChange,
  passphrase,
  onPassphraseChange,
  repeatPassphrase,
  onRepeatPassphraseChange,
  includeStorageManifest,
  onIncludeStorageManifestChange,
  reauthPassword,
  onReauthPasswordChange,
  expectedConfirmation,
  canStart,
  onStart,
  onDownload,
  onDelete,
  onResetDraft,
  onOpenTablesCatalog,
  onNotify,
}: {
  overview: BackupOverview | null;
  refreshing: boolean;
  busy: boolean;
  uncertain: boolean;
  activeJob: BackupJob | undefined;
  mode: BackupMode;
  onModeChange: (mode: BackupMode) => void;
  scope: BackupScope;
  onScopeChange: (scope: BackupScope) => void;
  exportFormat: BackupExportFormat;
  onExportFormatChange: (format: BackupExportFormat) => void;
  selectedTables: string[];
  onSelectedTablesChange: (tables: string[]) => void;
  confirmation: string;
  onConfirmationChange: (value: string) => void;
  passphrase: string;
  onPassphraseChange: (value: string) => void;
  repeatPassphrase: string;
  onRepeatPassphraseChange: (value: string) => void;
  includeStorageManifest: boolean;
  onIncludeStorageManifestChange: (value: boolean) => void;
  reauthPassword: string;
  onReauthPasswordChange: (value: string) => void;
  expectedConfirmation: string;
  canStart: boolean;
  onStart: () => void;
  onDownload: (job: BackupJob) => void;
  onDelete: (job: BackupJob) => void;
  onResetDraft: () => void;
  onOpenTablesCatalog: () => void;
  onNotify: (message: string, tone?: "success" | "error") => void;
}) {
  const [tableFilter, setTableFilter] = useState("");
  const [jobFilters, setJobFilters] = useState<BackupJobFilters>(
    DEFAULT_BACKUP_JOB_FILTERS,
  );
  const [jobsPage, setJobsPage] = useState(1);
  const [jobsPageSize, setJobsPageSize] = useState(5);

  const availableTables = useMemo(() => {
    const raw = overview?.preflight.tables || [];
    const sensitive = new Set(overview?.preflight.safe_excluded_data_tables || []);
    return mode === "operational"
      ? raw.filter((table) => !sensitive.has(table))
      : raw;
  }, [overview?.preflight.tables, overview?.preflight.safe_excluded_data_tables, mode]);

  const filteredTableOptions = useMemo(() => {
    const needle = tableFilter.trim().toLowerCase();
    if (!needle) return availableTables.slice(0, 60);
    return availableTables
      .filter((table) => table.toLowerCase().includes(needle))
      .slice(0, 60);
  }, [availableTables, tableFilter]);

  const allJobs = overview?.jobs || [];
  const filteredJobs = useMemo(
    () => filterBackupJobs(allJobs, jobFilters),
    [allJobs, jobFilters],
  );
  const pagedJobs = useMemo(
    () => paginateItems(filteredJobs, jobsPage, jobsPageSize),
    [filteredJobs, jobsPage, jobsPageSize],
  );

  const toggleTableSelection = (tableName: string) => {
    if (selectedTables.includes(tableName)) {
      onSelectedTablesChange(selectedTables.filter((t) => t !== tableName));
    } else {
      onSelectedTablesChange([...selectedTables, tableName].sort());
    }
  };

  const applyPresetTables = (presetTables: string[]) => {
    const valid = new Set(availableTables);
    const matched = presetTables.filter((t) => valid.has(t));
    const merged = Array.from(new Set([...selectedTables, ...matched])).sort();
    onSelectedTablesChange(merged);
  };

  const updateJobFilter = <K extends keyof BackupJobFilters>(
    key: K,
    value: BackupJobFilters[K],
  ) => {
    setJobFilters((current) => ({ ...current, [key]: value }));
    setJobsPage(1);
  };

  const handleExportHistory = (format: "csv" | "xlsx" | "json") => {
    if (!filteredJobs.length) return;
    const filename = exportBackupJobsHistory(filteredJobs, format);
    onNotify(`Exported ${filteredJobs.length} backup job receipt(s) to ${filename}.`, "success");
  };

  const primaryButtonLabel = activeJob
    ? "Backup already running"
    : mode === "operational" && exportFormat === "archive"
      ? "Create safe backup"
      : mode === "operational" && exportFormat === "sql_dump"
        ? "Create SQL DB dump"
        : exportFormat === "sql_dump"
          ? "Create encrypted SQL dump"
          : "Create encrypted full backup";

  const importantCount =
    overview?.preflight.important_table_count ??
    overview?.preflight.important_tables?.length ??
    0;

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="min-w-0 space-y-4">
        <Card
          title="Create backup"
          subtitle="Reads and packages data safely without modifying live records."
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">
                  Backup type
                </label>
                <WSelect
                  ariaLabel="Backup type"
                  value={mode}
                  onChange={(value) => {
                    void requestNavigation(() => {
                      onModeChange(value as BackupMode);
                      onResetDraft();
                    });
                  }}
                  options={[
                    {
                      value: "operational",
                      label: "Standard backup (operational)",
                    },
                    {
                      value: "disaster_recovery",
                      label: "Encrypted full recovery",
                    },
                  ]}
                  className="w-full !min-w-0"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">
                  Output format
                </label>
                <WSelect
                  ariaLabel="Backup output format"
                  value={exportFormat}
                  onChange={(value) =>
                    onExportFormatChange(value as BackupExportFormat)
                  }
                  options={[
                    {
                      value: "archive",
                      label: "Backup package (.zip)",
                    },
                    {
                      value: "sql_dump",
                      label: "PostgreSQL dump (.sql)",
                    },
                  ]}
                  className="w-full !min-w-0"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">
                Data scope
              </label>
              <WSelect
                ariaLabel="Backup data scope"
                value={scope}
                onChange={(value) => onScopeChange(value as BackupScope)}
                options={[
                  {
                    value: "full",
                    label: `Full eFlow database (${overview?.preflight.table_count || 0} tables)`,
                  },
                  {
                    value: "important",
                    label: `Key operational data (${importantCount || "core"} tables)`,
                  },
                  {
                    value: "selected",
                    label: `Selected tables (${selectedTables.length})`,
                  },
                ]}
                className="w-full !min-w-0"
              />
            </div>

            {scope === "selected" && (
              <div className="space-y-2.5 rounded-xl border border-neutral-200 bg-neutral-50/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-neutral-800">
                    Select important presets or individual tables ({selectedTables.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={onOpenTablesCatalog}
                    >
                      Pick in Table Catalog
                    </Button>
                    {selectedTables.length > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => onSelectedTablesChange([])}
                      >
                        Clear ({selectedTables.length})
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {IMPORTANT_DATA_PRESETS.map((preset) => (
                    <Button
                      key={preset.id}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => applyPresetTables(preset.tables)}
                      title={preset.description}
                    >
                      + {preset.label}
                    </Button>
                  ))}
                </div>
                <SearchInput
                  value={tableFilter}
                  onChange={setTableFilter}
                  placeholder="Filter tables to include in dump…"
                />
                <div className="max-h-40 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-2">
                  {filteredTableOptions.length > 0 ? (
                    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                      {filteredTableOptions.map((table) => (
                        <label
                          key={table}
                          className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-neutral-50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedTables.includes(table)}
                            onChange={() => toggleTableSelection(table)}
                            className="h-3.5 w-3.5 rounded border-neutral-300"
                          />
                          <span className="truncate font-mono text-[11px]">
                            {table}
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="py-3 text-center text-xs text-neutral-400">
                      No matching tables found.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div
              className={`rounded-xl border p-3 ${mode === "operational" ? "border-blue-200 bg-blue-50/60" : "border-violet-200 bg-violet-50/60"}`}
            >
              <div className="flex items-start gap-2.5">
                {mode === "operational" ? (
                  exportFormat === "sql_dump" ? (
                    <FileCode2 size={16} className="mt-0.5 shrink-0 text-blue-600" />
                  ) : (
                    <ShieldCheck size={16} className="mt-0.5 shrink-0 text-blue-600" />
                  )
                ) : (
                  <LockKeyhole size={16} className="mt-0.5 shrink-0 text-violet-600" />
                )}
                <div>
                  <div className="text-[12.5px] font-medium text-neutral-900">
                    {mode === "operational"
                      ? exportFormat === "sql_dump"
                        ? "PostgreSQL restore dump (.sql)"
                        : "Standard safe export"
                      : "Encrypted full recovery archive"}
                  </div>
                  <p className="mt-0.5 text-[12px] leading-5 text-neutral-600">
                    {mode === "operational"
                      ? exportFormat === "sql_dump"
                        ? "Creates a PostgreSQL restore file (.sql) with schema definitions and row inserts, excluding private credentials."
                        : "Packages schema SQL, restore data SQL, row exports, and SHA-256 checksums, excluding private credentials."
                      : "Includes full configuration protected by your passphrase. The passphrase is never stored and cannot be recovered."}
                  </p>
                </div>
              </div>
            </div>

            {mode === "disaster_recovery" && (
              <p role="status" className="text-xs text-muted-foreground">
                {passphrase.length}/128 characters · use at least 12.{" "}
                {repeatPassphrase && passphrase !== repeatPassphrase
                  ? "Passphrases do not match."
                  : ""}
              </p>
            )}
            {mode === "disaster_recovery" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label>
                  <span className="mb-1 block text-xs font-medium text-neutral-600">
                    Archive passphrase
                  </span>
                  <input
                    type="password"
                    minLength={12}
                    maxLength={128}
                    value={passphrase}
                    onChange={(event) => onPassphraseChange(event.target.value)}
                    placeholder="12–128 characters"
                    className="h-10 w-full rounded-lg border border-neutral-200 px-3 text-[13px] outline-none focus:border-violet-400"
                  />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-medium text-neutral-600">
                    Repeat passphrase
                  </span>
                  <input
                    type="password"
                    minLength={12}
                    maxLength={128}
                    value={repeatPassphrase}
                    onChange={(event) =>
                      onRepeatPassphraseChange(event.target.value)
                    }
                    placeholder="Repeat exactly"
                    className="h-10 w-full rounded-lg border border-neutral-200 px-3 text-[13px] outline-none focus:border-violet-400"
                  />
                </label>
              </div>
            )}

            {exportFormat === "archive" && (
              <label className="flex items-start gap-2.5 rounded-xl border border-neutral-200 p-3">
                <input
                  type="checkbox"
                  checked={includeStorageManifest}
                  onChange={(event) =>
                    onIncludeStorageManifestChange(event.target.checked)
                  }
                  className="mt-0.5 h-4 w-4 rounded border-neutral-300"
                />
                <div>
                  <div className="text-[12.5px] font-medium text-neutral-800">
                    Include uploaded files index
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-neutral-500">
                    Lists attachment references for recovery checks without downloading large uploaded files.
                  </p>
                </div>
              </label>
            )}

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600">
                Type{" "}
                <strong className="text-neutral-900">
                  {expectedConfirmation}
                </strong>{" "}
                to confirm
              </span>
              <input
                value={confirmation}
                onChange={(event) => onConfirmationChange(event.target.value)}
                placeholder={expectedConfirmation}
                className="h-10 w-full rounded-lg border border-neutral-200 px-3 font-mono text-[13px] uppercase tracking-wide outline-none focus:border-neutral-500"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600">
                Confirm your account password
              </span>
              <input
                type="password"
                value={reauthPassword}
                onChange={(event) => onReauthPasswordChange(event.target.value)}
                autoComplete="current-password"
                placeholder="Required immediately before export"
                className="h-10 w-full rounded-lg border border-neutral-200 px-3 text-[13px] outline-none focus:border-neutral-500"
              />
              <span className="mt-1 block text-[11px] text-neutral-400">
                Verified directly with sign-in authentication and never stored.
              </span>
            </label>

            <WButton
              icon={
                busy || activeJob ? (
                  <LoaderCircle size={14} className="animate-spin" />
                ) : (
                  <HardDriveDownload size={14} />
                )
              }
              variant="primary"
              onClick={onStart}
              disabled={!canStart || busy || uncertain}
              className="w-full justify-center py-2.5"
            >
              {primaryButtonLabel}
            </WButton>
          </div>
        </Card>

        <p className="px-1 text-xs text-[var(--eflow-text-muted)]">
          Files stay available for {overview?.preflight.retention_hours || 24} hours and are verified with SHA-256.
        </p>
      </div>

      <div className="min-w-0">
        <Card
          title="Backup history"
          subtitle="Filter, inspect receipts, or download completed files."
          right={
            allJobs.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!filteredJobs.length}
                  onClick={() => handleExportHistory("csv")}
                >
                  <Download size={12} aria-hidden="true" />
                  CSV
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!filteredJobs.length}
                  onClick={() => handleExportHistory("xlsx")}
                >
                  <Download size={12} aria-hidden="true" />
                  Excel
                </Button>
              </div>
            ) : undefined
          }
        >
          {refreshing && (
            <p className="mb-2 inline-flex items-center gap-1 text-xs text-neutral-400">
              <LoaderCircle size={12} className="animate-spin" /> Refreshing jobs…
            </p>
          )}

          {allJobs.length > 0 && (
            <div className="mb-4 space-y-2.5 rounded-xl border border-[var(--eflow-border)] bg-[var(--eflow-subtle)] p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <SearchInput
                  value={jobFilters.search}
                  onChange={(value) => updateJobFilter("search", value)}
                  placeholder="Search file name, job ID, or checksum…"
                />
                <WSelect
                  ariaLabel="Filter backup jobs by status"
                  value={jobFilters.status}
                  onChange={(value) => updateJobFilter("status", value)}
                  options={[
                    { value: "all", label: "All statuses" },
                    { value: "completed", label: "Completed" },
                    { value: "running", label: "Running / Queued" },
                    { value: "failed", label: "Failed" },
                  ]}
                  className="w-full !min-w-0"
                />
                <WSelect
                  ariaLabel="Filter backup jobs by mode"
                  value={jobFilters.mode}
                  onChange={(value) => updateJobFilter("mode", value)}
                  options={[
                    { value: "all", label: "All backup types" },
                    { value: "operational", label: "Operational" },
                    { value: "disaster_recovery", label: "Disaster recovery" },
                  ]}
                  className="w-full !min-w-0"
                />
                <WSelect
                  ariaLabel="Filter backup jobs by format"
                  value={jobFilters.exportFormat}
                  onChange={(value) => updateJobFilter("exportFormat", value)}
                  options={[
                    { value: "all", label: "All formats" },
                    { value: "archive", label: "ZIP Archive" },
                    { value: "sql_dump", label: "SQL Dump" },
                  ]}
                  className="w-full !min-w-0"
                />
                <label className="text-[11px] text-[var(--eflow-text-muted)]">
                  From date
                  <DateInput
                    aria-label="Backup job from date"
                    value={jobFilters.dateFrom}
                    onChange={(event) =>
                      updateJobFilter("dateFrom", event.target.value)
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-[var(--eflow-border)] px-3 text-xs"
                  />
                </label>
                <label className="text-[11px] text-[var(--eflow-text-muted)]">
                  Through date
                  <DateInput
                    aria-label="Backup job through date"
                    value={jobFilters.dateTo}
                    onChange={(event) =>
                      updateJobFilter("dateTo", event.target.value)
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-[var(--eflow-border)] px-3 text-xs"
                  />
                </label>
              </div>
              {hasBackupJobFilters(jobFilters) && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setJobFilters(DEFAULT_BACKUP_JOB_FILTERS);
                      setJobsPage(1);
                    }}
                  >
                    <RotateCcw size={12} aria-hidden="true" />
                    Reset job filters
                  </Button>
                </div>
              )}
            </div>
          )}

          {pagedJobs.items.length > 0 ? (
            <div className="space-y-3">
              <div className="space-y-2.5">
                {pagedJobs.items.map((job) => (
                  <BackupJobCard
                    key={job.id}
                    job={job}
                    onDownload={onDownload}
                    onDelete={onDelete}
                    busy={busy}
                  />
                ))}
              </div>
              <PaginationBar
                page={pagedJobs.page}
                pageSize={pagedJobs.pageSize}
                total={pagedJobs.total}
                totalPages={pagedJobs.totalPages}
                pageSizeOptions={[5, 10, 25]}
                itemLabel="backups"
                onPageChange={setJobsPage}
                onPageSizeChange={(nextSize) => {
                  setJobsPageSize(nextSize);
                  setJobsPage(1);
                }}
              />
            </div>
          ) : allJobs.length > 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-white py-10 text-center">
              <Archive size={24} className="mx-auto text-neutral-300" />
              <div className="mt-2 text-[13px] font-medium text-neutral-700">
                No backup jobs match your filters
              </div>
              <div className="mt-1 text-[12px] text-neutral-400">
                Adjust or clear your filter settings to view recorded backups.
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-white py-10 text-center">
              <Archive size={24} className="mx-auto text-neutral-300" />
              <div className="mt-2 text-[13px] font-medium text-neutral-700">
                No backups created yet
              </div>
              <div className="mt-1 text-[12px] text-neutral-400">
                Created backups and SQL dumps will appear here with download links and SHA-256 verification hashes.
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
