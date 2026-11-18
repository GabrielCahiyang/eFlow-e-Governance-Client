import { useSyncExternalStore } from "react";

export type ConnectivityStatus = "online" | "slow" | "offline";

export interface ConnectivitySnapshot {
  status: ConnectivityStatus;
  checking: boolean;
  lastCheckedAt: number | null;
}

export const SLOW_CONNECTION_THRESHOLD_MS = 8000;
export const SLOW_RTT_MS = 3000;
export const PROBE_TIMEOUT_MS = 6000;
export const OFFLINE_RETRY_INTERVAL_MS = 10_000;

interface NetworkInformationLike {
  effectiveType?: string;
  rtt?: number;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

function getNetworkInformation(): NetworkInformationLike | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
}

export function isNavigatorOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function isNetworkInformationSlow(): boolean {
  const connection = getNetworkInformation();
  if (!connection) return false;
  if (connection.effectiveType === "slow-2g" || connection.effectiveType === "2g") {
    return true;
  }
  return typeof connection.rtt === "number" && connection.rtt >= SLOW_RTT_MS;
}

export function isNetworkFetchError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof DOMException && error.name === "AbortError") return false;
  if (error instanceof Error && error.name === "AbortError") return false;
  if (error instanceof TypeError) return true;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const lower = message.toLowerCase();
  return (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network request failed") ||
    lower.includes("load failed") ||
    lower.includes("err_internet_disconnected") ||
    lower.includes("err_name_not_resolved")
  );
}

function getSupabaseOrigin(): string | null {
  const rawUrl =
    typeof import.meta !== "undefined" && import.meta.env
      ? (import.meta.env.VITE_SUPABASE_URL as string | undefined)
      : undefined;
  if (!rawUrl || typeof rawUrl !== "string") return null;
  try {
    return new URL(rawUrl).origin;
  } catch {
    return null;
  }
}

