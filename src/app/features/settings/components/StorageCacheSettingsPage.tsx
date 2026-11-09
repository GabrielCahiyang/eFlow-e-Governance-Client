import { useEffect, useState } from "react";
import { Database, HardDrive, RotateCcw, ShieldCheck } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import {
  inspectStorageAndCache,
  purgeAllQueryCaches,
  subscribeCacheDiagnostics,
  type StorageAndCacheDiagnostics,
} from "../../../shared/queryCache";
import {
  ResultMessage,
  SectionHeading,
  Surface,
  type Result,
} from "./settingsPrimitives";

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export function StorageCacheSettingsPage() {
  const { user, userProfile } = useAuth();
  const [diagnostics, setDiagnostics] = useState<StorageAndCacheDiagnostics>(
    () => inspectStorageAndCache(),
  );
  const [result, setResult] = useState<Result>(null);

  useEffect(() => {
    setDiagnostics(inspectStorageAndCache());
    return subscribeCacheDiagnostics(() => {
      setDiagnostics(inspectStorageAndCache());
    });
  }, []);

  const handleClearCachedData = () => {
    const outcome = purgeAllQueryCaches("manual");
    setDiagnostics(inspectStorageAndCache());
    setResult({
      tone: "success",
      text: `Cached data cleared (${outcome.clearedEntries} snapshot${outcome.clearedEntries === 1 ? "" : "s"} evicted). Drafts, attachments awaiting submission, and financial retry records were preserved.`,
    });
  };

  return (
    <div className="max-w-3xl space-y-5">
      <Surface className="p-5 sm:p-6">
        <SectionHeading
          icon={<Database size={19} />}
          eyebrow="Storage & cache"
          title="In-memory workspace cache"
          description="eFlow caches read-only workspace queries in memory for fast repeat navigation and deduplicates concurrent requests. Clearing cached data forces fresh server reads on next visit without affecting your work in progress."
        />

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
            <p className="text-[11px] font-medium text-neutral-500 dark:text-slate-400">
              Cached snapshots
            </p>
            <p
              data-testid="cache-entry-count"
              className="mt-1 text-lg font-semibold text-neutral-900 dark:text-slate-100"
            >
              {diagnostics.totalCachedEntries}
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
            <p className="text-[11px] font-medium text-neutral-500 dark:text-slate-400">
              Approximate memory usage
            </p>
            <p
              data-testid="cache-memory-bytes"
              className="mt-1 text-lg font-semibold text-neutral-900 dark:text-slate-100"
            >
              {formatBytes(diagnostics.approxCacheBytes)}
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
            <p className="text-[11px] font-medium text-neutral-500 dark:text-slate-400">
              Active scope
            </p>
            <p className="mt-1 truncate text-[13px] font-semibold text-neutral-900 dark:text-slate-100">
              {userProfile?.email || user?.email || "Authenticated session"}
            </p>
            <p className="text-[11px] text-neutral-500 dark:text-slate-400">
              Scope generation #{diagnostics.generation}
            </p>
          </div>
        </div>

        {diagnostics.domains.length > 0 && (
          <div className="mt-4 rounded-xl border border-neutral-200/80 p-3.5 dark:border-slate-800">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-400">
              Active cached domains
            </p>
            <div className="flex flex-wrap gap-2">
              {diagnostics.domains.map((item) => (
                <span
                  key={item.domain}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <span>{item.domain}</span>
                  <span className="text-neutral-400 dark:text-slate-400">
                    ({item.entries})
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200/80 pt-4 dark:border-slate-800">
          <div className="text-[11px] text-neutral-500 dark:text-slate-400">
            {diagnostics.lastClearedAt
              ? `Last cleared at ${new Date(diagnostics.lastClearedAt).toLocaleTimeString()}`
              : "Cache automatically resets on sign-out, account switch, or permission changes."}
          </div>
          <button
            type="button"
            onClick={handleClearCachedData}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-[12px] font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            <RotateCcw size={15} /> Clear cached data
          </button>
        </div>

        <div className="mt-4">
          <ResultMessage result={result} />
        </div>
      </Surface>

      <Surface className="p-5 sm:p-6">
        <SectionHeading
          icon={<HardDrive size={19} />}
          eyebrow="Protected local state"
          title="Preserved drafts & financial retry records"
          description="Clearing cached data never deletes unsaved drafts, attachments awaiting submission, or pending financial reconciliation records."
        />

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
            <p className="text-[11px] font-medium text-neutral-500 dark:text-slate-400">
              Work & hierarchy drafts
            </p>
            <p
              data-testid="protected-work-drafts"
              className="mt-1 text-base font-semibold text-neutral-900 dark:text-slate-100"
            >
              {diagnostics.protectedRecords.workDraftsCount} preserved
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
            <p className="text-[11px] font-medium text-neutral-500 dark:text-slate-400">
              Review feedback drafts
            </p>
            <p
              data-testid="protected-review-drafts"
              className="mt-1 text-base font-semibold text-neutral-900 dark:text-slate-100"
            >
              {diagnostics.protectedRecords.reviewDraftsCount} preserved
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
            <p className="text-[11px] font-medium text-neutral-500 dark:text-slate-400">
              Financial retry receipts
            </p>
            <p
              data-testid="protected-financial-retries"
              className="mt-1 text-base font-semibold text-neutral-900 dark:text-slate-100"
            >
              {diagnostics.protectedRecords.financialRetryCount} preserved
            </p>
          </div>
        </div>
      </Surface>

      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-[12px] text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-200">
        <ShieldCheck size={17} className="mt-0.5 shrink-0" />
        <p>
          Cached permissions, balances, and capabilities are never used as
          authority for financial transactions or consequential actions. All
          mutations are validated directly by the server.
        </p>
      </div>
    </div>
  );
}
