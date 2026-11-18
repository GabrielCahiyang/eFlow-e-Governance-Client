import { fetchConfig } from "../../../../lib/supabaseService";
import { controlPanelFetch } from "../../../shared/controlPanelClient";

const DEFAULT_MODEL = "deepseek-r1:8b";
const DEFAULT_POLL_INTERVAL_MS = 1_500;
const DEFAULT_MAX_WAIT_MS = 2 * 60 * 60 * 1_000;
const DEFAULT_RECONNECT_BUDGET_MS = 5 * 60 * 1_000;
const RETRYABLE_JOB_HTTP_STATUSES = new Set([502, 503, 504, 524, 530]);
const RECONNECT_BACKOFF_STEPS_MS = [2_000, 4_000, 8_000, 15_000];

export type AiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiChatRequest = {
  model?: string;
  messages: AiChatMessage[];
  stream?: boolean;
  pdf_office_extraction?: { schemaVersion: 1; document: string; tasks: Array<{key:string;title:string}> };
  workspace_decomposition?: { schemaVersion: 1; projectId: string; sourceText: string; context: Record<string, unknown> };
  workspace_staffing?: { schemaVersion: 1; taskId: string; autoAssign?: boolean; projectId?: string; draftTask?: {title:string;description:string;estimatedHours:number}; plannedAssignments?: Array<{lead:string;hours:number}> };
  pdf_table_enrichment?: {
    schemaVersion: 1;
    tasks: Array<{ key: string; title: string; methodology: string[]; schedule: string }>;
    costs: Array<{ sourceId: string }>;
  };
};

export type AiChatResponse = {
  model?: string;
  message?: { role?: string; content?: string };
  choices?: Array<{ message?: { content?: string } }>;
  response?: string;
  content?: string;
  done?: boolean;
  error?: string;
};

export type AiJobStatus = "queued" | "processing" | "completed" | "failed";

export interface AiProcessingProgress {
  stage: string; message: string; current?: number | null; total?: number | null; updated_at?: number;
  history?: Array<{ stage: string; message: string }>;
}

export type AiQueueUpdate = {
  jobId: string;
  status: AiJobStatus;
  position: number | null;
  jobsAhead: number;
  queueDepth: number;
  progress?: AiProcessingProgress | null;
};

export type AiChatRequestOptions = {
  requestId?: string;
  requestTimeoutMs?: number;
  maxWaitMs?: number;
  pollIntervalMs?: number;
  reconnectBudgetMs?: number;
  onQueueUpdate?: (update: AiQueueUpdate) => void;
};

class JobHttpStatusError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "JobHttpStatusError";
    this.status = status;
  }
}

type AiJobResponse = {
  job_id: string;
  status: AiJobStatus;
  position: number | null;
  jobs_ahead: number;
  queue_depth: number;
  progress?: AiProcessingProgress | null;
  result: AiChatResponse | null;
  error: string | null;
  detail?: string;
};

async function resolveModel(requestedModel?: string): Promise<string> {
  if (requestedModel?.trim()) return requestedModel.trim();
  const configuredModel = await fetchConfig("ai_model").catch(() => null);
  return configuredModel?.trim() || DEFAULT_MODEL;
}

function normalizeOptions(
  timeoutOrOptions: number | AiChatRequestOptions,
): Required<Omit<AiChatRequestOptions, "onQueueUpdate">> &
  Pick<AiChatRequestOptions, "onQueueUpdate"> {
  const provided = typeof timeoutOrOptions === "number"
    ? { requestTimeoutMs: timeoutOrOptions }
    : timeoutOrOptions;
  return {
    requestTimeoutMs: provided.requestTimeoutMs ?? 30_000,
    maxWaitMs: provided.maxWaitMs ?? DEFAULT_MAX_WAIT_MS,
    pollIntervalMs: provided.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
    reconnectBudgetMs: provided.reconnectBudgetMs ?? DEFAULT_RECONNECT_BUDGET_MS,
    onQueueUpdate: provided.onQueueUpdate,
    requestId: provided.requestId ?? crypto.randomUUID(),
  };
}

function isRetryableTransportError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true;
  }
  if (
    error instanceof Error &&
    (error.name === "AiServiceUnavailableError" ||
      error.name === "ControlPanelUnavailableError")
  ) {
    return true;
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }
  if (
    error instanceof JobHttpStatusError &&
    RETRYABLE_JOB_HTTP_STATUSES.has(error.status)
  ) {
    return true;
  }
  return false;
}

