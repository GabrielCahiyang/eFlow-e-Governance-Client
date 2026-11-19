import {
  getSupportPageGroup,
  pageDisplayLabel,
  supportGroupOrder,
  type NavigationGroupId,
  type ShellNavigationItem,
} from "../navigation";
import type { GuidedTourSection } from "../guided-tours";
import { groupOfficeTools } from "./officeToolGroups";

const GLOBAL_GROUP_ORDER: readonly NavigationGroupId[] = [
  "my-work",
  "workspaces",
  "inbox",
  "accounting",
  "admin-center",
];

function expandItemPages(
  item: ShellNavigationItem,
  options: { filterInboxRoot?: boolean; adminCenter?: boolean } = {},
): GuidedTourSection[] {
  const pages = options.filterInboxRoot
    ? item.pages.filter((page) => item.id !== "inbox" || page.label !== "Inbox")
    : item.pages;
  return pages.map((page) => ({
    id: item.id,
    page: page.label,
    label:
      !options.adminCenter && pages.length === 1
        ? item.label
        : pageDisplayLabel(item.id, page.label),
  }));
}

/**
 * Mirrors the exact top-to-bottom tab order rendered by GlobalNavigation,
 * ContextRail, WorkspaceNavigationPanel, and groupOfficeTools so Tour of eFlow
 * walks strictly tab-by-tab with zero jumps, zero skipped tabs, and no hidden
 * legacy sections.
 */
export function buildVisibleTourSections({
  items,
  role,
  workspaceKind,
}: {
  items: ShellNavigationItem[];
  role: string;
  workspaceKind?: "office" | "personal";
}): GuidedTourSection[] {
  const result: GuidedTourSection[] = [];
  const seen = new Set<string>();
  const pushUnique = (entry: GuidedTourSection) => {
    const key = `${entry.id}:${entry.page}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push(entry);
  };

  for (const group of GLOBAL_GROUP_ORDER) {
    if (!items.some((item) => item.group === group)) continue;

    if (group === "my-work") {
      // MyWorkContextRail renders personal_work tabs in top-to-bottom order.
      // Legacy tasks/subtasks/history/etc. are not separate primary tabs here.
      const personalWork = items.filter((item) => item.id === "personal_work");
      if (personalWork.length > 0) {
        for (const item of personalWork) {
          for (const entry of expandItemPages(item)) pushUnique(entry);
        }
      } else {
        for (const item of items.filter((entry) => entry.group === "my-work")) {
          for (const entry of expandItemPages(item)) pushUnique(entry);
        }
      }
      continue;
    }

    if (group === "workspaces") {
      // Matches WorkspaceNavigationPanel: Office tools (in groupOfficeTools order),
      // followed immediately by Projects. Legacy `tasks` is excluded just like the panel.
      const showOfficeTools =
        (workspaceKind === "personal" || role === "head")
        && items.some((item) => item.group === "workspaces" && item.id !== "projects" && item.id !== "tasks");

      if (showOfficeTools) {
        const toolItems = workspaceKind === "personal"
          ? items.filter((item) => item.group === "workspaces" && item.id !== "projects" && item.id !== "tasks")
          : groupOfficeTools(items).flatMap((toolGroup) => toolGroup.items);
        for (const item of toolItems) {
          for (const entry of expandItemPages(item)) pushUnique(entry);
        }
      }

      if (items.some((item) => item.id === "projects")) {
        pushUnique({ id: "projects", page: "Projects", label: "Projects" });
      }
      continue;
    }

    if (group === "inbox") {
      for (const item of items.filter((entry) => entry.group === "inbox")) {
        for (const entry of expandItemPages(item, { filterInboxRoot: true })) pushUnique(entry);
      }
      continue;
    }

    if (group === "admin-center") {
      const adminItems = items.filter((entry) => entry.group === "admin-center");
      for (const supportGroup of [...supportGroupOrder, "Support tools"]) {
        for (const item of adminItems) {
          const matchedPages = item.pages.filter(
            (page) => (getSupportPageGroup(page.label) || "Support tools") === supportGroup,
          );
          for (const page of matchedPages) {
            pushUnique({
              id: item.id,
              page: page.label,
              label: pageDisplayLabel(item.id, page.label),
            });
          }
        }
      }
      continue;
    }

    for (const item of items.filter((entry) => entry.group === group)) {
      for (const entry of expandItemPages(item)) pushUnique(entry);
    }
  }

  return result;
}
