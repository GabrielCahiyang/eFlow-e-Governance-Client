import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  LoaderCircle,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { ProgressBar, WButton } from "../../../../components/workflow/primitives";
import type { BackupJob } from "../../services/backupService";

function formatBytes(value?: number | null): string {
  if (!value) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
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
  const active = job.status === "queued" || job.status === "running";
  const completed = job.status === "completed";
  const failed = job.status === "failed";
  const Icon = active ? LoaderCircle : completed ? CheckCircle2 : AlertTriangle;
  const iconTone = active
    ? "bg-blue-50 text-blue-600"
    : completed
      ? "bg-emerald-50 text-emerald-600"
      : "bg-red-50 text-red-600";

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconTone}`}>
          <Icon size={17} className={active ? "animate-spin" : ""} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12.5px] font-semibold text-neutral-900">
              {job.archive_name || (active ? "Generating eFlow backup" : "Backup attempt")}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[9.5px] font-medium uppercase tracking-wide ${
              completed ? "bg-emerald-50 text-emerald-700" : active ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-700"
            }`}>
              {job.status.replace("_", " ")}
            </span>
            {job.mode === "disaster_recovery" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[9.5px] font-medium text-violet-700">
                <ShieldCheck size={10} /> AES-256
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[10.5px] text-neutral-500">
            {job.phase} · started {new Date(job.created_at).toLocaleString("en-US")}
          </p>
          {active && (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-[10px] text-neutral-500">
                <span>{job.phase}</span><span>{job.progress}%</span>
              </div>
              <ProgressBar value={job.progress} />
            </div>
          )}
          {failed && job.error && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[10.5px] leading-4 text-red-700">
              {job.error}
            </div>
          )}
          {completed && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="Tables" value={job.table_count} />
              <Metric label="Rows" value={job.row_count.toLocaleString()} />
              <Metric label="Archive" value={formatBytes(job.archive_size)} />
              <Metric label="Expires" value={job.expires_at ? new Date(job.expires_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"} />
            </div>
          )}
          {completed && job.archive_sha256 && (
            <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-neutral-50 px-2.5 py-2 font-mono text-[9.5px] text-neutral-500">
              <ShieldCheck size={11} className="shrink-0 text-emerald-600" />
              <span className="truncate" title={job.archive_sha256}>SHA-256 {job.archive_sha256}</span>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {completed && (
            <WButton icon={<Download size={13} />} variant="primary" onClick={() => onDownload(job)} disabled={busy}>
              Download
            </WButton>
          )}
          {!active && (
            <WButton icon={<Trash2 size={13} />} variant="ghost" onClick={() => onDelete(job)} disabled={busy}>
              Delete
            </WButton>
          )}
          {active && <Clock3 size={15} className="text-neutral-300" />}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-neutral-50 px-2.5 py-2">
      <div className="text-[9px] uppercase tracking-wide text-neutral-400">{label}</div>
      <div className="mt-0.5 truncate text-[11px] font-medium text-neutral-800">{value}</div>
    </div>
  );
}

