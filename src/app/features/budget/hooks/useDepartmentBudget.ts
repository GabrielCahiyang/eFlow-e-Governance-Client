import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { getPhilippineYear } from "../../../shared/calendarDates";
import { subscribeBudgetRealtime } from "./budgetRealtimeCoordinator";
import {
  buildQueryScopeKey,
  evictQueryDomain,
  getQueryCacheGeneration,
  isDocumentVisible,
  loadWithQueryCache,
  readCachedQuery,
  subscribeQueryDomain,
} from "../../../shared/queryCache";
import type { DepartmentBudgetBundle } from "../types";
import { fetchDepartmentBudgetBundle } from "../services/budgetService";
import { AuthContext } from "../../../contexts/authContextValue";
import { isQueryAccessDenied } from "../../../shared/queryAccess";
import { readableUiError } from "../../../shared/userFacingError";

const EMPTY: DepartmentBudgetBundle = {
  summary: null,
  lines: [],
  commitments: [],
  allocations: [],
  allocationLines: [],
  requests: [],
  requestAttachments: [],
  releases: [],
  liquidations: [],
  ledger: [],
  adjustments: [],
};

const BUDGET_DOMAIN = "department-budget";

function budgetCacheKey(orgId: string | undefined, fiscalYear: number, actorId?: string) {
  return buildQueryScopeKey({ userId: actorId, officeId: orgId, fiscalYear });
}

export function warmDepartmentBudget(orgId: string, fiscalYear: number, actorId?: string, forceRefresh = false) {
  const scope = budgetCacheKey(orgId, fiscalYear, actorId);
  if (!forceRefresh) {
    const pending = readCachedQuery<DepartmentBudgetBundle>(BUDGET_DOMAIN, scope).inFlight;
    if (pending) return pending;
  }
  return loadWithQueryCache({
    domain: BUDGET_DOMAIN,
    scope,
    forceRefresh,
    fetcher: () => fetchDepartmentBudgetBundle(orgId, fiscalYear),
  });
}

