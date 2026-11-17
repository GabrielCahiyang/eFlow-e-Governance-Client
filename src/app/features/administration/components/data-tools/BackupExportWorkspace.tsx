import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { signInWithAccountProtection } from '../../../authentication';
import {
  Archive,
  CheckCircle2,
  HardDriveDownload,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ServerCog,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { useToast } from "../../../../components/ui/Toast";
import { WorkspaceHeader } from '../../../../components/ui/workspace';
import {
  Card,
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

import { useExplicitDraft } from "../../../../shared/useExplicitDraft";
import { requestNavigation } from "../../../../shared/navigationGuard";
import { useConfirmation } from "../../../../components/ui/useConfirmation";
import { FeedbackState } from "../../../../components/ui/FeedbackState";
const uncertainStarts = new Map<
  string,
  { ids: string[]; mode: BackupMode; after: number }
>();

function BackupExportWorkspaceSkeleton() {
  return (
    <div
      className="eflow-page-content"
      role="status"
      aria-label="Inspecting database backup readiness…"
    >
      <span className="sr-only">Inspecting database backup readiness…</span>
      <WorkspaceHeader
        title="Backup & Export"
        description="Create and download a verified snapshot of organization data without changing live records."
      />
      <div aria-hidden="true">
        <div className="mb-5 h-12 w-full animate-pulse rounded-xl border border-neutral-200 bg-neutral-100" />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card
            title="Create backup"
            subtitle="Reads and packages data safely without modifying live records."
          >
            <div className="space-y-4">
              <div className="h-9 w-full animate-pulse rounded-lg bg-neutral-100" />
              <div className="h-16 w-full animate-pulse rounded-xl bg-blue-50/60" />
              <div className="h-14 w-full animate-pulse rounded-xl bg-neutral-100" />
              <div className="h-10 w-full animate-pulse rounded-xl bg-neutral-100" />
              <div className="h-10 w-full animate-pulse rounded-xl bg-neutral-100" />
              <div className="h-10 w-full animate-pulse rounded-xl bg-neutral-200/80" />
            </div>
          </Card>
          <Card
            title="Recent backups & downloads"
            subtitle="Completed archives remain available until their expiration time."
          >
            <div className="h-36 animate-pulse rounded-xl border border-dashed border-neutral-200 bg-neutral-50" />
          </Card>
        </div>
      </div>
    </div>
  );
}

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

  const pending = useRef(false);
  const confirmDelete = useConfirmation();
  const [operationError, setOperationError] = useState("");
  const [receipt, setReceipt] = useState("");
  const [uncertain, setUncertain] = useState(() =>
    uncertainStarts.has(user?.id || ""),
  );
  const resetDraft = () => {
    setConfirmation("");
    setPassphrase("");
    setRepeatPassphrase("");
    setReauthPassword("");
  };
  const draft = useExplicitDraft(
    "Backup preparation",
    Boolean(confirmation || passphrase || repeatPassphrase || reauthPassword),
    busy,
    resetDraft,
  );
  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await fetchBackupOverview();
      setOverview(result);
      setError(undefined);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load Data Tools.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeJob = overview?.jobs.find(
    (job) => job.status === "queued" || job.status === "running",
  );
  useEffect(() => {
    if (!activeJob) return;
    const timer = window.setInterval(() => {
      void load(true);
    }, 1_500);
    return () => window.clearInterval(timer);
  }, [activeJob?.id, load]);

  const expectedConfirmation =
    mode === "operational" ? "BACK UP EFLOW" : "FULL EFLOW BACKUP";
  const canStart = Boolean(
    overview?.preflight.configured &&
      !activeJob &&
      !uncertain &&
      !pending.current &&
      confirmation.trim().toUpperCase() === expectedConfirmation &&
      reauthPassword.length > 0 &&
      (mode === "operational" ||
        (overview.preflight.encryption_available &&
          passphrase.length >= 12 && passphrase.length <= 128 &&
          passphrase === repeatPassphrase)),
  );
  const recentCompleted =
    overview?.jobs.filter((job) => job.status === "completed").length || 0;
  const exportedRows =
    overview?.jobs.reduce(
      (total, job) => total + (job.status === "completed" ? job.row_count : 0),
      0,
    ) || 0;

  const tablePreview = useMemo(
    () => overview?.preflight.tables.slice(0, 18) || [],
    [overview?.preflight.tables],
  );

  const create = async () => {
    if (!canStart || pending.current) return;
    pending.current = true;
    draft.pendingRef.current = true;
    setBusy(true);
    setOperationError("");
    let submitted = false;
    try {
      if (!user?.email)
        throw new Error(
          "Your signed-in email could not be verified. Sign in again before exporting.",
        );
      await signInWithAccountProtection(user.email, reauthPassword);
      submitted = true;
      uncertainStarts.set(user.id, {
        ids: overview?.jobs.map((job) => job.id) || [],
        mode,
        after: Date.now(),
      });
      const job = await startBackup({
        mode,
        confirmation,
        includeStorageManifest,
        passphrase: mode === "disaster_recovery" ? passphrase : undefined,
      });
      uncertainStarts.delete(user.id);
      setUncertain(false);
      draft.markClean();
      setReceipt(
        `Backup job ${job.id} accepted · ${job.status}. Completion is confirmed by its job status and archive receipt.`,
      );
      setOverview((current) =>
        current ? { ...current, jobs: [job, ...current.jobs] } : current,
      );
      setConfirmation("");
      setPassphrase("");
      setRepeatPassphrase("");
      setReauthPassword("");
      toast(
        "Backup job started. You may continue using eFlow while it runs.",
        "success",
      );
    } catch (createError) {
      const rejected =
        createError instanceof Error &&
        /route is not loaded|not configured|confirmation|passphrase|pg_dump|already running|forbidden|permission|unauthorized/i.test(
          createError.message,
        );
      if (submitted && !rejected) setUncertain(true);
      else if (user) uncertainStarts.delete(user.id);
      setOperationError(
        (createError instanceof Error
          ? createError.message
          : "Could not start backup.") +
          (submitted && !rejected
            ? " The result is uncertain. Verify the job list before starting another backup."
            : " Preparation retained; correct the error and retry."),
      );
      toast(
        createError instanceof Error
          ? createError.message
          : "Could not start backup.",
        "error",
      );
    } finally {
      pending.current = false;
      draft.pendingRef.current = false;
      setBusy(false);
    }
  };

  const download = async (job: BackupJob) => {
    if (pending.current) return;
    pending.current = true;
    draft.pendingRef.current = true;
    setBusy(true);
    try {
      await downloadBackup(job);
      toast("Backup download started.", "success");
    } catch (downloadError) {
      setOperationError(
        downloadError instanceof Error
          ? downloadError.message
          : "Could not download backup.",
      );
      toast(
        downloadError instanceof Error
          ? downloadError.message
          : "Could not download backup.",
        "error",
      );
    } finally {
      pending.current = false;
      draft.pendingRef.current = false;
      setBusy(false);
    }
  };

  const remove = async (job: BackupJob) => {
    if (pending.current) return;
    pending.current = true;
    draft.pendingRef.current = true;
    setBusy(true);
    try {
      if (
        !(await confirmDelete.confirm({
          title: "Delete backup archive?",
          description: `${job.archive_name || job.id}. This permanently removes its temporary gateway files. The source database is unchanged. Retain a verified copy before deletion.`,
          danger: true,
          confirmationText: job.archive_name || job.id,
          actionLabel: "Delete archive",
        }))
      )
        return;
      await deleteBackup(job.id);
      setOverview((current) =>
        current
          ? {
              ...current,
              jobs: current.jobs.filter((item) => item.id !== job.id),
            }
          : current,
      );
      setReceipt(`Temporary archive ${job.id} deleted from the gateway.`);
      toast("Temporary backup files deleted.", "success");
    } catch (deleteError) {
      setOperationError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete backup. Verify the current job list before retrying.",
      );
      toast(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete backup.",
        "error",
      );
    } finally {
      pending.current = false;
      draft.pendingRef.current = false;
      setBusy(false);
    }
  };

  const verifyStart = async () => {
    if (pending.current || !user) return;
    pending.current = true;
    setBusy(true);
    try {
      const result = await fetchBackupOverview();
      setOverview(result);
      const attempt = uncertainStarts.get(user.id);
      const matches = result.jobs.filter(
        (job) =>
          attempt &&
          !attempt.ids.includes(job.id) &&
          job.actor_id === user.id &&
          job.mode === attempt.mode &&
          new Date(job.created_at).getTime() >= attempt.after - 2000,
      );
      if (matches.length === 1) {
        uncertainStarts.delete(user.id);
        setUncertain(false);
        draft.markClean();
        resetDraft();
        setReceipt(
          `Matching backup job ${matches[0].id} found · ${matches[0].status}. Review its job receipt below before a retry.`,
        );
        setOperationError("");
      } else
        setOperationError(
          "No unique matching backup job could be confirmed. Keep this preparation and review the gateway job history before another start.",
        );
    } catch (caught) {
      setOperationError(
        caught instanceof Error
          ? caught.message
          : "Backup verification unavailable.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  if (loading && !overview) return <BackupExportWorkspaceSkeleton />;

  if (error && !overview) {
    return (
      <div className="eflow-page-content">
        <WorkspaceHeader
          title="Backup & Export"
          description="Create an audited, checksummed export of the live eFlow Supabase schema and operational data."
        />
        <BackupGatewayUnavailable
          error={error}
          refreshing={refreshing}
          onRetry={() => void load(true)}
        />
      </div>
    );
  }

  return (
    <div className="eflow-page-content">
      <WorkspaceHeader
        title="Backup & Export"
        description="Create and download a verified snapshot of organization data without changing live records."
        actions={
          <WButton
            icon={
              <RefreshCw
                size={13}
                className={refreshing ? "animate-spin" : ""}
              />
            }
            onClick={() => void load(true)}
            disabled={refreshing}
          >
            Refresh readiness
          </WButton>
        }
      />

      {confirmDelete.dialog}
      {receipt && (
        <FeedbackState tone="success" title="Backup saved">
          {receipt}
        </FeedbackState>
      )}
      {operationError && (
        <FeedbackState tone="error" title="Backup needs attention">
          {operationError}
        </FeedbackState>
      )}
      {uncertain && (
        <div className="mb-4">
          <WButton disabled={busy} onClick={() => void verifyStart()}>
            Verify backup outcome
          </WButton>
        </div>
      )}
      {error && (
        <FeedbackState tone="error" title="Backup status issue" onRetry={() => void load(true)}>
          {error}
        </FeedbackState>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--eflow-border)] bg-[var(--eflow-subtle)] px-4 py-3 text-sm">
        <div className="flex flex-wrap items-center gap-2.5">
          {overview?.preflight.configured ? (
            <ShieldCheck size={17} aria-hidden="true" className="text-[var(--eflow-positive-text)]" />
          ) : (
            <ShieldAlert size={17} aria-hidden="true" className="text-[var(--eflow-warning-text)]" />
          )}
          <span className="font-medium text-[var(--eflow-text)]">
            {overview?.preflight.configured
              ? "Backup service ready"
              : "Server setup needed before backups can run"}
          </span>
          <span className="eflow-tabular text-xs text-[var(--eflow-text-muted)]">
            {overview?.preflight.table_count || 0} tables covered · Archives retained {overview?.preflight.retention_hours || 24}h · {recentCompleted} ready now
          </span>
        </div>
        {exportedRows > 0 && (
          <span className="eflow-tabular text-xs text-[var(--eflow-text-muted)]">
            {exportedRows.toLocaleString()} rows packaged this session
          </span>
        )}
      </div>

      {!overview?.preflight.configured && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50/80 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <ServerCog size={17} />
            </div>
            <div>
              <h3 className="text-[13px] font-semibold text-amber-950">
                One-time server setup required
              </h3>
              <p className="mt-1 max-w-[65ch] text-[12.5px] leading-5 text-amber-800">
                Ask your server operator to configure the database backup connection and PostgreSQL dump tools in the backend gateway environment, then restart the gateway.
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                <ReadinessBadge
                  ready={overview?.preflight.database_url_configured || false}
                  label="Database connection"
                />
                <ReadinessBadge
                  ready={overview?.preflight.pg_dump_available || false}
                  label="PostgreSQL tools"
                />
                <ReadinessBadge
                  ready={overview?.preflight.encryption_available || false}
                  label="Archive encryption"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card
            title="Create backup"
            subtitle="Reads and packages data safely without modifying live records."
          >
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">
                  Backup type
                </label>
                <WSelect
                  value={mode}
                  onChange={(value) => {
                    void requestNavigation(() => {
                      setMode(value as BackupMode);
                      resetDraft();
                    });
                  }}
                  options={[
                    {
                      value: "operational",
                      label: "Operational export · standard",
                    },
                    {
                      value: "disaster_recovery",
                      label: "Disaster recovery · password encrypted",
                    },
                  ]}
                  className="w-full"
                />
              </div>

              <div
                className={`rounded-xl border p-3 ${mode === "operational" ? "border-blue-200 bg-blue-50/60" : "border-violet-200 bg-violet-50/60"}`}
              >
                <div className="flex items-start gap-2.5">
                  {mode === "operational" ? (
                    <ShieldCheck size={16} className="mt-0.5 text-blue-600" />
                  ) : (
                    <LockKeyhole size={16} className="mt-0.5 text-violet-600" />
                  )}
                  <div>
                    <div className="text-[12.5px] font-medium text-neutral-900">
                      {mode === "operational"
                        ? "Standard safe export"
                        : "Encrypted full recovery archive"}
                    </div>
                    <p className="mt-0.5 text-[12px] leading-5 text-neutral-600">
                      {mode === "operational"
                        ? "Includes workspace structure and operational data while excluding private server secrets."
                        : "Includes full configuration data protected by your passphrase. The passphrase is never stored and cannot be recovered."}
                    </p>
                  </div>
                </div>
              </div>

              {mode === 'disaster_recovery' && <p role="status" className="text-xs text-muted-foreground">{passphrase.length}/128 characters · use at least 12. {repeatPassphrase && passphrase !== repeatPassphrase ? 'Passphrases do not match.' : ''}</p>}
              {mode === "disaster_recovery" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label>
                    <span className="mb-1 block text-xs font-medium text-neutral-600">
                      Archive passphrase
                    </span>
                    <input
                      type="password" minLength={12} maxLength={128}
                      value={passphrase}
                      onChange={(event) => setPassphrase(event.target.value)}
                      placeholder="12–128 characters"
                      className="h-10 w-full rounded-lg border border-neutral-200 px-3 text-[13px] outline-none focus:border-violet-400"
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-medium text-neutral-600">
                      Repeat passphrase
                    </span>
                    <input
                      type="password" minLength={12} maxLength={128}
                      value={repeatPassphrase}
                      onChange={(event) =>
                        setRepeatPassphrase(event.target.value)
                      }
                      placeholder="Repeat exactly"
                      className="h-10 w-full rounded-lg border border-neutral-200 px-3 text-[13px] outline-none focus:border-violet-400"
                    />
                  </label>
                </div>
              )}

              <label className="flex items-start gap-2.5 rounded-xl border border-neutral-200 p-3">
                <input
                  type="checkbox"
                  checked={includeStorageManifest}
                  onChange={(event) =>
                    setIncludeStorageManifest(event.target.checked)
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

              <label>
                <span className="mb-1 block text-xs font-medium text-neutral-600">
                  Type{" "}
                  <strong className="text-neutral-900">
                    {expectedConfirmation}
                  </strong>{" "}
                  to confirm
                </span>
                <input
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  placeholder={expectedConfirmation}
                  className="h-10 w-full rounded-lg border border-neutral-200 px-3 font-mono text-[13px] uppercase tracking-wide outline-none focus:border-neutral-500"
                />
              </label>

              <label>
                <span className="mb-1 block text-xs font-medium text-neutral-600">
                  Confirm your account password
                </span>
                <input
                  type="password"
                  value={reauthPassword}
                  onChange={(event) => setReauthPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter your password before starting"
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
                onClick={create}
                disabled={!canStart || busy}
                className="w-full justify-center py-2.5"
              >
                {activeJob
                  ? "Backup already running"
                  : mode === "operational"
                    ? "Create safe backup"
                    : "Create encrypted full backup"}
              </WButton>
            </div>
          </Card>

          <details className="rounded-xl border border-[var(--eflow-border)] bg-[var(--eflow-surface)] px-4 py-3 text-xs text-[var(--eflow-text-muted)]">
            <summary className="cursor-pointer font-medium text-[var(--eflow-text)]">
              Technical backup contents ({overview?.preflight.table_count || 0} tables · SHA-256 verified)
            </summary>
            <p className="mt-2 leading-5">
              Each ZIP package includes schema SQL, restore data SQL, row-level JSONL exports, and a SHA-256 verification manifest. Temporary archives automatically delete after {overview?.preflight.retention_hours || 24} hours.
            </p>
            {tablePreview.length > 0 && (
              <p className="mt-2 font-mono text-[11px] text-neutral-500">
                Sample tables: {tablePreview.slice(0, 8).join(", ")}
                {tablePreview.length > 8 ? ` (+${(overview?.preflight.table_count || tablePreview.length) - 8} more)` : ""}
              </p>
            )}
          </details>
        </div>

        <Card
          title="Recent backups & downloads"
          subtitle="Completed archives remain available until their expiration time."
        >
          {refreshing && (
            <p className="mb-2 inline-flex items-center gap-1 text-xs text-neutral-400">
              <LoaderCircle size={12} className="animate-spin" /> Refreshing jobs…
            </p>
          )}
          {overview?.jobs.length ? (
            <div className="space-y-2.5">
              {overview.jobs.map((job) => (
                <BackupJobCard
                  key={job.id}
                  job={job}
                  onDownload={download}
                  onDelete={remove}
                  busy={busy}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-white py-10 text-center">
              <Archive size={24} className="mx-auto text-neutral-300" />
              <div className="mt-2 text-[13px] font-medium text-neutral-700">
                No backups created yet
              </div>
              <div className="mt-1 text-[12px] text-neutral-400">
                Created backups will appear here with download links and verification hashes.
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function ReadinessBadge({ ready, label }: { ready: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${ready ? "bg-emerald-100 text-emerald-800" : "bg-white/70 text-amber-800"}`}
    >
      {ready ? <CheckCircle2 size={10} /> : <ShieldAlert size={10} />}
      {label}
    </span>
  );
}
