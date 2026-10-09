import type { ReactNode } from "react";
import {
  Analytics,
  Calendar,
  ChartBar,
  CheckmarkOutline,
  Dashboard,
  FolderOpen,
  Notification,
  Report,
  Security,
  StarFilled,
  Task,
  UserMultiple,
  Wallet,
} from "@carbon/icons-react";

export interface CoreRoleNavItem {
  id: string;
  icon: ReactNode;
  label: string;
  page: string;
  group: string;
  requiresLeadership?: boolean;
  requiresHead?: boolean;
}

export interface CoreRoleNavigation {
  defaultSection: string;
  navItems: CoreRoleNavItem[];
}

/** Section IDs that belong exclusively to the Accounting workspace. */
export const ACCOUNTING_SECTION_IDS = new Set([
  "accounting_overview",
  "accounting_releases",
  "accounting_journal",
  "accounting_audit",
  "accounting_budgets",
]);

export function isAccountingSection(sectionId: string): boolean {
  return ACCOUNTING_SECTION_IDS.has(sectionId);
}

/** Accounting nav group — appended after employee items for accounting_staff. */
const ACCOUNTING_NAV_ITEMS: CoreRoleNavItem[] = [
  {
    id: "accounting_overview",
    icon: <Dashboard size={16} />,
    label: "Accounting Overview",
    page: "Accounting Overview",
    group: "Accounting",
  },
  {
    id: "accounting_releases",
    icon: <Wallet size={16} />,
    label: "Voucher & Cash Releases",
    page: "Voucher & Cash Releases",
    group: "Accounting",
  },
  {
    id: "accounting_journal",
    icon: <Report size={16} />,
    label: "General Journal",
    page: "General Journal",
    group: "Accounting",
  },
  {
    id: "accounting_audit",
    icon: <CheckmarkOutline size={16} />,
    label: "Financial Audit Trail",
    page: "Financial Audit Trail",
    group: "Accounting",
  },
  {
    id: "accounting_budgets",
    icon: <ChartBar size={16} />,
    label: "Office Budget Ledgers",
    page: "Office Budget Ledgers",
    group: "Accounting",
  },
];

/** Employee nav items — shared between employee and accounting_staff roles. */
const EMPLOYEE_NAV_ITEMS: CoreRoleNavItem[] = [
  {
    id: "tasks",
    icon: <Task size={16} />,
    label: "My Tasks",
    page: "My Tasks",
    group: "My Work",
  },
  {
    id: "projects",
    icon: <FolderOpen size={16} />,
    label: "Projects",
    page: "Projects",
    group: "My Work",
  },
  {
    id: "leading",
    icon: <StarFilled size={16} />,
    label: "Work I'm Leading",
    page: "Leading Work",
    group: "Leadership",
    requiresLeadership: true,
  },
  {
    id: "subtasks",
    icon: <CheckmarkOutline size={16} />,
    label: "My Subtasks",
    page: "My Subtasks",
    group: "My Work",
  },
  {
    id: "reviews",
    icon: <CheckmarkOutline size={16} />,
    label: "Leader Reviews",
    page: "Leader Reviews",
    group: "Leadership",
    requiresLeadership: true,
  },
  {
    id: "deadlines",
    icon: <Calendar size={16} />,
    label: "Deadlines",
    page: "Deadlines",
    group: "My Work",
  },
  {
    id: "history",
    icon: <Report size={16} />,
    label: "Task History",
    page: "Task History",
    group: "My Work",
  },
  {
    id: "performance",
    icon: <Analytics size={16} />,
    label: "Performance",
    page: "Performance",
    group: "Insights",
  },
  {
    id: "reports",
    icon: <ChartBar size={16} />,
    label: "Work Report",
    page: "Work Report",
    group: "Insights",
  },
  {
    id: "announcements",
    icon: <Notification size={16} />,
    label: "Announcements",
    page: "Announcements",
    group: "Communication",
  },
];

