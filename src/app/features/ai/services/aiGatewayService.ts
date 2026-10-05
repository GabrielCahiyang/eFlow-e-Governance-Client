import { fetchConfig } from "../../../../lib/supabaseService";
import { controlPanelFetch } from "../../../shared/controlPanelClient";

const DEFAULT_MODEL = "deepseek-r1:8b";
const DEFAULT_POLL_INTERVAL_MS = 1_500;
const DEFAULT_MAX_WAIT_MS = 2 * 60 * 60 * 1_000;

export type AiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiChatRequest = {
  model?: string;
  messages: AiChatMessage[];
  stream?: boolean;
  workspace_decomposition?: { schemaVersion: 1; projectId: string; sourceText: string; context: Record<string, unknown> };
  workspace_staffing?: { schemaVersion: 1; taskId: string };
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
  requestTimeoutMs?: number;
  maxWaitMs?: number;
  pollIntervalMs?: number;
  onQueueUpdate?: (update: AiQueueUpdate) => void;
};

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
    onQueueUpdate: provided.onQueueUpdate,
  };
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
    throw new Error(data.detail || data.error || `AI queue returned ${response.status}`);
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
  const requestId = crypto.randomUUID();
  const submitResponse = await controlPanelFetch(
    "ai/jobs",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: await resolveModel(request.model),
        messages: request.messages,
        stream: false,
        request_id: requestId,
        ...(request.workspace_decomposition ? { workspace_decomposition: request.workspace_decomposition } : {}),
        ...(request.workspace_staffing ? { workspace_staffing: request.workspace_staffing } : {}),
      }),
    },
    {
      timeoutMs: options.requestTimeoutMs,
      retryOnEndpointChange: true,
      requireAiOnline: true,
    },
  );

  let job = await readJobResponse(submitResponse);
  options.onQueueUpdate?.(queueUpdate(job));
  const deadline = Date.now() + options.maxWaitMs;

  while (job.status === "queued" || job.status === "processing") {
    if (Date.now() >= deadline) {
      throw new Error(
        "The AI job is still queued or processing. It was not cancelled; check again shortly.",
      );
    }
    await wait(options.pollIntervalMs);
    const statusResponse = await controlPanelFetch(
      `ai/jobs/${encodeURIComponent(job.job_id)}`,
      { method: "GET" },
      {
        timeoutMs: options.requestTimeoutMs,
        retryOnEndpointChange: true,
        requireAiOnline: true,
      },
    );
    job = await readJobResponse(statusResponse);
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
