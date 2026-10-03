import { isAdminRole } from "../../../../shared/roles";
import type { UserRole } from "../../../../types";
import { ProgressBar } from "@vibe/core";
import { getRoleLabel } from "../../../../shared/roles";

export const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "member", label: "Member" },
  { value: "accounting_staff", label: "Accounting Staff" },
  { value: "head", label: "Head" },
  { value: "admin", label: "Admin" },
];

export function getAssignableRoleOptions(viewerRole?: string) {
  if (isAdminRole(viewerRole)) return ROLE_OPTIONS;
  return ROLE_OPTIONS.filter(({ value }) => value === "member" || value === "accounting_staff");
}

// ─── Status / Role badges ────────────────────────────────────────
export function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    admin: "border-blue-200 bg-blue-50 text-blue-700",
    head: "border-violet-200 bg-violet-50 text-violet-700",
    accounting_staff: "border-cyan-200 bg-cyan-50 text-cyan-800",
    employee: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[9.5px] font-semibold ${colors[role] || "border-neutral-200 bg-neutral-50 text-neutral-700"}`}>{getRoleLabel(role)}</span>;
}

export function StatusBadge({ active }: { active: boolean }) {
  return <span aria-label={`Account status: ${active ? "active" : "inactive"}`} role="status" className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9.5px] font-semibold ${active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-neutral-200 bg-neutral-100 text-neutral-600"}`}><span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-neutral-400"}`} />{active ? "Active" : "Inactive"}</span>;
}

export function WorkloadBar({ value }: { value: number }) {
  const style = value >= 80 ? "negative" : value >= 60 ? "warning" : "positive";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16"><ProgressBar aria-label={`${value}% workload`} animated={false} barStyle={style} fullWidth size="small" value={Math.min(100, value)} /></div>
      <span className="eflow-tabular text-[11px] text-neutral-600">{value}%</span>
    </div>
  );
}

// ─── Create User Modal ───────────────────────────────────────────
