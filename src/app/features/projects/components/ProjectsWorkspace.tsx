import { ProjectIndex } from './ProjectIndex';
import { isAppointedOfficeHead } from '../../../shared/officeAuthority';
import * as React from "react";
import { useWorkspaceNavigationHost } from '../../../shared/WorkspaceNavigationContext';
import { requestNavigation } from '../../../shared/navigationGuard';
import { writeNavigationLocation } from '../../navigation';
import { NAVIGATION_LOCATION_EVENT, pushNavigationHistory, replaceNavigationHistory } from '../../../shared/navigationHistory';
import { FeedbackState } from '../../../components/ui/FeedbackState';
import { useProjectLocation } from '../hooks/useProjectLocation';
import { readProjectPlanningView, useProjectPlanningLocation } from '../hooks/useProjectPlanningLocation';
import { CitywidePlansOverview } from "./CitywidePlansOverview";
import * as Icons from "lucide-react";
import { Skeleton } from "@vibe/core";
import { CreateWorkPlanDialog, type WorkPlanCreationMode } from "../../proposal-import";
import { useDeptDirectoryEmployees } from "../../members";
import { isTaskLead } from "../../tasks";
import { ProjectTemplatesModal } from "../../work-templates";
import { useNotificationNavigationIntent } from "../../notifications";
import {
  useProjectsData,
  useOrgs,
  useProfiles,
} from "../../../hooks/useSupabaseData";
import { useTasks } from "../../../hooks/useFirebaseData";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../components/ui/Toast";
import { ProjectArchiveDialog } from "./ProjectArchiveDialog";
import { ProjectCompleteDialog } from "./ProjectCompleteDialog";
import { ProjectContextSidebar } from "./ProjectContextSidebar";
import { ProjectWorkspaceActions } from './ProjectWorkspaceActions';
import { TaskDetailDrawer } from "../../task-inspector";
import { ProjectDeleteDialog } from "./ProjectDeleteDialog";
import { ProjectDetail } from "./ProjectDetail";
import type { ProjectCommandTab } from "./project-command/types";
import type { ProjectTool } from "./project-command/ProjectToolsInspector";
import {
  ALL_PROJECT_DEPARTMENTS,
  UNASSIGNED_PROJECT_DEPARTMENT,
  matchesProjectDepartment,
  resolveProjectWorkspaceAccess,
  type ProjectScope,
} from "./model";
import {
  CollaborationDraftList,
  CollaborationDraftWorkspace,
  isActiveCollaborationDraft,
  subscribeToCollaborationDraftChanges,
  useCollaborationDrafts,
} from "../../interdepartment-collaboration";
import {
  archiveProposalProjects,
  markProposalProjectsCompleted,
} from "../services/proposalDeliveryService";
import { notifyProjectListeners } from "../services/projectService";
import "./projectsVibe.css";
import './projectWorkflow.css';
import { CreateProjectDialog } from '../../project-table';
import { useWorkspaceScope } from '../../workspaces';

interface ProjectWorkspaceContext {
  id: string;
  type: "portfolio" | "project" | "proposal";
  title: string;
  projectId?: string;
  draftId?: string;
  initialCollaborationTab?: "overview" | "approvals" | "governance";
}

const PROJECT_WORKSPACE_TITLE: Partial<Record<ProjectCommandTab, string>> = {
  overview: "Overview",
  tasks: "Main table",
  gantt: "Gantt",
  board: "Board",
  dashboard: "Dashboard",
  offices: "Offices",
  timeline: "Timeline",
  calendar: "Calendar",
  delivery: "Tasks",
  plan: "Timeline",
  work: "Tasks",
  team: "Team",
};

