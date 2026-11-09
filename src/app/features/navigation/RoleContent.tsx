import { lazyFeature } from "../../shared/lazyFeature";
import { Suspense, type ReactNode } from "react";
import { WorkspaceShell } from "../../components/ui/workspace";
import { Settings } from "@vibe/icons";
import { useAuth } from "../../contexts/AuthContext";
import {
  getNavigationPermission,
  isAdministrativeNavigationSection,
} from "./navigationPermissions";
import { AccessDenied } from "./AccessDenied";
import { ProjectWorkspaceSkeleton } from "../../components/workflow/ProjectWorkspaceSkeleton";
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
const WorkspaceOverview = lazyFeature(
  () =>
    import("../personal-work").then((m) => ({
      default: m.WorkspaceOverview,
    })),
  undefined,
  "WorkspaceOverview",
);
const MemberOverview = lazyFeature(
  () =>
    import("../personal-work").then((m) => ({
      default: m.MemberOverview,
    })),
  undefined,
  "MemberOverview",
);
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
  onNavigate?: (section: string, page: string, projectId?: string) => void;
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

function RoleLoading({
  role,
  activeSection,
  activePage,
}: {
  role?: string;
  activeSection?: string;
  activePage?: string;
}) {
  const section = activeSection || "dashboard";
  return (
    <div
      className="eflow-workspace-skeleton p-5"
      role="status"
      aria-label="Loading workspace"
    >
      <span className="sr-only">Loading workspace</span>
      <div aria-hidden="true" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="h-6 w-48 animate-pulse rounded-lg bg-neutral-200/80" />
            <div className="h-3.5 w-72 animate-pulse rounded bg-neutral-100" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-28 animate-pulse rounded-lg bg-neutral-100" />
            <div className="h-9 w-24 animate-pulse rounded-lg bg-neutral-200/80" />
          </div>
        </div>

        {section === "dashboard" ? (
          role === "member" ? (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[0, 1, 2, 3].map((index) => (
                  <div
                    key={index}
                    className="h-24 animate-pulse rounded-xl border border-neutral-200 bg-white p-4"
                  />
                ))}
              </div>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="h-72 animate-pulse rounded-xl border border-neutral-200 bg-white p-4" />
                <div className="space-y-4">
                  <div className="h-36 animate-pulse rounded-xl border border-neutral-200 bg-white p-4" />
                  <div className="h-32 animate-pulse rounded-xl border border-neutral-200 bg-white p-4" />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                {[0, 1, 2, 3, 4].map((index) => (
                  <div
                    key={index}
                    className="h-24 animate-pulse rounded-xl border border-neutral-200 bg-white p-4"
                  />
                ))}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {[0, 1, 2].map((index) => (
                  <div
                    key={index}
                    className="h-28 animate-pulse rounded-xl border border-neutral-200 bg-white p-4"
                  />
                ))}
              </div>
              <div className="h-64 animate-pulse rounded-xl border border-neutral-200 bg-white p-4" />
            </>
          )
        ) : section === "inbox" || section === "reviews" ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
            <div className="space-y-2.5 rounded-xl border border-neutral-200 bg-white p-4">
              {[0, 1, 2, 3, 4].map((index) => (
                <div
                  key={index}
                  className="h-16 animate-pulse rounded-lg border border-neutral-100 bg-neutral-50/70"
                />
              ))}
            </div>
            <div className="h-96 animate-pulse rounded-xl border border-neutral-200 bg-white p-5" />
          </div>
        ) : section === "settings" ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
            <div className="space-y-2 rounded-2xl border border-neutral-200 bg-white p-3">
              {[0, 1, 2, 3, 4].map((index) => (
                <div
                  key={index}
                  className="h-11 animate-pulse rounded-xl bg-neutral-100"
                />
              ))}
            </div>
            <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6">
              <div className="h-28 animate-pulse rounded-xl bg-neutral-100" />
              <div className="h-44 animate-pulse rounded-xl bg-neutral-50" />
            </div>
          </div>
        ) : section === "projects" ||
          (section === "tasks" && activePage === "Board") ? (
          <ProjectWorkspaceSkeleton view={section === "projects" ? projectLoadingView() : "board"} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className="h-20 animate-pulse rounded-xl border border-neutral-200 bg-white p-3.5"
                />
              ))}
            </div>
            <div className="space-y-2.5 rounded-xl border border-neutral-200 bg-white p-4">
              <div className="h-9 w-full animate-pulse rounded-lg bg-neutral-100" />
              {[0, 1, 2, 3, 4].map((index) => (
                <div
                  key={index}
                  className="h-12 w-full animate-pulse rounded-lg bg-neutral-50"
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function projectLoadingView() {
  const params = new URLSearchParams(window.location.search);
  return params.has("project") ? params.get("view") || "tasks" : "index";
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
  if (activeSection === "dashboard" && role !== "admin")
    return (
      <Suspense
        fallback={
          <RoleLoading
            role={role}
            activeSection={activeSection}
            activePage={activePage}
          />
        }
      >
        <PageFrame>
          {role === "member" ? (
            <MemberOverview onNavigate={onNavigate} />
          ) : (
            <WorkspaceOverview onNavigate={onNavigate} />
          )}
        </PageFrame>
      </Suspense>
    );
  if (activeSection === "personal_work") {
    if (role === "admin" || (!can("navigation.tasks") && !hasLeadingWork))
      return (
        <PageFrame>
          <AccessDenied permission="navigation.tasks" />
        </PageFrame>
      );
    return (
      <Suspense
        fallback={
          <RoleLoading
            role={role}
            activeSection={activeSection}
            activePage={activePage}
          />
        }
      >
        <PageFrame>
          <PersonalWorkWorkspace
            page={activePage}
            onNavigate={onNavigate}
            hasLeadingWork={hasLeadingWork}
          />
        </PageFrame>
      </Suspense>
    );
  }
  if (activeSection === "inbox")
    return (
      <Suspense
        fallback={
          <RoleLoading
            role={role}
            activeSection={activeSection}
            activePage={activePage}
          />
        }
      >
        <PageFrame>
          <ActionCenter
            role={role}
            hasLeadingWork={hasLeadingWork}
            page={activePage}
            onNavigate={onNavigate}
          />
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
      <Suspense
        fallback={
          <RoleLoading
            role={role}
            activeSection={activeSection}
            activePage={activePage}
          />
        }
      >
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
    return (
      <RoleLoading
        role={role}
        activeSection={activeSection}
        activePage={activePage}
      />
    );
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
      <Suspense
        fallback={
          <RoleLoading
            role={role}
            activeSection={activeSection}
            activePage={activePage}
          />
        }
      >
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
            <p className="text-[14px] font-normal">Account access unavailable</p>
            <p className="text-[12px] mt-1">
              Ask an administrator to review your account role.
            </p>
          </div>
        </div>
      );
  }
  return (
    <Suspense
      fallback={
        <RoleLoading
          role={role}
          activeSection={activeSection}
          activePage={activePage}
        />
      }
    >
      {content}
    </Suspense>
  );
}
