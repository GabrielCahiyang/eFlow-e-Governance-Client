import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { signInWithAccountProtection } from "../../../authentication";
import {
  CheckCircle2,
  RefreshCw,
  ServerCog,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { useToast } from "../../../../components/ui/Toast";
import {
  WorkspaceHeader,
  WorkspaceTabs,
  type WorkspaceTab,
} from "../../../../components/ui/workspace";
import {
  Card,
  WButton,
} from "../../../../components/workflow/primitives";
import {
  deleteBackup,
  downloadBackup,
  fetchBackupOverview,
  isBackupGatewayUnavailableError,
  startBackup,
  type BackupExportFormat,
  type BackupJob,
  type BackupMode,
  type BackupOverview,
  type BackupScope,
} from "../../services/backupService";
import { BackupGatewayUnavailable } from "./BackupGatewayUnavailable";
import { DatabaseDumpPanel } from "./DatabaseDumpPanel";
import { ImportantDataExplorer } from "./ImportantDataExplorer";
import { SchemaTablesCatalog } from "./SchemaTablesCatalog";
import { useAuth } from "../../../../contexts/AuthContext";
import { useExplicitDraft } from "../../../../shared/useExplicitDraft";
import { useConfirmation } from "../../../../components/ui/useConfirmation";
import { FeedbackState } from "../../../../components/ui/FeedbackState";

const uncertainStarts = new Map<
  string,
  { ids: string[]; mode: BackupMode; after: number }
>();

type BackupWorkspaceTab = "backup" | "explorer" | "tables";

function BackupExportWorkspaceSkeleton() {
  return (
    <div
      className="eflow-page-content"
      role="status"
      aria-label="Inspecting database backup readiness…"
    >
      <span className="sr-only">Inspecting database backup readiness…</span>
      <WorkspaceHeader
        title="Backup"
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
  const [gatewayUnavailable, setGatewayUnavailable] = useState(false);

  const [activeTab, setActiveTab] = useState<BackupWorkspaceTab>("backup");
  const [mode, setMode] = useState<BackupMode>("operational");
  const [scope, setScope] = useState<BackupScope>("full");
  const [exportFormat, setExportFormat] = useState<BackupExportFormat>("archive");
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [explorerTable, setExplorerTable] = useState("projects");

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
      setGatewayUnavailable(false);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load Data Tools.",
      );
      setGatewayUnavailable(isBackupGatewayUnavailableError(loadError));
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
      (scope !== "selected" || selectedTables.length > 0) &&
      confirmation.trim().toUpperCase() === expectedConfirmation &&
      reauthPassword.length > 0 &&
      (mode === "operational" ||
        (overview.preflight.encryption_available &&
          passphrase.length >= 12 &&
          passphrase.length <= 128 &&
          passphrase === repeatPassphrase)),
  );
  const recentCompleted =
    overview?.jobs.filter((job) => job.status === "completed").length || 0;
  const exportedRows =
    overview?.jobs.reduce(
      (total, job) => total + (job.status === "completed" ? job.row_count : 0),
      0,
    ) || 0;

  const create = async () => {
    if (!canStart || pending.current) return;
    pending.current = true;
    draft.pendingRef.current = true;
    setBusy(true);
    setOperationError("");
    let submitted = false;
    try {
      if (!user?.email) {
        throw new Error(
          "Your signed-in email could not be verified. Sign in again before exporting.",
        );
      }
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
        scope,
        exportFormat,
        tables: scope === "selected" ? selectedTables : undefined,
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
        /route is not loaded|not configured|confirmation|passphrase|pg_dump|already running|forbidden|permission|unauthorized|select at least/i.test(
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
      ) {
        return;
      }
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
      } else {
        setOperationError(
          "No unique matching backup job could be confirmed. Keep this preparation and review the gateway job history before another start.",
        );
      }
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

  const handleStageTableDump = (tables: string[]) => {
    setSelectedTables(tables);
    setScope("selected");
    setActiveTab("backup");
  };

  const handleBrowseTable = (table: string) => {
    setExplorerTable(table);
    setActiveTab("explorer");
  };

  if (loading && !overview) return <BackupExportWorkspaceSkeleton />;

  if (error && !overview) {
    return (
      <div className="eflow-page-content">
        <WorkspaceHeader
          title="Backup"
          description="Create an audited, checksummed export of the live eFlow Supabase schema and operational data."
        />
        {gatewayUnavailable ? (
          <BackupGatewayUnavailable
            error={error}
            refreshing={refreshing}
            onRetry={() => void load(true)}
          />
        ) : (
          <FeedbackState
            tone="error"
            title="Backup access unavailable"
            onRetry={() => void load(true)}
            pending={refreshing}
          >
            {error}
          </FeedbackState>
        )}
      </div>
    );
  }

  const tabs: WorkspaceTab[] = [
    {
      id: "backup",
      label: "DB Dump & Backups",
      content: (
        <DatabaseDumpPanel
          overview={overview}
          refreshing={refreshing}
          busy={busy}
          uncertain={uncertain}
          activeJob={activeJob}
          mode={mode}
          onModeChange={setMode}
          scope={scope}
          onScopeChange={setScope}
          exportFormat={exportFormat}
          onExportFormatChange={setExportFormat}
          selectedTables={selectedTables}
          onSelectedTablesChange={setSelectedTables}
          confirmation={confirmation}
          onConfirmationChange={setConfirmation}
          passphrase={passphrase}
          onPassphraseChange={setPassphrase}
          repeatPassphrase={repeatPassphrase}
          onRepeatPassphraseChange={setRepeatPassphrase}
          includeStorageManifest={includeStorageManifest}
          onIncludeStorageManifestChange={setIncludeStorageManifest}
          reauthPassword={reauthPassword}
          onReauthPasswordChange={setReauthPassword}
          expectedConfirmation={expectedConfirmation}
          canStart={canStart}
          onStart={() => void create()}
          onDownload={(job) => void download(job)}
          onDelete={(job) => void remove(job)}
          onResetDraft={resetDraft}
          onOpenTablesCatalog={() => setActiveTab("tables")}
          onNotify={(message, tone) => toast(message, tone || "success")}
        />
      ),
    },
    {
      id: "explorer",
      label: "Important Data Explorer",
      content: (
        <ImportantDataExplorer
          active={activeTab === "explorer"}
          availableTables={overview?.preflight.tables || []}
          safeExcludedTables={overview?.preflight.safe_excluded_data_tables || []}
          selectedTable={explorerTable}
          onSelectTable={setExplorerTable}
          onStageTableDump={handleStageTableDump}
          onNotify={(message, tone) => toast(message, tone || "success")}
        />
      ),
    },
    {
      id: "tables",
      label: `Database Tables (${overview?.preflight.table_count || 0})`,
      content: (
        <SchemaTablesCatalog
          active={activeTab === "tables"}
          selectedTables={selectedTables}
          onSelectedTablesChange={setSelectedTables}
          onStageDumpWithSelected={() => {
            setScope("selected");
            setActiveTab("backup");
          }}
          onBrowseTable={handleBrowseTable}
          onNotify={(message, tone) => toast(message, tone || "success")}
        />
      ),
    },
  ];

  return (
    <div className="eflow-page-content min-w-0 space-y-4">
      <WorkspaceHeader
        title="Backup"
        description="Create database dumps, inspect key tables, and export records without changing live data."
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
        <FeedbackState
          tone="error"
          title="Backup status issue"
          onRetry={() => void load(true)}
        >
          {error}
        </FeedbackState>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--eflow-border)] bg-[var(--eflow-subtle)] px-4 py-3 text-sm">
        <div className="flex flex-wrap items-center gap-2.5">
          {overview?.preflight.configured ? (
            <ShieldCheck
              size={17}
              aria-hidden="true"
              className="text-[var(--eflow-positive-text)]"
            />
          ) : (
            <ShieldAlert
              size={17}
              aria-hidden="true"
              className="text-[var(--eflow-warning-text)]"
            />
          )}
          <span className="font-medium text-[var(--eflow-text)]">
            {overview?.preflight.configured
              ? "Backup service ready"
              : "Server setup needed before backups can run"}
          </span>
          <span className="eflow-tabular text-xs text-[var(--eflow-text-muted)]">
            {overview?.preflight.table_count || 0} tables ·{" "}
            {overview?.preflight.important_table_count ??
              overview?.preflight.important_tables?.length ??
              0}{" "}
            key tables · Retained {overview?.preflight.retention_hours || 24}h ·{" "}
            {recentCompleted} ready
          </span>
        </div>
        {exportedRows > 0 && (
          <span className="eflow-tabular text-xs text-[var(--eflow-text-muted)]">
            {exportedRows.toLocaleString()} rows exported
          </span>
        )}
      </div>

      {!overview?.preflight.configured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
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

      <WorkspaceTabs
        label="Backup & export workspaces"
        value={activeTab}
        onValueChange={(next) => setActiveTab(next as BackupWorkspaceTab)}
        tabs={tabs}
      />
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
