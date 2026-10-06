import { focusActivatedButton } from "../../shared/focusActivatedButton";
import { TaskDepartmentProvider } from "../tasks";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  buildShellNavigation,
  getDefaultSection,
  getRoleNavigationCandidates,
  getSidebarContent,
  RoleContent,
  useRoleNavigationState,
} from "../navigation";
import { FeatureDialog } from "../../components/ui/FeatureDialog";
import { WorkspaceNavigationContext } from "../../shared/WorkspaceNavigationContext";
import { useMediaQuery } from "../../shared/useMediaQuery";
import { NavigationDiscardDialog } from "./components/NavigationDiscardDialog";
import { NavigationSearchDialog } from "./components/NavigationSearchDialog";
import { MobileNavigationBar } from "./components/MobileNavigationBar";
import { GuidedTourProvider } from "../guided-tours";
import {
  useOrgs,
  useProjectsData,
  useTasksData,
} from "../../hooks/useSupabaseData";
import { isTaskLead } from "../../services/taskSelectors";
import { EflowTopBar } from "./components/EflowTopBar";
import { ProductivitySidebar } from "./components/ProductivitySidebar";
import "./eflowAppShell.css";
import "./navigationV2.css";
import { getNavigationActionAlerts } from "./navigationActionAlerts";
import { usePendingPlanDrafts } from "./usePendingPlanDrafts";
import { OnboardingWorkspace } from "../onboarding";

interface EflowAppShellProps {
  role: string;
}

export function EflowAppShell({ role }: EflowAppShellProps) {
  const { can, user, userProfile } = useAuth();
  const { tasks, loading: tasksLoading } = useTasksData();
  const { projects, loading: projectsLoading } = useProjectsData();
  const { orgs } = useOrgs();
  const userId = user?.id;
  const planDrafts = usePendingPlanDrafts(userId);
  const [isMobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [projectHost, setProjectHost] = useState<HTMLDivElement | null>(null);
  const desktop = useMediaQuery("(min-width: 1024px)");
  const getInitialPage = useCallback(
    (section: string) => {
      const content = getSidebarContent(role, section);
      return content.sections[0]?.items[0]?.label;
    },
    [role],
  );
  const { activePage, activeSection, selectPageAsync } = useRoleNavigationState(
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
  const actionAlerts = getNavigationActionAlerts({
    tasks,
    projects,
    drafts: planDrafts,
    userId,
    role: userProfile?.role,
    orgId: userProfile?.org_id || userProfile?.departmentId,
  });
  const navigationItems = useMemo(
    () =>
      buildShellNavigation({
        role,
        persistedRole: userProfile?.role,
        can,
        hasLeadingWork,
        alerts: actionAlerts,
      }),
    [
      role,
      userProfile?.role,
      can,
      hasLeadingWork,
      actionAlerts.projects,
      actionAlerts.reviews,
    ],
  );
  const workspaceName = useMemo(() => {
    const orgId = userProfile?.org_id || userProfile?.departmentId;
    return (
      orgs.find((org) => org.id === orgId)?.name ||
      (role === "admin" ? "LGU Ormoc City" : "Organization not assigned")
    );
  }, [orgs, role, userProfile?.departmentId, userProfile?.org_id]);

  const handlePageSelect = useCallback(
    async (section: string, page: string, projectId?: string) => {
      const accepted = await selectPageAsync(
        section,
        page,
        projectId ? { project: projectId, view: "tasks" } : undefined,
      );
      if (accepted !== false) {
        setMobileNavigationOpen(false);
        setSearchOpen(false);
      }
      return accepted;
    },
    [selectPageAsync],
  );

  const tourSections = navigationItems.map((item) => ({
    id: item.id,
    label: item.label,
    page: getInitialPage(item.id) || item.label,
  }));
  const onHome = () => {
    const section = getDefaultSection(role);
    const item =
      navigationItems.find((item) => item.id === section) || navigationItems[0];
    if (item) void handlePageSelect(item.id, item.pages[0].label);
  };
  const openSearch = () => {
    setMobileNavigationOpen(false);
    setSearchOpen(true);
  };
  const openHelp = () => {
    setMobileNavigationOpen(false);
    document
      .querySelector<HTMLButtonElement>(
        '[data-tour-id="system-walkthrough"] button',
      )
      ?.click();
  };
  const closeNavigation = useCallback(() => setMobileNavigationOpen(false), []);
  const workspaceHost = useMemo(
    () => ({ projectHost, closeNavigation }),
    [projectHost, closeNavigation],
  );
  const sidebarProps = {
    activePage,
    activeSection,
    navigationItems,
    onPageSelect: handlePageSelect,
    workspaceName,
    role,
    onHome,
    onSearch: openSearch,
    onHelp: openHelp,
    setProjectHost,
  };

  return (
    <TaskDepartmentProvider
      organizations={orgs}
      defaultDepartmentId={userProfile?.org_id || userProfile?.departmentId}
    >
      <GuidedTourProvider
        activePage={activePage}
        activeSection={activeSection}
        onNavigate={handlePageSelect}
        role={userProfile?.role || role}
        sections={tourSections}
        userId={user?.id || ""}
      >
        <WorkspaceNavigationContext.Provider value={workspaceHost}>
          <NavigationDiscardDialog />
          <div
            className="eflow-app-shell"
            data-tour-id="application-shell"
            onClickCapture={(event) => focusActivatedButton(event.target)}
          >
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
              {desktop && (
                <div className="eflow-app-shell__desktop-navigation">
                  <ProductivitySidebar {...sidebarProps} />
                </div>
              )}
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
                  leadershipLoading={tasksLoading}
                  role={role}
                  onNavigate={handlePageSelect}
                />
              </main>
            </div>
            {!desktop && (
              <MobileNavigationBar
                items={navigationItems}
                role={role}
                activeSection={activeSection}
                onNavigate={handlePageSelect}
                onHome={onHome}
                onMore={() => setMobileNavigationOpen(true)}
              />
            )}
          </div>

          {isMobileNavigationOpen && (
            <FeatureDialog
              title="Navigation"
              onClose={closeNavigation}
              contentClassName="eflow-mobile-navigation-dialog"
            >
              <div className="eflow-mobile-navigation">
                <ProductivitySidebar
                  {...sidebarProps}
                  mobile
                  setProjectHost={!desktop ? setProjectHost : undefined}
                />
              </div>
            </FeatureDialog>
          )}
          {searchOpen && (
            <NavigationSearchDialog
              items={navigationItems}
              projects={projects}
              loading={projectsLoading}
              onClose={() => setSearchOpen(false)}
              onSelect={handlePageSelect}
            />
          )}
        </WorkspaceNavigationContext.Provider>
      </GuidedTourProvider>
    </TaskDepartmentProvider>
  );
}
