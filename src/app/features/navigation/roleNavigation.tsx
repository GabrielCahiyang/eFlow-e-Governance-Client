import type { ReactNode } from "react";
import {
  ChartBar,
  Dashboard,
  Folder,
  FolderOpen,
  Home,
  Notification,
  Renew,
  Report,
  Security,
  Settings,
  UserMultiple,
} from "@carbon/icons-react";
import { getCoreRoleNavigation } from "../../components/Layout/coreWorkflowNavigation";
import { ADMINISTRATIVE_NAVIGATION_SECTIONS } from "./navigationPermissions";

export interface RoleNavItem {
  id: string;
  icon: ReactNode;
  label: string;
  requiresLeadership?: boolean;
  requiresDepartmentHead?: boolean;
}

export interface RoleNavigation {
  navItems: RoleNavItem[];
  defaultSection: string;
  defaultPages?: Record<string, string>;
}

const compatibilityNavigation: Record<string, RoleNavigation> = {
  superadmin: {
    defaultSection: "dashboard",
    navItems: [
      { id: "dashboard", icon: <Dashboard size={16} />, label: "Dashboard" },
      {
        id: "projects",
        icon: <FolderOpen size={16} />,
        label: "Plans & Projects",
      },
      { id: "reports", icon: <ChartBar size={16} />, label: "Reports" },
      {
        id: "announcements",
        icon: <Notification size={16} />,
        label: "Announcements",
      },
      {
        id: "users",
        icon: <UserMultiple size={16} />,
        label: "User Management",
      },
      { id: "org_tree", icon: <Folder size={16} />, label: "Org Structure" },
      { id: "audit", icon: <Report size={16} />, label: "Audit Trail" },
      {
        id: "administration",
        icon: <Settings size={16} />,
        label: "System Settings",
      },
      { id: "migration", icon: <Renew size={16} />, label: "Data Tools" },
    ],
  },
  executive: {
    defaultSection: "portfolio",
    defaultPages: {
      portfolio: "City Project Pulse",
      transform: "Sustainable Tourism & Eco-Resorts",
      financial: "Master Budget Execution",
      audit: "Cryptographic Ledger",
    },
    navItems: [
      {
        id: "portfolio",
        icon: <Dashboard size={16} />,
        label: "Portfolio Intelligence",
      },
      {
        id: "transform",
        icon: <Renew size={16} />,
        label: "Project Transformation",
      },
      {
        id: "financial",
        icon: <ChartBar size={16} />,
        label: "Financial Oversight",
      },
      { id: "audit", icon: <Security size={16} />, label: "Immutable Audit" },
    ],
  },
  legislative: {
    defaultSection: "legdash",
    defaultPages: {
      legdash: "Active Measures Pipeline",
      session: "Order of Business",
      committee: "Proposed Municipal Budget",
      councilor: "Councilor Dashboard",
    },
    navItems: [
      {
        id: "legdash",
        icon: <Dashboard size={16} />,
        label: "Legislative Dashboard",
      },
      {
        id: "session",
        icon: <Report size={16} />,
        label: "Session Management",
      },
      {
        id: "committee",
        icon: <UserMultiple size={16} />,
        label: "Committee Affairs",
      },
      {
        id: "councilor",
        icon: <Folder size={16} />,
        label: "Councilor Workspace",
      },
    ],
  },
  hrmo: {
    defaultSection: "workforce",
    defaultPages: {
      workforce: "Burnout Prediction Radar",
      wellness: "Automated Alerts",
      compliance: "CSC Appraisals",
    },
    navItems: [
      {
        id: "workforce",
        icon: <UserMultiple size={16} />,
        label: "Workforce Intelligence",
      },
      {
        id: "wellness",
        icon: <Notification size={16} />,
        label: "Wellness & Attendance",
      },
      {
        id: "compliance",
        icon: <Security size={16} />,
        label: "Performance Compliance",
      },
    ],
  },
  finance: {
    defaultSection: "projfin",
    defaultPages: {
      projfin: "Programmatic Buckets",
      liquidation: "Receipt Verification",
      crypto: "Hashed Liquidations",
    },
    navItems: [
      { id: "projfin", icon: <ChartBar size={16} />, label: "Project Finance" },
      { id: "liquidation", icon: <Report size={16} />, label: "Liquidation" },
      { id: "crypto", icon: <Security size={16} />, label: "Immutable Ledger" },
    ],
  },
  depthead: {
    defaultSection: "command",
    navItems: [
      { id: "command", icon: <Home size={16} />, label: "Command Center" },
      {
        id: "leader",
        icon: <UserMultiple size={16} />,
        label: "Leader Workspace",
      },
      {
        id: "deptportfolio",
        icon: <Folder size={16} />,
        label: "Department Workspace",
      },
    ],
  },
  teamleader: {
    defaultSection: "command",
    navItems: [
      {
        id: "command",
        icon: <Home size={16} />,
        label: "Leader Command Center",
      },
      {
        id: "leader",
        icon: <UserMultiple size={16} />,
        label: "Leader Workspace",
      },
      {
        id: "deptportfolio",
        icon: <Folder size={16} />,
        label: "Section Workspace",
      },
    ],
  },
  employee: {
    defaultSection: "mywork",
    navItems: [
      { id: "mywork", icon: <Home size={16} />, label: "My Work" },
      {
        id: "leader",
        icon: <UserMultiple size={16} />,
        label: "Leader Workspace",
      },
      {
        id: "workspace",
        icon: <Folder size={16} />,
        label: "Department Workspace",
      },
    ],
  },
  councilor_pad: {
    defaultSection: "councilor",
    defaultPages: {
      councilor: "Councilor Dashboard",
      legdash: "Active Measures Pipeline",
      session: "Order of Business",
      committee: "Proposed Municipal Budget",
    },
    navItems: [
      {
        id: "councilor",
        icon: <Dashboard size={16} />,
        label: "Councilor Dashboard",
      },
      {
        id: "legdash",
        icon: <Report size={16} />,
        label: "Legislative Measures",
      },
      { id: "session", icon: <Folder size={16} />, label: "Sessions" },
      {
        id: "committee",
        icon: <UserMultiple size={16} />,
        label: "Committees",
      },
    ],
  },
};

