import { describe, expect, it, vi } from "vitest";
import { buildVisibleTourSections } from "../../src/app/features/app-shell/tourNavigationOrder";
import { getPageTourSteps, getSystemTourSteps } from "../../src/app/features/guided-tours";
import { buildShellNavigation } from "../../src/app/features/navigation";

const HEAD_PERMISSIONS = new Set([
  "navigation.projects",
  "navigation.department_budgets",
  "navigation.tasks",
  "navigation.reviews",
  "navigation.team_supervision",
  "navigation.team_intelligence",
  "navigation.reports",
]);

const MEMBER_PERMISSIONS = new Set([
  "navigation.projects",
  "navigation.tasks",
]);

const ACCOUNTING_PERMISSIONS = new Set([
  "navigation.projects",
  "navigation.tasks",
  "navigation.department_budgets",
  "navigation.accounting_overview",
  "navigation.accounting_releases",
  "navigation.accounting_journal",
  "navigation.accounting_audit",
]);

const ADMIN_PERMISSIONS = new Set([
  "navigation.user_management",
  "navigation.organization",
  "navigation.audit",
  "navigation.system_settings",
  "navigation.data_tools",
]);

describe("guided tour manifests", () => {
  it("builds a system tour only from role-visible destinations with conversational narration", () => {
    const navigate = vi.fn();
    const steps = getSystemTourSteps([
      { id: "tasks", label: "My Tasks", page: "My Tasks" },
      { id: "subtasks", label: "My Subtasks", page: "My Subtasks" },
    ], navigate);

    expect(steps.some((step) => step.id === "system-section-tasks")).toBe(true);
    expect(steps.some((step) => step.id === "system-section-subtasks")).toBe(true);
    expect(steps.some((step) => step.id === "system-section-users")).toBe(false);
    for (const step of steps) {
      expect(step.narration?.trim().length).toBeGreaterThan(20);
      expect(step.narration).not.toBe(`${step.title}. ${step.description}`);
    }

    steps.find((step) => step.id === "system-section-tasks")?.beforeShow?.();
    expect(navigate).toHaveBeenCalledWith("tasks", "My Tasks");
  });

  it("walks Head navigation strictly tab-by-tab (My Work -> Workspace -> Inbox) without jumping or showing hidden Tasks", () => {
    const navItems = buildShellNavigation({
      role: "head",
      can: (permission) => HEAD_PERMISSIONS.has(permission),
    });
    const sections = buildVisibleTourSections({
      items: navItems,
      role: "head",
      workspaceKind: "office",
    });

    expect(sections.map((section) => `${section.id}:${section.page}`)).toEqual([
      "personal_work:Assigned work",
      "personal_work:Leading",
      "personal_work:Subtasks",
      "personal_work:History",
      "dashboard:Workspace Overview",
      "budget:Office Budget",
      "team:Analytics",
      "team:Office Team",
      "projects:Projects",
      "inbox:Notifications",
      "inbox:Messages",
      "reviews:For Review",
    ]);

    expect(sections.some((section) => section.id === "tasks")).toBe(false);
    expect(sections.some((section) => section.id === "subtasks")).toBe(false);

    const steps = getSystemTourSteps(sections, vi.fn());
    const ids = steps.map((step) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("walks Member navigation strictly tab-by-tab (My Work -> Workspace Projects -> Inbox)", () => {
    const navItems = buildShellNavigation({
      role: "member",
      can: (permission) => MEMBER_PERMISSIONS.has(permission),
    });
    const sections = buildVisibleTourSections({
      items: navItems,
      role: "member",
      workspaceKind: "office",
    });

    expect(sections.map((section) => `${section.id}:${section.page}`)).toEqual([
      "personal_work:Assigned work",
      "personal_work:Leading",
      "personal_work:Subtasks",
      "personal_work:History",
      "projects:Projects",
      "inbox:Notifications",
      "inbox:Messages",
    ]);
  });

  it("walks Accounting Staff navigation strictly tab-by-tab including all Accounting tabs in order", () => {
    const navItems = buildShellNavigation({
      role: "accounting_staff",
      can: (permission) => ACCOUNTING_PERMISSIONS.has(permission),
    });
    const sections = buildVisibleTourSections({
      items: navItems,
      role: "accounting_staff",
      workspaceKind: "office",
    });

    expect(sections.map((section) => `${section.id}:${section.page}`)).toEqual([
      "personal_work:Assigned work",
      "personal_work:Leading",
      "personal_work:Subtasks",
      "personal_work:History",
      "projects:Projects",
      "inbox:Notifications",
      "inbox:Messages",
      "accounting_overview:Accounting Overview",
      "accounting_releases:Voucher & Cash Releases",
      "accounting_releases:Settlements",
      "accounting_journal:General Journal",
      "accounting_audit:Financial Audit Trail",
      "accounting_budgets:Office Budget Ledgers",
    ]);
  });

  it("walks Admin navigation strictly tab-by-tab across Admin Center pages", () => {
    const navItems = buildShellNavigation({
      role: "admin",
      can: (permission) => ADMIN_PERMISSIONS.has(permission),
    });
    const sections = buildVisibleTourSections({
      items: navItems,
      role: "admin",
    });

    expect(sections.map((section) => `${section.id}:${section.page}:${section.label}`)).toEqual([
      "users:People & Accounts:People & Accounts",
      "users:Roles & Access:Roles & Access",
      "users:Account Audit:Account Audit",
      "users:System & Maintenance:System & Maintenance",
      "users:Backup & Export:Backup",
    ]);
  });

  it("provides a replayable page guide for Projects with latest workflow details", () => {
    const steps = getPageTourSteps("projects", "Projects");
    expect(steps).toHaveLength(4);
    expect(steps[1].description).toContain("Groups organize tasks");
    expect(steps[1].target).toBe("[data-tour-id='project-main-table']");
    expect(steps.at(-1)?.target).toBe("[data-tour-id='workspace-help']");
    expect(steps.every((step) => Boolean(step.narration?.trim()))).toBe(true);
  });

  it("covers the latest Analytics workspace including Reports and Deep Analysis", () => {
    const steps = getPageTourSteps("team", "Analytics");
    expect(steps).toHaveLength(4);
    expect(steps[0].description).toContain("Deep Analysis");
    expect(steps[1].description).toContain("CSV or PDF");
    expect(steps[2].description).toContain("drag stage boxes");
    expect(steps[2].description).toContain("right-click any stage box");
    expect(steps[2].description).toContain("last saved snapshot");
    expect(steps.at(-1)?.target).toBe("[data-tour-id='workspace-help']");
    for (const step of steps) {
      expect(step.narration?.trim().length).toBeGreaterThan(20);
      expect(step.narration).not.toBe(`${step.title}. ${step.description}`);
    }
  });

  it("provides dedicated page guides for Office Budget and Workspace Overview", () => {
    const budgetSteps = getPageTourSteps("budget", "Office Budget");
    expect(budgetSteps).toHaveLength(4);
    expect(budgetSteps[2].description).toContain("never double-charged");
    expect(budgetSteps.every((step) => Boolean(step.narration?.trim()))).toBe(true);

    const overviewSteps = getPageTourSteps("dashboard", "Workspace Overview");
    expect(overviewSteps).toHaveLength(4);
    expect(overviewSteps.every((step) => Boolean(step.narration?.trim()))).toBe(true);
  });
});
