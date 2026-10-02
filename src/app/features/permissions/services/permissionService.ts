import { isAdminRole } from "../../../shared/roles";
import { supabase } from "../../../../lib/supabase";
import type { OrganizationScopeGrant, RolePermissionRow, ScopeGrantInput, UserOverrideRow } from "../types";
import { resolvePermissions } from "../selectors";
import { PERMISSIONS_CHANGED_EVENT, PERMISSIONS_CHANGED_STORAGE_KEY } from "../constants";

function announcePermissionsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PERMISSIONS_CHANGED_EVENT));
  try {
    window.localStorage.setItem(PERMISSIONS_CHANGED_STORAGE_KEY, String(Date.now()));
  } catch {
    // Realtime and the same-window event still refresh access when storage is unavailable.
  }
}

export async function fetchRolePermissions(): Promise<RolePermissionRow[]> {
  const { data, error } = await supabase.from("role_permissions").select("*");
  if (error) return [];
  return (data || []).map((row: Record<string, any>) => ({
    role: String(row.role), permission: String(row.permission), allowed: Boolean(row.allowed),
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : undefined,
  }));
}

export async function fetchUserOverrides(userId: string): Promise<UserOverrideRow[]> {
  const { data, error } = await supabase.from("user_permission_overrides").select("*").eq("user_id", userId);
  if (error) return [];
  return (data || []).map((row: Record<string, any>) => ({
    userId: String(row.user_id), permission: String(row.permission), allowed: Boolean(row.allowed),
    setBy: row.set_by ? String(row.set_by) : null,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : typeof row.created_at === "string" ? row.created_at : undefined,
  }));
}

export async function fetchEffectivePermissions(userId: string, role: string): Promise<Set<string>> {
  const [rolePermissions, overrides] = await Promise.all([fetchRolePermissions(), fetchUserOverrides(userId)]);
  return resolvePermissions(role, rolePermissions, overrides);
}

export async function setRolePermission(role: string, permission: string, allowed: boolean): Promise<void> {
  if (isAdminRole(role)) throw new Error("Admin core access cannot be changed.");
  const { error } = await supabase.from("role_permissions").upsert(
    { role, permission, allowed, updated_at: new Date().toISOString() }, { onConflict: "role,permission" },
  );
  if (error) throw error;
  announcePermissionsChanged();
}

export async function setUserOverride(userId: string, permission: string, allowed: boolean | null, setBy: string): Promise<void> {
  if (allowed === null) {
    const { error } = await supabase.from("user_permission_overrides").delete().eq("user_id", userId).eq("permission", permission);
    if (error) throw error;
    announcePermissionsChanged();
    return;
  }
  const { error } = await supabase.from("user_permission_overrides").upsert(
    { user_id: userId, permission, allowed, set_by: setBy, updated_at: new Date().toISOString() },
    { onConflict: "user_id,permission" },
  );
  if (error) throw error;
  announcePermissionsChanged();
}

export async function fetchOrganizationScopeGrants(userId: string): Promise<OrganizationScopeGrant[]> {
  const { data, error } = await supabase.from("user_org_scope_grants").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    throw error;
  }
  return (data || []).map((row: Record<string, any>) => ({
    id: String(row.id), userId: String(row.user_id), orgId: String(row.org_id),
    accessLevel: row.access_level as OrganizationScopeGrant["accessLevel"], reason: String(row.reason || ""),
    grantedBy: String(row.granted_by), expiresAt: row.expires_at ? String(row.expires_at) : null,
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  }));
}

export async function saveOrganizationScopeGrant(input: ScopeGrantInput): Promise<void> {
  const reason = input.reason.trim();
  if (reason.length < 4) throw new Error("Enter a clear reason for this cross-organization grant.");
  const { error } = await supabase.from("user_org_scope_grants").upsert({
    user_id: input.userId, org_id: input.orgId, access_level: input.accessLevel,
    reason, expires_at: input.expiresAt || null, granted_by: input.grantedBy,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,org_id" });
  if (error) throw error;
}

export async function deleteOrganizationScopeGrant(grantId: string): Promise<void> {
  const { error } = await supabase.from("user_org_scope_grants").delete().eq("id", grantId);
  if (error) throw error;
}
