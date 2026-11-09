import { useCallback, useEffect, useRef, useState } from "react";
import { fetchRecentNotifications } from "../../../services/notificationService";
import {
  buildQueryScopeKey,
  evictQueryDomain,
  getQueryCacheGeneration,
  isDocumentVisible,
  loadWithQueryCache,
  readCachedQuery,
} from "../../../shared/queryCache";
import { isQueryAccessDenied } from "../../../shared/queryAccess";

const FEED_DOMAIN = "personal-feed";
const readerIds = new WeakMap<Function, string>();
let nextReaderSeq = 1;

function getReaderId(fn: Function): string {
  let id = readerIds.get(fn);
  if (!id) {
    id = `reader_${nextReaderSeq++}_${fn.name || "anon"}`;
    readerIds.set(fn, id);
  }
  return id;
}

function feedCacheKey(userId: string | undefined, read: Function) {
  return buildQueryScopeKey({ userId, filter: getReaderId(read) });
}

export function warmPersonalFeed<T>(userId: string, read: (id: string) => Promise<T[]>) {
  return loadWithQueryCache({
    domain: FEED_DOMAIN,
    scope: feedCacheKey(userId, read),
    fetcher: () => read(userId),
  });
}

/** Each source has independent error/retry state. Scope and sequence reject late results. */
export function usePersonalFeed<T>(
  userId: string | undefined,
  read: (id: string) => Promise<T[]> = fetchRecentNotifications as unknown as (
    id: string,
  ) => Promise<T[]>,
  enabled = true,
  subscribe?: (id: string, invalidate: () => void) => () => void,
) {
  const cacheScope = feedCacheKey(userId, read);
  const initialCached =
    userId && enabled
      ? readCachedQuery<T[]>(FEED_DOMAIN, cacheScope)
      : undefined;

  const [state, setState] = useState<{
    scope?: string;
    rows: T[];
    loading: boolean;
    refreshing: boolean;
    error: string;
  }>(() => ({
    scope: cacheScope,
    rows: initialCached?.hit && initialCached.data ? initialCached.data : [],
    loading: Boolean(userId && enabled && !initialCached?.hit),
    refreshing: false,
    error: "",
  }));
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);
  const readRef = useRef(read);
  readRef.current = read;

  useEffect(() => {
    let active = true;
    let sequence = 0;
    let inFlight = false;
    let queued = false;
    let queuedForce = false;

    const cached =
      userId && enabled
        ? readCachedQuery<T[]>(FEED_DOMAIN, cacheScope)
        : undefined;
    const hasInitialRows = Boolean(cached?.hit && cached.data);

    setState({
      scope: cacheScope,
      rows: hasInitialRows ? (cached!.data as T[]) : [],
      loading: Boolean(userId && enabled && !hasInitialRows),
      refreshing: Boolean(userId && enabled && hasInitialRows && !cached?.fresh),
      error: "",
    });

    if (!userId || !enabled) return;

    const load = async (forceRefresh = false) => {
      if (!active) return;
      if (inFlight) {
        queued = true;
        queuedForce = queuedForce || forceRefresh;
        return;
      }
      inFlight = true;
      const current = ++sequence;
      const generation = getQueryCacheGeneration();
      const stillCurrent = () => active && sequence === current && getQueryCacheGeneration() === generation;
      const existing = readCachedQuery<T[]>(FEED_DOMAIN, cacheScope);
      if (existing.hit && existing.data && (forceRefresh || !existing.fresh)) {
        setState((prev) =>
          prev.scope === cacheScope ? { ...prev, refreshing: true } : prev,
        );
      }
      try {
        const rows = await loadWithQueryCache({
          domain: FEED_DOMAIN,
          scope: cacheScope,
          ttlMs: 30_000,
          forceRefresh,
          fetcher: () => readRef.current(userId),
        });
        if (stillCurrent()) {
          setState({
            scope: cacheScope,
            rows,
            loading: false,
            refreshing: false,
            error: "",
          });
        }
      } catch (error) {
        if (stillCurrent()) {
          const denied = isQueryAccessDenied(error);
          if (denied) evictQueryDomain(FEED_DOMAIN, cacheScope);
          setState(previous => ({
            scope: cacheScope,
            rows: !denied && previous.scope === cacheScope ? previous.rows : [],
            loading: false,
            refreshing: false,
            error:
              error instanceof Error
                ? error.message
                : "Could not load this source.",
          }));
        }
      } finally {
        inFlight = false;
        if (queued) {
          const nextForce = queuedForce;
          queued = false;
          queuedForce = false;
          void load(nextForce);
        }
      }
    };

    void load(revision > 0);
    const unsubscribe = subscribe?.(userId, () => void load(true));
    const timer = window.setInterval(() => {
      if (isDocumentVisible()) void load();
    }, 15000);
    const focus = () => void load(true);
    window.addEventListener("focus", focus);
    window.addEventListener("online", focus);
    return () => {
      active = false;
      ++sequence;
      unsubscribe?.();
      window.clearInterval(timer);
      window.removeEventListener("focus", focus);
      window.removeEventListener("online", focus);
    };
  }, [cacheScope, userId, enabled, revision, subscribe]);

  return {
    ...(state.scope === cacheScope && enabled
      ? state
      : {
          rows: [] as T[],
          loading: Boolean(userId && enabled),
          refreshing: false,
          error: "",
        }),
    retry,
  };
}
