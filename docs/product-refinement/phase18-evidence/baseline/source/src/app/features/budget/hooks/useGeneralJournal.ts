import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase";
import type { AccountingAccount, GeneralJournalEntry } from "../types";
import {
  fetchAccountingAccounts,
  fetchGeneralJournal,
} from "../services/budgetService";

export function useGeneralJournal(
  orgId?: string,
  fiscalYear = new Date().getFullYear(),
) {
  const scope = `${orgId || ""}:${fiscalYear}`;
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const loadedScopeRef = useRef("");
  const [loadedScope, setLoadedScope] = useState("");
  const request = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current++;
    };
  }, []);
  const [entries, setEntries] = useState<GeneralJournalEntry[]>([]);
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [loading, setLoading] = useState(Boolean(orgId));
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
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
    setLoading(true);
    setError("");
    try {
      const [nextEntries, nextAccounts] = await Promise.all([
        fetchGeneralJournal(orgId, fiscalYear),
        fetchAccountingAccounts(),
      ]);
      if (valid()) {
        setEntries(nextEntries);
        setAccounts(nextAccounts);
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
          setEntries([]);
          setAccounts([]);
        }
        setLoadedScope(scope);
      }
    } finally {
      if (valid()) setLoading(false);
    }
  }, [fiscalYear, orgId, scope]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!orgId) return;
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
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "general_journal_lines" },
        refresh,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fiscalYear, orgId, refresh]);
  return {
    entries: loadedScope === scope ? entries : [],
    accounts: loadedScope === scope ? accounts : [],
    loading: Boolean(orgId) && loadedScope !== scope,
    refreshing: loading && loadedScope === scope,
    error,
    refresh,
  };
}
