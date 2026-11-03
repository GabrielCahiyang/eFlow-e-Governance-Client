import { expect, it } from "vitest";
import { getRoleNavigation } from "../../src/app/features/navigation/roleNavigation";
import { buildShellNavigation } from "../../src/app/features/navigation/presentationNavigation";
import {
  resolveProjectView,
  PERMANENT_TABS,
} from "../../src/app/features/projects/components/project-command/projectViewCatalog";
import { destinationNavigationParameters } from "../../src/app/features/navigation/queryContext";
it("lands Head, Accounting and Member on their distinct overview destinations", () => {
  expect(getRoleNavigation("head").defaultSection).toBe("dashboard");
  expect(getRoleNavigation("accounting_staff").defaultSection).toBe(
    "accounting_overview",
  );
  expect(getRoleNavigation("member").defaultSection).toBe("dashboard");
  expect(getRoleNavigation("admin").defaultSection).toBe("users");
});
it("shows one Analytics destination while retaining the independent account invitation page", () => {
  const nav = buildShellNavigation({ role: "head", can: () => true });
  expect(nav.filter((n) => n.label === "Analytics")).toHaveLength(1);
  expect(nav.find((n) => n.id === "team")?.pages.map((p) => p.label)).toContain(
    "Office Team",
  );
  expect(nav.some((n) => n.id === "intelligence")).toBe(false);
});
it("retains an intelligence-only permission entrance without granting team supervision", () => {
  const nav = buildShellNavigation({
    role: "head",
    can: (p) => p === "navigation.team_intelligence",
  });
  expect(nav.find((n) => n.id === "intelligence")?.label).toBe("Analytics");
  expect(nav.some((n) => n.id === "team")).toBe(false);
});
it("adds Analytics to projects without replacing their operational Main table", () => {
  expect(PERMANENT_TABS.find((t) => t.id === "tasks")?.label).toBe(
    "Main table",
  );
  expect(resolveProjectView("analytics")).toBe("analytics");
  expect(resolveProjectView("main-table")).toBe("tasks");
});
it("preserves the new project view through the shell route validation boundary", () => {
  expect(
    destinationNavigationParameters("projects", {
      workspace: "office",
      project: "project",
      view: "analytics",
    }),
  ).toEqual({ workspace: "office", project: "project", view: "analytics" });
});
