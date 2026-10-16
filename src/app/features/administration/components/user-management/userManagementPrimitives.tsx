import { isAdminRole } from "../../../../shared/roles";
import type { UserRole } from "../../../../types";
import { ProgressBar } from "@vibe/core";
import { getRoleLabel } from "../../../../shared/roles";
import '../../administrationWorkspace.css';

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
  return <span className="eflow-account-role" data-role={role}>{getRoleLabel(role)}</span>;
}

export function StatusBadge({ active }: { active: boolean }) {
  return <span aria-label={`Account status: ${active ? "active" : "inactive"}`} role="status" className="eflow-account-status" data-active={active}>{active ? "Active" : "Inactive"}</span>;
}

export function WorkloadBar({ value }: { value: number }) {
  if (!Number.isFinite(value)) return <span className="text-muted-foreground text-xs">Unavailable</span>;
  const style = value >= 80 ? "negative" : value >= 60 ? "warning" : "positive";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16"><ProgressBar aria-label={`${value}% workload`} animated={false} barStyle={style} fullWidth size="small" value={Math.min(100, value)} /></div>
      <span className="eflow-tabular text-[11px] text-neutral-600">{value}%</span>
    </div>
  );
}

// ─── Create User Modal ───────────────────────────────────────────
