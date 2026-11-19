import { isAdminRole } from "../../shared/roles";
import {
  ADMIN_PERMISSIONS,
  PERMISSION_LABELS,
  type PermissionKey,
} from "./constants";

export const ADMIN_ONLY_PERMISSION_SET = new Set<string>(ADMIN_PERMISSIONS);

/**
 * Accounting execution & treasury workspace permissions that enforce segregation
 * of duties on the backend (only Accounting Staff accounts or Accounting Staff-based
 * custom roles can hold them). Office Budget Ledgers (`navigation.department_budgets`)
 * remains shareable with Heads and custom roles.
 */
export const ACCOUNTING_STAFF_ONLY_PERMISSIONS: readonly PermissionKey[] = [
  "navigation.accounting_overview",
  "navigation.accounting_releases",
  "navigation.accounting_journal",
  "navigation.accounting_audit",
  "accounting.release_cash",
  "accounting.settle_liquidation",
  "accounting.post_journal",
] as const;

export const ACCOUNTING_STAFF_ONLY_PERMISSION_SET = new Set<string>(
  ACCOUNTING_STAFF_ONLY_PERMISSIONS,
);

/**
 * Single source of truth for frontend permission dependencies.
 * Matches live Postgres `public.permission_prerequisites()` and Python `_PERMISSION_PREREQUISITES` 1:1.
 */
export const PERMISSION_DEPENDENCIES: Readonly<Partial<Record<PermissionKey, readonly PermissionKey[]>>> = {
  "projects.create": ["navigation.projects"],
  "projects.archive": ["navigation.projects"],
  "projects.delete": ["navigation.projects"],
  "tasks.assign": ["navigation.tasks"],
  "tasks.verify": ["navigation.reviews"],
  "reports.export": ["navigation.reports"],
  "announcements.publish": ["navigation.announcements"],
  "users.manage": ["navigation.user_management"],
  "audit.read": ["navigation.audit"],
  "settings.manage": ["navigation.system_settings"],
  "database.backup": ["navigation.data_tools"],
  "accounting.release_cash": ["navigation.accounting_releases"],
  "accounting.settle_liquidation": ["navigation.accounting_releases"],
  "accounting.post_journal": ["navigation.accounting_journal"],
};

export function isAdminOnlyPermission(permission: string): boolean {
  return ADMIN_ONLY_PERMISSION_SET.has(permission);
}

export function isAccountingOnlyPermission(permission: string): boolean {
  return ACCOUNTING_STAFF_ONLY_PERMISSION_SET.has(permission);
}

export function getPermissionRestriction(
  permission: string,
  baseRole: string,
): { restricted: boolean; reason: string | null } {
  if (isAdminRole(baseRole)) {
    return { restricted: true, reason: "System Admin permissions are fixed and cannot be modified." };
  }
  if (isAdminOnlyPermission(permission)) {
    return {
      restricted: true,
      reason: "Admin only — cannot be granted to non-Admin roles or users.",
    };
  }
  if (baseRole !== "accounting_staff" && isAccountingOnlyPermission(permission)) {
    return {
      restricted: true,
      reason: "Requires an Accounting Staff account type (segregation of duties).",
    };
  }
  return { restricted: false, reason: null };
}

/** Transitive prerequisites required to allow `permission`. */
export function getPermissionPrerequisites(permission: string): PermissionKey[] {
  const visited = new Set<PermissionKey>();
  const stack: string[] = [...(PERMISSION_DEPENDENCIES[permission as PermissionKey] || [])];
  while (stack.length > 0) {
    const req = stack.pop() as PermissionKey;
    if (visited.has(req)) continue;
    visited.add(req);
    const parentReqs = PERMISSION_DEPENDENCIES[req];
    if (parentReqs) {
      for (const parent of parentReqs) {
        if (!visited.has(parent)) stack.push(parent);
      }
    }
  }
  return Array.from(visited);
}

/** Transitive dependent permissions that require `permission` to stay allowed. */
export function getPermissionDependents(permission: string): PermissionKey[] {
  const reverse = new Map<string, PermissionKey[]>();
  for (const [child, reqs] of Object.entries(PERMISSION_DEPENDENCIES) as Array<
    [PermissionKey, readonly PermissionKey[]]
  >) {
    for (const req of reqs) {
      const list = reverse.get(req) || [];
      list.push(child);
      reverse.set(req, list);
    }
  }

  const visited = new Set<PermissionKey>();
  const stack: PermissionKey[] = [...(reverse.get(permission) || [])];
  while (stack.length > 0) {
    const dep = stack.pop()!;
    if (visited.has(dep)) continue;
    visited.add(dep);
    const childDeps = reverse.get(dep);
    if (childDeps) {
      for (const next of childDeps) {
        if (!visited.has(next)) stack.push(next);
      }
    }
  }
  return Array.from(visited);
}

