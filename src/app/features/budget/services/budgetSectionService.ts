import { supabase } from "../../../../lib/supabase";
import type { BudgetSection } from "../types";
import { validateBudgetSections } from "../selectors/budgetSections";

export async function fetchBudgetSections(orgId: string, fiscalYear: number) {
  const { data, error } = await supabase.rpc("get_office_budget_sections", { p_org_id: orgId, p_fiscal_year: fiscalYear });
  if (error?.code === "PGRST202") return { sections: [], sectionsAvailable: false, itemizedCashAvailable: false, sectionsVersion: 0 };
  if (error) throw new Error(error.message);
  const row = data as { sections?: BudgetSection[]; version?: number } | null;
  return { sections: (row?.sections || []).map(s => ({ ...s, parentId: s.parentId || undefined, accountCode: s.accountCode || undefined })), sectionsAvailable: Array.isArray(row?.sections), itemizedCashAvailable: Boolean(row?.sections?.some(s => "journalAccountCode" in s)), sectionsVersion: row?.version || 0 };
}

export async function saveBudgetSections(input: {
  orgId: string; fiscalYear: number; sections: BudgetSection[]; expectedVersion: number;
  reason?: string; settings: { dailyReleaseLimit: number; perReceiptLimit: number; liquidationDueDays: number; allowReceiptOverride: boolean; threshold: number; notes: string };
}) {
  const invalid = validateBudgetSections(input.sections);
  if (invalid) throw new Error(invalid);
  const { data, error } = await supabase.rpc("save_office_budget_sections", {
    p_org_id: input.orgId, p_fiscal_year: input.fiscalYear, p_sections: input.sections.filter(s => !s.retired),
    p_expected_version: input.expectedVersion, p_reason: input.reason?.trim() || null, p_settings: input.settings,
  });
  if (error) throw new Error(error.message);
  return String(data);
}
