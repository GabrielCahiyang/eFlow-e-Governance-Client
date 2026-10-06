import * as React from "react";
import { createPortal } from 'react-dom';
import { useWorkspaceNavigationHost } from '../../../shared/WorkspaceNavigationContext';
import { requestNavigation } from '../../../shared/navigationGuard';
import { writeNavigationLocation } from '../../navigation';
import { replaceNavigationHistory } from '../../../shared/navigationHistory';
import { FeedbackState } from '../../../components/ui/FeedbackState';
import { useProjectLocation } from '../hooks/useProjectLocation';
import { CitywidePlansOverview } from "./CitywidePlansOverview";
import * as Icons from "lucide-react";
import { Skeleton } from "@vibe/core";
import { SplitActionButton } from "../../../components/ui/workspace";
import { CreateWorkPlanDialog, type WorkPlanCreationMode } from "../../proposal-import";
import { useDeptDirectoryEmployees } from "../../members";
import { isTaskLead } from "../../tasks";
import { ProjectTemplatesModal } from "../../work-templates";
import { useNotificationNavigationIntent } from "../../notifications";
import { fetchProjectMembers } from "../services/projectMemberService";
import type { ProjectMember } from "../services/types";
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
import { buildProjectPortfolioSummary } from "../selectors/projectCommandSelectors";
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
import { CreateProjectDialog } from '../../project-table';

export interface WorkspaceEditorTab {
  id: string;
  type: "portfolio" | "project" | "proposal";
  title: string;
  projectId?: string;
  draftId?: string;
  initialCollaborationTab?: "overview" | "approvals" | "governance";
  pinned?: boolean;
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
  const { projects: dbProjects, loading: projectsLoading } = useProjectsData();
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

  // IDE-like Tabs state
  const [tabs, setTabs] = React.useState<WorkspaceEditorTab[]>([
    {
      id: "portfolio",
      type: "portfolio",
      title: "Plans & Projects",
      pinned: true,
    },
  ]);
  const [activeTabId, setActiveTabId] = React.useState<string>("portfolio");
  const [projectWorkspaceTab, setProjectWorkspaceTab] = React.useState<ProjectCommandTab>("tasks");
  const [quickProjectOpen, setQuickProjectOpen] = React.useState(false);
  const [requestedProjectTool, setRequestedProjectTool] = React.useState<{ projectId: string; tool: ProjectTool } | null>(null);
  const [contextProjectMembers, setContextProjectMembers] = React.useState<ProjectMember[]>([]);
  const [deleteTarget, setDeleteTarget] = React.useState<{ id: string; title: string } | null>(null);
  const [archiveTarget, setArchiveTarget] = React.useState<{ id: string; title: string; isArchived: boolean } | null>(null);
  const [completeTarget, setCompleteTarget] = React.useState<{ id: string; title: string } | null>(null);
  const [completionTaskId, setCompletionTaskId] = React.useState<string | null>(null);
  const [departmentFilter, setDepartmentFilter] = React.useState(ALL_PROJECT_DEPARTMENTS);
  const [contextNotice, setContextNotice] = React.useState('');

  const [workspaceView, setWorkspaceView] = React.useState<
    "portfolio" | "drafts" | "signoff"
  >("portfolio");
  const [creationMode, setCreationMode] = React.useState<WorkPlanCreationMode | null>(null);
  const [templatesOpen, setTemplatesOpen] = React.useState(false);
  const access = resolveProjectWorkspaceAccess(readOnly, can);
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
  const active = React.useMemo(
    () => inScope.filter((p) => p.status !== "archived"),
    [inScope],
  );

  const summaries = React.useMemo(() => {
    const map = new Map();
    for (const project of inScope) {
      map.set(project.id, buildProjectPortfolioSummary(project, tasks));
    }
    return map;
  }, [inScope, tasks]);

  // Tab management handlers
  const openProject = React.useCallback(
    (projectId: string, historyMode: 'push' | 'replace' | false = 'replace') => {
      const project = dbProjects.find((p) => p.id === projectId);
      if (!project) return;
      const tabId = `project-${projectId}`;
      const title = project?.title || "Project Workspace";
      setTabs((current) => {
        if (current.some((t) => t.id === tabId)) return current;
        return [...current, { id: tabId, type: "project", projectId, title }];
      });
      setActiveTabId(tabId);
      setWorkspaceView("portfolio");
      if (historyMode) {
        const params = new URLSearchParams(window.location.search);
        const view = params.get('project') === projectId ? params.get('view') || projectWorkspaceTab : 'tasks';
        writeNavigationLocation('projects', 'Projects', historyMode, { project: projectId, view });
      }

      setProjectWorkspaceTab((currentView) => {
        const current = tabs.find((tab) => tab.id === activeTabId);
        return current?.type === "project" ? currentView : "tasks";
      });
    },
    [activeTabId, dbProjects, tabs, projectWorkspaceTab],
  );