/**
 * Filters a raw permission set so effective permissions always satisfy:
 *  1. Non-Admins never hold Admin-only permissions.
 *  2. Non-Accounting-Staff accounts never hold Accounting-Staff-only permissions.
 *  3. No permission is active unless all of its prerequisites are also active.
 */
export function enforcePermissionDependencies(
  rawAllowed: Iterable<string>,
  options: { isAdmin?: boolean; baseRole?: string } = {},
): Set<string> {
  const effective = new Set<string>(rawAllowed);
  const isAdmin = Boolean(options.isAdmin);
  const baseRole = options.baseRole;

  if (!isAdmin) {
    for (const perm of Array.from(effective)) {
      if (isAdminOnlyPermission(perm)) {
        effective.delete(perm);
      } else if (baseRole && baseRole !== "accounting_staff" && isAccountingOnlyPermission(perm)) {
        effective.delete(perm);
      }
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const perm of Array.from(effective)) {
      const prereqs = PERMISSION_DEPENDENCIES[perm as PermissionKey];
      if (!prereqs || prereqs.length === 0) continue;
      if (prereqs.some((req) => !effective.has(req))) {
        effective.delete(perm);
        changed = true;
      }
    }
  }
  return effective;
}

export interface ModulePresetDefinition {
  id: string;
  label: string;
  permissions: readonly PermissionKey[];
  requiresAccountingRole?: boolean;
}

export interface PermissionModuleDefinition {
  id: string;
  title: string;
  description: string;
  pageKeys: readonly PermissionKey[];
  standardActionKeys: readonly PermissionKey[];
  advancedActionKeys: readonly PermissionKey[];
  presets: readonly ModulePresetDefinition[];
  adminOnly?: boolean;
}

