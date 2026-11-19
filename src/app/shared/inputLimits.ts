import type React from "react";

/**
 * Single source of truth for text and numeric input bounds across eFlow.
 * Kept aligned 1:1 with live Postgres CHECK constraints and FastAPI Pydantic schemas.
 */
export const INPUT_LIMITS = {
  // Text / letter limits
  CODE: 50,               // Voucher codes, cheque numbers, account codes, unit labels, status labels
  ROLE_NAME: 60,          // Custom role labels (custom_roles.label <= 60)
  SHORT_TAG: 100,         // Skill tags, short keywords (skill_tag_definitions.label <= 100)
  SEARCH: 120,            // Search & filter boxes across workspaces
  GROUP_TITLE: 120,       // Project groups, workspaces, templates (<= 120)
  PASSWORD: 128,          // Passwords (min 8, max 128)
  PERSON_NAME: 160,       // Full name, display name (<= 160)
  TITLE: 200,             // Project title, office/account/subtask title, announcement title (<= 200)
  SHORT_DESCRIPTION: 240, // Role description, short remarks (<= 240)
  EMAIL: 254,             // RFC 5321 max email length (project_invitation_requests.email <= 254)
  TASK_TITLE: 300,        // Task titles (phase3_create_task <= 300)
  TAGS_LIST: 500,         // Comma-separated tag lists
  REASON: 1000,           // Reasons, archive/delete/decline/deadline explanations, short comments
  SUMMARY: 1500,          // Invitation / profile summaries (<= 1500)
  FUNDING_REASON: 3000,   // Project/office budget funding justification & authority references
  COMMENT: 4000,          // Discussion comments & review notes (<= 4000)
  DESCRIPTION: 10000,     // Task/plan descriptions, announcement bodies, criteria blocks
  PROJECT_DESCRIPTION: 12000, // Project description & scope (eflow_project.save_details <= 12000)

  // Numeric limits
  MONEY_MAX_BUDGET: 90_000_000_000, // ₱90B annual/project budget ceiling
  MONEY_MAX_LINE: 9_999_999_999,    // ₱9.99B line-item / unit-cost ceiling
  MONEY_MAX_TASK_IMPACT: 1_000_000_000_000, // ₱1T task budget impact ceiling
  QUANTITY_MAX_RECEIPT: 9_007_199_254_740,
  QUANTITY_MAX_PROPOSAL: 90_071_992_547_409,
  PERCENT_MIN: 0,
  PERCENT_MAX: 100,
  PROGRESS_EDITABLE_MAX: 99,
  DAYS_REVIEW_MAX: 90,
  DAYS_RECURRENCE_MAX: 365,
  DAYS_SHARE_MAX: 30,
  QUORUM_MAX: 99,
  SEQUENCE_MAX: 99,
  POSITION_MAX: 999,
  FISCAL_YEAR_MIN: 2000,
  FISCAL_YEAR_MAX: 2200,
  DATE_TEXT_MAX: 10,      // MM/DD/YYYY or YYYY-MM-DD
} as const;

export function defaultMaxLengthForInputType(type?: string): number | undefined {
  switch (type) {
    case "email":
      return INPUT_LIMITS.EMAIL;
    case "password":
      return INPUT_LIMITS.PASSWORD;
    case "search":
      return INPUT_LIMITS.SEARCH;
    case undefined:
    case "":
    case "text":
    case "url":
    case "tel":
      return INPUT_LIMITS.TAGS_LIST;
    default:
      return undefined;
  }
}

export function maxDigitsForNumber(max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 12;
  return Math.max(1, String(Math.floor(max)).length);
}

/**
 * Prevent invalid scientific notation / sign keys on numeric <input> fields.
 */
export function blockInvalidNumberKey(
  event: React.KeyboardEvent<HTMLInputElement>,
  options: { allowDecimal?: boolean; allowNegative?: boolean } = {},
): void {
  const { allowDecimal = false, allowNegative = false } = options;
  const blocked = ["e", "E", "+"];
  if (!allowNegative) blocked.push("-");
  if (!allowDecimal) blocked.push(".");
  if (blocked.includes(event.key)) {
    event.preventDefault();
  }
}

/**
 * Sanitize typed integer text against max digit count so users cannot type past `max`.
 */
export function sanitizeIntegerInput(raw: string, max: number): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") return "";
  if (!/^\d+$/.test(trimmed)) return null;
  const cleaned = trimmed.replace(/^0+(?=\d)/, "");
  if (cleaned.length > maxDigitsForNumber(max)) return null;
  return cleaned;
}

/**
 * Sanitize typed positive decimal text (up to `scale` decimals) with integer-digit cap from `max`.
 */
export function sanitizeDecimalInput(raw: string, max: number, scale = 2): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") return "";
  const pattern = new RegExp(`^\\d*(?:\\.\\d{0,${scale}})?$`);
  if (!pattern.test(trimmed)) return null;
  const normalized = (trimmed.startsWith(".") ? `0${trimmed}` : trimmed).replace(/^0+(?=\d)/, "");
  const intPart = normalized.split(".")[0] || "";
  if (intPart.length > maxDigitsForNumber(max)) return null;
  return normalized;
}

export function textLengthError(
  value: string,
  label: string,
  options: { min?: number; max: number; required?: boolean },
): string {
  const trimmed = value.trim();
  if (options.required && !trimmed) {
    return `${label} is required.`;
  }
  if (trimmed && options.min !== undefined && trimmed.length < options.min) {
    return `${label} must be at least ${options.min} characters.`;
  }
  if (value.length > options.max) {
    return `${label} must be at most ${options.max.toLocaleString("en-US")} characters.`;
  }
  return "";
}
