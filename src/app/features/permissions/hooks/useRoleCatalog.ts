import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../lib/supabase";
import { getRoleLabel, isAdminRole, normalizeUserRole } from "../../../shared/roles";
import type { UserRole } from "../../../types";
import { MANAGED_ROLES } from "../constants";
import { CUSTOM_ROLES_CHANGED_EVENT, fetchCustomRoles } from "../services/permissionService";
import type { CustomRoleDefinition, ManagedRoleCatalogEntry } from "../types";

const BUILTIN_DESCRIPTIONS: Record<string, string> = {
  admin: "Full organization oversight, security configuration, and user administration. Core permissions stay locked.",
  head: "Office leadership, task assignment, review approvals, and operational reporting within assigned scopes.",
  accounting_staff: "Budget oversight, cash disbursement verification, liquidation review, and financial reconciliation.",
  member: "Day-to-day project execution, task updates, subtask completion, and inbox collaboration.",
};

export function buildRoleCatalog(customRoles: CustomRoleDefinition[]): ManagedRoleCatalogEntry[] {
  const builtIns: ManagedRoleCatalogEntry[] = MANAGED_ROLES.map((role) => ({
    key: role.key,
    label: role.label,
    description: BUILTIN_DESCRIPTIONS[role.key] || "",
    baseRole: role.key as ManagedRoleCatalogEntry["baseRole"],
    isBuiltIn: true,
    isLocked: isAdminRole(role.key),
  }));
  const customEntries: ManagedRoleCatalogEntry[] = [...customRoles]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((role) => ({
      key: role.key,
      label: role.label,
      description: role.description,
      baseRole: role.baseRole,
      isBuiltIn: false,
      isLocked: false,
    }));
  return [...builtIns, ...customEntries];
}

export function getAssignableRoleCatalog(
  catalog: ManagedRoleCatalogEntry[],
  currentUserRole?: string | null,
): ManagedRoleCatalogEntry[] {
  if (isAdminRole(currentUserRole || "")) return catalog;
  return catalog.filter((entry) => entry.baseRole !== "admin" && !isAdminRole(entry.key));
}

export function resolveAccountRoleDisplay(
  role: string,
  customRoleKey: string | null | undefined,
  catalog: ManagedRoleCatalogEntry[],
): { label: string; baseLabel: string; isCustom: boolean } {
  const baseLabel = getRoleLabel(role);
  if (customRoleKey) {
    const match = catalog.find((entry) => entry.key === customRoleKey && !entry.isBuiltIn);
    if (match) return { label: match.label, baseLabel, isCustom: true };
  }
  return { label: baseLabel, baseLabel, isCustom: false };
}

export function resolveRoleSelection(
  selection: string,
  catalog: ManagedRoleCatalogEntry[],
): { role: UserRole; customRoleKey: string | null; label: string } {
  const matched = catalog.find((entry) => entry.key === selection);
  if (matched && !matched.isBuiltIn) {
    return {
      role: matched.baseRole as UserRole,
      customRoleKey: matched.key,
      label: matched.label,
    };
  }
  const baseRole = normalizeUserRole(selection);
  return {
    role: baseRole,
    customRoleKey: null,
    label: matched?.label || getRoleLabel(baseRole),
  };
}

export function useRoleCatalog() {
  const [customRoles, setCustomRoles] = useState<CustomRoleDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const rows = await fetchCustomRoles();
      setCustomRoles(rows);
    } catch {
      setCustomRoles((prev) => prev);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    const onCustomChange = () => void reload();
    if (typeof window !== "undefined") {
      window.addEventListener(CUSTOM_ROLES_CHANGED_EVENT, onCustomChange);
    }
    const maybeChannel = typeof (supabase as any)?.channel === "function"
      ? (supabase as any)
          .channel(`custom-roles:${crypto.randomUUID()}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "custom_roles" }, onCustomChange)
          .subscribe()
      : null;

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(CUSTOM_ROLES_CHANGED_EVENT, onCustomChange);
      }
      if (maybeChannel && typeof (supabase as any)?.removeChannel === "function") {
        void (supabase as any).removeChannel(maybeChannel);
      }
    };
  }, [reload]);

  const roleCatalog = useMemo(() => buildRoleCatalog(customRoles), [customRoles]);
  return { roleCatalog, customRoles, loading, reload };
}
