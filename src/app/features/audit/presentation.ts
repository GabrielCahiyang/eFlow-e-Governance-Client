import { buildDiff, type AuditEvent, type DiffRow } from "../../services/auditService";

export type AuditTone = "good" | "info" | "warn" | "bad" | "neutral";

export interface AuditValueLookup {
  profileNames?: ReadonlyMap<string, string>;
  orgNames?: ReadonlyMap<string, string>;
}

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
  "account.activation_approve": "Account activation approved",
  "account.activation_completed": "Account activation completed",
  "account.activation_email_attempted": "Account activation email sent",
  "account.activation_staged": "Account invitation created",
  "account.activation_revoke": "Account invitation revoked",
  "account.activation_resend": "Account invitation resent",
  "account.activation_deleted": "Revoked invitation deleted",
  "invitation_created": "Office invitation created",
  "invitation_email_attempted": "Office invitation queued",
  "invitation_email_sent": "Office invitation sent",
  "invitation_email_failed": "Office invitation email failed",
  "organization.leadership_changed": "Organization leadership changed",
  "access.user_permission_overrides.insert": "User permission granted",
  "access.user_permission_overrides.update": "User permission updated",
  "access.user_permission_overrides.delete": "User permission removed",
  "access.role_permissions.insert": "Role permission granted",
  "access.role_permissions.update": "Role permission updated",
  "access.role_permissions.delete": "Role permission removed",
  "custom_roles.insert": "Custom role created",
  "custom_roles.update": "Custom role updated",
  "custom_roles.delete": "Custom role removed",
  "department_budget.saved": "Office budget saved",
  "department_budget.locked": "Office budget locked",
  "department_budget.sections_saved": "Budget sections saved",
  "department_budget.release_automatic": "Automatic budget release",
  "project.activated": "Project activated",
  "project.published": "Project published",
  "project.funding_authorized": "Project funding authorized",
  "project.readiness_review": "Project readiness reviewed",
  "project.group.insert": "Project group created",
  "project.task_funding_allocated": "Task funding allocated",
  "report.exported": "Report exported",
  "onboarding_started": "Workspace welcome started",
  "onboarding_completed": "Workspace onboarding completed",
  "onboarding_dismissed": "Workspace welcome skipped",
  "backup.started": "Backup started",
  "backup.completed": "Backup completed",
  "backup.downloaded": "Backup downloaded",
  "backup.deleted": "Backup deleted",
  "settings.general.updated": "General system settings updated",
  "settings.presentation.updated": "System branding updated",
  "settings.login_branding.updated": "Sign-in branding updated",
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
  headUserId: "Office Head",
  head_user_id: "Office Head",
  deputyUserId: "Deputy / Assistant Head",
  role: "Account role",
  account_role: "Account role",
  requested_privileged_role: "Approved role",
  is_active: "Account active",
  isActive: "Account active",
  org_id: "Assigned Office",
  orgId: "Assigned Office",
  office_id: "Assigned Office",
  assignedOffice: "Assigned Office",
  full_name: "Full name",
  fullName: "Full name",
  email: "Email address",
  user_id: "Target user",
  set_by: "Changed by",
  permission: "Permission",
  allowed: "Access allowed",
  emailDeliveryStatus: "Email delivery",
  requested_role: "Requested role",
  organization_name: "Organization name",
  organization_subtitle: "Header subtitle",
  login_portal_title: "Sign-in organization label",
  login_portal_subtitle: "Sign-in prompt text",
  support_email: "Support email",
  activation_expiry_hours: "Activation link expiry (hours)",
  default_email_notifications_enabled: "Default email notifications",
  maintenance_banner_enabled: "Maintenance banner",
  maintenance_banner_message: "Maintenance notice",
  due_soon_days: "Due-soon warning window (days)",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  head: "Office Head",
  dept_head: "Office Head",
  department_head: "Office Head",
  member: "Member",
  accounting_staff: "Accounting Staff",
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
  lookup?: AuditValueLookup,
): PresentedAuditValue {
  value = redactAuditDisplay(key, value);
  if (value === undefined || value === null || value === "") {
    if (
      lookup &&
      /^(headUserId|head_user_id|deputyUserId|assignedTo|assigneeId|reviewerId|backupReviewerId)$/i.test(
        key,
      )
    ) {
      return { display: "None (Unassigned)", empty: true };
    }
    return { display: "Not recorded", empty: true };
  }
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
  if (/^(role|account_role|requested_privileged_role)$/i.test(key) && ROLE_LABELS[text]) {
    return { display: ROLE_LABELS[text] };
  }
  if (lookup) {
    const profileMatch = lookup.profileNames?.get(text);
    if (profileMatch) {
      return { display: profileMatch, technical: text };
    }
    const orgMatch = lookup.orgNames?.get(text);
    if (orgMatch) {
      return { display: orgMatch, technical: text };
    }
  }
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
  headUserId: -2,
  role: -1,
  is_active: -1,
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

function compactText(text: string, maxLength = 36): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

export function summarizeAuditChanges(
  event: AuditEvent,
  lookup?: AuditValueLookup,
): string {
  const changed = orderAuditDiff(buildDiff(event.beforeData, event.afterData)).filter(
    (row) => {
      if (!row.changed) return false;
      if (/^(created_at|updated_at|createdAt|updatedAt|set_by|resourceId|officeId)$/i.test(row.key)) {
        return false;
      }
      const beforeText = presentAuditValue(row.key, row.before, lookup).display;
      const afterText = presentAuditValue(row.key, row.after, lookup).display;
      return beforeText !== afterText;
    },
  );
  if (changed.length > 0) {
    const preview = changed.slice(0, 2).map((row) => {
      const label = humanizeAuditField(row.key);
      const before = compactText(presentAuditValue(row.key, row.before, lookup).display);
      const after = compactText(presentAuditValue(row.key, row.after, lookup).display);
      return `${label}: ${before} → ${after}`;
    });
    const extra = changed.length > 2 ? ` (+${changed.length - 2} more)` : "";
    return `${preview.join(" · ")}${extra}`;
  }
  if (event.changeSummary) return compactText(event.changeSummary, 96);
  if (event.reason) return compactText(event.reason, 96);
  return "No field changes recorded";
}

export function enrichAdministrativeAuditEvents(
  events: AuditEvent[],
  profileNames: ReadonlyMap<string, string>,
  orgNames: ReadonlyMap<string, string>,
  profileRoles?: ReadonlyMap<string, string>,
): AuditEvent[] {
  const invitationUserMap = new Map<string, string>();
  for (const ev of events) {
    const invId = String(ev.metadata?.invitation_id || ev.entityId || "");
    if (!invId) continue;
    const explicitUser =
      (typeof ev.metadata?.accepted_by === "string" && ev.metadata.accepted_by) ||
      (typeof ev.metadata?.user_id === "string" && ev.metadata.user_id) ||
      undefined;
    if (explicitUser) {
      invitationUserMap.set(invId, explicitUser);
      continue;
    }
    if (ev.action === "account.activation_completed" && ev.actorId) {
      invitationUserMap.set(invId, ev.actorId);
    }
  }

  for (const ev of events) {
    if (ev.action !== "account.activation_approve") continue;
    const invId = String(ev.metadata?.invitation_id || ev.entityId || "");
    if (!invId || invitationUserMap.has(invId)) continue;
    const companion = events.find(
      (other) =>
        other.action === "organization.leadership_changed" &&
        other.orgId === ev.orgId &&
        Math.abs(other.createdAt - ev.createdAt) <= 5000 &&
        typeof (other.afterData as Record<string, unknown> | undefined)?.headUserId === "string",
    );
    const headUserId = (companion?.afterData as Record<string, unknown> | undefined)
      ?.headUserId as string | undefined;
    if (headUserId) {
      invitationUserMap.set(invId, headUserId);
    }
  }

  return events.map((ev) => {
    const resolvedActorName =
      (!ev.actorName || ev.actorName === "System") &&
      ev.actorId &&
      profileNames.get(ev.actorId)
        ? profileNames.get(ev.actorId)!
        : ev.actorName;

    if (ev.action === "organization.leadership_changed") {
      const beforeHead = (ev.beforeData as Record<string, unknown> | undefined)?.headUserId as
        | string
        | null
        | undefined;
      const afterHead = (ev.afterData as Record<string, unknown> | undefined)?.headUserId as
        | string
        | null
        | undefined;
      const beforeName = beforeHead
        ? profileNames.get(beforeHead) || shortenIdentifier(String(beforeHead))
        : null;
      const afterName = afterHead
        ? profileNames.get(afterHead) || shortenIdentifier(String(afterHead))
        : null;
      const officeName =
        (ev.orgId && orgNames.get(ev.orgId)) ||
        (ev.entityId && orgNames.get(ev.entityId)) ||
        "Office";
      const synthesizedReason =
        ev.reason ||
        (!beforeName && afterName
          ? `Assigned ${afterName} as Office Head of ${officeName}.`
          : beforeName && !afterName
          ? `Removed ${beforeName} as Office Head of ${officeName}.`
          : beforeName && afterName
          ? `Changed Office Head of ${officeName} from ${beforeName} to ${afterName}.`
          : undefined);
      return {
        ...ev,
        actorName: resolvedActorName,
        reason: synthesizedReason,
      };
    }

    if (ev.action.startsWith("account.activation_")) {
      const invId = String(ev.metadata?.invitation_id || ev.entityId || "");
      const resolvedUserId =
        (ev.entityId && profileNames.has(ev.entityId) ? ev.entityId : undefined) ||
        (invId ? invitationUserMap.get(invId) : undefined);
      const targetName =
        (resolvedUserId && profileNames.get(resolvedUserId)) ||
        (typeof ev.metadata?.full_name === "string" && ev.metadata.full_name.trim()) ||
        (typeof ev.metadata?.email === "string" && ev.metadata.email.trim()) ||
        undefined;
      const officeName = (ev.orgId && orgNames.get(ev.orgId)) || undefined;

      if (ev.beforeData == null && ev.afterData == null) {
        if (ev.action === "account.activation_approve") {
          const companion = events.find(
            (other) =>
              other.action === "organization.leadership_changed" &&
              other.orgId === ev.orgId &&
              Math.abs(other.createdAt - ev.createdAt) <= 5000,
          );
          const companionBeforeHead = (
            companion?.beforeData as Record<string, unknown> | undefined
          )?.headUserId as string | null | undefined;
          const companionAfterHead = (
            companion?.afterData as Record<string, unknown> | undefined
          )?.headUserId as string | null | undefined;
          const approvedRole =
            companionAfterHead ||
            (resolvedUserId && profileRoles?.get(resolvedUserId) === "head") ||
            ev.metadata?.requested_privileged_role === "head"
              ? "head"
              : "admin";
          const roleTitle = approvedRole === "head" ? "Office Head" : "Administrator";
          return {
            ...ev,
            actorName: resolvedActorName,
            entityId: resolvedUserId || ev.entityId,
            beforeData: {
              ...(targetName ? { full_name: targetName } : {}),
              role: "member",
              is_active: false,
              ...(approvedRole === "head"
                ? { headUserId: companionBeforeHead ?? null }
                : {}),
              status: "pending_approval",
            },
            afterData: {
              ...(targetName ? { full_name: targetName } : {}),
              role: approvedRole,
              is_active: true,
              ...(approvedRole === "head"
                ? { headUserId: resolvedUserId || companionAfterHead || targetName || "Assigned" }
                : {}),
              status: "approved",
            },
            reason:
              ev.reason ||
              (targetName
                ? `Approved ${targetName} as ${roleTitle}${officeName ? ` of ${officeName}` : ""}.`
                : `Approved ${roleTitle} account activation${officeName ? ` for ${officeName}` : ""}.`),
          };
        }

        if (ev.action === "account.activation_completed") {
          return {
            ...ev,
            actorName: resolvedActorName,
            entityId: resolvedUserId || ev.entityId,
            beforeData: {
              ...(targetName ? { full_name: targetName } : {}),
              status: "pending_activation",
            },
            afterData: {
              ...(targetName ? { full_name: targetName } : {}),
              status: "activated",
              ...(officeName ? { assignedOffice: officeName } : {}),
            },
            reason:
              ev.reason ||
              (targetName
                ? `${targetName} verified their email and completed account activation${officeName ? ` in ${officeName}` : ""}.`
                : `Recipient verified their email and completed account activation.`),
          };
        }

        if (ev.action === "account.activation_email_attempted") {
          return {
            ...ev,
            actorName: resolvedActorName,
            entityId: resolvedUserId || ev.entityId,
            beforeData: { status: "queued" },
            afterData: {
              status: "email_sent",
              ...(targetName ? { full_name: targetName } : {}),
              ...(officeName ? { assignedOffice: officeName } : {}),
            },
            reason:
              ev.reason ||
              (targetName
                ? `Dispatched account activation email to ${targetName}${officeName ? ` (${officeName})` : ""}.`
                : `Dispatched account activation email.`),
          };
        }

        if (ev.action === "account.activation_staged") {
          return {
            ...ev,
            actorName: resolvedActorName,
            entityId: resolvedUserId || ev.entityId,
            beforeData: { status: "not_invited" },
            afterData: {
              status: "pending_activation",
              ...(targetName ? { full_name: targetName } : {}),
              ...(officeName ? { assignedOffice: officeName } : {}),
            },
            reason:
              ev.reason ||
              (targetName
                ? `Created account activation invitation for ${targetName}${officeName ? ` (${officeName})` : ""}.`
                : `Created account activation invitation.`),
          };
        }
      }

      return {
        ...ev,
        actorName: resolvedActorName,
        entityId: resolvedUserId || ev.entityId,
      };
    }

    if (resolvedActorName !== ev.actorName) {
      return { ...ev, actorName: resolvedActorName };
    }
    return ev;
  });
}
