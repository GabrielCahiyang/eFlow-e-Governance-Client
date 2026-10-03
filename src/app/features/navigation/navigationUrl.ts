import { getDefaultSection, getRoleNavigationCandidates } from "./roleNavigation";
import { getSidebarContent } from "./sidebarContent";

export const NAVIGATION_PAGE_QUERY = "page";

const SECTION_PATHS: Record<string, string> = {
  dashboard: "overview",
  command: "command-center",
  projects: "projects",
  tasks: "tasks",
  budget: "office-budget",
  subtasks: "subtasks",
  leading: "leading",
  reviews: "reviews",
  team: "team-supervision",
  identity: "identity-and-access",
  intelligence: "team-intelligence",
  reports: "reports",
  announcements: "announcements",
  settings: "settings",
  users: "users",
  permissions: "permissions",
  org_tree: "organization",
  audit: "audit",
  administration: "system-settings",
  migration: "data-tools",
  deadlines: "deadlines",
  history: "task-history",
  performance: "performance",
  workforce: "workforce-intelligence",
  wellness: "wellness-attendance",
  compliance: "performance-compliance",
  portfolio: "portfolio-intelligence",
  transform: "project-transformation",
  financial: "financial-oversight",
  legdash: "legislative-dashboard",
  session: "session-management",
  committee: "committee-affairs",
  councilor: "councilor-workspace",
  projfin: "project-finance",
  liquidation: "liquidation",
  crypto: "immutable-ledger",
  accounting_overview: "accounting-overview",
  accounting_releases: "voucher-cash-releases",
  accounting_journal: "general-journal",
  accounting_audit: "financial-audit-trail",
  accounting_budgets: "office-budget-ledgers",
};

interface NavigationCandidate {
  id: string;
  label: string;
}

export interface NavigationLocation {
  section: string;
  page?: string;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getNavigationPath(section: string): string {
  return `/${SECTION_PATHS[section] || slugify(section)}`;
}

function getSectionFromPath(
  pathname: string,
  candidates: NavigationCandidate[],
): string | undefined {
  const segment = pathname.split("/").filter(Boolean)[0]?.toLowerCase();
  if (!segment) return undefined;

  if (segment === SECTION_PATHS.settings) return "settings";
  if (segment === "department-budget" && candidates.some(candidate => candidate.id === "budget")) return "budget";
  if (segment === "department-budget-ledgers" && candidates.some(candidate => candidate.id === "accounting_budgets")) return "accounting_budgets";

  return candidates.find((candidate) => {
    const candidatePath = getNavigationPath(candidate.id).slice(1);
    return (
      candidatePath === segment ||
      candidate.id.toLowerCase() === segment ||
      slugify(candidate.label) === segment
    );
  })?.id;
}

function getPageFromUrl(url: URL): string | undefined {
  return (
    url.searchParams.get(NAVIGATION_PAGE_QUERY) ||
    url.searchParams.get("view") ||
    undefined
  );
}

function getValidPage(
  role: string,
  section: string,
  requestedPage: string | undefined,
  getInitialPage: (section: string) => string | undefined,
): string | undefined {
  if (!requestedPage) return getInitialPage(section);
  const pages = getSidebarContent(role, section).sections.flatMap((group) =>
    group.items.map((item) => item.label),
  );
  return pages.includes(requestedPage) ? requestedPage : getInitialPage(section);
}

export function readNavigationLocation(
  role: string,
  getInitialPage: (section: string) => string | undefined,
): NavigationLocation {
  const defaultSection = getDefaultSection(role);
  if (typeof window === "undefined") {
    return { section: defaultSection, page: getInitialPage(defaultSection) };
  }

  const url = new URL(window.location.href);
  if (role === "admin") {
    const legacySupport: Record<string,string> = { organization:"Office Structure", audit:"Account Audit", "system-settings":"System Settings", "data-tools":"Backup & Export", permissions:"Role Defaults" };
    const supportPage = legacySupport[url.pathname.split("/").filter(Boolean)[0] || ""];
    if (supportPage) return { section:"users", page:supportPage };
  }
  const candidates = getRoleNavigationCandidates(role);
  const section = getSectionFromPath(url.pathname, candidates) || defaultSection;
  return {
    section,
    page: getValidPage(role, section, getPageFromUrl(url), getInitialPage),
  };
}

export function writeNavigationLocation(
  section: string,
  page?: string,
  mode: "push" | "replace" = "push",
): void {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  url.pathname = getNavigationPath(section);
  url.searchParams.delete("view");
  if (page) url.searchParams.set(NAVIGATION_PAGE_QUERY, page);
  else url.searchParams.delete(NAVIGATION_PAGE_QUERY);

  const nextLocation = `${url.pathname}${url.search}${url.hash}`;
  if (`${window.location.pathname}${window.location.search}${window.location.hash}` === nextLocation) {
    return;
  }

  const state = { ...window.history.state, eflowNavigation: true };
  window.history[`${mode}State`](state, "", nextLocation);
}

export function getNavigationUrl(section: string, page?: string): string {
  const url = new URL(getNavigationPath(section), "https://eflow.local");
  if (page) url.searchParams.set(NAVIGATION_PAGE_QUERY, page);
  return `${url.pathname}${url.search}`;
}