/**
 * The active Admin / Department Head / Employee workflow uses stable section
 * ids and one destination per sidebar row. Page labels remain presentation
 * text; they are no longer overloaded as the primary navigation structure.
 */
const CORE_WORKFLOW_NAVIGATION: Record<string, CoreRoleNavigation> = {
  admin: { defaultSection: "users", navItems: [{id:"users", icon:<UserMultiple size={16} />,label:"User Management",page:"All Users",group:"Administration"}] },
  /**
   * accounting_staff: All standard employee sections are kept intact so that
   * assigning accounting access is purely additive — the person retains their
   * full task / project / subtask workspace and gains the Accounting group
   * appended at the bottom. Removing accounting access reverts them to the
   * plain employee role which uses only EMPLOYEE_NAV_ITEMS.
   */
  accounting_staff: {
    defaultSection: "accounting_overview",
    navItems: [...EMPLOYEE_NAV_ITEMS, ...ACCOUNTING_NAV_ITEMS],
  },
  head: {
    defaultSection: "dashboard",
    navItems: [
      {
        id: "dashboard",
        icon: <Dashboard size={16} />,
        label: "Overview",
        page: "Dashboard",
        group: "Office",
      },
      {
        id: "projects",
        icon: <FolderOpen size={16} />,
        label: "Projects",
        page: "Projects",
        group: "Office",
      },
      {
        id: "tasks",
        icon: <Task size={16} />,
        label: "Tasks",
        page: "Task Board",
        group: "Office",
      },
      {
        id: "budget",
        icon: <Wallet size={16} />,
        label: "Office Budget",
        page: "Office Budget",
        group: "Office",
      },
      {
        id: "leading",
        icon: <StarFilled size={16} />,
        label: "Work I'm Leading",
        page: "Leading Work",
        group: "Leadership",
        requiresLeadership: true,
      },
      {
        id: "subtasks",
        icon: <CheckmarkOutline size={16} />,
        label: "My Subtasks",
        page: "My Subtasks",
        group: "Office",
      },
      {
        id: "reviews",
        icon: <CheckmarkOutline size={16} />,
        label: "Reviews",
        page: "For Review",
        group: "Office",
      },
      {
        id: "team",
        icon: <UserMultiple size={16} />,
        label: "Office Team",
        page: "Team Supervision",
        group: "People",
      },
      {
        id: "identity",
        icon: <Security size={16} />,
        label: "Identity & Access",
        page: "Identity & Access",
        group: "People",
        requiresHead: true,
      },
      {
        id: "intelligence",
        icon: <Analytics size={16} />,
        label: "Team Intelligence",
        page: "Team Intelligence",
        group: "People",
      },
      {
        id: "reports",
        icon: <ChartBar size={16} />,
        label: "Reports",
        page: "Reports",
        group: "Insights",
      },
      {
        id: "announcements",
        icon: <Notification size={16} />,
        label: "Announcements",
        page: "Announcements",
        group: "Communication",
      },
    ],
  },
  member: {
    defaultSection: "personal_work",
    navItems: EMPLOYEE_NAV_ITEMS,
  },
};

export function getCoreRoleNavigation(
  role: string,
): CoreRoleNavigation | undefined {
  return CORE_WORKFLOW_NAVIGATION[role];
}

export function getCoreSidebarContent(
  role: string,
  section: string,
):
  | {
      title: string;
      sections: {
        title: string;
        items: {
          icon: ReactNode;
          label: string;
          isActive: boolean;
        }[];
      }[];
    }
  | undefined {
  const config = getCoreRoleNavigation(role);
  const item = config?.navItems.find((entry) => entry.id === section);
  if (!item) return undefined;

  return {
    title: item.label,
    sections: [
      {
        title: item.group,
        items: [
          {
            icon: item.icon,
            label: item.page,
            isActive: true,
          },
        ],
      },
    ],
  };
}
