import { isAdminRole } from "../../../shared/roles";
import { supabase } from "../../../../lib/supabase";
import type {
  BaseCustomRole,
  CustomRoleDefinition,
  OrganizationScopeGrant,
  RolePermissionRow,
  ScopeGrantInput,
  UserOverrideRow,
} from "../types";
import { resolvePermissions } from "../selectors";
import {
  ACTION_PERMISSION_KEYS,
  PERMISSIONS_CHANGED_EVENT,
  PERMISSIONS_CHANGED_STORAGE_KEY,
  VISIBLE_PAGE_PERMISSION_KEYS,
} from "../constants";

const ALL_MANAGED_PERMISSIONS = [...VISIBLE_PAGE_PERMISSION_KEYS, ...ACTION_PERMISSION_KEYS];

export const CUSTOM_ROLES_CHANGED_EVENT = "eflow:custom-roles-changed";
const RESERVED_ROLE_KEYS = new Set(["admin", "head", "accounting_staff", "member", "super_admin"]);

export function announcePermissionsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PERMISSIONS_CHANGED_EVENT));
  try {
    window.localStorage.setItem(PERMISSIONS_CHANGED_STORAGE_KEY, String(Date.now()));
  } catch {
    // Realtime and the same-window event still refresh access when storage is unavailable.
  }
}

export function announceCustomRolesChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CUSTOM_ROLES_CHANGED_EVENT));
  announcePermissionsChanged();
}

function isMissingCustomRolesRelation(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205";
}

function mapCustomRoleRow(row: Record<string, any>): CustomRoleDefinition {
  return {
    key: String(row.key),
    label: String(row.label),
    description: String(row.description || ""),
    baseRole: row.base_role as BaseCustomRole,
    createdAt: typeof row.created_at === "string" ? row.created_at : undefined,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : undefined,
  };
}

async function readRolePermissions(strict = false): Promise<RolePermissionRow[]> {
  const { data, error } = await supabase.from("role_permissions").select("*");
  if (error && strict) throw error;
  if (error) return [];
  return (data || []).map((row: Record<string, any>) => ({
    role: String(row.role), permission: String(row.permission), allowed: Boolean(row.allowed),
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : undefined,
  }));
}

export function fetchRolePermissions(): Promise<RolePermissionRow[]> {
  return readRolePermissions();
}

async function readUserOverrides(userId: string, strict = false): Promise<UserOverrideRow[]> {
  const { data, error } = await supabase.from("user_permission_overrides").select("*").eq("user_id", userId);
  if (error && strict) throw error;
  if (error) return [];
  return (data || []).map((row: Record<string, any>) => ({
    userId: String(row.user_id), permission: String(row.permission), allowed: Boolean(row.allowed),
    setBy: row.set_by ? String(row.set_by) : null,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : typeof row.created_at === "string" ? row.created_at : undefined,
  }));
}

export function fetchUserOverrides(userId: string): Promise<UserOverrideRow[]> {
  return readUserOverrides(userId);
}

export async function fetchIndividualAccess(userId: string) {
  const [roleRows, overrides] = await Promise.all([
    readRolePermissions(true),
    readUserOverrides(userId, true),
  ]);
  return { roleRows, overrides };
}

export async function fetchCustomRoles(): Promise<CustomRoleDefinition[]> {
  const table = (supabase as any)?.from?.("custom_roles");
  if (!table || typeof table.select !== "function") return [];
  const { data, error } = await table.select("*").order("label", { ascending: true });
  if (error) {
    if (isMissingCustomRolesRelation(error)) return [];
    throw error;
  }
  return (data || []).map((row: Record<string, any>) => mapCustomRoleRow(row));
}

async function fetchCustomRoleByKey(key: string): Promise<CustomRoleDefinition | null> {
  const normalized = key.trim();
  if (!normalized || isAdminRole(normalized)) return null;
  const table = (supabase as any)?.from?.("custom_roles");
  if (!table || typeof table.select !== "function") return null;
  const { data, error } = await table.select("*").eq("key", normalized).maybeSingle();
  if (error) {
    if (isMissingCustomRolesRelation(error)) return null;
    throw error;
  }
  return data ? mapCustomRoleRow(data as Record<string, any>) : null;
}

export async function fetchEffectivePermissions(
  userId: string,
  role: string,
  customRoleKey?: string | null,
): Promise<Set<string>> {
  const [rolePermissions, overrides, customRole] = await Promise.all([
    readRolePermissions(true),
    readUserOverrides(userId, true),
    customRoleKey && !isAdminRole(role) ? fetchCustomRoleByKey(customRoleKey) : Promise.resolve(null),
  ]);
  return resolvePermissions(role, rolePermissions, overrides, customRole);
}

