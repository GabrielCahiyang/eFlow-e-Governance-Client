import { useState } from "react";
import { formatManilaDateTime } from "../../../../shared/calendarDisplay";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Database,
  Download,
  LoaderCircle,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { ProgressBar, WButton } from "../../../../components/workflow/primitives";
import { formatBytes } from "../../selectors/backupSelectors";
import type { BackupJob } from "../../services/backupService";

function scopeLabel(job: BackupJob): string {
  if (job.scope === "important") return "Important data";
  if (job.scope === "selected") {
    const count = job.selected_tables?.length || job.table_count;
    return count ? `${count} selected tables` : "Selected tables";
  }
  return "Full database";
}

export function BackupJobCard({
  job,
  onDownload,
  onDelete,
  busy,
}: {
  job: BackupJob;
  onDownload: (job: BackupJob) => void;
  onDelete: (job: BackupJob) => void;
  busy: boolean;
}) {
  const [copiedHash, setCopiedHash] = useState(false);
  const active = job.status === "queued" || job.status === "running";
  const completed = job.status === "completed";
  const failed = job.status === "failed";
  const isSqlDump = job.export_format === "sql_dump";
  const Icon = active ? LoaderCircle : completed ? CheckCircle2 : AlertTriangle;
  const iconTone = active
    ? "bg-blue-50 text-blue-600 ring-1 ring-blue-100"
    : completed
      ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100"
      : "bg-red-50 text-red-600 ring-1 ring-red-100";

  const archiveTitle =
    job.archive_name ||
    (active ? "Generating eFlow backup" : "Backup attempt");

  const copyChecksum = async () => {
    if (!job.archive_sha256 || !navigator?.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(job.archive_sha256);
      setCopiedHash(true);
      window.setTimeout(() => setCopiedHash(false), 1800);
    } catch {
      // Ignore clipboard write errors in restricted contexts.
    }
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-2xs transition-colors hover:border-neutral-300">
      {/* Header row: icon + title/timestamp + action buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconTone}`}
          >
            <Icon size={18} className={active ? "animate-spin" : ""} />
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="break-all text-[13.5px] font-semibold leading-snug text-neutral-900"
              title={archiveTitle}
            >
              {archiveTitle}
            </div>
            <p className="mt-0.5 text-xs text-neutral-500">
              {job.phase} · {formatManilaDateTime(job.created_at, "—")}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 self-start">
          {completed && (
            <WButton
              icon={<Download size={13} />}
              variant="primary"
              onClick={() => onDownload(job)}
              disabled={busy}
            >
              Download
            </WButton>
          )}
          {!active && (
            <WButton
              icon={<Trash2 size={13} />}
              variant="ghost"
              onClick={() => onDelete(job)}
              disabled={busy}
            >
              Delete
            </WButton>
          )}
          {active && <Clock3 size={15} className="text-neutral-300" />}
        </div>
      </div>

      {/* Full-width badges row */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
            completed
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70"
              : active
                ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200/70"
                : "bg-red-50 text-red-700 ring-1 ring-red-200/70"
          }`}
        >
          {job.status.replace("_", " ")}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-neutral-700">
          <Database size={11} className="shrink-0 text-neutral-500" />
          <span>
            {isSqlDump ? "SQL dump" : "ZIP package"} · {scopeLabel(job)}
          </span>
        </span>
        {job.mode === "disaster_recovery" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-medium text-violet-700 ring-1 ring-violet-200/70">
            <ShieldCheck size={11} className="shrink-0" /> AES-256
          </span>
        )}
      </div>

      {active && (
        <div className="mt-3.5">
          <div className="mb-1 flex items-center justify-between text-[11px] text-neutral-500">
            <span>{job.phase}</span>
            <span className="eflow-tabular font-medium">{job.progress}%</span>
          </div>
          <ProgressBar value={job.progress} />
        </div>
      )}

      {failed && job.error && (
        <div className="mt-3.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11.5px] leading-4 text-red-700">
          {job.error}
        </div>
      )}

      {/* Full-width metrics grid */}
      {completed && (
        <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Metric label="Tables" value={job.table_count.toLocaleString()} />
          <Metric
            label="Rows"
            value={
              isSqlDump && job.row_count === 0
                ? "SQL Dump"
                : job.row_count.toLocaleString()
            }
          />
          <Metric label="Size" value={formatBytes(job.archive_size)} />
          <Metric
            label="Expires"
            value={job.expires_at ? formatManilaDateTime(job.expires_at, "—") : "—"}
          />
        </div>
      )}

      {/* Full-width SHA-256 verification bar */}
      {completed && job.archive_sha256 && (
        <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg border border-neutral-200/80 bg-neutral-50/80 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2 font-mono text-[11px] text-neutral-600">
            <ShieldCheck size={13} className="shrink-0 text-emerald-600" />
            <span className="truncate" title={job.archive_sha256}>
              SHA-256 {job.archive_sha256}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void copyChecksum()}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            title="Copy SHA-256 checksum"
          >
            {copiedHash ? (
              <>
                <Check size={11} className="text-emerald-600" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy size={11} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-lg border border-neutral-100 bg-neutral-50/90 px-3 py-2.5">
      <div className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
        {label}
      </div>
      <div
        className="eflow-tabular mt-1 truncate text-[12.5px] font-semibold text-neutral-900"
        title={String(value)}
      >
        {value}
      </div>
    </div>
  );
}