export const PERMISSION_MODULES: readonly PermissionModuleDefinition[] = [
  {
    id: "projects",
    title: "Projects",
    description: "Viewing project workspaces, creating new projects, and lifecycle controls.",
    pageKeys: ["navigation.projects"],
    standardActionKeys: ["projects.create"],
    advancedActionKeys: ["projects.archive", "projects.delete"],
    presets: [
      { id: "none", label: "No access", permissions: [] },
      { id: "view", label: "View only", permissions: ["navigation.projects"] },
      { id: "manage", label: "Create & manage", permissions: ["navigation.projects", "projects.create"] },
    ],
  },
  {
    id: "tasks",
    title: "Tasks & Subtasks",
    description: "Task boards, personal work tracking, and assigning work to team members.",
    pageKeys: ["navigation.tasks"],
    standardActionKeys: ["tasks.assign"],
    advancedActionKeys: [],
    presets: [
      { id: "none", label: "No access", permissions: [] },
      { id: "view", label: "View only", permissions: ["navigation.tasks"] },
      { id: "manage", label: "Assign & manage", permissions: ["navigation.tasks", "tasks.assign"] },
    ],
  },
  {
    id: "reviews",
    title: "Review Queues",
    description: "Reviewing and verifying submitted task deliverables.",
    pageKeys: ["navigation.reviews"],
    standardActionKeys: ["tasks.verify"],
    advancedActionKeys: [],
    presets: [
      { id: "none", label: "No access", permissions: [] },
      { id: "view", label: "View only", permissions: ["navigation.reviews"] },
      { id: "manage", label: "Verify submissions", permissions: ["navigation.reviews", "tasks.verify"] },
    ],
  },
  {
    id: "team",
    title: "Team & Oversight",
    description: "Office team supervision and workload intelligence dashboards.",
    pageKeys: ["navigation.team_supervision", "navigation.team_intelligence"],
    standardActionKeys: [],
    advancedActionKeys: [],
    presets: [
      { id: "none", label: "No access", permissions: [] },
      { id: "supervision", label: "Supervision", permissions: ["navigation.team_supervision"] },
      {
        id: "full",
        label: "Full oversight",
        permissions: ["navigation.team_supervision", "navigation.team_intelligence"],
      },
    ],
  },
  {
    id: "reports_comms",
    title: "Reports & Announcements",
    description: "Operational reporting, exports, and official announcements.",
    pageKeys: ["navigation.reports", "navigation.announcements"],
    standardActionKeys: ["reports.export"],
    advancedActionKeys: ["announcements.publish"],
    presets: [
      { id: "none", label: "No access", permissions: [] },
      { id: "view", label: "View only", permissions: ["navigation.reports", "navigation.announcements"] },
      {
        id: "export",
        label: "View & export",
        permissions: ["navigation.reports", "reports.export", "navigation.announcements"],
      },
      {
        id: "full",
        label: "Full access",
        permissions: [
          "navigation.reports",
          "reports.export",
          "navigation.announcements",
          "announcements.publish",
        ],
      },
    ],
  },
  {
    id: "accounting",
    title: "Accounting & Office Budgets",
    description: "Office budget ledgers and segregated Accounting Staff treasury workflows.",
    pageKeys: [
      "navigation.department_budgets",
      "navigation.accounting_overview",
      "navigation.accounting_releases",
      "navigation.accounting_journal",
      "navigation.accounting_audit",
    ],
    standardActionKeys: ["accounting.release_cash", "accounting.settle_liquidation"],
    advancedActionKeys: ["accounting.post_journal"],
    presets: [
      { id: "none", label: "No access", permissions: [] },
      { id: "budgets", label: "Office budgets", permissions: ["navigation.department_budgets"] },
      {
        id: "view",
        label: "View accounting",
        requiresAccountingRole: true,
        permissions: [
          "navigation.department_budgets",
          "navigation.accounting_overview",
          "navigation.accounting_releases",
          "navigation.accounting_journal",
          "navigation.accounting_audit",
        ],
      },
      {
        id: "full",
        label: "Full accounting",
        requiresAccountingRole: true,
        permissions: [
          "navigation.department_budgets",
          "navigation.accounting_overview",
          "navigation.accounting_releases",
          "navigation.accounting_journal",
          "navigation.accounting_audit",
          "accounting.release_cash",
          "accounting.settle_liquidation",
          "accounting.post_journal",
        ],
      },
    ],
  },
  {
    id: "system_admin",
    title: "System Administration",
    description: "Fixed administrative privileges for user management, audit logs, settings, and backups.",
    pageKeys: [
      "navigation.user_management",
      "navigation.audit",
      "navigation.system_settings",
      "navigation.data_tools",
    ],
    standardActionKeys: ["users.manage", "audit.read"],
    advancedActionKeys: ["settings.manage", "database.backup"],
    presets: [],
    adminOnly: true,
  },
];

export function getModuleAllKeys(module: PermissionModuleDefinition): PermissionKey[] {
  return [...module.pageKeys, ...module.standardActionKeys, ...module.advancedActionKeys];
}

export function detectModulePreset(
  module: PermissionModuleDefinition,
  allowedMap: Record<string, boolean>,
): string | "custom" {
  const allKeys = getModuleAllKeys(module);
  for (const preset of module.presets) {
    const presetSet = new Set<string>(preset.permissions);
    const exactMatch = allKeys.every((key) => Boolean(allowedMap[key]) === presetSet.has(key));
    if (exactMatch) return preset.id;
  }
  return "custom";
}

export interface RoleTogglePlan {
  allowed: boolean;
  error?: string;
  changes: Record<string, boolean>;
  autoEnabled: PermissionKey[];
  cascadeDisabled: PermissionKey[];
  summary: string | null;
}

/**
 * Plans a single permission toggle on a role or custom role while maintaining
 * strict prerequisite consistency and role-restriction guards.
 */
