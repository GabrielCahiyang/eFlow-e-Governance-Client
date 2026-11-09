import { registerAuthCacheReset } from "./authCacheReset";

export interface QueryScopeParts {
  userId?: string | null;
  workspaceId?: string | null;
  officeId?: string | null;
  projectId?: string | null;
  fiscalYear?: number | string | null;
  filter?: string | null;
}

export interface QueryCacheEntry<T = unknown> {
  domain: string;
  scope: string;
  data: T | undefined;
  hasData: boolean;
  updatedAt: number;
  staleAt: number;
  inFlight: Promise<T> | undefined;
  inFlightGeneration: number;
  generation: number;
  approxBytes: number;
}

export interface DomainCacheDiagnostic {
  domain: string;
  entries: number;
  approxBytes: number;
}

export interface ProtectedStorageCounts {
  workDraftsCount: number;
  reviewDraftsCount: number;
  financialRetryCount: number;
  notificationIntentCount: number;
  totalProtectedCount: number;
}

export interface StorageAndCacheDiagnostics {
  totalCachedEntries: number;
  approxCacheBytes: number;
  domains: DomainCacheDiagnostic[];
  lastClearedAt: string | null;
  lastClearReason: string | null;
  generation: number;
  protectedRecords: ProtectedStorageCounts;
}

type DomainEventType = "invalidated" | "evicted" | "updated";
type DomainListener = (event: { type: DomainEventType; scope?: string }) => void;

interface ExternalCacheRegistration {
  id: string;
  label: string;
  purge: () => void;
  inspect?: () => DomainCacheDiagnostic;
}

const DEFAULT_TTL_MS = 30_000;

let storeByDomain: Record<string, Record<string, QueryCacheEntry<any>>> = {};
let domainListeners: Record<string, DomainListener[]> = {};
let diagnosticsListeners: Array<() => void> = [];
let externalCaches: ExternalCacheRegistration[] = [];
let protectedReviewDraftCounter: (() => number) | null = null;
let globalGeneration = 1;
let lastClearedAtIso: string | null = null;
let lastClearReasonValue: string | null = null;

function estimateBytes(value: unknown): number {
  if (value === null || value === undefined) return 0;
  try {
    const serialized = JSON.stringify(value);
    return serialized ? serialized.length * 2 : 64;
  } catch {
    return 256;
  }
}

function notifyDiagnosticsListeners() {
  for (const listener of [...diagnosticsListeners]) {
    try {
      listener();
    } catch {
      // Ignore diagnostic listener errors.
    }
  }
}

function notifyDomain(domain: string, event: { type: DomainEventType; scope?: string }) {
  const listeners = domainListeners[domain];
  if (!listeners?.length) return;
  for (const listener of [...listeners]) {
    try {
      listener(event);
    } catch {
      // Ignore subscriber errors.
    }
  }
}

export function buildQueryScopeKey(parts: QueryScopeParts): string {
  const userPart = parts.userId ? `u:${parts.userId}` : "u:anon";
  const wsPart = parts.workspaceId ? `ws:${parts.workspaceId}` : "ws:default";
  const officePart = parts.officeId ? `org:${parts.officeId}` : "org:all";
  const projPart = parts.projectId ? `proj:${parts.projectId}` : "proj:all";
  const fyPart =
    parts.fiscalYear !== undefined && parts.fiscalYear !== null
      ? `fy:${parts.fiscalYear}`
      : "fy:all";
  const filterPart = parts.filter ? `f:${parts.filter}` : "f:none";
  return `${userPart}|${wsPart}|${officePart}|${projPart}|${fyPart}|${filterPart}`;
}

export function getQueryCacheGeneration(): number {
  return globalGeneration;
}

export function isDocumentVisible(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState !== "hidden";
}

function ensureEntry<T>(domain: string, scope: string): QueryCacheEntry<T> {
  if (!storeByDomain[domain]) {
    storeByDomain[domain] = {};
  }
  let entry = storeByDomain[domain][scope] as QueryCacheEntry<T> | undefined;
  if (!entry) {
    entry = {
      domain,
      scope,
      data: undefined,
      hasData: false,
      updatedAt: 0,
      staleAt: 0,
      inFlight: undefined,
      inFlightGeneration: globalGeneration,
      generation: globalGeneration,
      approxBytes: 0,
    };
    storeByDomain[domain][scope] = entry;
  }
  return entry;
}

