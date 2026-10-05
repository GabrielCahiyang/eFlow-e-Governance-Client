import { isAdminRole } from "../../shared/roles";
import { TaskDepartmentProvider } from "../tasks";
import { Modal } from "@vibe/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  canOpenNavigationSection,
  getRoleNavigationCandidates,
  getSidebarContent,
  isRoleNavigationItemVisible,
  RoleContent,
  useRoleNavigationState,
} from "../navigation";
import { GuidedTourProvider } from "../guided-tours";
import { useOrgs, useProjectsData, useTasksData } from "../../hooks/useSupabaseData";
import { isTaskLead } from "../../services/taskSelectors";
import { EflowTopBar } from "./components/EflowTopBar";
import {
  ProductivitySidebar,
  type ShellNavigationItem,
} from "./components/ProductivitySidebar";
import "./eflowAppShell.css";
import { getNavigationActionAlerts } from "./navigationActionAlerts";
import { usePendingPlanDrafts } from "./usePendingPlanDrafts";
import { OnboardingWorkspace } from '../onboarding';

interface EflowAppShellProps {
  role: string;
}

function getSectionPages(role: string, section: string, persistedRole?: string) {
  const content = getSidebarContent(role, section);
  return content.sections.flatMap((contentSection) =>
    contentSection.items
      .filter((item) => isAdminRole(persistedRole) || section !== "users" || item.label === "All Users")
      .map((item) => ({ label: item.label })),
  );
}

export function EflowAppShell({ role }: EflowAppShellProps) {
  const { can, user, userProfile } = useAuth();
  const { tasks } = useTasksData();
  const { projects } = useProjectsData();
  const { orgs } = useOrgs();
  const userId = user?.id;
  const planDrafts = usePendingPlanDrafts(userId);
  const [isMobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const getInitialPage = useCallback(
    (section: string) => {
      const content = getSidebarContent(role, section);
      return content.sections[0]?.items[0]?.label;
    },
    [role],
  );
  const { activePage, activeSection, selectPage } = useRoleNavigationState(
    role,
    getInitialPage,
  );

  // Keep the browser tab useful as users move between role-specific menus.
  // The login route owns the base "eFlow" title; the authenticated shell sets
  // the currently selected destination without changing navigation behavior.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const sectionLabel =
      activeSection === "settings"
        ? "Settings"
        : getRoleNavigationCandidates(role).find(
            (item) => item.id === activeSection,
          )?.label;
    const activity = activePage?.trim() || sectionLabel || "eFlow";
    document.title = activity;
  }, [activePage, activeSection, role]);

  const hasLeadingWork =
    Boolean(userId) && tasks.some((task) => isTaskLead(task, userId));
  const visibleNavigationItems = getRoleNavigationCandidates(role).filter(
    (item) =>
      isRoleNavigationItemVisible(item, hasLeadingWork, userProfile?.role) &&
      canOpenNavigationSection(
        role,
        item.id,
        can,
        Boolean(item.requiresLeadership && hasLeadingWork),
      ),
  );
  const actionAlerts = getNavigationActionAlerts({
    tasks,
    projects,
    drafts: planDrafts,
    userId,
    role: userProfile?.role,
    orgId: userProfile?.org_id || userProfile?.departmentId,
  });
  const navigationItems = useMemo<ShellNavigationItem[]>(
    () =>
      visibleNavigationItems.map((item) => {
        const content = getSidebarContent(role, item.id);
        const pages = getSectionPages(role, item.id, userProfile?.role);
        const hasAlert = item.id === "projects"
          ? actionAlerts.projects
          : (item.id === "reviews" || item.id === "approvals") && actionAlerts.reviews;
        return {
          ...item,
          group: content.sections[0]?.title || "Workspace",
          pages: pages.length > 0 ? pages : [{ label: item.label }],
          hasAlert,
        };
      }),
    [role, userProfile?.role, visibleNavigationItems, actionAlerts.projects, actionAlerts.reviews],
  );
  const workspaceName = useMemo(() => {
    const orgId = userProfile?.org_id || userProfile?.departmentId;
    return orgs.find((org) => org.id === orgId)?.name || (role === "admin" ? "LGU Ormoc City" : "Organization not assigned");
  }, [orgs, role, userProfile?.departmentId, userProfile?.org_id]);

  useEffect(() => {
    if (activeSection === "settings") return;
    if (visibleNavigationItems.some((item) => item.id === activeSection))
      return;
    const fallback = visibleNavigationItems[0];
    if (fallback)
      selectPage(fallback.id, getInitialPage(fallback.id) || fallback.label);
  }, [activeSection, getInitialPage, selectPage, visibleNavigationItems]);

  const handlePageSelect = useCallback(
    (section: string, page: string) => {
      selectPage(section, page);
      setMobileNavigationOpen(false);
    },
    [selectPage],
  );

  const tourSections = visibleNavigationItems.map((item) => ({
    id: item.id,
    label: item.label,
    page: getInitialPage(item.id) || item.label,
  }));

  return (
    <TaskDepartmentProvider organizations={orgs} defaultDepartmentId={userProfile?.org_id || userProfile?.departmentId}>
    <GuidedTourProvider
      activePage={activePage}
      activeSection={activeSection}
      onNavigate={handlePageSelect}
      role={userProfile?.role || role}
      sections={tourSections}
      userId={user?.id || ""}
    >
      <div className="eflow-app-shell" data-tour-id="application-shell">
        <a className="eflow-skip-link" href="#eflow-active-workspace">
          Skip to workspace
        </a>
        <EflowTopBar
          activePage={activePage}
          activeSection={activeSection}
          onOpenMobileNavigation={() => setMobileNavigationOpen(true)}
          onPageSelect={handlePageSelect}
          role={role}
        />
        <div className="eflow-app-shell__body">
          <div className="eflow-app-shell__desktop-navigation">
            <ProductivitySidebar
              activePage={activePage}
              activeSection={activeSection}
              navigationItems={navigationItems}
              onPageSelect={handlePageSelect}
              workspaceName={workspaceName}
            />
          </div>
          <main
            className="eflow-app-shell__workspace"
            aria-label="Active workspace"
            id="eflow-active-workspace"
            tabIndex={-1}
          >
            <OnboardingWorkspace onNavigate={handlePageSelect} />
            <RoleContent
              activePage={activePage}
              activeSection={activeSection}
              hasLeadingWork={hasLeadingWork}
              role={role}
            />
          </main>
        </div>
      </div>

      <Modal
        className="eflow-mobile-navigation-dialog"
        closeButtonAriaLabel="Close navigation"
        id="eflow-mobile-navigation"
        onClose={() => setMobileNavigationOpen(false)}
        show={isMobileNavigationOpen}
        size="full-view"
      >
        <div className="eflow-mobile-navigation">
          <ProductivitySidebar
            activePage={activePage}
            activeSection={activeSection}
            mobile
            navigationItems={navigationItems}
            onPageSelect={handlePageSelect}
            workspaceName={workspaceName}
          />
        </div>
      </Modal>
    </GuidedTourProvider>
    </TaskDepartmentProvider>
  );
}