export function getRoleNavigation(role: string): RoleNavigation {
  return (
    getCoreRoleNavigation(role) ||
    compatibilityNavigation[role] ||
    compatibilityNavigation.superadmin
  );
}

/**
 * Core workspaces keep their stable role manifest. Permission-managed roles
 * can additionally receive administrative destinations through Role Defaults
 * or a user-specific exception.
 */
export function getRoleNavigationCandidates(role: string): RoleNavItem[] {
  const base = getRoleNavigation(role).navItems;
  if (!["depthead", "teamleader", "employee"].includes(role)) return base;
  const existing = new Set(base.map((item) => item.id));
  const supplementalIds = new Set<string>(ADMINISTRATIVE_NAVIGATION_SECTIONS);
  const supplemental = compatibilityNavigation.superadmin.navItems.filter(
    (item) => supplementalIds.has(item.id) && !existing.has(item.id),
  );
  return [...base, ...supplemental];
}

/**
 * Leadership destinations are contextual workspaces, not role defaults.
 * Heads, Assistant Heads, and Employees only see them while they actually
 * lead at least one task visible to their account.
 */
export function isRoleNavigationItemVisible(
  item: Pick<RoleNavItem, "requiresLeadership" | "requiresDepartmentHead">,
  hasLeadingWork: boolean,
  persistedRole?: string,
): boolean {
  if (
    item.requiresDepartmentHead &&
    !["dept_head", "department_head"].includes(persistedRole || "")
  ) {
    return false;
  }
  return !item.requiresLeadership || hasLeadingWork;
}

export function getDefaultSection(role: string): string {
  return getRoleNavigation(role).defaultSection;
}