export function buildCustomRoleKey(label: string, existingKeys: Iterable<string> = []): string {
  const used = new Set(Array.from(existingKeys, (k) => k.toLowerCase()));
  const baseRaw = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  let slug = baseRaw.length >= 2 ? baseRaw : `role_${baseRaw || "custom"}`;
  if (!/^[a-z]/.test(slug)) slug = `role_${slug}`;
  slug = slug.slice(0, 42);
  if (RESERVED_ROLE_KEYS.has(slug)) slug = `${slug}_custom`;
  let candidate = slug;
  let counter = 2;
  while (used.has(candidate) || RESERVED_ROLE_KEYS.has(candidate)) {
    const suffix = `_${counter}`;
    candidate = `${slug.slice(0, Math.max(2, 48 - suffix.length))}${suffix}`;
    counter += 1;
  }
  return candidate;
}

export async function saveCustomRolePermissions(
  roleKey: string,
  allowedMap: Record<string, boolean>,
): Promise<void> {
  if (!roleKey || isAdminRole(roleKey)) throw new Error("Admin defaults cannot be changed.");
  const del = await supabase.from("role_permissions").delete().eq("role", roleKey);
  if (del?.error) throw del.error;

  const now = new Date().toISOString();
  const rows = ALL_MANAGED_PERMISSIONS.map((permission) => ({
    role: roleKey,
    permission,
    allowed: Boolean(allowedMap[permission]),
    updated_at: now,
  }));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("role_permissions")
      .upsert(rows, { onConflict: "role,permission" });
    if (error) throw error;
  }
  announcePermissionsChanged();
}

export async function createCustomRole(input: {
  label: string;
  baseRole?: BaseCustomRole;
  description?: string;
  existingKeys?: Iterable<string>;
  permissions?: Record<string, boolean>;
}): Promise<CustomRoleDefinition> {
  const label = input.label.trim().replace(/\s+/g, " ");
  if (label.length < 2 || label.length > 60) {
    throw new Error("Role name must be between 2 and 60 characters.");
  }
  const description = (input.description || "").trim().slice(0, 240);
  const currentKeys = input.existingKeys
    ? Array.from(input.existingKeys)
    : (await fetchCustomRoles()).map((r) => r.key);
  const key = buildCustomRoleKey(label, currentKeys);
  const baseRole = input.baseRole ?? "member";
  const { data, error } = await supabase
    .from("custom_roles")
    .insert({ key, label, description, base_role: baseRole })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("A custom role with that name already exists.");
    throw error;
  }
  if (input.permissions) {
    await saveCustomRolePermissions(key, input.permissions);
  }
  announceCustomRolesChanged();
  return mapCustomRoleRow(data as Record<string, any>);
}

export async function updateCustomRole(
  key: string,
  input: {
    label: string;
    description?: string;
    baseRole?: BaseCustomRole;
    permissions?: Record<string, boolean>;
  },
): Promise<CustomRoleDefinition> {
  const label = input.label.trim().replace(/\s+/g, " ");
  if (label.length < 2 || label.length > 60) {
    throw new Error("Role name must be between 2 and 60 characters.");
  }
  const description = (input.description || "").trim().slice(0, 240);
  const patch: Record<string, unknown> = {
    label,
    description,
    updated_at: new Date().toISOString(),
  };
  if (input.baseRole) patch.base_role = input.baseRole;
  const { data, error } = await supabase
    .from("custom_roles")
    .update(patch)
    .eq("key", key)
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("A custom role with that name already exists.");
    throw error;
  }
  const updated = mapCustomRoleRow(data as Record<string, any>);
  if (input.permissions) {
    await saveCustomRolePermissions(key, input.permissions);
  }
  announceCustomRolesChanged();
  return updated;
}

export async function deleteCustomRole(key: string): Promise<void> {
  if (!key || isAdminRole(key)) throw new Error("Built-in roles cannot be deleted.");
  const permDelete = await supabase.from("role_permissions").delete().eq("role", key);
  if (permDelete?.error) throw permDelete.error;
  const { error } = await supabase.from("custom_roles").delete().eq("key", key);
  if (error) throw error;
  announceCustomRolesChanged();
}

export async function restoreRoleDefaults(role: string): Promise<void> {
  if (isAdminRole(role)) throw new Error("Admin defaults cannot be changed.");
  const { error } = await supabase.from("role_permissions").delete().eq("role", role);
  if (error) throw error;
  announcePermissionsChanged();
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
