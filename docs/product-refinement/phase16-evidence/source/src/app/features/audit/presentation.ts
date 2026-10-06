import type { DiffRow } from "../../services/auditService";

export type AuditTone = "good" | "info" | "warn" | "bad" | "neutral";

const ACTION_LABELS: Record<string, string> = {
  "task.transition.completed": "Task completed",
  "task.transition.for_review": "Task submitted for review",
  "task.transition.in_progress": "Task work started",
  "task.transition.changes_requested": "Task updates needed",
  "task.review.approved": "Task approved",
  "task.review.changes_requested": "Task updates needed",
  "task.created": "Task created",
  "task.assigned": "Task assigned",
  "task.cancelled": "Task cancelled",
  "task.reopened": "Task reopened",
  "subtask.progress.updated": "Subtask progress updated",
  "subtask.submitted": "Subtask evidence submitted",
  "subtask.review.approved": "Subtask approved",
  "subtask.review.changes_requested": "Subtask updates needed",
  "project.created": "Project created",
  "project.updated": "Project updated",
  "project.archived": "Project archived",
  "project.restored": "Project restored",
  "project.deleted": "Project permanently deleted",
};

const FIELD_LABELS: Record<string, string> = {
  auditHash: "Approval verification",
  status: "Workflow status",
  submissionId: "Submission record",
  reviewerId: "Reviewer",
  backupReviewerId: "Backup reviewer",
  assignedTo: "Assigned person",
  assigneeId: "Assigned person",
  percentComplete: "Progress",
  linkedProjectId: "Operational project",
  milestoneId: "Milestone",
  deletedAt: "Deletion time",
  archivedAt: "Archive time",
};

const IDENTIFIER_KEY = /(^id$|Id$|_id$|hash)/i;

export function humanizeAuditAction(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  const words = action.replace(/[._-]+/g, " ").trim();
  return words
    ? words.charAt(0).toUpperCase() + words.slice(1)
    : "System event";
}

export function auditActionTone(action: string): AuditTone {
  if (/approved|completed|created|published|restored/i.test(action))
    return "good";
  if (/changes_requested|rejected|cancelled|deleted|failed/i.test(action))
    return "bad";
  if (/submitted|for_review|reopened|archived/i.test(action)) return "warn";
  if (/updated|assigned|progress|transition/i.test(action)) return "info";
  return "neutral";
}

export function humanizeAuditField(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return words
    ? words.charAt(0).toUpperCase() + words.slice(1)
    : "Changed value";
}

export function humanizeEntityType(entityType: string): string {
  const words = entityType.replace(/[_-]+/g, " ").trim();
  return words
    ? words.charAt(0).toUpperCase() + words.slice(1)
    : "System record";
}

export function shortenIdentifier(value: string): string {
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

export interface PresentedAuditValue {
  display: string;
  technical?: string;
  empty?: boolean;
}

export function redactAuditDisplay(key: string, value: unknown): unknown {
  if (
    /password|token|secret|api_?key|(^|[_-])ssn|^tin|[_-]tin([_-]|$)|credential|pds|personal_data/i.test(
      key,
    )
  )
    return "••••";
  if (Array.isArray(value))
    return value.map((item) => redactAuditDisplay("", item));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([field, item]) => [
        field,
        redactAuditDisplay(field, item),
      ]),
    );
  return value;
}
export function presentAuditValue(
  key: string,
  value: unknown,
): PresentedAuditValue {
  value = redactAuditDisplay(key, value);
  if (value === undefined || value === null || value === "")
    return { display: "Not recorded", empty: true };
  if (typeof value === "boolean") return { display: value ? "Yes" : "No" };
  if (typeof value === "number")
    return {
      display:
        key === "percentComplete" ? `${value}%` : value.toLocaleString("en-PH"),
    };
  if (Array.isArray(value))
    return {
      display: value.length ? value.map(String).join(", ") : "None",
      empty: value.length === 0,
    };
  if (typeof value === "object") {
    const technical = JSON.stringify(value, null, 2);
    return {
      display: `Structured record · ${Object.keys(value as Record<string, unknown>).length} fields`,
      technical,
    };
  }

  const text = String(value);
  if (key === "status")
    return {
      display: text
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase()),
    };
  if (
    IDENTIFIER_KEY.test(key) ||
    /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(text) ||
    /^[0-9a-f]{32,}$/i.test(text)
  ) {
    return { display: shortenIdentifier(text), technical: text };
  }
  return { display: text };
}

const DIFF_PRIORITY: Record<string, number> = {
  status: 0,
  percentComplete: 1,
  assignedTo: 2,
  assigneeId: 2,
  reviewerId: 3,
  submissionId: 4,
  auditHash: 5,
};

export function orderAuditDiff(diff: DiffRow[]): DiffRow[] {
  return [...diff].sort(
    (a, b) =>
      (DIFF_PRIORITY[a.key] ?? 50) - (DIFF_PRIORITY[b.key] ?? 50) ||
      a.key.localeCompare(b.key),
  );
}
