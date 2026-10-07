import { supabase } from "../../lib/supabase";
import { fetchConfig } from "../../lib/supabaseService";
import { SESSION_REFRESH_MESSAGE } from "./userFacingError";

const RETRYABLE_GATEWAY_STATUSES = new Set([502, 503, 504, 530]);

export const AI_RESTARTING_MESSAGE =
  "The AI service is down. The system detected the outage and is automatically restarting the secure connection. Please try again shortly.";

export const CONTROL_PANEL_UNAVAILABLE_MESSAGE =
  "The secure eFlow control service is unavailable. Please try again shortly.";

const AI_HEARTBEAT_MAX_AGE_MS = 45_000;

export type AiRuntimeStatus =
  | "online"
  | "offline"
  | "starting"
  | "restarting"
  | "unknown";

export type AiRuntimeState = {
  endpoint: string;
  status: AiRuntimeStatus;
  message: string;
};

export class AiServiceUnavailableError extends Error {
  constructor(message = AI_RESTARTING_MESSAGE) {
    super(message);
    this.name = "AiServiceUnavailableError";
  }
}

export class ControlPanelUnavailableError extends Error {
  constructor(message = CONTROL_PANEL_UNAVAILABLE_MESSAGE) {
    super(message);
    this.name = "ControlPanelUnavailableError";
  }
}

export type ControlPanelFetchOptions = {
  timeoutMs?: number;
  retryOnEndpointChange?: boolean;
  requireAiOnline?: boolean;
};

export function normalizeControlPanelBase(rawValue: string): string {
  const value = rawValue.trim().replace(/\/+$/, "");
  if (!value) return "";
  if (value === "/api" || value.endsWith("/controlpanelEflow/api")) return value;
  if (value.endsWith("/controlpanelEflow")) return `${value}/api`;

  try {
    const url = new URL(value);
    if (!url.pathname || url.pathname === "/") {
      return `${value}/controlpanelEflow/api`;
    }
  } catch {
    // Relative development proxy paths are valid and remain unchanged.
  }
  return value;
}

async function readPublishedEndpoint(): Promise<string | null> {
  // The published Cloudflare endpoint is the only route for online clients.
  // Do not fall back to /api: when eFlow runs on another laptop, that route
  // points at the browser host instead of the machine running the AI server.
  try {
    const endpoint = await fetchConfig("ai_endpoint");
    if (endpoint?.trim()) return endpoint;
    console.warn("[controlPanel] ai_endpoint key exists but value is empty or null");
  } catch (err) {
    // Surface this so we can diagnose — the UI shows a generic "restarting" message
    // but the real Supabase error is logged here.
    console.error("[controlPanel] fetchConfig(ai_endpoint) failed:", err);
  }
  return null;
}

export async function resolveControlPanelBase(): Promise<string> {
  if (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    return "/controlpanelEflow/api";
  }
  const endpoint = normalizeControlPanelBase((await readPublishedEndpoint()) || "");
  if (!endpoint) throw new ControlPanelUnavailableError();
  return endpoint;
}

export async function resolveAiControlPanelBase(): Promise<string> {
  const runtime = await getAiEndpointStatus();

  // Supabase status and heartbeat are advisory. The Cloudflare endpoint can
  // still be live while a state update is delayed or another host has just
  // restarted. Do not reject an import before attempting the authenticated
  // request; the gateway is the authoritative availability check.
  if (!runtime.endpoint) {
    console.error("[controlPanel] resolveAiControlPanelBase: endpoint is empty. Runtime state:", runtime);
    throw new AiServiceUnavailableError(runtime.message || AI_RESTARTING_MESSAGE);
  }
  return runtime.endpoint;
}

export async function getAiEndpointStatus(): Promise<AiRuntimeState> {
  // Primary: read AI config from the local EflowWeb server which uses the
  // service role key — this bypasses Supabase RLS and works on every machine
  // regardless of the browser client's auth state.
  let publishedEndpoint: string | null = null;
  let configuredStatus: string | null = null;
  let configuredMessage: string | null = null;
  let heartbeat: string | null = null;

  try {
    const resp = await fetch("/controlpanelEflow/api/ai/status");
    if (resp.ok) {
      const body = await resp.json() as {
        ai_endpoint?: string | null;
        ai_endpoint_status?: string | null;
        ai_endpoint_heartbeat?: string | null;
      };
      publishedEndpoint = body.ai_endpoint ?? null;
      configuredStatus = body.ai_endpoint_status ?? null;
      heartbeat = body.ai_endpoint_heartbeat ?? null;
    } else {
      // Fall through to the Supabase direct path below.
      throw new Error(`/ai/status returned ${resp.status}`);
    }
  } catch {
    // Fallback: read system_config directly via the Supabase client.
    // This works when the browser session is properly attached (Laptop A's own
    // browser with a valid JWT) but may return null if RLS blocks the read.
    [publishedEndpoint, configuredStatus, configuredMessage, heartbeat] = await Promise.all([
      readPublishedEndpoint(),
      fetchConfig("ai_endpoint_status").catch(() => null),
      fetchConfig("ai_endpoint_status_message").catch(() => null),
      fetchConfig("ai_endpoint_heartbeat").catch(() => null),
    ]);
  }

  const status = configuredStatus?.trim().toLowerCase();
  const effectiveStatus = status === "online" && !isAiHeartbeatFresh(heartbeat)
    ? "restarting"
    : status;
  return {
    endpoint: normalizeControlPanelBase(publishedEndpoint || ""),
    status:
      effectiveStatus === "online" ||
      effectiveStatus === "offline" ||
      effectiveStatus === "starting" ||
      effectiveStatus === "restarting"
        ? effectiveStatus
        : "unknown",
    message: effectiveStatus === "restarting" && status === "online"
      ? AI_RESTARTING_MESSAGE
      : configuredMessage?.trim() || (
      effectiveStatus === "offline" || effectiveStatus === "starting" || effectiveStatus === "restarting"
        ? AI_RESTARTING_MESSAGE
        : ""
    ),
  };
}