export function planRolePermissionToggle(
  currentMap: Record<string, boolean>,
  permission: PermissionKey,
  nextAllowed: boolean,
  baseRole: string,
): RoleTogglePlan {
  const restriction = getPermissionRestriction(permission, baseRole);
  if (restriction.restricted && (nextAllowed || isAdminRole(baseRole))) {
    return {
      allowed: false,
      error: restriction.reason || "This permission cannot be changed for this role.",
      changes: {},
      autoEnabled: [],
      cascadeDisabled: [],
      summary: null,
    };
  }

  const changes: Record<string, boolean> = { [permission]: nextAllowed };
  const autoEnabled: PermissionKey[] = [];
  const cascadeDisabled: PermissionKey[] = [];

  if (nextAllowed) {
    for (const req of getPermissionPrerequisites(permission)) {
      const reqRestriction = getPermissionRestriction(req, baseRole);
      if (reqRestriction.restricted) {
        return {
          allowed: false,
          error: reqRestriction.reason || `Cannot enable required permission ${PERMISSION_LABELS[req]}.`,
          changes: {},
          autoEnabled: [],
          cascadeDisabled: [],
          summary: null,
        };
      }
      if (!currentMap[req]) {
        changes[req] = true;
        autoEnabled.push(req);
      }
    }
  } else {
    for (const dep of getPermissionDependents(permission)) {
      if (currentMap[dep]) {
        changes[dep] = false;
        cascadeDisabled.push(dep);
      }
    }
  }

  let summary: string | null = null;
  if (autoEnabled.length > 0) {
    const names = autoEnabled.map((k) => PERMISSION_LABELS[k] || k).join(", ");
    summary = `Also enabled ${names} because ${PERMISSION_LABELS[permission] || permission} requires it.`;
  } else if (cascadeDisabled.length > 0) {
    const names = cascadeDisabled.map((k) => PERMISSION_LABELS[k] || k).join(", ");
    summary = `Turning off ${PERMISSION_LABELS[permission] || permission} will also turn off ${names}.`;
  }

  return {
    allowed: true,
    changes,
    autoEnabled,
    cascadeDisabled,
    summary,
  };
}

/**
 * Plans switching a module's quick access level preset (e.g., No access / View only / Create & manage).
 * Respects `baseRole` restrictions and never creates missing-prerequisite states.
 */
export function planModulePresetChange(
  currentMap: Record<string, boolean>,
  module: PermissionModuleDefinition,
  presetId: string,
  baseRole: string,
): RoleTogglePlan {
  if (module.adminOnly || isAdminRole(baseRole)) {
    return {
      allowed: false,
      error: "System Administration permissions are locked to Admin accounts.",
      changes: {},
      autoEnabled: [],
      cascadeDisabled: [],
      summary: null,
    };
  }
  const preset = module.presets.find((item) => item.id === presetId);
  if (!preset) {
    return {
      allowed: false,
      error: "Choose a valid module access level.",
      changes: {},
      autoEnabled: [],
      cascadeDisabled: [],
      summary: null,
    };
  }
  if (preset.requiresAccountingRole && baseRole !== "accounting_staff") {
    return {
      allowed: false,
      error: "Accounting workspace access requires an Accounting Staff account type.",
      changes: {},
      autoEnabled: [],
      cascadeDisabled: [],
      summary: null,
    };
  }

  const targetSet = new Set<string>(preset.permissions);
  for (const key of Array.from(targetSet)) {
    for (const req of getPermissionPrerequisites(key)) {
      targetSet.add(req);
    }
  }

  const moduleKeys = getModuleAllKeys(module);
  const changes: Record<string, boolean> = {};
  const cascadeDisabled: PermissionKey[] = [];

  for (const key of moduleKeys) {
    const restriction = getPermissionRestriction(key, baseRole);
    if (restriction.restricted) continue;
    const desired = targetSet.has(key);
    const current = Boolean(currentMap[key]);
    if (desired !== current) {
      changes[key] = desired;
      if (!desired && (module.standardActionKeys.includes(key) || module.advancedActionKeys.includes(key))) {
        cascadeDisabled.push(key);
      }
    }
  }

  // Ensure no cross-module dependent is left dangling if a page in this module was disabled.
  for (const [key, desired] of Object.entries(changes)) {
    if (!desired) {
      for (const dep of getPermissionDependents(key)) {
        if (currentMap[dep] && changes[dep] !== false) {
          changes[dep] = false;
          if (!cascadeDisabled.includes(dep)) cascadeDisabled.push(dep);
        }
      }
    }
  }

  return {
    allowed: true,
    changes,
    autoEnabled: [],
    cascadeDisabled,
    summary:
      Object.keys(changes).length > 0
        ? `Updated ${module.title} to ${preset.label}.`
        : null,
  };
}

export interface UserOverridePlan {
  allowed: boolean;
  error?: string;
  changes: Record<string, boolean | null>;
  autoEnabled: PermissionKey[];
  cascadeDisabled: PermissionKey[];
  summary: string | null;
}

/**
 * Plans an individual user override change (`true` = Allow, `false` = Deny, `null` = Default)
 * across role baseline + existing overrides so effective permissions never contradict dependencies.
 */
