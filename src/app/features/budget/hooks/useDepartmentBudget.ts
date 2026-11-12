import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase";
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
  const pending = readCachedQuery<DepartmentBudgetBundle>(BUDGET_DOMAIN, scope).inFlight;
  if (pending) return pending;
  return loadWithQueryCache({
    domain: BUDGET_DOMAIN,
    scope,
    forceRefresh,
    fetcher: () => fetchDepartmentBudgetBundle(orgId, fiscalYear),
  });
}

export function useDepartmentBudget(
  orgId?: string,
  fiscalYear = new Date().getFullYear(),
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
          setError(
            caught instanceof Error
              ? caught.message
              : "Budget data could not be loaded.",
          );
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
    let subscribed = false;
    let pendingRefresh: number | undefined;
    const onChange = () => {
      if (pendingRefresh !== undefined) return;
      pendingRefresh = window.setTimeout(async () => {
        pendingRefresh = undefined;
        await readCachedQuery(BUDGET_DOMAIN, cacheScope).inFlight?.catch(() => undefined);
        if (active && currentScope.current === scope) void refresh();
      }, 200);
    };
    const budgetId = loadedScope === scope ? data.summary?.id : undefined;
    // Realtime reuses an existing channel when its topic matches. React Strict
    // Mode can remount this effect before removeChannel() finishes, so every
    // subscription needs its own topic to avoid adding bindings to the channel
    // that is still unsubscribing.
    const channelTopic = `office-budget:${orgId}:${fiscalYear}:${budgetId || "setup"}:${crypto.randomUUID()}`;
    let channel = supabase
      .channel(channelTopic)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "department_fiscal_budgets",
          filter: `org_id=eq.${orgId}`,
        },
        onChange,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "petty_cash_requests",
          filter: `org_id=eq.${orgId}`,
        },
        onChange,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "budget_ledger_entries",
          filter: `org_id=eq.${orgId}`,
        },
        onChange,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "projects", filter: `org_id=eq.${orgId}` },
        onChange,
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "projects" },
        () => {
          // Realtime DELETE events cannot be filtered by Office.
          if (readCachedQuery<DepartmentBudgetBundle>(BUDGET_DOMAIN, cacheScope).data?.readjustmentBlockedByProjects) onChange();
        },
      );
    if (budgetId) {
      channel = channel
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "office_budget_sections",
            filter: `fiscal_budget_id=eq.${budgetId}`,
          },
          onChange,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "department_budget_lines",
            filter: `fiscal_budget_id=eq.${budgetId}`,
          },
          onChange,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "department_budget_adjustments",
            filter: `fiscal_budget_id=eq.${budgetId}`,
          },
          onChange,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "budget_commitments",
            filter: `fiscal_budget_id=eq.${budgetId}`,
          },
          onChange,
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "work_budget_allocations" },
          onChange,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "work_budget_allocation_lines",
          },
          onChange,
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "petty_cash_releases" },
          onChange,
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "petty_cash_liquidations" },
          onChange,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "petty_cash_request_attachments",
          },
          onChange,
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "petty_cash_receipts" },
          onChange,
        );
    }
    if (loadedScope === scope && data.itemizedCashAvailable) {
      channel = channel
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "petty_cash_request_lines" },
          onChange,
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "petty_cash_receipt_items" },
          onChange,
        );
    }
    channel.subscribe(status => {
      if (status !== "SUBSCRIBED") return;
      if (subscribed) onChange();
      subscribed = true;
    });
    const recheck = () => {
      if (isDocumentVisible()) void executeLoad(false);
    };
    const fallback = window.setInterval(recheck, 30_000);
    window.addEventListener("focus", recheck);
    window.addEventListener("online", onChange);
    document.addEventListener("visibilitychange", recheck);
    return () => {
      active = false;
      window.clearTimeout(pendingRefresh);
      window.clearInterval(fallback);
      window.removeEventListener("focus", recheck);
      window.removeEventListener("online", onChange);
      document.removeEventListener("visibilitychange", recheck);
      void supabase.removeChannel(channel);
    };
  }, [cacheScope, data.summary?.id, data.itemizedCashAvailable, executeLoad, fiscalYear, loadedScope, orgId, refresh, scope]);
  return {
    ...(loadedScope === scope ? data : EMPTY),
    loading: Boolean(orgId) && loadedScope !== scope,
    refreshing: loading && loadedScope === scope,
    error,
    refresh,
  };
}