function queueUpdate(job: AiJobResponse): AiQueueUpdate {
  return {
    jobId: job.job_id,
    status: job.status,
    position: job.position,
    jobsAhead: job.jobs_ahead,
    queueDepth: job.queue_depth,
    progress: job.progress,
  };
}

async function readJobResponse(response: Response): Promise<AiJobResponse> {
  const data = (await response.json().catch(() => ({}))) as Partial<AiJobResponse> & {
    error?: string;
  };
  if (!response.ok) {
    throw new JobHttpStatusError(
      response.status,
      data.detail || data.error || `AI queue returned ${response.status}`,
    );
  }
  if (!data.job_id || !data.status) {
    throw new Error("AI queue returned an invalid job response.");
  }
  return data as AiJobResponse;
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, delayMs));
}

export async function requestAiChat(
  request: AiChatRequest,
  timeoutOrOptions: number | AiChatRequestOptions,
): Promise<AiChatResponse> {
  const options = normalizeOptions(timeoutOrOptions);
  const requestId = options.requestId;
  const resolvedModel = await resolveModel(request.model);
  const submitBody = JSON.stringify({
    model: resolvedModel,
    messages: request.messages,
    stream: false,
    request_id: requestId,
    ...(request.pdf_office_extraction ? { pdf_office_extraction: request.pdf_office_extraction } : {}),
    ...(request.workspace_decomposition ? { workspace_decomposition: request.workspace_decomposition } : {}),
    ...(request.workspace_staffing ? { workspace_staffing: request.workspace_staffing } : {}),
    ...(request.pdf_table_enrichment ? { pdf_table_enrichment: request.pdf_table_enrichment } : {}),
  });

  const withReconnect = async <T>(
    operation: () => Promise<T>,
    activeJobId?: string,
  ): Promise<T> => {
    const budgetMs = Math.max(0, options.reconnectBudgetMs);
    const reconnectDeadline = Date.now() + budgetMs;
    let attempt = 0;
    while (true) {
      try {
        return await operation();
      } catch (error) {
        if (!isRetryableTransportError(error) || Date.now() >= reconnectDeadline) {
          throw error;
        }
        const backoff =
          RECONNECT_BACKOFF_STEPS_MS[
            Math.min(attempt, RECONNECT_BACKOFF_STEPS_MS.length - 1)
          ];
        const delayMs = Math.min(backoff, Math.max(0, reconnectDeadline - Date.now()));
        attempt += 1;
        options.onQueueUpdate?.({
          jobId: activeJobId ?? requestId,
          status: "processing",
          position: null,
          jobsAhead: 0,
          queueDepth: 1,
          progress: {
            stage: "reconnecting",
            message: "Reconnecting to the AI service…",
          },
        });
        if (delayMs > 0) await wait(delayMs);
      }
    }
  };

  const submitJob = () =>
    withReconnect(async () => {
      const submitResponse = await controlPanelFetch(
        "ai/jobs",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: submitBody,
        },
        {
          timeoutMs: options.requestTimeoutMs,
          retryOnEndpointChange: true,
          requireAiOnline: true,
        },
      );
      return readJobResponse(submitResponse);
    });

  let job = await submitJob();
  options.onQueueUpdate?.(queueUpdate(job));
  const deadline = Date.now() + options.maxWaitMs;

  while (job.status === "queued" || job.status === "processing") {
    if (Date.now() >= deadline) {
      throw new Error(
        "The AI job is still queued or processing. It was not cancelled; check again shortly.",
      );
    }
    await wait(options.pollIntervalMs);
    try {
      job = await withReconnect(async () => {
        const statusResponse = await controlPanelFetch(
          `ai/jobs/${encodeURIComponent(job.job_id)}`,
          { method: "GET" },
          {
            timeoutMs: options.requestTimeoutMs,
            retryOnEndpointChange: true,
            requireAiOnline: true,
          },
        );
        return readJobResponse(statusResponse);
      }, job.job_id);
    } catch (error) {
      // If the AI server restarted and lost its in-memory job table (404),
      // resubmit with the same request_id so the server deduplicates or
      // restarts the step cleanly without failing the import.
      if (error instanceof JobHttpStatusError && error.status === 404) {
        job = await submitJob();
      } else {
        throw error;
      }
    }
    options.onQueueUpdate?.(queueUpdate(job));
  }

  if (job.status === "failed") {
    throw new Error(job.error || "The queued AI request failed.");
  }
  if (!job.result) {
    throw new Error("The AI job completed without a result.");
  }
  return job.result;
}

export function readAiText(response: AiChatResponse): string {
  return (
    response.message?.content ||
    response.choices?.[0]?.message?.content ||
    response.response ||
    response.content ||
    ""
  );
}
