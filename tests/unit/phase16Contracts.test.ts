import { journalFingerprint } from "../../src/app/features/budget/financialReceipts";
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  ACCOUNTING_VIEWS,
  resolveAccountingView,
} from "../../src/app/features/budget/accountingNavigation";
import {
  filterAuditEvents,
  EMPTY_AUDIT_FILTERS,
} from "../../src/app/features/audit/auditFilters";
import {
  presentAuditValue,
  redactAuditDisplay,
} from "../../src/app/features/audit/presentation";
import {
  financialFailureIsUncertain,
  financialOutcome,
  recordFinancialOutcome,
} from "../../src/app/features/budget/financialReceipts";
import { departmentReportColumns } from "../../src/app/features/reports/exportColumns";
import type { AuditEvent } from "../../src/app/services/auditService";

describe("Phase 16 compatibility and disclosure", () => {
  it.each(ACCOUNTING_VIEWS)(
    "keeps the $id view reachable through its existing section permission",
    (view) => {
      expect(resolveAccountingView(view.section, view.page)).toBe(view.id);
      expect(view.section).not.toBe("accounting_settlements");
    },
  );
  it("keeps old release links on Releases and shares its permission with Settlements", () => {
    expect(resolveAccountingView("accounting_releases")).toBe("releases");
    expect(resolveAccountingView("accounting_releases", "Settlements")).toBe(
      "settlements",
    );
    expect(resolveAccountingView("unknown")).toBe("overview");
  });
  it("redacts nested secrets, private PDS and arrays without hiding ordinary settings", () => {
    const value = {
      settings: { enabled: true, api_key: "secret" },
      people: [{ credentials: "secret", name: "Alex" }],
      pds: { address: "private" },
      tin_number: "private",
    };
    expect(redactAuditDisplay("", value)).toEqual({
      settings: { enabled: true, api_key: "••••" },
      people: [{ credentials: "••••", name: "Alex" }],
      pds: "••••",
      tin_number: "••••",
    });
    expect(presentAuditValue("config", value).technical).not.toContain(
      "secret",
    );
    expect(presentAuditValue("config", value).technical).not.toContain(
      "private",
    );
  });
  it("applies actor, Office and inclusive local-day filters only to the loaded set", () => {
    const events = [
      {
        id: "one",
        actorId: "a",
        actorName: "Alex",
        orgId: "office",
        action: "profile.updated",
        entityType: "profile",
        createdAt: new Date("2026-10-06T23:59:59").getTime(),
      },
      {
        id: "two",
        actorId: "b",
        actorName: "Blair",
        orgId: "office",
        action: "profile.updated",
        entityType: "profile",
        createdAt: new Date("2026-10-06T12:00:00").getTime(),
      },
      {
        id: "three",
        actorId: "a",
        actorName: "Alex",
        orgId: "other",
        action: "profile.updated",
        entityType: "profile",
        createdAt: new Date("2026-10-07T00:00:00").getTime(),
      },
    ] as AuditEvent[];
    expect(
      filterAuditEvents(
        events,
        {
          ...EMPTY_AUDIT_FILTERS,
          actor: "a",
          office: "office",
          from: "2026-10-06",
          to: "2026-10-06",
        },
        (event) => event.id,
      ).map((event) => event.id),
    ).toEqual(["one"]);
    expect(
      filterAuditEvents(
        events,
        { ...EMPTY_AUDIT_FILTERS, query: "missing" },
        (event) => event.id,
      ),
    ).toEqual([]);
    expect(
      filterAuditEvents([], EMPTY_AUDIT_FILTERS, (event) => event.id),
    ).toEqual([]);
  });
  it("keeps exact report column order and formatting", () => {
    expect(departmentReportColumns.map((column) => column.header)).toEqual([
      "Work item",
      "Parent / transition",
      "Person",
      "Role",
      "Project",
      "Status",
      "Priority / severity",
      "Progress",
      "Signal",
      "Event date",
      "Due date",
      "Detail",
    ]);
    const progress = departmentReportColumns.find(
      (column) => column.key === "progress",
    )!;
    expect(progress.value({ progress: 0 } as never)).toBe("0%");
    expect(progress.value({} as never)).toBe("—");
  });
  it("distinguishes explicit server rejection from an uncertain response", () => {
    expect(
      financialFailureIsUncertain(
        new Error("Only assigned Accounting Staff may settle"),
      ),
    ).toBe(false);
    expect(
      financialFailureIsUncertain(
        new Error("Cash release exceeds the daily limit"),
      ),
    ).toBe(false);
    expect(financialFailureIsUncertain(new Error("Failed to fetch"))).toBe(
      true,
    );
    expect(financialFailureIsUncertain(new Error("Gateway unavailable"))).toBe(
      true,
    );
    expect(financialFailureIsUncertain(new Error("Unknown result"))).toBe(true);
  });
  it("preserves duplicate journal lines while ignoring line order in verification", () => {
    const base = {
      entryDate: "2026-10-06",
      referenceNumber: "COR",
      memo: "Correction",
      lines: [
        { accountCode: "100", debit: 50, credit: 0 },
        { accountCode: "100", debit: 50, credit: 0 },
        { accountCode: "200", debit: 0, credit: 100 },
      ],
    };
    expect(journalFingerprint(base)).toBe(
      journalFingerprint({ ...base, lines: [...base.lines].reverse() }),
    );
    expect(journalFingerprint(base)).not.toBe(
      journalFingerprint({
        ...base,
        lines: [
          { accountCode: "100", debit: 100, credit: 0 },
          { accountCode: "200", debit: 0, credit: 100 },
        ],
      }),
    );
  });
  it("retains uncertain and saved receipts across reopening a financial dialog", () => {
    const key = "phase16-isolated-receipt";
    recordFinancialOutcome(key, "uncertain");
    expect(financialOutcome(key)).toBe("uncertain");
    recordFinancialOutcome(key, "saved");
    expect(financialOutcome(key)).toBe("saved");
  });
});
