export interface RolePermissionRow {
  role: string;
  permission: string;
  allowed: boolean;
  updatedAt?: string;
}

export type BaseCustomRole = "head" | "accounting_staff" | "member";

export interface CustomRoleDefinition {
  key: string;
  label: string;
  description: string;
  baseRole: BaseCustomRole;
  createdAt?: string;
  updatedAt?: string;
}

export interface CustomRoleSummary {
  key: string;
  baseRole: string;
}

export interface ManagedRoleCatalogEntry {
  key: string;
  label: string;
  description: string;
  baseRole: "admin" | BaseCustomRole;
  isBuiltIn: boolean;
  isLocked: boolean;
}

export interface UserOverrideRow {
  userId: string;
  permission: string;
  allowed: boolean;
  setBy?: string | null;
  updatedAt?: string;
}

export type OrganizationAccessLevel = "read" | "review" | "manage";

export interface OrganizationScopeGrant {
  id: string;
  userId: string;
  orgId: string;
  accessLevel: OrganizationAccessLevel;
  reason: string;
  grantedBy: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScopeGrantInput {
  userId: string;
  orgId: string;
  accessLevel: OrganizationAccessLevel;
  reason: string;
  expiresAt?: string | null;
  grantedBy: string;
}
