import { lazy, Suspense, type ReactNode } from "react";
import { WorkspaceShell, WorkspaceSkeleton } from "../../components/ui/workspace";
import { Settings } from "@vibe/icons";
import { useAuth } from "../../contexts/AuthContext";
import { getNavigationPermission, isAdministrativeNavigationSection } from "./navigationPermissions";
import { AccessDenied } from "./AccessDenied";
import { getRoleNavigation } from "./roleNavigation";
import { isAccountingSection } from "../../components/Layout/coreWorkflowNavigation";

const SettingsContent = lazy(() => import("../../components/Settings/SettingsContent").then((module) => ({ default: module.SettingsContent })));
const AdministrationWorkspace = lazy(() => import("../administration").then(module => ({default:module.AdministrationWorkspace})));
const HeadContent = lazy(() => import("../role-head").then((module) => ({ default: module.HeadContent })));
const MemberContent = lazy(() => import("../../components/Member/MemberContent").then((module) => ({ default: module.MemberContent })));
const AccountingStaffContent = lazy(() => import("../role-accounting").then((module) => ({ default: module.AccountingStaffContent })));

interface RoleContentProps {
  role: string;
  activeSection: string;
  activePage?: string;
  hasLeadingWork?: boolean;
}

function PageFrame({ children, padded = true, dark = false }: { children: ReactNode; padded?: boolean; dark?: boolean }) {
  return (
    <div className={`h-full min-h-0 flex-1 overflow-hidden ${dark ? "bg-neutral-50 dark:bg-slate-950" : "bg-neutral-50"}`}>
      <WorkspaceShell data-tour-page-content className={`h-full min-w-0 overflow-y-auto ${padded ? "p-3 sm:p-6" : ""}`}>{children}</WorkspaceShell>
    </div>
  );
}

function RoleLoading() {
  return <WorkspaceSkeleton />;
}

export function RoleContent({ role, activeSection, activePage, hasLeadingWork = false }: RoleContentProps) {
  const { can } = useAuth();
  if (!["admin", "head", "accounting_staff", "member"].includes(role)) return <PageFrame><p role="alert">Unsupported account role. Ask an Admin to correct this account.</p></PageFrame>;
  const isProjectsWorkspace = activeSection === "projects";
  if (role === "admin" && activeSection !== "settings" && activeSection !== "users" && !isAdministrativeNavigationSection(activeSection)) {
    return <PageFrame><AdministrationWorkspace /></PageFrame>;
  }
  if (activeSection === "settings") {
    return <Suspense fallback={<RoleLoading />}><PageFrame padded={false} dark><SettingsContent activePage={activePage} /></PageFrame></Suspense>;
  }

  const requiredPermission = getNavigationPermission(role, activeSection);
  const activeNavigationItem = getRoleNavigation(role).navItems.find(
    (item) => item.id === activeSection,
  );
  const hasContextualLeadershipAccess = Boolean(
    hasLeadingWork && activeNavigationItem?.requiresLeadership,
  );
  if (requiredPermission && !can(requiredPermission) && !hasContextualLeadershipAccess) {
    return <PageFrame padded={false}><AccessDenied permission={requiredPermission} /></PageFrame>;
  }

  if (role !== "admin" && isAdministrativeNavigationSection(activeSection)) {
    return (
      <Suspense fallback={<RoleLoading />}>
        <PageFrame><AdministrationWorkspace activeSection={activeSection} activePage={activePage} /></PageFrame>
      </Suspense>
    );
  }

  let content: ReactNode;
  switch (role) {
    case "admin":
      content = <PageFrame padded={!isProjectsWorkspace}><AdministrationWorkspace activeSection={activeSection} activePage={activePage} /></PageFrame>;
      break;
    case "head":
      content = <PageFrame padded={!isProjectsWorkspace}><HeadContent activeSection={activeSection} activePage={activePage} /></PageFrame>;
      break;
    case "member":
      content = <PageFrame padded={!isProjectsWorkspace}><MemberContent activeSection={activeSection} activePage={activePage} /></PageFrame>;
      break;
    case "accounting_staff":
      /**
       * Accounting staff keep their full employee workspace. When the active
       * section is one of the dedicated accounting destinations, render the
       * AccountingStaffContent; for all other sections (tasks, projects, etc.)
       * the standard MemberContent handles the page — preserving every
       * employee-facing workflow that existed before the accounting role was
       * assigned.
       */
      content = isAccountingSection(activeSection)
        ? <PageFrame padded={false}><AccountingStaffContent activeSection={activeSection} activePage={activePage} /></PageFrame>
        : <PageFrame padded={!isProjectsWorkspace}><MemberContent activeSection={activeSection} activePage={activePage} /></PageFrame>;
      break;
    default:
      content = (
        <div className="bg-neutral-50 h-full min-h-0 flex-1 overflow-y-auto p-6 rounded-r-2xl flex items-center justify-center">
          <div className="text-center text-neutral-400">
            <Settings size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-[14px] font-normal">Content coming soon</p>
            <p className="text-[12px] mt-1">Role: {role}</p>
          </div>
        </div>
      );
  }
  return <Suspense fallback={<RoleLoading />}>{content}</Suspense>;
}
