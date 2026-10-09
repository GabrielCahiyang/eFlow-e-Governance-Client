import { focusActivatedButton } from "../../shared/focusActivatedButton";
import { TaskDepartmentProvider } from "../tasks";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  buildShellNavigation,
  getRoleNavigationCandidates,
  getSidebarContent,
  getNavigationPath,
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
import { PersonalWorkspace, WorkspaceScopeContext, WorkspaceSelector, useWorkspaceState, buildWorkspaceNavigation } from '../workspaces';

interface EflowAppShellProps {
  role: string;
}

export function EflowAppShell({ role }: EflowAppShellProps) {
  const { can, user, userProfile } = useAuth();
  const userId = user?.id;
  const officeId = userProfile?.org_id || userProfile?.departmentId || '';
  const operational = ['head','member','accounting_staff'].includes(userProfile?.role || role);
  const workspaceState = useWorkspaceState(userId || '', officeId, operational && userProfile?.is_active !== false);
  const currentWorkspace = workspaceState.snapshot?.workspace;
  const personal = currentWorkspace?.kind === 'personal';
  const officeContext = currentWorkspace?.kind === 'office' && currentWorkspace.office_id !== officeId;
  const { tasks, loading: tasksLoading } = useTasksData(!personal && !workspaceState.loading);
  const { projects, loading: projectsLoading } = useProjectsData(!personal && !workspaceState.loading);
  const officeProjectRevision = projects.map(project=>`${project.id}:${project.status}:${project.title}`).join('|');
  useEffect(()=>{ if(currentWorkspace?.kind==='office') void workspaceState.refresh(); },[officeProjectRevision]);
  const { orgs } = useOrgs();
  const planDrafts = usePendingPlanDrafts(personal ? undefined : userId);
  const [isMobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
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
  const roleNavigationItems = useMemo(
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
  const navigationItems = useMemo(() => buildWorkspaceNavigation(roleNavigationItems,personal,Boolean(officeContext)),[roleNavigationItems,personal,officeContext]);
  const workspaceName = useMemo(() => {
    const orgId = userProfile?.org_id || userProfile?.departmentId;
    return (
      orgs.find((org) => org.id === orgId)?.name ||
      (role === "admin" ? "LGU Ormoc City" : "Organization not assigned")
    );
  }, [orgs, role, userProfile?.departmentId, userProfile?.org_id]);

  const handlePageSelect = useCallback(
    async (section: string, page: string, projectId?: string) => {
      const shortcut = workspaceState.snapshot?.projects.find(project => project.id === projectId && project.shortcut);
      if (shortcut?.home_workspace_id) {
        const accepted=await workspaceState.select(shortcut.home_workspace_id,{pathname:'/projects',page:'Projects',project:shortcut.id,view:'tasks'});
        if(accepted){setMobileNavigationOpen(false);setSearchOpen(false);}return accepted;
      }
      if(officeId && (personal && !['dashboard','projects','personal_work','settings'].includes(section) || officeContext && !['dashboard','projects','personal_work','settings'].includes(section))){
        const accepted=await workspaceState.select(officeId,{pathname:getNavigationPath(section),page});
        if(accepted){setMobileNavigationOpen(false);setSearchOpen(false);}return accepted;
      }
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
    [selectPageAsync, workspaceState.snapshot, workspaceState.select,personal,officeContext,officeId],
  );

  const tourSections = navigationItems.map((item) => ({
    id: item.id,
    label: item.label,
    page: getInitialPage(item.id) || item.label,
  }));
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
    () => ({ closeNavigation }),
    [closeNavigation],
  );
  const sidebarProps = {
    activePage,
    activeSection,
    navigationItems,
    onPageSelect: handlePageSelect,
    workspaceName: currentWorkspace?.name || (workspaceState.error && workspaceState.requested !== officeId ? 'Workspace unavailable' : workspaceName),
    role,
    onSearch: openSearch,
    onHelp: openHelp,
    userId: userId || '',
    workspaceId: currentWorkspace?.id || workspaceState.requested || officeId || 'unassigned',
    projects: workspaceState.snapshot?.projects || (workspaceState.unavailable && !new URLSearchParams(window.location.search).has('workspace') ? projects : []),
    projectsLoading: operational && workspaceState.loading || projectsLoading,
    workspaceKind: currentWorkspace?.kind,
    workspaceSelector: operational ? <WorkspaceSelector name={currentWorkspace?.name || (workspaceState.error && workspaceState.requested !== officeId ? 'Workspace unavailable' : workspaceName)} currentId={currentWorkspace?.id} workspaces={workspaceState.workspaces} recent={workspaceState.recent} userId={userId || ''} ownerName={userProfile?.full_name || 'You'} loading={workspaceState.loading} error={workspaceState.error} available={!workspaceState.unavailable} onSelect={async id=>{const accepted=await workspaceState.select(id);if(accepted){setMobileNavigationOpen(false);setSearchOpen(false);}return accepted;}} onCreated={()=>{setMobileNavigationOpen(false);setSearchOpen(false);}} onRefresh={workspaceState.refresh} /> : undefined,
  };
  const explicitWorkspace = new URLSearchParams(window.location.search).has('workspace');
  const blockedScope = activeSection!=='personal_work'&&operational && (workspaceState.loading || (!currentWorkspace && (explicitWorkspace || Boolean(workspaceState.error && !workspaceState.unavailable))));
  const workspaceScope = currentWorkspace ? { workspace: currentWorkspace, userId: userId || '', officeProjectIds: (workspaceState.snapshot?.projects || []).filter(p=>p.kind==='office').map(p=>p.id), projectIds: (workspaceState.snapshot?.projects || []).filter(p=>!p.shortcut).map(p=>p.id), includeCreatedOfficeProject: workspaceState.includeCreatedOfficeProject } : null;

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
                className="eflow-app-shell__workspace eflow-scroll-region"
                aria-label="Active workspace"
                id="eflow-active-workspace"
                tabIndex={-1}
              >
                <OnboardingWorkspace onNavigate={handlePageSelect} />
                {blockedScope ? <div className="eflow-workspace" role={workspaceState.error ? 'alert' : 'status'}><p>{workspaceState.error || (workspaceState.loading ? 'Loading workspace…' : 'Create or select a workspace to continue.')}</p><button type="button" onClick={()=>void workspaceState.refresh()}>Retry workspace</button></div>
                  : personal && !['dashboard','personal_work','settings','inbox','users','permissions','org_tree','audit','administration','migration'].includes(activeSection) ? <PersonalWorkspace key={`${userId}:${currentWorkspace.id}`} workspace={currentWorkspace} projects={workspaceState.snapshot?.projects || []} userId={userId || ''} ownerName={userProfile?.full_name || 'You'} officeId={officeId} section={activeSection} onOpen={id=>void handlePageSelect('projects','Projects',id)} onRefresh={workspaceState.refresh} />
                  : officeContext && !['dashboard','personal_work','projects','settings'].includes(activeSection) ? <div className="eflow-workspace"><p>Select a project in this shared Office context, or return to your Office to use Office tools.</p><button type="button" onClick={()=>void workspaceState.select(officeId)}>Return to my Office</button></div>
                  : <WorkspaceScopeContext.Provider value={workspaceScope}><RoleContent
                  key={`${userId}:${currentWorkspace?.id || officeId || 'unassigned'}`}
                  activePage={activePage}
                  activeSection={activeSection}
                  hasLeadingWork={hasLeadingWork}
                  leadershipLoading={tasksLoading}
                  role={role}
                  onNavigate={handlePageSelect}
                /></WorkspaceScopeContext.Provider>}
              </main>
            </div>
            {!desktop && (
              <MobileNavigationBar
                items={navigationItems}
                role={role}
                activeSection={activeSection}
                onNavigate={handlePageSelect}
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
                />
              </div>
            </FeatureDialog>
          )}
          {searchOpen && (
            <NavigationSearchDialog
              items={navigationItems}
              projects={sidebarProps.projects}
              loading={sidebarProps.projectsLoading}
              onClose={() => setSearchOpen(false)}
              onSelect={handlePageSelect}
            />
          )}
        </WorkspaceNavigationContext.Provider>
      </GuidedTourProvider>
    </TaskDepartmentProvider>
  );
}