export function ProjectsWorkspace({
  scope,
  eyebrow: _eyebrow,
  proposalGrouping: _proposalGrouping = true,
  readOnly = false,
}: {
  scope: ProjectScope;
  eyebrow: string;
  proposalGrouping?: boolean;
  readOnly?: boolean;
}) {
  const { projects: availableProjects, loading: projectsLoading, error: projectsError, retry: retryProjects } = useProjectsData();
  const workspaceScope = useWorkspaceScope();
  const [committedProject, setCommittedProject] = React.useState<import('../services/types').Project>();
  const createdNavigationRef = React.useRef<string | undefined>(undefined);
  const dbProjects = React.useMemo(() => {
    const snapshot = workspaceScope ? availableProjects.filter(project=>workspaceScope.officeProjectIds.includes(project.id)) : availableProjects;
    // Keep the returned creation receipt visible until realtime catches up.
    return committedProject && (!workspaceScope || committedProject.orgId === workspaceScope.workspace.office_id) && !snapshot.some(project=>project.id===committedProject.id) ? [...snapshot, committedProject] : snapshot;
  }, [availableProjects,workspaceScope, committedProject]);
  React.useEffect(() => { if (committedProject && availableProjects.some(project=>project.id===committedProject.id)) setCommittedProject(undefined); }, [availableProjects, committedProject]);
  const { tasks, loading: tasksLoading } = useTasks();
  const { orgs } = useOrgs();
  const { profiles } = useProfiles();
  const { can, user, userProfile } = useAuth();
  const navigationHost = useWorkspaceNavigationHost();
  const { toast } = useToast();
  const { deptEmployees } = useDeptDirectoryEmployees({
    scope: "exact",
    includeCurrentUser: true,
    includeDepartmentHeads: true,
    activeOnly: true,
    excludeAdmins: true,
  });

  const [activeTab, setActiveTab] = React.useState<ProjectWorkspaceContext>({ id: 'portfolio', type: 'portfolio', title: 'All projects' });
  const [projectWorkspaceTab, setProjectWorkspaceTab] = React.useState<ProjectCommandTab>("tasks");
  const [quickProjectOpen, setQuickProjectOpen] = React.useState(false);
  const [requestedProjectTool, setRequestedProjectTool] = React.useState<{ projectId: string; tool: ProjectTool } | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<{ id: string; title: string } | null>(null);
  const [archiveTarget, setArchiveTarget] = React.useState<{ id: string; title: string; isArchived: boolean } | null>(null);
  const [completeTarget, setCompleteTarget] = React.useState<{ id: string; title: string } | null>(null);
  const [completionTaskId, setCompletionTaskId] = React.useState<string | null>(null);
  const [departmentFilter, setDepartmentFilter] = React.useState(ALL_PROJECT_DEPARTMENTS);
  const [contextNotice, setContextNotice] = React.useState('');

  const [workspaceView, setWorkspaceView] = React.useState<
    "portfolio" | "drafts" | "signoff"
  >(readProjectPlanningView);
  const restorePlanningView = React.useCallback((view: 'portfolio' | 'drafts' | 'signoff') => {
    setWorkspaceView(view);
    if (view !== 'portfolio') setActiveTab({id:'portfolio',type:'portfolio',title:'All projects'});
  }, []);
  const openPlanning = useProjectPlanningLocation(restorePlanningView);
  const [creationMode, setCreationMode] = React.useState<WorkPlanCreationMode | null>(null);
  const [templatesOpen, setTemplatesOpen] = React.useState(false);
  const baseAccess = resolveProjectWorkspaceAccess(readOnly, can);
  const access = { ...baseAccess, canCreate: baseAccess.canCreate && isAppointedOfficeHead(userProfile, orgs) && (!workspaceScope || workspaceScope.workspace.office_id === (userProfile?.org_id || userProfile?.departmentId)) };
  const collaboration = useCollaborationDrafts();
  const activeCollaborationDrafts = React.useMemo(
    () => collaboration.drafts.filter(isActiveCollaborationDraft),
    [collaboration.drafts],
  );
  const currentOrgId = userProfile?.org_id || userProfile?.departmentId || "";

  React.useEffect(() => {
    return subscribeToCollaborationDraftChanges(() => {
      void notifyProjectListeners();
    });
  }, []);

  const departmentFilterOptions = React.useMemo(() => {
    if (!scope.includeAllAccessibleWork) return [];
    const organizationIds = new Set<string>();
    dbProjects.forEach((project) => {
      if (project.orgId) organizationIds.add(project.orgId);
    });
    activeCollaborationDrafts.forEach((draft) => {
      if (draft.ownerOrgId) organizationIds.add(draft.ownerOrgId);
    });
    const options = orgs
      .filter((organization) => organizationIds.has(organization.id))
      .map((organization) => ({ value: organization.id, label: organization.name }))
      .sort((left, right) => left.label.localeCompare(right.label));
    organizationIds.forEach((organizationId) => {
      if (!options.some((option) => option.value === organizationId)) {
        options.push({ value: organizationId, label: organizationId });
      }
    });
    if (dbProjects.some((project) => !project.orgId)) {
      options.push({ value: UNASSIGNED_PROJECT_DEPARTMENT, label: "No office assigned" });
    }
    return [{ value: ALL_PROJECT_DEPARTMENTS, label: "All offices" }, ...options];
  }, [activeCollaborationDrafts, dbProjects, orgs, scope.includeAllAccessibleWork]);

  const inScope = React.useMemo(() => {
    if (scope.includeAllAccessibleWork) {
      return dbProjects.filter((project) => matchesProjectDepartment(project.orgId, departmentFilter));
    }
    if (!scope.enforceOrgScope) return dbProjects;
    // RLS includes project contacts and selected inter-Office participants,
    // including new contacts who have no global Office membership yet.
    return dbProjects;
  }, [dbProjects, departmentFilter, scope]);

  const visibleCollaborationDrafts = React.useMemo(
    () => scope.includeAllAccessibleWork
      ? activeCollaborationDrafts.filter((draft) => matchesProjectDepartment(draft.ownerOrgId, departmentFilter))
      : activeCollaborationDrafts,
    [activeCollaborationDrafts, departmentFilter, scope.includeAllAccessibleWork],
  );

  const approvalPortfolioDrafts = React.useMemo(() => collaboration.drafts.filter((draft) => matchesProjectDepartment(draft.ownerOrgId, departmentFilter)), [collaboration.drafts, departmentFilter]);
  // Tab management handlers
  const openProject = React.useCallback(
    (projectId: string, historyMode: 'push' | 'replace' | false = 'replace') => {
      const project = dbProjects.find((p) => p.id === projectId);
      if (!project) return false;
      setContextNotice('');
      const tabId = `project-${projectId}`;
      const title = project?.title || "Project Workspace";
      setActiveTab({ id: tabId, type: 'project', projectId, title });
      setWorkspaceView("portfolio");
      if (historyMode) {
        const params = new URLSearchParams(window.location.search);
        const view = params.get('project') === projectId ? params.get('view') || projectWorkspaceTab : 'tasks';
        writeNavigationLocation('projects', 'Projects', historyMode, { project: projectId, view, parameters: { project: projectId, view } });
      }

      setProjectWorkspaceTab(currentView => activeTab.projectId === projectId ? currentView : 'tasks');
      return true;
    },
    [activeTab.projectId, dbProjects, projectWorkspaceTab],
  );

  const openProposal = React.useCallback(
    (draftId: string, initialCollaborationTab: "overview" | "approvals" | "governance" = "overview", historyMode: 'push' | false = 'push') => {
      const draft = collaboration.drafts.find((d) => d.id === draftId);
      if (!draft) return false;
      setContextNotice('');
      const tabId = `proposal-${draftId}`;
      const title = draft?.title || "Proposal Workspace";
      setActiveTab({id: tabId, type: 'proposal', draftId, title, initialCollaborationTab});
      setWorkspaceView('portfolio');
      if (historyMode) {
        const url = new URL(window.location.href);
        url.pathname = '/projects'; url.searchParams.set('page', 'Projects');
        for (const key of ['project','view','plans','people']) url.searchParams.delete(key);
        url.searchParams.set('proposal', draftId); url.searchParams.set('proposalView', initialCollaborationTab);
        pushNavigationHistory(`${url.pathname}${url.search}${url.hash}`);
      }
      return true;
    },
    [collaboration.drafts],
  );

  const showIndex = React.useCallback(() => { setActiveTab({id:'portfolio',type:'portfolio',title:'All projects'}); }, []);
  const openIndex = React.useCallback(() => {
    setActiveTab({id:'portfolio',type:'portfolio',title:'All projects'}); setWorkspaceView('portfolio');
    writeNavigationLocation('projects', 'Projects', 'push', { parameters: {} });
  }, []);
  const closeTab = React.useCallback((tabId: string) => {
    if (activeTab.id === tabId) openIndex();
  }, [activeTab.id, openIndex]);

  const loading = projectsLoading || tasksLoading;
  useNotificationNavigationIntent(
    (intent) =>
      intent.kind === "project" ||
      intent.kind === "proposal" ||
      intent.kind === "collaboration",
    (intent) => {
      if (loading || projectsError) return false;
      const needsPlan = intent.kind === 'collaboration' && !!intent.proposalId || !intent.projectId && !!intent.proposalId;
      if (needsPlan && collaboration.loading) return false;
      if (needsPlan && collaboration.error) { setContextNotice('Work plans could not load. Open Saved work plans and retry loading.'); return false; }
      if (intent.kind === "collaboration" && intent.proposalId) {
        if (!openProposal(intent.proposalId)) { setContextNotice('This work plan is unavailable or is no longer shared with you.'); return 'unavailable'; }
        return true;
      }
      if (intent.projectId) {
        if (!openProject(intent.projectId, 'push')) { setContextNotice('This project is unavailable in this workspace. Open its home workspace or check your access.'); return 'unavailable'; }
        return true;
      }
      if (intent.proposalId) {
        if (!openProposal(intent.proposalId)) { setContextNotice('This work plan is unavailable or is no longer shared with you.'); return 'unavailable'; }
        return true;
      }
      setContextNotice('This notification does not contain a project or work-plan link.');
      return 'unavailable';
    },
    [dbProjects, loading, projectsError, collaboration.loading, collaboration.error, openProject, openProposal],
  );

  const currentUserId = user?.id || userProfile?.id || userProfile?.uid || "";
  const canManageDepartmentTemplates = [
    "head",
    "head",
    ].includes(userProfile?.role || "");
  const leadingTasks = tasks.filter(
    (task) =>
      isTaskLead(task, currentUserId) &&
      !task.archivedAt &&
      !["for_review", "completed", "cancelled"].includes(task.status),
  );
  const changeDepartmentFilter = React.useCallback((nextDepartmentId: string) => {
    setDepartmentFilter(nextDepartmentId);
    setActiveTab({id:'portfolio',type:'portfolio',title:'All projects'});
    setWorkspaceView("portfolio");
    setProjectWorkspaceTab("tasks");
    writeNavigationLocation('projects', 'Projects', 'push', { parameters: {} });
  }, []);

  const activeProject = activeTab.type === "project" && activeTab.projectId
    ? dbProjects.find((p) => p.id === activeTab.projectId)
    : undefined;
  const unavailableProject = React.useCallback((id?:string) => {
    if(id && createdNavigationRef.current===id)return;
    setContextNotice('That project is no longer in your available content. Select an available project to continue.');
    const url = new URL(window.location.href);
    if (activeProject) { url.searchParams.set('project', activeProject.id); url.searchParams.set('view', projectWorkspaceTab); }
    else { url.searchParams.delete('project'); url.searchParams.delete('view'); }
    replaceNavigationHistory(`${url.pathname}${url.search}${url.hash}`);
  }, [activeProject, projectWorkspaceTab]);
  React.useEffect(()=>{if(dbProjects.some(project=>project.id===createdNavigationRef.current))createdNavigationRef.current=undefined;},[dbProjects]);
  useProjectLocation({ projects: dbProjects, loading: projectsLoading || !!projectsError, activeProjectId: activeProject?.id, onOpen: openProject, onUnavailable: unavailableProject, onIndex: showIndex, workspaceId: workspaceScope?.workspace.id });
  React.useEffect(() => {
    const restore = () => {
      if (collaboration.loading || collaboration.error || window.location.pathname !== '/projects') return;
      const params = new URLSearchParams(window.location.search);
      if (workspaceScope && params.get('workspace') !== workspaceScope.workspace.id) return;
      const id = params.get('proposal');
      if (!id) return;
      const view = params.get('proposalView');
      if (!openProposal(id, view === 'approvals' || view === 'governance' ? view : 'overview', false)) {
        setContextNotice('This work plan is unavailable or is no longer shared with you.');
        const url = new URL(window.location.href);
        url.searchParams.delete('proposal'); url.searchParams.delete('proposalView');
        replaceNavigationHistory(`${url.pathname}${url.search}${url.hash}`);
      }
    };
    restore(); window.addEventListener(NAVIGATION_LOCATION_EVENT, restore);
    return () => window.removeEventListener(NAVIGATION_LOCATION_EVENT, restore);
  }, [collaboration.loading, collaboration.error, openProposal, workspaceScope?.workspace.id]);
  React.useEffect(() => {
    if (projectsLoading || !activeTab.projectId || activeProject) return;
    setActiveTab({id:'portfolio',type:'portfolio',title:'All projects'});
  }, [activeProject, activeTab.projectId, projectsLoading]);

  React.useEffect(() => {
    if (activeTab.type === "project" && activeProject) {
      const workspaceTitle = PROJECT_WORKSPACE_TITLE[projectWorkspaceTab] || "Workspace";
      document.title = `${workspaceTitle} · ${activeProject.title}`;
      return;
    }
    if (activeTab.type === "proposal") {
      const collaborationTitle = activeTab.initialCollaborationTab === "approvals"
        ? "Review & Governance"
        : "Overview";
      document.title = `${collaborationTitle} · ${activeTab.title}`;
      return;
    }
    const planningTitle = workspaceView === "drafts"
      ? "Drafts"
      : workspaceView === "signoff"
        ? "Waiting for approval"
        : "All projects";
    document.title = planningTitle;
  }, [activeProject, activeTab, projectWorkspaceTab, workspaceView]);

  React.useEffect(() => {
    if (requestedProjectTool && requestedProjectTool.projectId === activeProject?.id) {
      setRequestedProjectTool(null);
    }
  }, [activeProject?.id, requestedProjectTool]);

  if (loading)
    return (
      <div
        className="eflow-projects-surface eflow-projects-loading grid min-h-[360px] grid-cols-[minmax(220px,304px)_minmax(0,1fr)] gap-4 p-4"
        aria-live="polite"
        role="status"
      >
        <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4">
          <Skeleton type="text" width={96} />
          <Skeleton type="rectangle" size="custom" height={42} fullWidth />
          <Skeleton type="rectangle" size="custom" height={42} fullWidth />
          <Skeleton type="rectangle" size="custom" height={42} fullWidth />
          <Skeleton type="rectangle" size="custom" height={42} fullWidth />
        </div>
        <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5">
          <Skeleton type="text" width={220} />
          <Skeleton type="text" width={320} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton type="rectangle" size="custom" height={78} fullWidth />
            <Skeleton type="rectangle" size="custom" height={78} fullWidth />
            <Skeleton type="rectangle" size="custom" height={78} fullWidth />
          </div>
          <Skeleton type="rectangle" size="custom" height={240} fullWidth />
        </div>
      </div>
    );

  const projectNavigation = (
      <ProjectContextSidebar
        activeProjectId={workspaceView === "portfolio" ? activeProject?.id : undefined}
        canAdd={access.canCreate}
        onCreateProject={() => { navigationHost?.closeNavigation(); setQuickProjectOpen(true); }}
        onImportProposal={() => { navigationHost?.closeNavigation(); setCreationMode('import'); }}
        userId={currentUserId}
        contextId={workspaceScope?.workspace.id || currentOrgId || 'unassigned'}
        canArchive={access.canArchive}
        canComplete={access.canManage && userProfile?.role === 'head' && userProfile.is_active !== false}
        canDelete={access.canDelete}
        onOpenPortfolio={() => { void requestNavigation(openIndex); }}
        onOpenProject={id => { void requestNavigation(() => { openProject(id, 'push'); navigationHost?.closeNavigation(); }); }}
        onArchiveProject={(id, title) => setArchiveTarget({ id, title, isArchived: false })}
        onCompleteProject={(id, title) => setCompleteTarget({ id, title })}
        onRestoreProject={(id, title) => setArchiveTarget({ id, title, isArchived: true })}
        onDeleteProject={(id, title) => setDeleteTarget({ id, title })}
        projects={inScope}
        departmentFilter={scope.includeAllAccessibleWork ? {
          value: departmentFilter,
          options: departmentFilterOptions,
          onChange: value => { void requestNavigation(() => changeDepartmentFilter(value)); },
        } : undefined}
      />
  );
  return (
    <div className="eflow-ide-workspace">
      {!navigationHost && projectNavigation}
      <div className="eflow-ide-workspace__content" hidden={!!completionTaskId}>
      <ProjectWorkspaceActions onAllProjects={() => { void requestNavigation(openIndex); }} canCreate={access.canCreate} disabledReason={baseAccess.canCreate && !access.canCreate ? workspaceScope && workspaceScope.workspace.office_id !== currentOrgId ? 'Return to your office to create a project.' : 'Only the appointed Office Head can create projects.' : undefined} onCreate={() => setQuickProjectOpen(true)} onWorkPlan={() => setCreationMode('manual')}
        onImport={() => setCreationMode('import')} onTemplates={() => setTemplatesOpen(true)}
        onSavedPlans={() => { void requestNavigation(() => openPlanning('drafts')); }}
        onReviewPlans={() => { void requestNavigation(() => openPlanning('signoff')); }}
        departmentFilter={scope.includeAllAccessibleWork ? { value: departmentFilter, options: departmentFilterOptions, onChange: value => { void requestNavigation(() => changeDepartmentFilter(value)); } } : undefined} />
      {contextNotice && <FeedbackState tone="warning" title="Project unavailable">{contextNotice}<button type="button" onClick={() => setContextNotice('')}>Dismiss</button></FeedbackState>}
      {/* The workspace is intentionally continuous: global rail → project context → page. */}
      <div className="flex-1 min-w-0 bg-white">
        {/* Tab 1: Project Workspace Detail Tab */}
        {activeTab.type === "project" && activeProject && (
          <div className="animate-in fade-in duration-150" key={activeTab.id}>
            <ProjectDetail
              key={`${currentUserId}:${currentOrgId}:${userProfile?.role || ''}:${activeProject.id}`}
              project={activeProject}
              initialTab={projectWorkspaceTab}
              initialTool={requestedProjectTool?.projectId === activeProject.id ? requestedProjectTool.tool : undefined}
              onWorkspaceTabChange={setProjectWorkspaceTab}
              onBack={() => { void requestNavigation(() => closeTab(activeTab.id)); }}
              onDeleted={() => closeTab(activeTab.id)}
              orgs={orgs}
              canManage={access.canManage}
              canArchive={access.canArchive}
              canDelete={access.canDelete}
              canReviewTasks={access.canReviewTasks}
              canExport={access.canExport}
              favoriteContextId={workspaceScope?.workspace.id || currentOrgId || 'unassigned'}
              authorizedProjectIds={inScope.map(project => project.id)}
              lifecycleActions={{
                complete: access.canManage && userProfile?.role === 'head' && userProfile.is_active !== false ? () => setCompleteTarget({ id: activeProject.id, title: activeProject.title }) : undefined,
                archive: access.canArchive ? () => setArchiveTarget({ id: activeProject.id, title: activeProject.title, isArchived: false }) : undefined,
                restore: access.canArchive ? () => setArchiveTarget({ id: activeProject.id, title: activeProject.title, isArchived: true }) : undefined,
                delete: access.canDelete ? () => setDeleteTarget({ id: activeProject.id, title: activeProject.title }) : undefined,
              }}
              onOpenSourceGovernance={(draftId) => openProposal(draftId, "governance")}
            />
          </div>
        )}

        {/* Tab 2: Proposal Workspace Detail Tab */}
        {activeTab.type === "proposal" && activeTab.draftId && (
          <div className="animate-in fade-in duration-150" key={`${activeTab.id}-${activeTab.initialCollaborationTab || "overview"}`}>
            <CollaborationDraftWorkspace
              draftId={activeTab.draftId}
              organizations={orgs}
              profiles={profiles}
              operationalProjects={dbProjects}
              operationalTasks={tasks}
              readOnly={readOnly}
              initialTab={activeTab.initialCollaborationTab}
              onBack={() => closeTab(activeTab.id)}
              onCommitted={() => {
                void collaboration.refresh();
                void notifyProjectListeners();
                closeTab(activeTab.id);
                setWorkspaceView("portfolio");
              }}
              onOpenProject={(projectId) => {
                openProject(projectId);
              }}
              onMarkProjectsCompleted={markProposalProjectsCompleted}
              onArchiveProjects={archiveProposalProjects}
            />
          </div>
        )}

        {/* Tab 3: Plans & Projects Main Landing / Portfolio Tab */}
        {activeTab.type === "portfolio" && (
          <div className="eflow-projects-surface animate-in fade-in duration-150">
            {workspaceView !== "portfolio" && (
              <div className="eflow-project-planning-heading">
                <span className="eflow-project-view-heading__eyebrow"><Icons.FileClock size={14} /> Planning workspace</span>
                <h2>{workspaceView === "drafts" ? "Drafts" : "Waiting for approval"}</h2>
                <p>{workspaceView === "drafts" ? "Draft plans in preparation and collaboration workspaces you own." : "Owned work plans currently waiting on partner decisions."}</p>
              </div>
            )}

            {workspaceView !== "portfolio" ? (
              collaboration.loading ? (
                <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5" aria-live="polite" role="status">
                  <Skeleton type="text" width={190} />
                  <Skeleton type="text" width={280} />
                  <Skeleton type="rectangle" size="custom" height={96} fullWidth />
                  <Skeleton type="rectangle" size="custom" height={96} fullWidth />
                </div>
              ) : collaboration.error ? (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700"
                >
                  {collaboration.error}
                  <button type="button" className="eflow-project-view-trigger" onClick={() => { void collaboration.refresh().catch(() => {}); }}>Retry work plans</button>
                </div>
              ) : (
                <CollaborationDraftList
                  drafts={visibleCollaborationDrafts}
                  organizations={orgs}
                  currentOrgId={currentOrgId}
                  mode={workspaceView === "drafts" ? "owned" : "waiting"}
                  accessibleOrgIds={collaboration.membershipOrgIds}
                  showAll={readOnly && scope.includeAllAccessibleWork}
                  onOpen={(draftId) => openProposal(draftId, workspaceView === "drafts" ? "overview" : "approvals")}
                />
              )
            ) : scope.includeAllAccessibleWork ? (
              <CitywidePlansOverview projects={inScope} drafts={approvalPortfolioDrafts} organizations={orgs} profiles={profiles} onOpenProject={openProject} onOpenPlan={(id) => openProposal(id, "approvals")} />
            ) : (
              projectsError ? <FeedbackState tone="error" title="Projects could not load">{projectsError.message}<button type="button" onClick={retryProjects}>Retry projects</button></FeedbackState> :
              <ProjectIndex projects={inScope} tasks={tasks} organizations={orgs} profiles={profiles}
                onOpen={id => { void requestNavigation(() => openProject(id, 'push')); }}
                onOpenProposal={id => { void requestNavigation(() => openProposal(id)); }}
                onCreate={access.canCreate ? () => setQuickProjectOpen(true) : undefined}/>

            )}
          </div>
        )}
      </div>
      </div>

      {access.canCreate && creationMode && (
        <CreateWorkPlanDialog
          open
          mode={creationMode}
          onModeChange={setCreationMode}
          onClose={() => {
            setCreationMode(null);
            void collaboration.refresh();
            void notifyProjectListeners();
          }}
        />
      )}
      {access.canCreate && quickProjectOpen && <CreateProjectDialog open officeId={currentOrgId} officeName={orgs.find(org=>org.id===currentOrgId)?.name} ownerName={userProfile?.full_name} onClose={()=>setQuickProjectOpen(false)} onCreated={project=>{setCommittedProject(project);createdNavigationRef.current=project.id;workspaceScope?.includeCreatedOfficeProject?.(project);writeNavigationLocation('projects','Projects','push',{project:project.id,view:'tasks',parameters:{project:project.id,view:'tasks',people:'add'}});setActiveTab({id:`project-${project.id}`,type:'project',projectId:project.id,title:project.title});setWorkspaceView('portfolio');setProjectWorkspaceTab('tasks');}}/>}

      {templatesOpen && (
        <ProjectTemplatesModal
          open={templatesOpen}
          onClose={() => setTemplatesOpen(false)}
          orgId={userProfile?.departmentId || userProfile?.org_id || ""}
          currentUserId={currentUserId}
          canManageDepartment={canManageDepartmentTemplates}
          leadingTasks={leadingTasks}
          employees={deptEmployees}
        />
      )}

      {archiveTarget && (
        <ProjectArchiveDialog
          projectId={archiveTarget.id}
          projectTitle={archiveTarget.title}
          isArchived={archiveTarget.isArchived}
          open={Boolean(archiveTarget)}
          onClose={() => setArchiveTarget(null)}
          onSuccess={() => {
            if (!archiveTarget.isArchived) closeTab(`project-${archiveTarget.id}`);
            setArchiveTarget(null);
            toast(archiveTarget.isArchived ? "Project restored." : "Project archived. History remains available.", "success");
          }}
        />
      )}

      {completeTarget && <ProjectCompleteDialog
        key={completeTarget.id}
        projectId={completeTarget.id}
        projectTitle={completeTarget.title}
        project={inScope.find(project=>project.id===completeTarget.id)}
        onClose={() => setCompleteTarget(null)}
        onSuccess={() => { setCompleteTarget(null); toast("Project completed. You can now archive it from the project dropdown.", "success"); }}
        onOpenTask={(taskId) => {
          if (!tasks.some((task) => task.id === taskId)) {
            toast("This task is not in your current task list. Use the location shown on the blocker to review its record.", "error");
            return;
          }
          setCompleteTarget(null); setCompletionTaskId(taskId);
        }}
        onOpenGovernance={(draftId) => { setCompleteTarget(null); openProposal(draftId, "governance"); }}
        onResolve={view=>{const id=completeTarget.id;setCompleteTarget(null);openProject(id,false);setProjectWorkspaceTab(view);writeNavigationLocation('projects','Projects','push',{project:id,view});}}
      />}
      {completionTaskId && <TaskDetailDrawer presentation="page" taskId={completionTaskId} task={tasks.find((task) => task.id === completionTaskId) || null} origin={{view:'project',restoreFocus:()=>document.querySelector<HTMLElement>('[aria-selected="true"][role="tab"]')?.focus()}} onClose={() => setCompletionTaskId(null)} canReview={access.canReviewTasks} />}

      {deleteTarget && (
        <ProjectDeleteDialog
          projectId={deleteTarget.id}
          projectTitle={deleteTarget.title}
          open={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            closeTab(`project-${deleteTarget.id}`);
            setDeleteTarget(null);
          }}
        />
      )}
    </div>
  );
}