export function useDepartmentBudget(
  orgId?: string,
  fiscalYear = getPhilippineYear(),
) {
  const actorId = useContext(AuthContext)?.user?.id;
  const cacheScope = budgetCacheKey(orgId, fiscalYear, actorId);
  const scope = cacheScope;
  const initialCached = orgId
    ? readCachedQuery<DepartmentBudgetBundle>(BUDGET_DOMAIN, cacheScope)
    : undefined;

  const [data, setData] = useState<DepartmentBudgetBundle>(() =>
    initialCached?.hit && initialCached.data ? initialCached.data : EMPTY,
  );
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const request = useRef(0);
  const loadedScopeRef = useRef(
    initialCached?.hit && initialCached.data ? scope : "",
  );
  const mounted = useRef(true);
  const [loadedScope, setLoadedScope] = useState(() =>
    initialCached?.hit && initialCached.data ? scope : "",
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current++;
    };
  }, []);
  const [loading, setLoading] = useState(
    Boolean(orgId) && !(initialCached?.hit && initialCached.fresh),
  );
  const [error, setError] = useState("");

  const executeLoad = useCallback(
    async (forceRefresh: boolean) => {
      const version = ++request.current;
      const generation = getQueryCacheGeneration();
      if (!orgId) {
        setData(EMPTY);
        setLoadedScope(scope);
        setLoading(false);
        setError("");
        return;
      }
      const cachedNow = !forceRefresh
        ? readCachedQuery<DepartmentBudgetBundle>(BUDGET_DOMAIN, cacheScope)
        : undefined;
      if (cachedNow?.hit && cachedNow.data) {
        setData(cachedNow.data);
        loadedScopeRef.current = scope;
        setLoadedScope(scope);
      }
      setLoading(true);
      setError("");
      const valid = () =>
        mounted.current &&
        getQueryCacheGeneration() === generation &&
        currentScope.current === scope &&
        request.current === version;
      try {
        const next = await warmDepartmentBudget(orgId, fiscalYear, actorId, forceRefresh);
        if (valid()) {
          setData(next);
          loadedScopeRef.current = scope;
          setLoadedScope(scope);
        }
      } catch (caught) {
        if (valid()) {
          setError(readableUiError(caught, "Couldn't load office budget details.", "read"));
          const denied = isQueryAccessDenied(caught);
          if (denied || loadedScopeRef.current !== scope) {
            if (denied) evictQueryDomain(BUDGET_DOMAIN, cacheScope);
            setData(EMPTY);
            loadedScopeRef.current = "";
          }
          setLoadedScope(scope);
        }
      } finally {
        if (valid()) setLoading(false);
      }
    },
    [actorId, cacheScope, fiscalYear, orgId, scope],
  );

  const refresh = useCallback(async () => {
    await executeLoad(true);
  }, [executeLoad]);

  useEffect(() => {
    if (!orgId) return;
    return subscribeQueryDomain(BUDGET_DOMAIN, event => {
      if (event.scope !== cacheScope || currentScope.current !== scope) return;
      if (event.type === "updated") {
        const cached = readCachedQuery<DepartmentBudgetBundle>(BUDGET_DOMAIN, cacheScope).data;
        if (!cached) return;
        setData(cached);
        loadedScopeRef.current = scope;
        setLoadedScope(scope);
        setError("");
      } else if (event.type === "evicted") {
        setData(EMPTY);
        loadedScopeRef.current = "";
      }
    });
  }, [cacheScope, orgId, scope]);

  useEffect(() => {
    void executeLoad(false);
  }, [executeLoad]);

  useEffect(() => {
    if (!orgId) return;
    let active = true;
    const budgetId = loadedScope === scope ? data.summary?.id : undefined;
    const itemized = loadedScope === scope && Boolean(data.itemizedCashAvailable);
    const coordinator = subscribeBudgetRealtime({
      scopeKey: `${actorId || ""}:${orgId}:${fiscalYear}:${budgetId || "setup"}:${itemized ? "1" : "0"}`,
      orgId,
      budgetId,
      itemized,
      canDeleteProjectTrigger: () =>
        Boolean(readCachedQuery<DepartmentBudgetBundle>(BUDGET_DOMAIN, cacheScope).data?.readjustmentBlockedByProjects),
      onRefresh: () => {
        void (async () => {
          await readCachedQuery(BUDGET_DOMAIN, cacheScope).inFlight?.catch(() => undefined);
          if (active && currentScope.current === scope) void refresh();
        })();
      },
    });
    const recheck = () => {
      if (isDocumentVisible()) void executeLoad(false);
    };
    let pollTick = 0;
    const fallback = window.setInterval(() => {
      if (!isDocumentVisible()) return;
      pollTick += 1;
      // Back off fallback polling from 30s to 90s while Realtime stays SUBSCRIBED.
      if (coordinator.isSubscribed() && pollTick % 3 !== 0) return;
      void executeLoad(false);
    }, 30_000);
    window.addEventListener("focus", recheck);
    window.addEventListener("online", coordinator.triggerOnlineRefresh);
    document.addEventListener("visibilitychange", recheck);
    return () => {
      active = false;
      window.clearInterval(fallback);
      window.removeEventListener("focus", recheck);
      window.removeEventListener("online", coordinator.triggerOnlineRefresh);
      document.removeEventListener("visibilitychange", recheck);
      coordinator.unsubscribe();
    };
  }, [actorId, cacheScope, data.itemizedCashAvailable, data.summary?.id, executeLoad, fiscalYear, loadedScope, orgId, refresh, scope]);
  return {
    ...(loadedScope === scope ? data : EMPTY),
    loading: Boolean(orgId) && loadedScope !== scope,
    refreshing: loading && loadedScope === scope,
    error,
    refresh,
  };
}
