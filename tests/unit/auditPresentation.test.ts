import { describe, expect, it } from "vitest";
import {
  enrichAdministrativeAuditEvents,
  humanizeAuditAction,
  humanizeAuditField,
  orderAuditDiff,
  presentAuditValue,
  shortenIdentifier,
  summarizeAuditChanges,
} from "../../src/app/features/audit";

describe("audit presentation", () => {
  it("turns internal event and field names into operational language", () => {
    expect(humanizeAuditAction("task.transition.completed")).toBe("Task completed");
    expect(humanizeAuditAction("account.activation_approve")).toBe("Account activation approved");
    expect(humanizeAuditField("auditHash")).toBe("Approval verification");
    expect(humanizeAuditField("submissionId")).toBe("Submission record");
    expect(humanizeAuditField("headUserId")).toBe("Office Head");
  });

  it("abbreviates technical references without discarding their exact value", () => {
    const id = "721ec4b9-7372-49ef-ba3f-0d3e813ccb8d";
    expect(shortenIdentifier(id)).toBe("721ec4b9…3ccb8d");
    expect(presentAuditValue("submissionId", id)).toEqual({
      display: "721ec4b9…3ccb8d",
      technical: id,
    });
  });

  it("orders the meaningful lifecycle change before technical verification data", () => {
    const ordered = orderAuditDiff([
      { key: "auditHash", before: null, after: "hash", changed: true },
      { key: "submissionId", before: "id", after: "id", changed: false },
      { key: "status", before: "for_review", after: "completed", changed: true },
    ]);
    expect(ordered.map((row) => row.key)).toEqual(["status", "submissionId", "auditHash"]);
  });

  it("enriches account activation approval and leadership events with actor, target person, and human-readable diffs", () => {
    const profileNames = new Map([
      ["admin-1", "Super Admin"],
      ["gabriel-1", "Gabriel Head"],
    ]);
    const orgNames = new Map([["org-ledipo", "LEDIPO"]]);
    const profileRoles = new Map([["gabriel-1", "head"]]);
    const lookup = { profileNames, orgNames };
    const ts = Date.parse("2026-11-18T17:32:38Z");

    const enriched = enrichAdministrativeAuditEvents(
      [
        {
          id: "ev-approve",
          actorId: "admin-1",
          actorName: "System",
          entityType: "user",
          entityId: "inv-1",
          action: "account.activation_approve",
          orgId: "org-ledipo",
          metadata: { invitation_id: "inv-1" },
          createdAt: ts,
        },
        {
          id: "ev-lead",
          actorId: "admin-1",
          actorName: "Super Admin",
          entityType: "organization",
          entityId: "org-ledipo",
          action: "organization.leadership_changed",
          orgId: "org-ledipo",
          beforeData: { headUserId: null },
          afterData: { headUserId: "gabriel-1" },
          createdAt: ts,
        },
      ],
      profileNames,
      orgNames,
      profileRoles,
    );

    expect(enriched[0].actorName).toBe("Super Admin");
    expect(enriched[0].entityId).toBe("gabriel-1");
    expect(enriched[0].reason).toContain("Approved Gabriel Head as Office Head of LEDIPO");
    expect(summarizeAuditChanges(enriched[0], lookup)).toContain(
      "Office Head: None (Unassigned) → Gabriel Head",
    );
    expect(summarizeAuditChanges(enriched[1], lookup)).toBe(
      "Office Head: None (Unassigned) → Gabriel Head",
    );
  });

  it("humanizes role permission updates and omits noisy null or timestamp diffs", () => {
    expect(humanizeAuditAction("access.role_permissions.update")).toBe("Role permission updated");
    expect(
      summarizeAuditChanges({
        id: "ev-perm",
        actorName: "Super Admin",
        entityType: "role_permissions",
        entityId: "head:announcements.publish",
        action: "access.role_permissions.update",
        beforeData: {
          role: "head",
          permission: "announcements.publish",
          allowed: true,
          updated_at: "2026-11-18T18:42:40Z",
        },
        afterData: {
          role: "head",
          permission: "announcements.publish",
          allowed: false,
          updated_at: "2026-11-18T18:42:42Z",
        },
        createdAt: Date.parse("2026-11-18T18:42:42Z"),
      }),
    ).toBe("Access allowed: Yes → No");

    expect(
      summarizeAuditChanges({
        id: "ev-onboard",
        actorName: "Super Admin",
        entityType: "account",
        entityId: "32f28c6a-8025-4a7e-abb4-c14577ff5c4b",
        action: "onboarding_dismissed",
        beforeData: null,
        afterData: {
          officeId: null,
          resourceId: "32f28c6a-8025-4a7e-abb4-c14577ff5c4b",
        },
        createdAt: Date.parse("2026-11-18T18:28:18Z"),
      }),
    ).toBe("No field changes recorded");
  });
});
