import { lazyFeature } from "../../shared/lazyFeature";
import { Suspense, type ReactNode } from "react";
import {
  WorkspaceShell,
  WorkspaceSkeleton,
} from "../../components/ui/workspace";
import { Settings } from "@vibe/icons";
import { useAuth } from "../../contexts/AuthContext";
import {
  getNavigationPermission,
  isAdministrativeNavigationSection,
} from "./navigationPermissions";
import { AccessDenied } from "./AccessDenied";
import { getRoleNavigation } from "./roleNavigation";
import { isAccountingSection } from "../../components/Layout/coreWorkflowNavigation";

const PersonalWorkWorkspace = lazyFeature(
  () =>
    import("../personal-work").then((module) => ({
      default: module.PersonalWorkWorkspace,
    })),
  undefined,
  "PersonalWorkWorkspace",
);
const WorkspaceOverview=lazyFeature(()=>import('../personal-work').then(m=>({default:m.WorkspaceOverview})),undefined,'WorkspaceOverview');
const ActionCenter = lazyFeature(
  () =>
    import("../action-center").then((module) => ({
      default: module.ActionCenter,
    })),
  undefined,
  "ActionCenter",
);

const SettingsContent = lazyFeature(
  () =>
    import("../../components/Settings/SettingsContent").then((module) => ({
      default: module.SettingsContent,
    })),
  undefined,
  "SettingsContent",
);
const AdministrationWorkspace = lazyFeature(
  () =>
    import("../administration").then((module) => ({
      default: module.AdministrationWorkspace,
    })),
  undefined,
  "AdministrationWorkspace",
);
const HeadContent = lazyFeature(
  () =>
    import("../role-head").then((module) => ({ default: module.HeadContent })),
  undefined,
  "HeadContent",
);
const MemberContent = lazyFeature(
  () =>
    import("../../components/Member/MemberContent").then((module) => ({
      default: module.MemberContent,
    })),
  undefined,
  "MemberContent",
);
const AccountingStaffContent = lazyFeature(
  () =>
    import("../role-accounting").then((module) => ({
      default: module.AccountingStaffContent,
    })),
  undefined,
  "AccountingStaffContent",
);

interface RoleContentProps {
  role: string;
  activeSection: string;
  activePage?: string;
  hasLeadingWork?: boolean;
  leadershipLoading?: boolean;
  onNavigate?: (section: string, page: string,projectId?:string) => void;
}

function PageFrame({
  children,
  padded = true,
}: {
  children: ReactNode;
  padded?: boolean;
}) {
  return (
    <div className="eflow-role-content">
      <WorkspaceShell
        data-tour-page-content
        className={`eflow-role-content__surface ${padded ? "eflow-role-content__surface--padded" : ""}`}
      >
        {children}
      </WorkspaceShell>
    </div>
  );
}

function RoleLoading() {
  return <WorkspaceSkeleton />;
}

export function RoleContent({
  role,
  activeSection,
  activePage,
  hasLeadingWork = false,
  leadershipLoading = false,
  onNavigate,
}: RoleContentProps) {
  const { can } = useAuth();
  if (!["admin", "head", "accounting_staff", "member"].includes(role))
    return (
      <PageFrame>
        <p role="alert">
          Unsupported account role. Ask an Admin to correct this account.
        </p>
      </PageFrame>
    );
  if (activeSection==='dashboard'&&role!=='admin') return <Suspense fallback={<RoleLoading/>}><PageFrame><WorkspaceOverview onNavigate={onNavigate}/></PageFrame></Suspense>;
  if (activeSection === "personal_work") {
    if (role === "admin" || (!can("navigation.tasks") && !hasLeadingWork))
      return (
        <PageFrame>
          <AccessDenied permission="navigation.tasks" />
        </PageFrame>
      );
    return (
      <Suspense fallback={<RoleLoading />}>
        <PageFrame>
          <PersonalWorkWorkspace page={activePage} onNavigate={onNavigate}/>
        </PageFrame>
      </Suspense>
    );
  }
  if (activeSection === "inbox")
    return (
      <Suspense fallback={<RoleLoading />}>
        <PageFrame>
          <ActionCenter role={role} hasLeadingWork={hasLeadingWork} />
        </PageFrame>
      </Suspense>
    );
  const isProjectsWorkspace = activeSection === "projects";
  if (
    role === "admin" &&
    activeSection !== "settings" &&
    activeSection !== "users" &&
    !isAdministrativeNavigationSection(activeSection)
  ) {
    return (
      <PageFrame padded={false}>
        <AdministrationWorkspace />
      </PageFrame>
    );
  }
  if (activeSection === "settings") {
    return (
      <Suspense fallback={<RoleLoading />}>
        <PageFrame padded={false}>
          <SettingsContent activePage={activePage} onNavigate={onNavigate} />
        </PageFrame>
      </Suspense>
    );
  }

  const requiredPermission = getNavigationPermission(role, activeSection);
  const activeNavigationItem = getRoleNavigation(role).navItems.find(
    (item) => item.id === activeSection,
  );
  if (activeNavigationItem?.requiresLeadership && leadershipLoading)
    return <RoleLoading />;
  if (
    (activeNavigationItem?.requiresLeadership && !hasLeadingWork) ||
    (activeNavigationItem?.requiresHead && role !== "head")
  )
    return (
      <PageFrame padded={false}>
        <AccessDenied permission={requiredPermission || "navigation.tasks"} />
      </PageFrame>
    );
  const hasContextualLeadershipAccess = Boolean(
    hasLeadingWork && activeNavigationItem?.requiresLeadership,
  );
  if (
    requiredPermission &&
    !can(requiredPermission) &&
    !hasContextualLeadershipAccess
  ) {
    return (
      <PageFrame padded={false}>
        <AccessDenied permission={requiredPermission} />
      </PageFrame>
    );
  }

  if (role !== "admin" && isAdministrativeNavigationSection(activeSection)) {
    return (
      <Suspense fallback={<RoleLoading />}>
        <PageFrame padded={false}>
          <AdministrationWorkspace
            activeSection={activeSection}
            activePage={activePage}
            onNavigate={onNavigate}
          />
        </PageFrame>
      </Suspense>
    );
  }

  let content: ReactNode;
  switch (role) {
    case "admin":
      content = (
        <PageFrame padded={false}>
          <AdministrationWorkspace
            activeSection={activeSection}
            activePage={activePage}
            onNavigate={onNavigate}
          />
        </PageFrame>
      );
      break;
    case "head":
      content = (
        <PageFrame padded={!isProjectsWorkspace}>
          <HeadContent activeSection={activeSection} activePage={activePage} />
        </PageFrame>
      );
      break;
    case "member":
      content = (
        <PageFrame padded={!isProjectsWorkspace}>
          <MemberContent
            activeSection={activeSection}
            activePage={activePage}
          />
        </PageFrame>
      );
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
      content = isAccountingSection(activeSection) ? (
        <PageFrame padded={false}>
          <AccountingStaffContent
            activeSection={activeSection}
            activePage={activePage}
            onNavigate={onNavigate}
          />
        </PageFrame>
      ) : (
        <PageFrame padded={!isProjectsWorkspace}>
          <MemberContent
            activeSection={activeSection}
            activePage={activePage}
          />
        </PageFrame>
      );
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