export function planUserOverrideChange(
  roleBaselineMap: Record<string, boolean>,
  currentOverridesMap: Record<string, boolean>,
  permission: PermissionKey,
  nextOverride: boolean | null,
  baseRole: string,
): UserOverridePlan {
  const restriction = getPermissionRestriction(permission, baseRole);
  if (restriction.restricted && nextOverride === true) {
    return {
      allowed: false,
      error: restriction.reason || "This permission cannot be granted to this account.",
      changes: {},
      autoEnabled: [],
      cascadeDisabled: [],
      summary: null,
    };
  }

  const effectiveAfter = (
    draftOverrides: Record<string, boolean | undefined>,
    key: string,
  ): boolean => {
    const ov = draftOverrides[key];
    return ov !== undefined ? ov : Boolean(roleBaselineMap[key]);
  };

  const draftOverrides: Record<string, boolean | undefined> = { ...currentOverridesMap };
  const changes: Record<string, boolean | null> = { [permission]: nextOverride };
  if (nextOverride === null) delete draftOverrides[permission];
  else draftOverrides[permission] = nextOverride;

  const autoEnabled: PermissionKey[] = [];
  const cascadeDisabled: PermissionKey[] = [];
  const nextEffective = effectiveAfter(draftOverrides, permission);

  if (nextEffective) {
    for (const req of getPermissionPrerequisites(permission)) {
      const reqRestriction = getPermissionRestriction(req, baseRole);
      if (reqRestriction.restricted) {
        return {
          allowed: false,
          error: reqRestriction.reason || `Cannot enable required permission ${PERMISSION_LABELS[req]}.`,
          changes: {},
          autoEnabled: [],
          cascadeDisabled: [],
          summary: null,
        };
      }
      if (!effectiveAfter(draftOverrides, req)) {
        // If role already allows req and it was explicitly denied, reset override to Default (null) if role allows it, else Allow (true).
        if (roleBaselineMap[req] && currentOverridesMap[req] === false) {
          changes[req] = null;
          delete draftOverrides[req];
        } else {
          changes[req] = true;
          draftOverrides[req] = true;
        }
        autoEnabled.push(req);
      }
    }
  } else {
    // Disabling or resetting to a denied default: cascade any dependent that would otherwise remain effectively allowed.
    for (const dep of getPermissionDependents(permission)) {
      if (effectiveAfter(draftOverrides, dep)) {
        // If role baseline already denies `dep` and user had an explicit Allow override, reset to Default (null); otherwise set explicit Deny (false).
        if (!roleBaselineMap[dep] && currentOverridesMap[dep] === true) {
          changes[dep] = null;
          delete draftOverrides[dep];
        } else {
          changes[dep] = false;
          draftOverrides[dep] = false;
        }
        cascadeDisabled.push(dep);
      }
    }
  }

  let summary: string | null = null;
  if (autoEnabled.length > 0) {
    const names = autoEnabled.map((k) => PERMISSION_LABELS[k] || k).join(", ");
    summary = `Also enables ${names} because ${PERMISSION_LABELS[permission] || permission} requires it.`;
  } else if (cascadeDisabled.length > 0) {
    const names = cascadeDisabled.map((k) => PERMISSION_LABELS[k] || k).join(", ");
    summary = `Also turns off dependent access: ${names}.`;
  }

  return {
    allowed: true,
    changes,
    autoEnabled,
    cascadeDisabled,
    summary,
  };
}

/**
 * Normalizes a full permission map before saving a custom role so restricted permissions
 * are forced false and all enabled actions automatically carry their prerequisites.
 */
export function normalizeRolePermissionMap(
  rawMap: Record<string, boolean>,
  baseRole: string,
): Record<string, boolean> {
  const normalized: Record<string, boolean> = {};
  for (const [perm, value] of Object.entries(rawMap)) {
    const restriction = getPermissionRestriction(perm, baseRole);
    normalized[perm] = restriction.restricted ? false : Boolean(value);
  }
  for (const [perm, value] of Object.entries(normalized)) {
    if (!value) continue;
    for (const req of getPermissionPrerequisites(perm)) {
      const reqRestriction = getPermissionRestriction(req, baseRole);
      if (reqRestriction.restricted) {
        normalized[perm] = false;
      } else {
        normalized[req] = true;
      }
    }
  }
  return normalized;
}