function getSupabaseAnonKey(): string | null {
  const key =
    typeof import.meta !== "undefined" && import.meta.env
      ? (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
      : undefined;
  return typeof key === "string" && key.trim() ? key : null;
}

/**
 * Only monitor real internet/Supabase requests so local dev tools
 * (Vite HMR on localhost:5173 or optional local Python gateway on :8322)
 * never trigger false "No internet" alerts when stopped or restarting.
 */
export function shouldMonitorRequestUrl(input: RequestInfo | URL): boolean {
  if (typeof window === "undefined") return false;
  let urlString = "";
  if (typeof input === "string") {
    urlString = input;
  } else if (input instanceof URL) {
    urlString = input.href;
  } else if (typeof Request !== "undefined" && input instanceof Request) {
    urlString = input.url;
  }
  if (!urlString) return false;

  let parsed: URL;
  try {
    parsed = new URL(urlString, window.location.href);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;

  const supabaseOrigin = getSupabaseOrigin();
  if (supabaseOrigin) {
    return parsed.origin === supabaseOrigin;
  }
  if (parsed.pathname.startsWith("/controlpanelEflow/")) return false;
  if (
    parsed.pathname.startsWith("/@vite/") ||
    parsed.pathname.startsWith("/@fs/") ||
    parsed.pathname.startsWith("/src/") ||
    parsed.pathname.startsWith("/node_modules/")
  ) {
    return false;
  }
  return true;
}

const listeners = new Set<() => void>();
let listenersInstalled = false;
let fetchMonitorInstalled = false;
let originalFetch: typeof fetch | null = null;
let offlinePollTimer: number | null = null;
let recoveryProbeTimer: number | null = null;
let inFlightProbe: Promise<ConnectivityStatus> | null = null;
let consecutiveFailures = 0;
let visibilitySleepEpoch = 0;
const activeSlowRequests = new Set<symbol>();

function shouldMonitorSlowLatency(input: RequestInfo | URL, init?: RequestInit): boolean {
  const body = init?.body;
  if (
    body &&
    ((typeof FormData !== "undefined" && body instanceof FormData) ||
      (typeof Blob !== "undefined" && body instanceof Blob) ||
      body instanceof ArrayBuffer ||
      ArrayBuffer.isView(body))
  ) {
    return false;
  }
  const urlString =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : typeof Request !== "undefined" && input instanceof Request
          ? input.url
          : "";
  if (!urlString || typeof window === "undefined") return true;
  try {
    const parsed = new URL(urlString, window.location.href);
    if (
      parsed.pathname.includes("/storage/v1/") ||
      parsed.pathname.includes("/realtime/v1/")
    ) {
      return false;
    }
  } catch {
    return true;
  }
  return true;
}

function clearRecoveryProbe() {
  if (recoveryProbeTimer !== null && typeof window !== "undefined") {
    window.clearTimeout(recoveryProbeTimer);
    recoveryProbeTimer = null;
  }
}

function scheduleRecoveryProbe() {
  if (typeof window === "undefined" || recoveryProbeTimer !== null) return;
  recoveryProbeTimer = window.setTimeout(() => {
    recoveryProbeTimer = null;
    if (
      snapshot.status === "slow" &&
      activeSlowRequests.size === 0 &&
      (typeof document === "undefined" || document.visibilityState === "visible")
    ) {
      void probeConnectivity();
    }
  }, 4_000);
}

let snapshot: ConnectivitySnapshot = {
  status: isNavigatorOffline() ? "offline" : isNetworkInformationSlow() ? "slow" : "online",
  checking: false,
  lastCheckedAt: null,
};

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function updateSnapshot(next: Partial<ConnectivitySnapshot>) {
  const status = next.status ?? snapshot.status;
  const checking = next.checking ?? snapshot.checking;
  const lastCheckedAt = next.lastCheckedAt ?? snapshot.lastCheckedAt;
  if (
    status === snapshot.status &&
    checking === snapshot.checking &&
    lastCheckedAt === snapshot.lastCheckedAt
  ) {
    return;
  }
  snapshot = { status, checking, lastCheckedAt };
  syncOfflinePolling(status);
  emit();
}

function syncOfflinePolling(status: ConnectivityStatus) {
  if (typeof window === "undefined") return;
  if (status === "offline") {
    if (offlinePollTimer === null) {
      offlinePollTimer = window.setInterval(() => {
        if (typeof document === "undefined" || document.visibilityState === "visible") {
          void probeConnectivity();
        }
      }, OFFLINE_RETRY_INTERVAL_MS);
    }
    return;
  }
  if (offlinePollTimer !== null) {
    window.clearInterval(offlinePollTimer);
    offlinePollTimer = null;
  }
}

function resolveProbeTarget(): { url: string; headers?: Record<string, string>; method: "GET" | "HEAD" } | null {
  const supabaseOrigin = getSupabaseOrigin();
  if (supabaseOrigin) {
    const anonKey = getSupabaseAnonKey();
    return {
      url: `${supabaseOrigin}/auth/v1/health`,
      headers: anonKey ? { apikey: anonKey } : undefined,
      method: "GET",
    };
  }
  if (typeof window !== "undefined" && window.location.origin.startsWith("http")) {
    return {
      url: `${window.location.origin}/`,
      method: "HEAD",
    };
  }
  return null;
}

/** Verify actual reachability and round-trip latency against the backend. */
export async function probeConnectivity(): Promise<ConnectivityStatus> {
  if (inFlightProbe) return inFlightProbe;
  if (isNavigatorOffline()) {
    consecutiveFailures = 0;
    updateSnapshot({ status: "offline", checking: false, lastCheckedAt: Date.now() });
    return "offline";
  }

  const target = resolveProbeTarget();
  const fetchImpl = originalFetch ?? (typeof fetch === "function" ? fetch.bind(globalThis) : null);
  if (!target || !fetchImpl) {
    const fallbackStatus: ConnectivityStatus = isNetworkInformationSlow() ? "slow" : "online";
    updateSnapshot({ status: fallbackStatus, checking: false, lastCheckedAt: Date.now() });
    return fallbackStatus;
  }

  updateSnapshot({ checking: true });

  inFlightProbe = (async () => {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId =
      controller && typeof window !== "undefined"
        ? window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
        : null;
    const startedAt = Date.now();

    try {
      await fetchImpl(target.url, {
        method: target.method,
        headers: target.headers,
        cache: "no-store",
        signal: controller?.signal,
      });
      const elapsed = Date.now() - startedAt;
      consecutiveFailures = 0;
      const nextStatus: ConnectivityStatus =
        elapsed >= SLOW_CONNECTION_THRESHOLD_MS ? "slow" : "online";
      updateSnapshot({ status: nextStatus, checking: false, lastCheckedAt: Date.now() });
      return nextStatus;
    } catch {
      consecutiveFailures += 1;
      const nextStatus: ConnectivityStatus =
        isNavigatorOffline() || consecutiveFailures >= 2 || snapshot.status === "offline"
          ? "offline"
          : snapshot.status;
      updateSnapshot({ status: nextStatus, checking: false, lastCheckedAt: Date.now() });
      return nextStatus;
    } finally {
      if (timeoutId !== null && typeof window !== "undefined") {
        window.clearTimeout(timeoutId);
      }
      inFlightProbe = null;
    }
  })();

  return inFlightProbe;
}

function handleOnline() {
  consecutiveFailures = 0;
  updateSnapshot({
    status: isNetworkInformationSlow() ? "slow" : "online",
  });
  if (!import.meta.env?.VITEST) {
    void probeConnectivity();
  }
}

function handleOffline() {
  consecutiveFailures = 0;
  updateSnapshot({ status: "offline", checking: false, lastCheckedAt: Date.now() });
}

function handleConnectionChange() {
  if (isNavigatorOffline()) {
    handleOffline();
    return;
  }
  if (snapshot.status !== "offline") {
    const nextStatus: ConnectivityStatus =
      activeSlowRequests.size > 0 || isNetworkInformationSlow() ? "slow" : "online";
    updateSnapshot({ status: nextStatus });
    if (nextStatus === "slow" && activeSlowRequests.size === 0 && !import.meta.env?.VITEST) {
      scheduleRecoveryProbe();
    }
  }
}

function handleVisibilityChange() {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    visibilitySleepEpoch += 1;
    activeSlowRequests.clear();
    if (snapshot.status === "slow") {
      updateSnapshot({ status: "online" });
    }
  }
}

function ensureWindowListeners() {
  if (listenersInstalled || typeof window === "undefined") return;
  listenersInstalled = true;
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  getNetworkInformation()?.addEventListener?.("change", handleConnectionChange);
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }

  if (isNavigatorOffline()) {
    updateSnapshot({ status: "offline", checking: false });
  }
}

