import { useCallback, useEffect, useRef, useState } from "react";
import { readableUiError } from "../../../shared/userFacingError";
import {
  buildProcessMiningScopeKey,
  fetchSavedProcessMiningSnapshot,
  runProcessMiningAnalysis,
  saveProcessMiningSnapshot,
} from "../services/processMiningService";
import type {
  ProcessMiningFilters,
  ProcessMiningProgress,
  ProcessMiningReport,
  SavedProcessMiningSnapshot,
} from "../types";

export const EMPTY_PROCESS_MINING_FILTERS: ProcessMiningFilters = {
  projectId: "",
  includeCompleted: true,
  fromDate: "",
  toDate: "",
};

const STORAGE_PREFIX = "eflow:deep-analysis:v2";

const INITIAL_PROGRESS: ProcessMiningProgress = {
  stage: "connecting",
  message: "Connecting to the analysis service…",
  history: [{ stage: "connecting", message: "Connecting to the analysis service…" }],
};

function snapshotStorageKey(scopeKey: string, filters: ProcessMiningFilters): string {
  return `${STORAGE_PREFIX}:${scopeKey || "office"}:${buildProcessMiningScopeKey(filters)}`;
}

function readLocalSnapshot(
  scopeKey: string,
  filters: ProcessMiningFilters,
): SavedProcessMiningSnapshot | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(snapshotStorageKey(scopeKey, filters));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedProcessMiningSnapshot>;
    if (!parsed || !parsed.report || !parsed.savedAt) return null;
    return {
      report: parsed.report,
      savedAt: String(parsed.savedAt),
      savedByName: parsed.savedByName ? String(parsed.savedByName) : null,
    };
  } catch {
    return null;
  }
}

function writeLocalSnapshot(
  scopeKey: string,
  filters: ProcessMiningFilters,
  snapshot: SavedProcessMiningSnapshot,
): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      snapshotStorageKey(scopeKey, filters),
      JSON.stringify(snapshot),
    );
  } catch {
    // Ignore storage quota or restricted storage cleanly.
  }
}