  const openProposal = React.useCallback(
    (draftId: string, initialCollaborationTab: "overview" | "approvals" | "governance" = "overview") => {
      const draft = collaboration.drafts.find((d) => d.id === draftId);
      const tabId = `proposal-${draftId}`;
      const title = draft?.title || "Proposal Workspace";
      setTabs((current) => {
        if (current.some((t) => t.id === tabId)) return current.map((tab) => tab.id === tabId ? { ...tab, initialCollaborationTab } : tab);
        return [...current, { id: tabId, type: "proposal", draftId, title, initialCollaborationTab }];
      });
      setActiveTabId(tabId);
    },
    [collaboration.drafts],
  );

  const closeTab = React.useCallback(
    (tabId: string) => {
      setTabs((current) => {
        const next = current.filter((t) => t.id !== tabId);
        if (activeTabId === tabId) {
          const closedIndex = current.findIndex((t) => t.id === tabId);
          const nextActive = next[Math.max(0, closedIndex - 1)] || next[0];
          if (nextActive) {
            setActiveTabId(nextActive.id);
            const url = new URL(window.location.href);
            if (nextActive.projectId) url.searchParams.set('project', nextActive.projectId);
            else { url.searchParams.delete('project'); url.searchParams.delete('view'); }
            replaceNavigationHistory(`${url.pathname}${url.search}${url.hash}`);
          }
        }
        return next;
      });
    },
    [activeTabId],
  );