export function readCachedQuery<T>(
  domain: string,
  scope: string,
): {
  hit: boolean;
  fresh: boolean;
  data: T | undefined;
  updatedAt: number;
  inFlight: Promise<T> | undefined;
  generation: number;
} {
  const domainBucket = storeByDomain[domain];
  const entry = domainBucket?.[scope] as QueryCacheEntry<T> | undefined;
  if (!entry || !entry.hasData) {
    return {
      hit: false,
      fresh: false,
      data: undefined,
      updatedAt: 0,
      inFlight: entry?.inFlight,
      generation: entry?.generation ?? globalGeneration,
    };
  }
  const now = Date.now();
  return {
    hit: true,
    fresh: now < entry.staleAt,
    data: entry.data,
    updatedAt: entry.updatedAt,
    inFlight: entry.inFlight,
    generation: entry.generation,
  };
}

export function writeCachedQuery<T>(
  domain: string,
  scope: string,
  data: T,
  ttlMs = DEFAULT_TTL_MS,
  expectedGeneration?: number,
): boolean {
  const entry = ensureEntry<T>(domain, scope);
  if (
    expectedGeneration !== undefined &&
    (expectedGeneration !== globalGeneration || expectedGeneration < entry.generation)
  ) {
    return false;
  }
  const now = Date.now();
  entry.data = data;
  entry.hasData = true;
  entry.updatedAt = now;
  entry.staleAt = now + ttlMs;
  entry.approxBytes = estimateBytes(data);
  notifyDomain(domain, { type: "updated", scope });
  notifyDiagnosticsListeners();
  return true;
}

export function loadWithQueryCache<T>(options: {
  domain: string;
  scope: string;
  ttlMs?: number;
  forceRefresh?: boolean;
  fetcher: () => Promise<T>;
}): Promise<T> {
  const { domain, scope, ttlMs = DEFAULT_TTL_MS, forceRefresh = false, fetcher } = options;
  const entry = ensureEntry<T>(domain, scope);
  const now = Date.now();

  if (!forceRefresh && entry.hasData && now < entry.staleAt) {
    return Promise.resolve(entry.data as T);
  }

  if (entry.inFlight && entry.inFlightGeneration === entry.generation) {
    return entry.inFlight;
  }

  const startGlobalGen = globalGeneration;
  const startEntryGen = entry.generation;

  const requestPromise = (async () => fetcher())()
    .then((result) => {
      if (entry.inFlight === requestPromise) {
        entry.inFlight = undefined;
      }
      if (globalGeneration === startGlobalGen && entry.generation === startEntryGen) {
        entry.data = result;
        entry.hasData = true;
        entry.updatedAt = Date.now();
        entry.staleAt = entry.updatedAt + ttlMs;
        entry.approxBytes = estimateBytes(result);
        notifyDomain(domain, { type: "updated", scope });
        notifyDiagnosticsListeners();
      }
      return result;
    })
    .catch((error) => {
      if (entry.inFlight === requestPromise) {
        entry.inFlight = undefined;
      }
      throw error;
    });

  entry.inFlight = requestPromise;
  entry.inFlightGeneration = startEntryGen;
  return requestPromise;
}

export function invalidateQueryDomain(domain: string, scopePrefix?: string): void {
  const bucket = storeByDomain[domain];
  if (bucket) {
    for (const key of Object.keys(bucket)) {
      if (!scopePrefix || key === scopePrefix || key.startsWith(scopePrefix)) {
        const entry = bucket[key];
        entry.staleAt = 0;
        entry.inFlight = undefined;
        entry.generation += 1;
      }
    }
  }
  notifyDomain(domain, { type: "invalidated", scope: scopePrefix });
  notifyDiagnosticsListeners();
}

export function evictQueryDomain(domain: string, scopePrefix?: string): void {
  const bucket = storeByDomain[domain];
  if (bucket) {
    for (const key of Object.keys(bucket)) {
      if (!scopePrefix || key === scopePrefix || key.startsWith(scopePrefix)) {
        const entry = bucket[key];
        entry.generation += 1;
        entry.inFlight = undefined;
        delete bucket[key];
      }
    }
  }
  notifyDomain(domain, { type: "evicted", scope: scopePrefix });
  notifyDiagnosticsListeners();
}

export function subscribeQueryDomain(
  domain: string,
  listener: DomainListener,
): () => void {
  if (!domainListeners[domain]) {
    domainListeners[domain] = [];
  }
  domainListeners[domain].push(listener);
  return () => {
    const list = domainListeners[domain];
    if (!list) return;
    domainListeners[domain] = list.filter((item) => item !== listener);
  };
}

export function subscribeCacheDiagnostics(listener: () => void): () => void {
  diagnosticsListeners.push(listener);
  return () => {
    diagnosticsListeners = diagnosticsListeners.filter((item) => item !== listener);
  };
}