export function useProcessMiningAnalysis(
  initialProjectId = "",
  cacheScopeKey = "office",
  dbContext: { orgId?: string; userId?: string; userName?: string } = {},
) {
  const { orgId = "", userId = "", userName = "" } = dbContext;

  const [filters, setFilters] = useState<ProcessMiningFilters>(() => ({
    ...EMPTY_PROCESS_MINING_FILTERS,
    projectId: initialProjectId,
  }));
  const [report, setReport] = useState<ProcessMiningReport | null>(() =>
    readLocalSnapshot(cacheScopeKey, {
      ...EMPTY_PROCESS_MINING_FILTERS,
      projectId: initialProjectId,
    })?.report || null,
  );
  const [savedAt, setSavedAt] = useState<string | null>(() =>
    readLocalSnapshot(cacheScopeKey, {
      ...EMPTY_PROCESS_MINING_FILTERS,
      projectId: initialProjectId,
    })?.savedAt || null,
  );
  const [savedByName, setSavedByName] = useState<string | null>(() =>
    readLocalSnapshot(cacheScopeKey, {
      ...EMPTY_PROCESS_MINING_FILTERS,
      projectId: initialProjectId,
    })?.savedByName || null,
  );
  const [isCachedSnapshot, setIsCachedSnapshot] = useState(false);
  const [loading, setLoading] = useState(() => !report);
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState<ProcessMiningProgress | null>(INITIAL_PROGRESS);
  const [error, setError] = useState("");
  const [runNonce, setRunNonce] = useState(0);
  const requestSeq = useRef(0);

  const invalidDateRange = Boolean(
    filters.fromDate && filters.toDate && filters.fromDate > filters.toDate,
  );

  useEffect(() => {
    if (invalidDateRange) {
      setLoading(false);
      setRefreshing(false);
      setProgress(null);
      setError("The end date must be on or after the start date.");
      return;
    }

    const seq = ++requestSeq.current;
    const controller = new AbortController();
    let liveSettled = false;

    const cachedLocal = readLocalSnapshot(cacheScopeKey, filters);
    if (cachedLocal) {
      setReport(cachedLocal.report);
      setSavedAt(cachedLocal.savedAt);
      setSavedByName(cachedLocal.savedByName || null);
      setRefreshing(true);
      setLoading(false);
    } else {
      setReport(null);
      setSavedAt(null);
      setSavedByName(null);
      setLoading(true);
      setRefreshing(false);
    }
    setIsCachedSnapshot(false);
    setError("");
    setProgress(INITIAL_PROGRESS);

    // Fetch saved snapshot from Supabase DB so any browser/PC can view the latest saved run offline
    const dbPromise: Promise<SavedProcessMiningSnapshot | null> = orgId
      ? fetchSavedProcessMiningSnapshot(orgId, filters)
      : Promise.resolve(null);

    void dbPromise.then((dbSnap) => {
      if (seq !== requestSeq.current || controller.signal.aborted || liveSettled || !dbSnap) {
        return;
      }
      writeLocalSnapshot(cacheScopeKey, filters, dbSnap);
      setReport(dbSnap.report);
      setSavedAt(dbSnap.savedAt);
      setSavedByName(dbSnap.savedByName || null);
      setRefreshing(true);
      setLoading(false);
    });

    void runProcessMiningAnalysis(filters, {
      signal: controller.signal,
      onProgress: (next) => {
        if (seq === requestSeq.current && !controller.signal.aborted) {
          setProgress(next);
        }
      },
    })
      .then(async (nextReport) => {
        if (seq !== requestSeq.current || controller.signal.aborted) {
          return;
        }
        liveSettled = true;
        const immediateStamp = nextReport.summary.generatedAt || new Date().toISOString();
        const immediateSnap: SavedProcessMiningSnapshot = {
          report: nextReport,
          savedAt: immediateStamp,
          savedByName: userName || null,
        };
        writeLocalSnapshot(cacheScopeKey, filters, immediateSnap);
        setReport(nextReport);
        setSavedAt(immediateStamp);
        setSavedByName(userName || null);
        setIsCachedSnapshot(false);
        setError("");
        setLoading(false);
        setRefreshing(false);

        if (orgId) {
          const persisted = await saveProcessMiningSnapshot({
            orgId,
            userId: userId || undefined,
            userName: userName || undefined,
            filters,
            report: nextReport,
          });
          if (persisted && seq === requestSeq.current && !controller.signal.aborted) {
            writeLocalSnapshot(cacheScopeKey, filters, persisted);
            setSavedAt(persisted.savedAt);
            setSavedByName(persisted.savedByName || userName || null);
          }
        }
      })
      .catch(async (caught) => {
        if (caught instanceof DOMException && caught.name === "AbortError") {
          return;
        }
        if (seq !== requestSeq.current) {
          return;
        }
        liveSettled = true;
        const dbSnap = await dbPromise.catch(() => null);
        if (seq !== requestSeq.current || controller.signal.aborted) {
          return;
        }
        const fallback = dbSnap || readLocalSnapshot(cacheScopeKey, filters);
        if (fallback) {
          writeLocalSnapshot(cacheScopeKey, filters, fallback);
          setReport(fallback.report);
          setSavedAt(fallback.savedAt);
          setSavedByName(fallback.savedByName || null);
          setIsCachedSnapshot(true);
          setError("");
        } else {
          setError(
            readableUiError(
              caught,
              "Unable to reach the live analysis server right now.",
              "read",
            ),
          );
        }
        setLoading(false);
        setRefreshing(false);
      });

    return () => {
      controller.abort();
    };
  }, [cacheScopeKey, filters, invalidDateRange, orgId, runNonce, userId, userName]);

  const updateFilters = useCallback((patch: Partial<ProcessMiningFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_PROCESS_MINING_FILTERS);
  }, []);

  const refresh = useCallback(() => {
    setRunNonce((n) => n + 1);
  }, []);

  return {
    filters,
    updateFilters,
    clearFilters,
    refresh,
    report,
    savedAt,
    savedByName,
    isCachedSnapshot,
    loading,
    refreshing,
    progress,
    error,
    invalidDateRange,
  };
}
