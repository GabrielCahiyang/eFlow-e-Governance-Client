import { supabase } from "../../../../lib/supabase";
import { controlPanelFetch } from "../../../shared/controlPanelClient";
import type {
  ProcessMiningFilters,
  ProcessMiningJobSnapshot,
  ProcessMiningProgress,
  ProcessMiningReport,
  SavedProcessMiningSnapshot,
} from "../types";

const POLL_INTERVAL_MS = 250;
const MAX_WAIT_MS = 120_000;

export function buildProcessMiningScopeKey(filters: ProcessMiningFilters): string {
  return [
    `project=${filters.projectId || "all"}`,
    `completed=${filters.includeCompleted ? "1" : "0"}`,
    `from=${filters.fromDate || ""}`,
    `to=${filters.toDate || ""}`,
  ].join("|");
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = globalThis.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      globalThis.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function parseErrorDetail(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => ({}))) as {
    detail?: unknown;
    error?: unknown;
  };
  if (typeof payload.detail === "string" && payload.detail.trim()) return payload.detail.trim();
  if (typeof payload.error === "string" && payload.error.trim()) return payload.error.trim();
  return `${fallback} (${response.status})`;
}

export async function fetchSavedProcessMiningSnapshot(
  orgId: string,
  filters: ProcessMiningFilters,
): Promise<SavedProcessMiningSnapshot | null> {
  if (!orgId) return null;
  try {
    const { data, error } = await supabase
      .from("process_mining_snapshots")
      .select("report, saved_at, generated_at, saved_by_name")
      .eq("org_id", orgId)
      .eq("scope_key", buildProcessMiningScopeKey(filters))
      .maybeSingle();

    if (error || !data || !data.report || typeof data.report !== "object") {
      return null;
    }
    return {
      report: data.report as ProcessMiningReport,
      savedAt: String(data.saved_at || data.generated_at || ""),
      savedByName: typeof data.saved_by_name === "string" && data.saved_by_name.trim()
        ? data.saved_by_name.trim()
        : null,
    };
  } catch {
    return null;
  }
}

export async function saveProcessMiningSnapshot(params: {
  orgId: string;
  userId?: string;
  userName?: string;
  filters: ProcessMiningFilters;
  report: ProcessMiningReport;
}): Promise<SavedProcessMiningSnapshot | null> {
  if (!params.orgId) return null;
  const nowIso = new Date().toISOString();
  const actorName = (params.userName || "").trim();
  try {
    const { data, error } = await supabase
      .from("process_mining_snapshots")
      .upsert(
        {
          org_id: params.orgId,
          scope_key: buildProcessMiningScopeKey(params.filters),
          project_id: params.filters.projectId || null,
          include_completed: params.filters.includeCompleted,
          from_date: params.filters.fromDate || null,
          to_date: params.filters.toDate || null,
          report: params.report,
          summary: params.report.summary,
          generated_at: params.report.summary.generatedAt || nowIso,
          saved_at: nowIso,
          saved_by: params.userId || null,
          saved_by_name: actorName,
        },
        { onConflict: "org_id,scope_key" },
      )
      .select("saved_at, saved_by_name")
      .maybeSingle();

    if (error) {
      return null;
    }
    return {
      report: params.report,
      savedAt: String(data?.saved_at || nowIso),
      savedByName: (typeof data?.saved_by_name === "string" && data.saved_by_name.trim()) || actorName || null,
    };
  } catch {
    return null;
  }
}

export async function startProcessMiningJob(
  filters: ProcessMiningFilters,
  requestId: string,
  signal?: AbortSignal,
): Promise<ProcessMiningJobSnapshot> {
  const response = await controlPanelFetch(
    "process-mining/jobs",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        ...(filters.projectId ? { project_id: filters.projectId } : {}),
        include_completed: filters.includeCompleted,
        ...(filters.fromDate ? { from_date: filters.fromDate } : {}),
        ...(filters.toDate ? { to_date: filters.toDate } : {}),
        request_id: requestId,
      }),
    },
    {
      timeoutMs: 25_000,
      requireAiOnline: false,
      retryOnEndpointChange: true,
    },
  );

  if (!response.ok) {
    throw new Error(await parseErrorDetail(response, "Unable to start Process Mining analysis"));
  }
  return (await response.json()) as ProcessMiningJobSnapshot;
}

export async function getProcessMiningJob(
  jobId: string,
  signal?: AbortSignal,
): Promise<ProcessMiningJobSnapshot> {
  const response = await controlPanelFetch(
    `process-mining/jobs/${encodeURIComponent(jobId)}`,
    { method: "GET", signal },
    {
      timeoutMs: 20_000,
      requireAiOnline: false,
      retryOnEndpointChange: true,
    },
  );
  if (!response.ok) {
    throw new Error(await parseErrorDetail(response, "Unable to read Process Mining progress"));
  }
  return (await response.json()) as ProcessMiningJobSnapshot;
}

export async function cancelProcessMiningJob(jobId: string): Promise<void> {
  try {
    await controlPanelFetch(
      `process-mining/jobs/${encodeURIComponent(jobId)}`,
      { method: "DELETE" },
      { timeoutMs: 8_000, requireAiOnline: false, retryOnEndpointChange: false },
    );
  } catch {
    // Best-effort cancellation on unmount/supersede.
  }
}

export async function runProcessMiningAnalysis(
  filters: ProcessMiningFilters,
  options: {
    requestId?: string;
    signal?: AbortSignal;
    onProgress?: (progress: ProcessMiningProgress) => void;
  } = {},
): Promise<ProcessMiningReport> {
  const requestId = options.requestId || crypto.randomUUID();
  let snapshot = await startProcessMiningJob(filters, requestId, options.signal);

  const emitProgress = (current: ProcessMiningJobSnapshot) => {
    if (current.progress && options.onProgress) {
      options.onProgress(current.progress);
    }
  };
  emitProgress(snapshot);

  const deadline = Date.now() + MAX_WAIT_MS;
  try {
    while (snapshot.status === "queued" || snapshot.status === "processing") {
      if (options.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      if (Date.now() >= deadline) {
        throw new Error("Deep Process Analysis took longer than expected. Refresh to retry.");
      }
      await sleep(POLL_INTERVAL_MS, options.signal);
      snapshot = await getProcessMiningJob(snapshot.job_id, options.signal);
      emitProgress(snapshot);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError" && snapshot.job_id) {
      void cancelProcessMiningJob(snapshot.job_id);
    }
    throw error;
  }

  if (snapshot.status === "failed") {
    throw new Error(snapshot.error || "Deep Process Analysis could not finish.");
  }
  if (!snapshot.result) {
    throw new Error("Process Mining finished without analysis output.");
  }
  return snapshot.result;
}