  const loading = projectsLoading || tasksLoading;
  useNotificationNavigationIntent(
    (intent) =>
      intent.kind === "project" ||
      intent.kind === "proposal" ||
      intent.kind === "collaboration",
    (intent) => {
      if (loading) return false;
      if (intent.kind === "collaboration" && intent.proposalId) {
        openProposal(intent.proposalId);
        return true;
      }
      if (intent.projectId) {
        openProject(intent.projectId);
        return true;
      }
      if (intent.proposalId) {
        openProposal(intent.proposalId);
        return true;
      }
      return true;
    },
    [dbProjects, loading, openProject, openProposal],
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
  const planningCounts = React.useMemo(() => {
    const owned = visibleCollaborationDrafts.filter((draft) => readOnly || draft.ownerOrgId === currentOrgId);
    return {
      workplans: owned.length,
      signoff: owned.filter((draft) => draft.status === "in_review").length,
      actionable: readOnly ? 0 : owned.filter((draft) => draft.status === "ready_to_commit" || draft.status === "changes_requested").length,
    };
  }, [currentOrgId, readOnly, visibleCollaborationDrafts]);

  const changeDepartmentFilter = React.useCallback((nextDepartmentId: string) => {
    setDepartmentFilter(nextDepartmentId);
    setTabs((current) => current.filter((tab) => tab.pinned));
    setActiveTabId("portfolio");
    setWorkspaceView("portfolio");
    setProjectWorkspaceTab("tasks");
    hasAutoOpenedRef.current = false;
  }, []);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const activeProject = activeTab.type === "project" && activeTab.projectId
    ? dbProjects.find((p) => p.id === activeTab.projectId)
    : undefined;
  const unavailableProject = React.useCallback(() => {
    setContextNotice('That project is no longer in your available content. Select an available project to continue.');
    const url = new URL(window.location.href);
    if (activeProject) { url.searchParams.set('project', activeProject.id); url.searchParams.set('view', projectWorkspaceTab); }
    else { url.searchParams.delete('project'); url.searchParams.delete('view'); }
    replaceNavigationHistory(`${url.pathname}${url.search}${url.hash}`);
  }, [activeProject, projectWorkspaceTab]);
  useProjectLocation({ projects: dbProjects, loading: projectsLoading, activeProjectId: activeProject?.id, onOpen: openProject, onUnavailable: unavailableProject });
  React.useEffect(() => {
    if (projectsLoading || !activeTab.projectId || activeProject) return;
    setTabs(current => current.filter(tab => tab.projectId !== activeTab.projectId));
    setActiveTabId('portfolio');
  }, [activeProject, activeTab.projectId, projectsLoading]);

  // Reactively open the first project on initial mount if workspace starts at default portfolio
  const hasAutoOpenedRef = React.useRef(false);
  React.useEffect(() => {
    if (!scope.includeAllAccessibleWork && !hasAutoOpenedRef.current && active.length > 0 && activeTabId === "portfolio" && workspaceView === "portfolio") {
      hasAutoOpenedRef.current = true;
      const requestedId = new URLSearchParams(window.location.search).get('project');
      openProject(active.find(p=>p.id===requestedId)?.id || active[0].id);
    }
  }, [active, activeTabId, openProject, workspaceView, scope.includeAllAccessibleWork]);

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
        : "Plans & Projects";
    document.title = planningTitle;
  }, [activeProject, activeTab, projectWorkspaceTab, workspaceView]);

  React.useEffect(() => {
    if (requestedProjectTool && requestedProjectTool.projectId === activeProject?.id) {
      setRequestedProjectTool(null);
    }
  }, [activeProject?.id, requestedProjectTool]);

  React.useEffect(() => {
    let cancelled = false;
    if (!activeProject?.id) {
      setContextProjectMembers([]);
      return;
    }
    void fetchProjectMembers(activeProject.id)
      .then((members) => {
        if (!cancelled) setContextProjectMembers(members);
      })
      .catch(() => {
        if (!cancelled) setContextProjectMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeProject?.id]);

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
        contextId={currentOrgId || 'unassigned'}
        canArchive={access.canArchive}
        canComplete={access.canManage}
        canDelete={access.canDelete}
        onOpenPortfolio={() => { void requestNavigation(() => {
          if (!scope.includeAllAccessibleWork && active[0]) {
            openProject(active[0].id);
          } else {
            setActiveTabId("portfolio");
            setWorkspaceView("portfolio");
          }
        }); }}
        onOpenProject={id => { void requestNavigation(() => { openProject(id, 'push'); navigationHost?.closeNavigation(); }); }}
        onArchiveProject={(id, title) => setArchiveTarget({ id, title, isArchived: false })}
        onCompleteProject={(id, title) => setCompleteTarget({ id, title })}
        onRestoreProject={(id, title) => setArchiveTarget({ id, title, isArchived: true })}
        onDeleteProject={(id, title) => setDeleteTarget({ id, title })}
        profiles={profiles}
        projects={inScope}
        summaries={summaries}
        tasks={tasks}
        projectMembers={contextProjectMembers}
        planningCounts={planningCounts}
        planningView={workspaceView}
        onOpenPlanning={(view) => {
          void requestNavigation(() => { setActiveTabId('portfolio'); setWorkspaceView(view); navigationHost?.closeNavigation(); });
        }}
        departmentFilter={scope.includeAllAccessibleWork ? {
          value: departmentFilter,
          options: departmentFilterOptions,
          onChange: value => { void requestNavigation(() => changeDepartmentFilter(value)); },
        } : undefined}
      />
  );
  return (
    <div className="eflow-ide-workspace">
      {navigationHost ? navigationHost.projectHost && createPortal(projectNavigation, navigationHost.projectHost) : projectNavigation}
      <div className="eflow-ide-workspace__content">
      {contextNotice && <FeedbackState tone="warning" title="Project unavailable">{contextNotice}<button type="button" onClick={() => setContextNotice('')}>Dismiss</button></FeedbackState>}
      {/* The workspace is intentionally continuous: global rail → project context → page. */}
      <div className="flex-1 min-w-0 bg-white">
        {/* Tab 1: Project Workspace Detail Tab */}
        {activeTab.type === "project" && activeProject && (
          <div className="animate-in fade-in duration-150" key={activeTab.id}>
            <ProjectDetail
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
              favoriteContextId={currentOrgId || 'unassigned'}
              authorizedProjectIds={inScope.map(project => project.id)}
              lifecycleActions={{
                complete: access.canManage ? () => setCompleteTarget({ id: activeProject.id, title: activeProject.title }) : undefined,
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
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 mb-4 shadow-sm">
                  <Icons.Boxes size={32} />
                </div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-1">{readOnly ? "Select a project" : "Let’s start working together"}</h3>
                <p className="text-sm text-neutral-500 max-w-sm mb-6">
                  {readOnly ? "Select a project from the left sidebar to view its tasks and approval history." : "Select a project from the left sidebar to open its workspace, or create a new plan to get started."}
                </p>
                {access.canCreate && (
                  <SplitActionButton
                    label="Create project"
                    onClick={() => setQuickProjectOpen(true)}
                    actions={[{id:'workplan',label:'Create a work plan',onSelect:()=>setCreationMode('manual')},{id:'import',label:'Import proposal',onSelect:()=>setCreationMode('import')},{id: "templates", label: "Use a project template", onSelect: () => setTemplatesOpen(true)}]}
                  />
                )}
              </div>
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
      {access.canCreate && quickProjectOpen && <CreateProjectDialog open officeId={currentOrgId} onClose={()=>setQuickProjectOpen(false)} onCreated={project=>{writeNavigationLocation('projects','Projects','push',{project:project.id,view:'tasks'});setTabs(current=>[...current.filter(t=>t.id!==`project-${project.id}`),{id:`project-${project.id}`,type:'project',projectId:project.id,title:project.title}]);setActiveTabId(`project-${project.id}`);setWorkspaceView('portfolio');setProjectWorkspaceTab('tasks');hasAutoOpenedRef.current=true;}}/>}

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
      />}
      {completionTaskId && <TaskDetailDrawer task={tasks.find((task) => task.id === completionTaskId) || null} onClose={() => setCompletionTaskId(null)} canReview={access.canReviewTasks} />}

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
