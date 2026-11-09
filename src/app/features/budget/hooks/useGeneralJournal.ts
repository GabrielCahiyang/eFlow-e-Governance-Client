import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase";
import {
  buildQueryScopeKey,
  evictQueryDomain,
  invalidateQueryDomain,
  loadWithQueryCache,
  readCachedQuery,
} from "../../../shared/queryCache";
import type { AccountingAccount, GeneralJournalEntry } from "../types";
import {
  fetchAccountingAccounts,
  fetchGeneralJournal,
} from "../services/budgetService";

interface CachedJournalPayload {
  entries: GeneralJournalEntry[];
  accounts: AccountingAccount[];
}

const JOURNAL_DOMAIN = "general-journal";

function journalCacheKey(orgId: string | undefined, fiscalYear: number, actorId?: string) {
  return buildQueryScopeKey({ userId: actorId, officeId: orgId, fiscalYear });
}

export function warmGeneralJournal(
  orgId: string,
  fiscalYear: number,
  actorId?: string,
  forceRefresh = false,
) {
  return loadWithQueryCache<CachedJournalPayload>({
    domain: JOURNAL_DOMAIN,
    scope: journalCacheKey(orgId, fiscalYear, actorId),
    forceRefresh,
    fetcher: async () => {
      const [entries, accounts] = await Promise.all([
        fetchGeneralJournal(orgId, fiscalYear),
        fetchAccountingAccounts(),
      ]);
      return { entries, accounts };
    },
  });
}

export function useGeneralJournal(
  orgId?: string,
  fiscalYear = new Date().getFullYear(),
  actorId?: string,
) {
  const scope = `${actorId || ""}:${orgId || ""}:${fiscalYear}`;
  const cacheScope = journalCacheKey(orgId, fiscalYear, actorId);
  const initialCached = orgId
    ? readCachedQuery<CachedJournalPayload>(JOURNAL_DOMAIN, cacheScope)
    : undefined;

  const knownEntries = useRef<{ scope: string; ids: Set<string> }>({
    scope,
    ids: new Set(
      initialCached?.hit && initialCached.data
        ? initialCached.data.entries.map((entry) => entry.id)
        : [],
    ),
  });
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const loadedScopeRef = useRef(
    initialCached?.hit && initialCached.data ? scope : "",
  );
  const [loadedScope, setLoadedScope] = useState(() =>
    initialCached?.hit && initialCached.data ? scope : "",
  );
  const request = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current++;
    };
  }, []);
  const [entries, setEntries] = useState<GeneralJournalEntry[]>(() =>
    initialCached?.hit && initialCached.data ? initialCached.data.entries : [],
  );
  const [accounts, setAccounts] = useState<AccountingAccount[]>(() =>
    initialCached?.hit && initialCached.data ? initialCached.data.accounts : [],
  );
  const [loading, setLoading] = useState(
    Boolean(orgId) && !(initialCached?.hit && initialCached.fresh),
  );
  const [error, setError] = useState("");

  const executeLoad = useCallback(
    async (forceRefresh: boolean) => {
      const version = ++request.current;
      const valid = () =>
        mounted.current &&
        currentScope.current === scope &&
        request.current === version;
      if (!orgId) {
        setEntries([]);
        setAccounts([]);
        setLoadedScope(scope);
        setLoading(false);
        setError("");
        return;
      }
      const cachedNow = !forceRefresh
        ? readCachedQuery<CachedJournalPayload>(JOURNAL_DOMAIN, cacheScope)
        : undefined;
      if (cachedNow?.hit && cachedNow.data) {
        knownEntries.current = {
          scope,
          ids: new Set(cachedNow.data.entries.map((entry) => entry.id)),
        };
        setEntries(cachedNow.data.entries);
        setAccounts(cachedNow.data.accounts);
        loadedScopeRef.current = scope;
        setLoadedScope(scope);
      }
      setLoading(true);
      setError("");
      try {
        if (forceRefresh) {
          invalidateQueryDomain(JOURNAL_DOMAIN, cacheScope);
        }
        const payload = await warmGeneralJournal(orgId, fiscalYear, actorId, forceRefresh);
        if (valid()) {
          knownEntries.current = {
            scope,
            ids: new Set(payload.entries.map((entry) => entry.id)),
          };
          setEntries(payload.entries);
          setAccounts(payload.accounts);
          loadedScopeRef.current = scope;
          setLoadedScope(scope);
        }
      } catch (caught) {
        if (valid()) {
          setError(
            caught instanceof Error
              ? caught.message
              : "The general journal could not be loaded.",
          );
          if (loadedScopeRef.current !== scope) {
            evictQueryDomain(JOURNAL_DOMAIN, cacheScope);
            setEntries([]);
            setAccounts([]);
          }
          setLoadedScope(scope);
        }
      } finally {
        if (valid()) setLoading(false);
      }
    },
    [cacheScope, fiscalYear, orgId, scope],
  );

  const refresh = useCallback(async () => {
    await executeLoad(true);
  }, [executeLoad]);

  useEffect(() => {
    void executeLoad(false);
  }, [executeLoad]);

  useEffect(() => {
    if (!orgId) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (disposed || currentScope.current !== scope) return;
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        if (!disposed && currentScope.current === scope) void refresh();
      }, 80);
    };
    const channel = supabase
      .channel(`general-journal:${orgId}:${fiscalYear}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "general_journal_entries",
          filter: `org_id=eq.${orgId}`,
        },
        schedule,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "general_journal_lines" },
        (payload) => {
          // Lines have no Office column. Only entries already read in this scope
          // qualify; the Office-filtered entry INSERT covers newly posted entries.
          const entryId = payload.new.journal_entry_id;
          if (
            knownEntries.current.scope === scope &&
            typeof entryId === "string" &&
            knownEntries.current.ids.has(entryId)
          )
            schedule();
        },
      )
      .subscribe();
    return () => {
      disposed = true;
      if (timer !== undefined) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [fiscalYear, orgId, refresh, scope]);
  return {
    entries: loadedScope === scope ? entries : [],
    accounts: loadedScope === scope ? accounts : [],
    loading: Boolean(orgId) && loadedScope !== scope,
    refreshing: loading && loadedScope === scope,
    error: loadedScope === scope ? error : "",
    refresh,
  };
}
