import { useCallback, useEffect, useRef, useState } from "react";
import {
  evictQueryDomain,
  getQueryCacheGeneration,
  isDocumentVisible,
  loadWithQueryCache,
  readCachedQuery,
} from "../../../shared/queryCache";
import { subscribeWorkChanges } from "../../../shared/workChanges";
import { ACCESS_CHANGED_EVENT } from "../../project-access";
import { loadWorkFeed } from "../services/workFeedService";
import type { WorkScope, WorkSnapshot } from "../types";
import { isQueryAccessDenied } from "../../../shared/queryAccess";

const WORK_FEED_DOMAIN = "work-feed";

function workFeedCacheKey(userId: string, scope?: WorkScope) {
  return JSON.stringify([
    userId,
    scope?.workspace.id || "all",
    scope?.workspace.timezone,
    scope?.projectIds?.slice().sort() ?? null,
  ]);
}

export function warmWorkFeed(userId: string, scope?: WorkScope) {
  return loadWithQueryCache({
    domain: WORK_FEED_DOMAIN,
    scope: workFeedCacheKey(userId, scope),
    fetcher: () => loadWorkFeed(userId, scope),
  });
}

export function useWorkFeed(userId: string, scope?: WorkScope) {
  const key = workFeedCacheKey(userId, scope);
  const initialCached = readCachedQuery<WorkSnapshot>(WORK_FEED_DOMAIN, key);
  const [state, setState] = useState<{
    key: string;
    data?: WorkSnapshot;
    loading: boolean;
    refreshing: boolean;
    error?: string;
  }>(() => ({
    key: initialCached.hit ? key : "",
    data: initialCached.data,
    loading: !initialCached.hit,
    refreshing: false,
  }));
  const generation = useRef(0);
  const inFlight = useRef<number | undefined>(undefined);
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const executeLoad = useCallback(
    async (forceRefresh: boolean) => {
      const token = ++generation.current;
      const cacheGeneration = getQueryCacheGeneration();
      const current = () => token === generation.current && cacheGeneration === getQueryCacheGeneration();
      inFlight.current = token;
      const cached = !forceRefresh
        ? readCachedQuery<WorkSnapshot>(WORK_FEED_DOMAIN, key)
        : undefined;
      setState((previous) => {
        const existingData =
          previous.key === key ? previous.data : cached?.data;
        return {
          key,
          data: existingData,
          loading: !existingData,
          refreshing: Boolean(existingData),
          error: undefined,
        };
      });
      try {
        const data = await loadWithQueryCache({
          domain: WORK_FEED_DOMAIN,
          scope: key,
          ttlMs: 30_000,
          forceRefresh,
          fetcher: () => loadWorkFeed(userIdRef.current, scopeRef.current),
        });
        if (current()) {
          setState({ key, data, loading: false, refreshing: false });
        }
      } catch (error) {
        if (current()) {
          const denied = isQueryAccessDenied(error);
          if (denied) evictQueryDomain(WORK_FEED_DOMAIN, key);
          setState(previous => ({
            key,
            data: !denied && previous.key === key ? previous.data : undefined,
            loading: false,
            refreshing: false,
            error: (error as Error).message,
          }));
        }
      } finally {
        if (inFlight.current === token) inFlight.current = undefined;
      }
    },
    [key],
  );

  const refresh = useCallback(async () => {
    await executeLoad(true);
  }, [executeLoad]);

  useEffect(() => {
    void executeLoad(false);
    const timer = window.setInterval(() => {
      if (!inFlight.current && isDocumentVisible()) void executeLoad(false);
    }, 15000);
    const handleRefresh = () => {
      void executeLoad(true);
    };
    const handleAccessChange = () => {
      evictQueryDomain(WORK_FEED_DOMAIN, key);
      setState({ key, loading: true, refreshing: false });
      handleRefresh();
    };
    window.addEventListener("focus", handleRefresh);
    window.addEventListener("online", handleRefresh);
    const stopWorkChanges = subscribeWorkChanges(handleRefresh);
    window.addEventListener(ACCESS_CHANGED_EVENT, handleAccessChange);
    return () => {
      ++generation.current;
      clearInterval(timer);
      window.removeEventListener("focus", handleRefresh);
      window.removeEventListener("online", handleRefresh);
      stopWorkChanges();
      window.removeEventListener(ACCESS_CHANGED_EVENT, handleAccessChange);
    };
  }, [executeLoad, key]);

  const currentCached =
    state.key !== key
      ? readCachedQuery<WorkSnapshot>(WORK_FEED_DOMAIN, key)
      : undefined;

  return {
    ...(state.key === key
      ? state
      : currentCached?.hit && currentCached.data
        ? {
            key,
            data: currentCached.data,
            loading: false,
            refreshing: !currentCached.fresh,
          }
        : { key, loading: true, refreshing: false }),
    refresh,
  };
}
