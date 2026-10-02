import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Archive,
  CheckCircle2,
  Clock3,
  Database,
  FileJson2,
  FileKey2,
  FileText,
  HardDriveDownload,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ServerCog,
  ShieldAlert,
  ShieldCheck,
  Table2,
} from "lucide-react";

import { useToast } from "../../../../components/ui/Toast";
import {
  Card,
  LoadingState,
  PageHeader,
  StatCard,
  WButton,
  WSelect,
} from "../../../../components/workflow/primitives";
import {
  deleteBackup,
  downloadBackup,
  fetchBackupOverview,
  startBackup,
  type BackupJob,
  type BackupMode,
  type BackupOverview,
} from "../../services/backupService";
import { BackupJobCard } from "./BackupJobCard";
import { BackupGatewayUnavailable } from "./BackupGatewayUnavailable";
import { useAuth } from "../../../../contexts/AuthContext";
import { supabase } from "../../../../../lib/supabase";

export function BackupExportWorkspace() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [overview, setOverview] = useState<BackupOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();
  const [mode, setMode] = useState<BackupMode>("operational");
  const [confirmation, setConfirmation] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [repeatPassphrase, setRepeatPassphrase] = useState("");
  const [includeStorageManifest, setIncludeStorageManifest] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reauthPassword, setReauthPassword] = useState("");

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await fetchBackupOverview();
      setOverview(result);
      setError(undefined);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load Data Tools.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const activeJob = overview?.jobs.find((job) => job.status === "queued" || job.status === "running");
  useEffect(() => {
    if (!activeJob) return;
    const timer = window.setInterval(() => { void load(true); }, 1_500);
    return () => window.clearInterval(timer);
  }, [activeJob?.id, load]);

  const expectedConfirmation = mode === "operational" ? "BACK UP EFLOW" : "FULL EFLOW BACKUP";
  const canStart = Boolean(
    overview?.preflight.configured &&
    !activeJob &&
    confirmation.trim().toUpperCase() === expectedConfirmation &&
    reauthPassword.length > 0 &&
    (mode === "operational" || (
      overview.preflight.encryption_available &&
      passphrase.length >= 12 &&
      passphrase === repeatPassphrase
    )),
  );
  const recentCompleted = overview?.jobs.filter((job) => job.status === "completed").length || 0;
  const exportedRows = overview?.jobs.reduce((total, job) => total + (job.status === "completed" ? job.row_count : 0), 0) || 0;

  const tablePreview = useMemo(() => overview?.preflight.tables.slice(0, 18) || [], [overview?.preflight.tables]);

  const create = async () => {
    if (!canStart) return;
    setBusy(true);
    try {
      if (!user?.email) throw new Error("Your signed-in email could not be verified. Sign in again before exporting.");
      const { error: reauthError } = await supabase.auth.signInWithPassword({ email: user.email, password: reauthPassword });
      if (reauthError) throw new Error("Password confirmation failed. No backup was started.");
      const job = await startBackup({
        mode,
        confirmation,
        includeStorageManifest,
        passphrase: mode === "disaster_recovery" ? passphrase : undefined,
      });
      setOverview((current) => current ? { ...current, jobs: [job, ...current.jobs] } : current);
      setConfirmation("");
      setPassphrase("");
      setRepeatPassphrase("");
      setReauthPassword("");
      toast("Backup job started. You may continue using eFlow while it runs.", "success");
    } catch (createError) {
      toast(createError instanceof Error ? createError.message : "Could not start backup.", "error");
    } finally {
      setBusy(false);
    }
  };

  const download = async (job: BackupJob) => {
    setBusy(true);
    try {
      await downloadBackup(job);
      toast("Backup download started.", "success");
    } catch (downloadError) {
      toast(downloadError instanceof Error ? downloadError.message : "Could not download backup.", "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (job: BackupJob) => {
    if (!window.confirm(`Delete ${job.archive_name || "this backup attempt"} from the gateway?`)) return;
    setBusy(true);
    try {
      await deleteBackup(job.id);
      setOverview((current) => current ? { ...current, jobs: current.jobs.filter((item) => item.id !== job.id) } : current);
      toast("Temporary backup files deleted.", "success");
    } catch (deleteError) {
      toast(deleteError instanceof Error ? deleteError.message : "Could not delete backup.", "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading && !overview) return <div className="p-8"><LoadingState label="Inspecting database backup readiness…" /></div>;

  if (error && !overview) {
    return (
      <div className="min-h-full bg-neutral-50/40 p-6 sm:p-8">
        <PageHeader
          eyebrow="Admin · Data Tools"
          title="Backup & Export"
          subtitle="Create an audited, checksummed export of the live eFlow Supabase schema and operational data."
        />
        <BackupGatewayUnavailable error={error} refreshing={refreshing} onRetry={() => void load(true)} />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-neutral-50/40 p-6 sm:p-8">
      <PageHeader
        eyebrow="Admin · Data Tools"
        title="Backup & Export"
        subtitle="Create an audited, checksummed export of the live eFlow Supabase schema and operational data."
        actions={(
          <WButton icon={<RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />} onClick={() => void load(true)} disabled={refreshing}>
            Refresh readiness
          </WButton>
        )}
      />

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[11.5px] text-red-700">
          <ShieldAlert size={15} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Public tables" value={overview?.preflight.table_count || 0} hint="Discovered through Supabase" tone="info" icon={<Table2 size={15} />} />
        <StatCard label="Gateway readiness" value={overview?.preflight.configured ? "Ready" : "Setup needed"} hint="Database URL + pg_dump" tone={overview?.preflight.configured ? "good" : "warn"} icon={<ServerCog size={15} />} />
        <StatCard label="Ready archives" value={recentCompleted} hint={`${overview?.preflight.retention_hours || 24}h temporary retention`} tone="good" icon={<Archive size={15} />} />
        <StatCard label="Rows packaged" value={exportedRows.toLocaleString()} hint="This gateway session" icon={<Database size={15} />} />
      </div>

      {!overview?.preflight.configured && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><ServerCog size={17} /></div>
            <div>
              <h3 className="text-[13px] font-semibold text-amber-950">One-time server setup required</h3>
              <p className="mt-1 text-[11px] leading-5 text-amber-800">
                Complete the server-only items marked below. Copy the Supabase direct or session-pooler connection string into <code className="rounded bg-amber-100 px-1">EFLOW_DATABASE_URL</code> in the private eFlow <code className="rounded bg-amber-100 px-1">.env</code>, then restart the gateway. PostgreSQL tools installed in their standard Windows location are detected automatically.
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                <ReadinessBadge ready={overview?.preflight.database_url_configured || false} label="Database URL" />
                <ReadinessBadge ready={overview?.preflight.pg_dump_available || false} label="pg_dump" />
                <ReadinessBadge ready={overview?.preflight.encryption_available || false} label="AES archive support" />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <div className="space-y-5">
          <Card title="Create database export" subtitle="Nothing is modified in Supabase; this operation only reads and packages data.">
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-[10.5px] font-medium uppercase tracking-wide text-neutral-500">Export mode</label>
                <WSelect
                  value={mode}
                  onChange={(value) => { setMode(value as BackupMode); setConfirmation(""); }}
                  options={[
                    { value: "operational", label: "Operational export · safe default" },
                    { value: "disaster_recovery", label: "Disaster recovery · encrypted" },
                  ]}
                  className="w-full"
                />
              </div>

              <div className={`rounded-xl border p-3 ${mode === "operational" ? "border-blue-200 bg-blue-50/60" : "border-violet-200 bg-violet-50/60"}`}>
                <div className="flex items-start gap-2.5">
                  {mode === "operational" ? <ShieldCheck size={16} className="mt-0.5 text-blue-600" /> : <LockKeyhole size={16} className="mt-0.5 text-violet-600" />}
                  <div>
                    <div className="text-[11.5px] font-medium text-neutral-900">
                      {mode === "operational" ? "Redacted operational backup" : "AES-256 disaster-recovery backup"}
                    </div>
                    <p className="mt-0.5 text-[10.5px] leading-4 text-neutral-600">
                      {mode === "operational"
                        ? `Exports the public schema and operational rows while excluding data from ${overview?.preflight.safe_excluded_data_tables.join(", ") || "secret configuration tables"}.`
                        : "Includes sensitive public configuration data inside a password-protected archive. The passphrase is never stored and cannot be recovered."}
                    </p>
                  </div>
                </div>
              </div>

              {mode === "disaster_recovery" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label>
                    <span className="mb-1 block text-[10.5px] font-medium text-neutral-500">Archive passphrase</span>
                    <input type="password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} placeholder="At least 12 characters" className="h-9 w-full rounded-lg border border-neutral-200 px-3 text-[12px] outline-none focus:border-violet-400" />
                  </label>
                  <label>
                    <span className="mb-1 block text-[10.5px] font-medium text-neutral-500">Repeat passphrase</span>
                    <input type="password" value={repeatPassphrase} onChange={(event) => setRepeatPassphrase(event.target.value)} placeholder="Repeat exactly" className="h-9 w-full rounded-lg border border-neutral-200 px-3 text-[12px] outline-none focus:border-violet-400" />
                  </label>
                </div>
              )}

              <label className="flex items-start gap-2.5 rounded-xl border border-neutral-200 p-3">
                <input type="checkbox" checked={includeStorageManifest} onChange={(event) => setIncludeStorageManifest(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-neutral-300" />
                <div>
                  <div className="text-[11.5px] font-medium text-neutral-800">Include storage bucket manifest</div>
                  <p className="mt-0.5 text-[10px] text-neutral-500">Records private bucket metadata for recovery planning. Large binary evidence files are not embedded in this database ZIP.</p>
                </div>
              </label>

              <label>
                <span className="mb-1 block text-[10.5px] font-medium text-neutral-500">
                  Type <strong className="text-neutral-900">{expectedConfirmation}</strong> to confirm
                </span>
                <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={expectedConfirmation} className="h-10 w-full rounded-xl border border-neutral-200 px-3 font-mono text-[12px] uppercase tracking-wide outline-none focus:border-neutral-500" />
              </label>

              <label>
                <span className="mb-1 block text-[10.5px] font-medium text-neutral-500">Confirm your current eFlow password</span>
                <input type="password" value={reauthPassword} onChange={(event) => setReauthPassword(event.target.value)} autoComplete="current-password" placeholder="Required immediately before export" className="h-10 w-full rounded-xl border border-neutral-200 px-3 text-[12px] outline-none focus:border-neutral-500" />
                <span className="mt-1 block text-[9px] text-neutral-400">Your password goes directly to Supabase authentication and is never sent to or stored by the eFlow gateway.</span>
              </label>

              <WButton icon={busy || activeJob ? <LoaderCircle size={14} className="animate-spin" /> : <HardDriveDownload size={14} />} variant="primary" onClick={create} disabled={!canStart || busy} className="w-full justify-center py-2.5">
                {activeJob ? "Backup already running" : mode === "operational" ? "Create safe backup" : "Create encrypted full backup"}
              </WButton>
            </div>
          </Card>

          <Card title="Archive contents" subtitle="Both machine-restorable and human-readable formats are included.">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <ArchiveItem icon={<FileText size={15} />} title="schema.sql" detail="Tables, indexes, functions, triggers, policies" />
              <ArchiveItem icon={<Database size={15} />} title="data.sql" detail="Dependency-safe restore statements" />
              <ArchiveItem icon={<FileJson2 size={15} />} title="data/*.jsonl" detail="One readable JSON object per database row" />
              <ArchiveItem icon={<FileKey2 size={15} />} title="manifest + SHA-256" detail="Counts, metadata, integrity verification" />
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Discovered public schema" subtitle={`${overview?.preflight.table_count || 0} PostgREST-visible tables`}>
            {tablePreview.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {tablePreview.map((table) => (
                  <span key={table} className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 font-mono text-[9.5px] text-neutral-600">{table}</span>
                ))}
                {(overview?.preflight.table_count || 0) > tablePreview.length && (
                  <span className="rounded-md bg-neutral-900 px-2 py-1 text-[9.5px] text-white">+{(overview?.preflight.table_count || 0) - tablePreview.length} more</span>
                )}
              </div>
            ) : (
              <div className="rounded-lg bg-neutral-50 px-3 py-6 text-center text-[11px] text-neutral-400">
                {overview?.preflight.discovery_error || "No public tables were discovered."}
              </div>
            )}
          </Card>

          <Card title="Security boundaries">
            <div className="space-y-3">
              <SecurityRule icon={<ShieldCheck size={14} />} title="Admin only" detail="Every request is verified with the current Supabase user JWT." />
              <SecurityRule icon={<ServerCog size={14} />} title="Server-side credentials" detail="Database and service-role secrets never enter the browser bundle." />
              <SecurityRule icon={<Clock3 size={14} />} title="Automatic cleanup" detail={`Temporary files expire after ${overview?.preflight.retention_hours || 24} hours.`} />
              <SecurityRule icon={<CheckCircle2 size={14} />} title="Audited integrity" detail="Start, completion, download, deletion, failure, and archive hash are recorded." />
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-neutral-900">Backup jobs</h2>
            <p className="text-[10.5px] text-neutral-500">Temporary gateway archives for your signed-in Admin account.</p>
          </div>
          {refreshing && <span className="inline-flex items-center gap-1 text-[10px] text-neutral-400"><LoaderCircle size={11} className="animate-spin" /> Updating</span>}
        </div>
        {overview?.jobs.length ? (
          <div className="space-y-2">
            {overview.jobs.map((job) => <BackupJobCard key={job.id} job={job} onDownload={download} onDelete={remove} busy={busy} />)}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white py-10 text-center">
            <Archive size={24} className="mx-auto text-neutral-300" />
            <div className="mt-2 text-[12px] font-medium text-neutral-600">No backup jobs in this gateway session</div>
            <div className="mt-0.5 text-[10.5px] text-neutral-400">Completed operations will appear here with their checksum and download controls.</div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReadinessBadge({ ready, label }: { ready: boolean; label: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${ready ? "bg-emerald-100 text-emerald-800" : "bg-white/70 text-amber-800"}`}>{ready ? <CheckCircle2 size={10} /> : <ShieldAlert size={10} />}{label}</span>;
}

function ArchiveItem({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return <div className="flex items-start gap-2.5 rounded-xl border border-neutral-100 bg-neutral-50/70 p-3"><div className="mt-0.5 text-blue-600">{icon}</div><div><div className="font-mono text-[11px] text-neutral-800">{title}</div><div className="mt-0.5 text-[9.5px] leading-4 text-neutral-500">{detail}</div></div></div>;
}

function SecurityRule({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return <div className="flex items-start gap-2.5"><div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">{icon}</div><div><div className="text-[11px] font-medium text-neutral-800">{title}</div><div className="mt-0.5 text-[9.5px] leading-4 text-neutral-500">{detail}</div></div></div>;
}
