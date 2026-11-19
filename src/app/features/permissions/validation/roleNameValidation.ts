import { MANAGED_ROLES } from "../constants";

const CONTROL_CHAR_REGEX = /[\x00-\x1f\x7f]/;

/** Built-in canonical role names and legacy/UI aliases that custom roles cannot reuse. */
export const RESERVED_ROLE_LABEL_MAP: Readonly<Record<string, string>> = {
  admin: "Admin",
  administrator: "Admin",
  "super admin": "Admin",
  head: "Head",
  "office head": "Head",
  "department head": "Head",
  "dept head": "Head",
  "assistant head": "Head",
  "accounting staff": "Accounting Staff",
  member: "Member",
  employee: "Member",
  viewer: "Viewer",
};

/** Collapse repeated whitespace and trim outer spaces for display/storage. */
export function cleanCustomRoleLabel(raw: string): string {
  return String(raw || "").trim().replace(/\s+/g, " ");
}

/**
 * Canonical comparison key for role names.
 * Matches case, extra whitespace, and separator punctuation (e.g. "Bagong-Role" === "bagong  role").
 */
export function normalizeRoleLabel(raw: string): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export interface ExistingRoleLabelEntry {
  key: string;
  label: string;
  isBuiltIn?: boolean;
}

/**
 * Validate a custom role name against length/character rules, built-in role names,
 * and existing custom role names (excluding the role currently being edited).
 */
export function validateCustomRoleName(
  rawLabel: string,
  existingRoles: readonly ExistingRoleLabelEntry[] = [],
  excludeRoleKey?: string | null,
): string | null {
  const cleaned = cleanCustomRoleLabel(rawLabel);

  if (cleaned.length < 2 || cleaned.length > 60) {
    return "Enter a role name between 2 and 60 characters.";
  }

  if (CONTROL_CHAR_REGEX.test(cleaned)) {
    return "Role name contains unsupported control characters.";
  }

  const normalized = normalizeRoleLabel(cleaned);
  const alnumCount = normalized.replace(/\s+/g, "").length;
  if (alnumCount < 2) {
    return "Role name must include at least 2 letters or numbers.";
  }

  const reservedHit = RESERVED_ROLE_LABEL_MAP[normalized];
  if (reservedHit) {
    return `"${cleaned}" matches the built-in ${reservedHit} role. Choose a different role name.`;
  }

  const builtInMatch = MANAGED_ROLES.find(
    (role) => normalizeRoleLabel(role.label) === normalized || normalizeRoleLabel(role.key) === normalized,
  );
  if (builtInMatch) {
    return `"${cleaned}" matches the built-in ${builtInMatch.label} role. Choose a different role name.`;
  }

  const excluded = (excludeRoleKey || "").trim().toLowerCase();
  const duplicate = existingRoles.find((role) => {
    if (excluded && role.key.trim().toLowerCase() === excluded) return false;
    return normalizeRoleLabel(role.label) === normalized;
  });

  if (duplicate) {
    return duplicate.isBuiltIn
      ? `"${cleaned}" matches the built-in ${duplicate.label} role. Choose a different role name.`
      : `A role named "${duplicate.label}" already exists. Choose a different role name.`;
  }

  return null;
}
