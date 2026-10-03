import { supabase } from "../../../../lib/supabase";
import type { MonthlyContributionRow } from "../types";

export async function fetchMonthlyProductivitySnapshots(monthStart: string, orgId?: string): Promise<MonthlyContributionRow[]> {
  let query = supabase.from("monthly_productivity_snapshots").select("*,profiles!monthly_productivity_snapshots_user_id_fkey(full_name),organizations(name)").eq("month_start", monthStart).order("contribution_score", { ascending: false });
  if (orgId) query = query.eq("org_id", orgId);
  const { data, error } = await query;
  if (error) { if (error.code === "42P01" || error.code === "PGRST205") return []; throw error; }
  return (data || []).map((row, index) => ({ rank: index + 1, userId: String(row.user_id), employeeName: String((row.profiles as any)?.full_name || "Member"), departmentName: String((row.organizations as any)?.name || ""), approvedTasks: Number(row.approved_tasks || 0), approvedSubtasks: Number(row.approved_subtasks || 0), onTimeRate: row.on_time_rate == null ? null : Number(row.on_time_rate), medianCycleHours: row.median_cycle_hours == null ? null : Number(row.median_cycle_hours), firstPassApprovalRate: row.first_pass_rate == null ? null : Number(row.first_pass_rate), contributionScore: Number(row.contribution_score || 0), breakdown: { delivery: Number(row.delivery_score || 0), quality: Number(row.quality_score || 0), speed: Number(row.speed_score || 0), collaboration: Number(row.collaboration_score || 0) }, source: "snapshot" as const }));
}

export async function recalculateMonthlyProductivity(monthStart: string, reason: string): Promise<void> {
  if (!reason.trim()) throw new Error("A recalculation reason is required.");
  const { error } = await supabase.rpc("recalculate_monthly_productivity", { p_month_start: monthStart, p_reason: reason.trim() });
  if (error) throw error;
}