/**
 * Observe real Supabase/remote fetch timing and network failures globally.
 * Safe to call multiple times; wraps window.fetch once.
 */
export function installConnectivityMonitor(): void {
  ensureWindowListeners();
  if (fetchMonitorInstalled || typeof window === "undefined" || typeof window.fetch !== "function") {
    return;
  }
  fetchMonitorInstalled = true;
  const nativeFetch = window.fetch.bind(window);
  originalFetch = nativeFetch;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (!shouldMonitorRequestUrl(input)) {
      return nativeFetch(input, init);
    }

    const reqToken = Symbol("monitored-fetch");
    const monitorSlow = shouldMonitorSlowLatency(input, init);
    const startSleepEpoch = visibilitySleepEpoch;
    const startedHidden =
      typeof document !== "undefined" && document.visibilityState === "hidden";
    const slowTimer =
      monitorSlow && !startedHidden
        ? window.setTimeout(() => {
            const tabHidden =
              typeof document !== "undefined" && document.visibilityState === "hidden";
            if (!tabHidden && visibilitySleepEpoch === startSleepEpoch && !isNavigatorOffline()) {
              activeSlowRequests.add(reqToken);
              if (snapshot.status === "online") {
                updateSnapshot({ status: "slow" });
              }
            }
          }, SLOW_CONNECTION_THRESHOLD_MS)
        : null;

    try {
      const response = await nativeFetch(input, init);
      if (slowTimer !== null) window.clearTimeout(slowTimer);
      activeSlowRequests.delete(reqToken);
      consecutiveFailures = 0;

      const nextStatus: ConnectivityStatus = isNavigatorOffline()
        ? "offline"
        : activeSlowRequests.size > 0
          ? "slow"
          : "online";
      if (nextStatus === "online") clearRecoveryProbe();
      updateSnapshot({ status: nextStatus, lastCheckedAt: Date.now() });
      return response;
    } catch (error) {
      if (slowTimer !== null) window.clearTimeout(slowTimer);
      activeSlowRequests.delete(reqToken);
      if (isNavigatorOffline()) {
        clearRecoveryProbe();
        updateSnapshot({ status: "offline", lastCheckedAt: Date.now() });
      } else if (isNetworkFetchError(error)) {
        consecutiveFailures += 1;
        if (consecutiveFailures >= 2) {
          clearRecoveryProbe();
          updateSnapshot({ status: "offline", lastCheckedAt: Date.now() });
        } else {
          void probeConnectivity();
        }
      }
      throw error;
    }
  };
}

function subscribe(listener: () => void): () => void {
  ensureWindowListeners();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ConnectivitySnapshot {
  return snapshot;
}

/** Subscribe to live browser and backend network connectivity state. */
export function useNetworkConnectivity() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    ...state,
    isOffline: state.status === "offline",
    isSlow: state.status === "slow",
    retry: probeConnectivity,
  };
}

/** Reset module state and listeners (intended for unit test isolation). */
export function resetConnectivityForTests(): void {
  if (typeof window !== "undefined") {
    if (listenersInstalled) {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      getNetworkInformation()?.removeEventListener?.("change", handleConnectionChange);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    }
    if (fetchMonitorInstalled && originalFetch) {
      window.fetch = originalFetch;
    }
    if (offlinePollTimer !== null) {
      window.clearInterval(offlinePollTimer);
      offlinePollTimer = null;
    }
    clearRecoveryProbe();
  }
  listenersInstalled = false;
  fetchMonitorInstalled = false;
  originalFetch = null;
  inFlightProbe = null;
  consecutiveFailures = 0;
  visibilitySleepEpoch = 0;
  activeSlowRequests.clear();
  listeners.clear();
  snapshot = {
    status: isNavigatorOffline() ? "offline" : isNetworkInformationSlow() ? "slow" : "online",
    checking: false,
    lastCheckedAt: null,
  };
}
