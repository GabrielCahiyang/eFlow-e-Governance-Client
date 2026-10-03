import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase";
import type { DepartmentBudgetBundle } from "../types";
import { fetchDepartmentBudgetBundle } from "../services/budgetService";

const EMPTY: DepartmentBudgetBundle = { summary: null, lines: [], commitments: [], allocations: [], allocationLines: [], requests: [], requestAttachments: [], releases: [], liquidations: [], ledger: [], adjustments: [] };

export function useDepartmentBudget(orgId?: string, fiscalYear = new Date().getFullYear()) {
  const [data, setData] = useState<DepartmentBudgetBundle>(EMPTY);
  const [loading, setLoading] = useState(Boolean(orgId));
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    if (!orgId) { setData(EMPTY); setLoading(false); return; }
    setLoading(true); setError("");
    try { setData(await fetchDepartmentBudgetBundle(orgId, fiscalYear)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Budget data could not be loaded."); }
    finally { setLoading(false); }
  }, [fiscalYear, orgId]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!orgId) return;
    const budgetId = data.summary?.id;
    // Realtime reuses an existing channel when its topic matches. React Strict
    // Mode can remount this effect before removeChannel() finishes, so every
    // subscription needs its own topic to avoid adding bindings to the channel
    // that is still unsubscribing.
    const channelTopic = `office-budget:${orgId}:${fiscalYear}:${budgetId || "setup"}:${crypto.randomUUID()}`;
    let channel = supabase.channel(channelTopic)
      .on("postgres_changes", { event: "*", schema: "public", table: "department_fiscal_budgets", filter: `org_id=eq.${orgId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "petty_cash_requests", filter: `org_id=eq.${orgId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "budget_ledger_entries", filter: `org_id=eq.${orgId}` }, refresh);
    if (budgetId) {
      channel = channel
        .on("postgres_changes", { event: "*", schema: "public", table: "department_budget_lines", filter: `fiscal_budget_id=eq.${budgetId}` }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "department_budget_adjustments", filter: `fiscal_budget_id=eq.${budgetId}` }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "budget_commitments", filter: `fiscal_budget_id=eq.${budgetId}` }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "work_budget_allocations" }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "work_budget_allocation_lines" }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "petty_cash_releases" }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "petty_cash_liquidations" }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "petty_cash_request_attachments" }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "petty_cash_receipts" }, refresh);
    }
    channel.subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [data.summary?.id, fiscalYear, orgId, refresh]);
  return { ...data, loading, error, refresh };
}