export function registerExternalMemoryCache(
  id: string,
  label: string,
  purge: () => void,
  inspect?: () => DomainCacheDiagnostic,
): () => void {
  externalCaches = externalCaches.filter((item) => item.id !== id);
  externalCaches.push({ id, label, purge, inspect });
  return () => {
    externalCaches = externalCaches.filter((item) => item.id !== id);
  };
}

export function registerProtectedReviewDraftCounter(counter: () => number): void {
  protectedReviewDraftCounter = counter;
}

export function inspectProtectedBrowserRecords(): ProtectedStorageCounts {
  let workDraftsCount = 0;
  let financialRetryCount = 0;
  let notificationIntentCount = 0;

  if (typeof window !== "undefined") {
    try {
      const storage = window.sessionStorage;
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i) || "";
        if (key.startsWith("eflow:nested-work-draft:v1:")) {
          workDraftsCount += 1;
        } else if (
          key.startsWith("eflow:independent-review:") ||
          key.startsWith("eflow.office-petty.pending:")
        ) {
          financialRetryCount += 1;
        } else if (key.startsWith("eflow:notification-intent:")) {
          notificationIntentCount += 1;
        }
      }
    } catch {
      // Ignore storage inspection failures.
    }
  }

  const reviewDraftsCount = protectedReviewDraftCounter ? protectedReviewDraftCounter() : 0;
  return {
    workDraftsCount,
    reviewDraftsCount,
    financialRetryCount,
    notificationIntentCount,
    totalProtectedCount:
      workDraftsCount + reviewDraftsCount + financialRetryCount + notificationIntentCount,
  };
}

export function inspectStorageAndCache(): StorageAndCacheDiagnostics {
  const domains: DomainCacheDiagnostic[] = [];
  let totalCachedEntries = 0;
  let approxCacheBytes = 0;

  for (const domain of Object.keys(storeByDomain)) {
    const bucket = storeByDomain[domain];
    let entries = 0;
    let bytes = 0;
    for (const key of Object.keys(bucket)) {
      const entry = bucket[key];
      if (entry.hasData) {
        entries += 1;
        bytes += entry.approxBytes;
      }
    }
    if (entries > 0) {
      domains.push({ domain, entries, approxBytes: bytes });
      totalCachedEntries += entries;
      approxCacheBytes += bytes;
    }
  }

  for (const ext of externalCaches) {
    if (ext.inspect) {
      try {
        const diag = ext.inspect();
        if (diag.entries > 0) {
          domains.push(diag);
          totalCachedEntries += diag.entries;
          approxCacheBytes += diag.approxBytes;
        }
      } catch {
        // Ignore inspector errors.
      }
    }
  }

  domains.sort((a, b) => a.domain.localeCompare(b.domain));

  return {
    totalCachedEntries,
    approxCacheBytes,
    domains,
    lastClearedAt: lastClearedAtIso,
    lastClearReason: lastClearReasonValue,
    generation: globalGeneration,
    protectedRecords: inspectProtectedBrowserRecords(),
  };
}

function purgeStoreEntries(reason: string): number {
  globalGeneration += 1;
  let clearedEntries = 0;
  const touchedDomains = Object.keys(storeByDomain);
  for (const domain of touchedDomains) {
    const bucket = storeByDomain[domain];
    for (const key of Object.keys(bucket)) {
      if (bucket[key].hasData) {
        clearedEntries += 1;
      }
      bucket[key].generation = globalGeneration;
      bucket[key].inFlight = undefined;
    }
  }
  storeByDomain = {};
  lastClearedAtIso = new Date().toISOString();
  lastClearReasonValue = reason;
  for (const domain of touchedDomains) {
    notifyDomain(domain, { type: "evicted" });
  }
  return clearedEntries;
}

export function purgeAllQueryCaches(
  reason: "manual" | "auth-reset" | "access-revoked" = "manual",
): { clearedEntries: number; clearedAt: string; preservedProtectedCount: number } {
  const beforeDiag = inspectStorageAndCache();
  const internalCount = purgeStoreEntries(reason);
  for (const ext of [...externalCaches]) {
    try {
      ext.purge();
    } catch {
      // Ignore external cache purge errors.
    }
  }
  const clearedAt = lastClearedAtIso || new Date().toISOString();
  notifyDiagnosticsListeners();
  return {
    clearedEntries: Math.max(beforeDiag.totalCachedEntries, internalCount),
    clearedAt,
    preservedProtectedCount: inspectProtectedBrowserRecords().totalProtectedCount,
  };
}

registerAuthCacheReset(() => {
  purgeStoreEntries("auth-reset");
  notifyDiagnosticsListeners();
});
