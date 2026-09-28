// ─── Super Admin Content Router ──────────────────────────────────
// Thin router that delegates to Supabase-connected modules.

import React from "react";
import { DashboardOverview } from "./DashboardOverview";
import { UserManagement } from "./UserManagement";
import { OrgTreeBuilder } from "./OrgTreeBuilder";
import { MigrationTool } from "./MigrationTool";
import { SystemSettings } from "./SystemSettings";
import { AdminAnnouncements } from "./AdminAnnouncements";
import { AdminAuditLog } from "./AdminAuditLog";
import { AdminPermissions } from "./AdminPermissions";
import { ProjectsWorkspace } from "../workflow/ProjectsWorkspace";
import { ReportsWorkspace } from "../workflow/ReportsWorkspace";
import { useState } from "react";
import { MonthlyLeaderboard } from "../../features/productivity";
import { useDepartmentTeamAnalytics } from "../../features/team-management";
import { useAuth } from "../../contexts/AuthContext";

// System-wide scope: super admin sees every org (empty scopedOrgIds = all).
const ADMIN_SCOPE = { isSuperAdmin: true, scopedOrgIds: [] as string[] };
function AdminProjects() {
  return <ProjectsWorkspace scope={ADMIN_SCOPE} eyebrow="Administration · Planning Portfolio" readOnly />;
}
function AdminReports() {
  const [view, setView] = useState<"reports" | "contribution">("reports");
  const analytics = useDepartmentTeamAnalytics();
  return <div className="min-h-full"><div className="flex gap-1 overflow-x-auto border-b border-neutral-200 bg-white px-3 pt-4 sm:px-8"><button type="button" onClick={() => setView("reports")} className={`shrink-0 rounded-t-lg px-4 py-2 text-[11px] font-medium ${view === "reports" ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-50"}`}>System reports</button><button type="button" onClick={() => setView("contribution")} className={`shrink-0 rounded-t-lg px-4 py-2 text-[11px] font-medium ${view === "contribution" ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-50"}`}>Monthly contribution</button></div>{view === "reports" ? <ReportsWorkspace scope={ADMIN_SCOPE} eyebrow="Administration · Reports" /> : <div className="p-3 sm:p-8"><MonthlyLeaderboard employees={analytics.allEmployees.filter((employee) => employee.id !== analytics.userProfile?.id)} tasks={analytics.tasks} facts={analytics.facts} currentUserId={analytics.userProfile?.id} allowDepartmentFilter /></div>}</div>;
}
function UserRoleDefaults() {
  return <UserManagement initialTab="role-defaults" />;
}
function IndividualUserAccess() {
  return <UserManagement initialTab="user-access" />;
}

// ─── Section → Page mapping ──────────────────────────────────────
const superAdminPages: Record<string, Record<string, React.ComponentType>> = {
  dashboard: {
    "Dashboard Overview": DashboardOverview,
  },
  users: {
    "All Users": UserManagement,
    "Role Defaults": UserRoleDefaults,
    "User Access": IndividualUserAccess,
  },
  org_tree: {
    "Org Structure": OrgTreeBuilder,
  },
  projects: {
    "All Projects": AdminProjects,
  },
  reports: {
    "System Reports": AdminReports,
  },
  announcements: {
    Announcements: AdminAnnouncements,
  },
  audit: {
    "Audit Log": AdminAuditLog,
  },
  permissions: {
    Permissions: AdminPermissions,
  },
  administration: {
    "System Settings": SystemSettings,
  },
  migration: {
    "Backup & Export": MigrationTool,
  },
  settings: {
    "System Settings": SystemSettings,
  },
};

// Default pages per section
export const defaultPages: Record<string, string> = {
  dashboard: "Dashboard Overview",
  users: "All Users",
  org_tree: "Org Structure",
  projects: "All Projects",
  reports: "System Reports",
  announcements: "Announcements",
  audit: "Audit Log",
  permissions: "Permissions",
  administration: "System Settings",
  migration: "Backup & Export",
  settings: "System Settings",
};

// ─── Sidebar content config (used by DetailSidebar) ──────────────
export const superAdminSidebarContent: Record<
  string,
  { title: string; sections: { title: string; items: { label: string }[] }[] }
> = {
  dashboard: {
    title: "Dashboard",
    sections: [{ title: "Overview", items: [{ label: "Dashboard Overview" }] }],
  },
  users: {
    title: "User Management",
    sections: [
      { title: "Identity & Access", items: [{ label: "All Users" }, { label: "Role Defaults" }, { label: "User Access" }] },
    ],
  },
  org_tree: {
    title: "Org Structure",
    sections: [
      { title: "Management", items: [{ label: "Org Structure" }] },
    ],
  },
  migration: {
    title: "Data Tools",
    sections: [{ title: "Tools", items: [{ label: "Backup & Export" }] }],
  },
  settings: {
    title: "Settings",
    sections: [{ title: "Configuration", items: [{ label: "System Settings" }] }],
  },
};

// ─── Main Router ─────────────────────────────────────────────────
export function SuperAdminContent({
  activeSection,
  activePage,
}: {
  activeSection: string;
  activePage?: string;
}) {
  const { userProfile } = useAuth();
  const section = superAdminPages[activeSection];
  if (!section) {
    return <DashboardOverview />;
  }

  const requestedPage = activePage || defaultPages[activeSection] || Object.keys(section)[0];
  const pageName = userProfile?.role !== "super_admin"
    && activeSection === "users"
    && requestedPage !== "All Users"
    ? "All Users"
    : requestedPage;
  const PageComponent = section[pageName];
  if (!PageComponent) {
    const fallback = Object.values(section)[0];
    if (fallback) {
      const FallbackComp = fallback;
      return <FallbackComp />;
    }
    return <DashboardOverview />;
  }
  return <PageComponent />;
}

export { superAdminPages };