export function isAiHeartbeatFresh(
  heartbeat: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!heartbeat) return false;
  const timestamp = Date.parse(heartbeat);
  return Number.isFinite(timestamp) && now - timestamp <= AI_HEARTBEAT_MAX_AGE_MS;
}

export function isAiServiceUnavailableError(
  error: unknown,
): error is AiServiceUnavailableError {
  return error instanceof AiServiceUnavailableError;
}

async function getAccessToken(forceRefresh = false): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  let session = data.session;
  const expiresSoon = Boolean(
    session?.expires_at && session.expires_at * 1_000 <= Date.now() + 60_000,
  );
  if (forceRefresh || expiresSoon) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) throw new Error(SESSION_REFRESH_MESSAGE);
    session = refreshed.session;
  }
  const token = session?.access_token;
  if (!token) throw new Error(SESSION_REFRESH_MESSAGE);
  return token;
}

function joinEndpoint(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

async function authenticatedFetch(
  base: string,
  path: string,
  init: RequestInit,
  accessToken: string,
  timeoutMs?: number,
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  const controller = new AbortController();
  const timeout = timeoutMs
    ? globalThis.setTimeout(() => controller.abort(), timeoutMs)
    : null;

  try {
    return await fetch(joinEndpoint(base, path), {
      ...init,
      headers,
      signal: init.signal || controller.signal,
    });
  } catch (error) {
    // TypeError means the browser could not reach the server at all (dead tunnel
    // URL, DNS not resolved, connection refused). Surface a clear message so the
    // user knows the AI server is offline rather than seeing a raw "Failed to fetch".
    if (error instanceof TypeError) {
      throw new AiServiceUnavailableError(
        "The AI service connection is unreachable. The server may be offline or the secure tunnel has not started yet. Please try again in a moment.",
      );
    }
    throw error;
  } finally {
    if (timeout !== null) globalThis.clearTimeout(timeout);
  }
}

export async function controlPanelFetch(
  path: string,
  init: RequestInit = {},
  options: ControlPanelFetchOptions = {},
): Promise<Response> {
  const retryOnEndpointChange = options.retryOnEndpointChange !== false;
  // Refresh the signed-in user's token before reading system_config. Its RLS
  // policy returns an empty endpoint for an expired session, which previously
  // sent a remote browser to its own local /api route.
  let accessToken = await getAccessToken();
  const resolveBase = options.requireAiOnline
    ? resolveAiControlPanelBase
    : resolveControlPanelBase;
  const firstBase = await resolveBase();

  try {
    let response = await authenticatedFetch(
      firstBase,
      path,
      init,
      accessToken,
      options.timeoutMs,
    );
    // A token can be revoked or rotated before its local expiry time. Recover
    // once with the current Supabase session before surfacing an auth error.
    if (response.status === 401) {
      accessToken = await getAccessToken(true);
      response = await authenticatedFetch(firstBase, path, init, accessToken, options.timeoutMs);
      if (response.status === 401) throw new Error(SESSION_REFRESH_MESSAGE);
    }
    if (!retryOnEndpointChange || !RETRYABLE_GATEWAY_STATUSES.has(response.status)) {
      return response;
    }
  } catch (error) {
    if (!retryOnEndpointChange || (error instanceof DOMException && error.name === "AbortError")) {
      throw error;
    }
  }

  // A Quick Tunnel can rotate after discovery. Refetch the published endpoint
  // and retry exactly once — but only if the endpoint actually changed.
  // If the URL is the same the server is genuinely down; propagate the error.
  const refreshedBase = await resolveBase();
  if (refreshedBase === firstBase) {
    // Endpoint did not change — server is unreachable, surface a clear message.
    throw new AiServiceUnavailableError(
      "The AI service is unreachable. The secure tunnel may have gone offline. Please wait for it to restart automatically.",
    );
  }
  return authenticatedFetch(
    refreshedBase,
    path,
    init,
    accessToken,
    options.timeoutMs,
  );
}
