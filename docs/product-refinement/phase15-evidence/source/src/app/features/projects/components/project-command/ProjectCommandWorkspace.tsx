import { useMemo, useState, useEffect } from "react";
import { hasDirtyNavigation, requestNavigation } from '../../../../shared/navigationGuard';
import { NAVIGATION_LOCATION_EVENT, pushNavigationHistory } from '../../../../shared/navigationHistory';
import { Skeleton } from "@vibe/core";
import type { Organization } from "../../../../types";
import { useProfiles } from "../../../../hooks/useSupabaseData";
import { useTasks } from "../../../../hooks/useFirebaseData";
import { TaskDetailDrawer, useTaskInspector } from "../../../task-inspector";
import { tasksForProject } from "../../../../services/taskSelectors";
import type { Project } from "../../services/projectService";
import { useProjectCommandData } from "../../hooks/useProjectCommandData";
import { ProjectHeader } from "./ProjectHeader";
import { ProjectParticipants } from "./ProjectParticipants";
import { ProjectUtilities, type ProjectLifecycleActions } from "./ProjectUtilities";
import { ProjectOverviewTab } from "./ProjectOverviewTab";
import { ProjectWorkTab } from "./ProjectWorkTab";
import { ProjectTimelineView } from "./ProjectTimelineView";
import { ProjectCalendarView } from "./ProjectCalendarView";
import { ProjectTeamTab } from "./ProjectTeamTab";
import { ProjectReportsTab } from "./ProjectReportsTab";
import { ProjectReviewsTab } from "./ProjectReviewsTab";
import { ProjectActivityTab } from "./ProjectActivityTab";
import { ProjectDashboardTab } from "./ProjectDashboardTab";
import { ProjectProposalContextTab } from "./ProjectProposalContextTab";
import { ProjectGovernanceTab } from "./ProjectGovernanceTab";
import { ProjectBudgetTab } from "./ProjectBudgetTab";
import { ProjectViewTabBar } from "./ProjectViewTabBar";
import { resolveProjectView } from "./projectViewCatalog";
import type { ProjectCommandTab } from "./types";
import "../projectsVibe.css";
import { ProjectTableWorkspace } from '../../../project-table';
import { updateProject } from '../../services/projectMutationService';
import { useAuth } from '../../../../contexts/AuthContext';
import { ProjectViewFilters, ProjectGanttView, ProjectOfficesView, ProjectInsightsView, useProjectViewPreferences, filterProjectViewTasks } from '../../../project-views';
import { scopeProjectViewData } from '../../selectors/projectViewContext';
import { ProjectOfficeContext, ProjectOfficePanel, useProjectOffices, canStaffProjectOffice } from '../../../project-offices';
import { ProjectReadinessPanel, ProjectReadinessSummary, ProjectReadinessSummaryProvider } from '../../../project-readiness';

export interface ProjectCommandWorkspaceProps {
  project: Project;
  initialTab?: ProjectCommandTab;
  initialTool?: "reviews" | "activity" | "reports";
  onWorkspaceTabChange?: (tab: ProjectCommandTab) => void;
  onBack: () => void;
  orgs: Organization[];
  canArchive: boolean;
  canManage: boolean;
  canDelete: boolean;
  onDeleted: () => void;
  canReviewTasks: boolean;
  canExport?: boolean;
  onOpenSourceGovernance?: (draftId: string) => void;
  lifecycleActions?: ProjectLifecycleActions;
  favoriteContextId?: string;
  authorizedProjectIds?: string[];
}


export function ProjectCommandWorkspace({
  project,
  initialTab = "tasks",
  initialTool,
  onWorkspaceTabChange,
  onBack: _onBack,
  orgs,
  canArchive: _canArchive,
  canManage: requestedManage,
  canDelete: _canDelete,
  canReviewTasks,
  canExport = true,
  onOpenSourceGovernance: _onOpenSourceGovernance,
  lifecycleActions = {}, favoriteContextId = "unassigned", authorizedProjectIds = [],
}: ProjectCommandWorkspaceProps) {
  const { tasks } = useTasks();
  const { profiles } = useProfiles();
  const { userProfile } = useAuth();
  const officeState = useProjectOffices(project.id);
  const canManage = requestedManage && (project.sourceCollaborationDraftId ? true : userProfile?.role === 'head' && userProfile.org_id === project.orgId);
  const shared = officeState.offices.some(o => o.relationship_type !== 'lead');
  const ownOffice = officeState.offices.find(o => o.office_id === userProfile?.org_id);
  const ownWorkAccess = !officeState.error && (!shared || ownOffice?.invitation_status === 'joined' && ownOffice.relationship_type !== 'observer' && (ownOffice.relationship_type === 'lead' || canStaffProjectOffice(ownOffice, userProfile, orgs) || officeState.members.some(m => m.project_office_id === ownOffice.id && m.user_id === userProfile?.id)));
  const [tab, setTabState] = useState<ProjectCommandTab>(() => resolveProjectView(typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("view") : null) || initialTool || initialTab);
  const inspector = useTaskInspector(project.id + ':' + (userProfile?.id || ''));
  const openTaskId = inspector.taskId;
  const setOpenTaskId = (id: string) => inspector.openTask(id, { view: tab, restoreFocus: () => {
    const target = document.querySelector<HTMLElement>(`[data-task-inspector-source="${CSS.escape(id)}"]`) || document.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    target?.focus();
  } });
  const { filters, setFilters } = useProjectViewPreferences(userProfile?.id || '', project.id);

  useEffect(() => {
    if (initialTool) {
      setTabState(initialTool);
    }
  }, [initialTool]);

  useEffect(() => {
    const onPopState = () => {
      if (hasDirtyNavigation()) return;
      const next = resolveProjectView(new URLSearchParams(window.location.search).get("view"));
      const projectId = new URLSearchParams(window.location.search).get("project");
      if (next && (!projectId || projectId === project.id)) setTabState(next);
    };
    window.addEventListener("popstate", onPopState);
    window.addEventListener(NAVIGATION_LOCATION_EVENT, onPopState);
    return () => { window.removeEventListener("popstate", onPopState); window.removeEventListener(NAVIGATION_LOCATION_EVENT, onPopState); };
  }, [project.id]);

  const projectTasks = useMemo(
    () => tasksForProject(tasks, project.id),
    [project.id, tasks],
  );
  const data = useProjectCommandData(project, projectTasks);
  const visibleTasks = useMemo(() => filterProjectViewTasks(projectTasks, filters), [projectTasks, filters]);
  const viewData = useMemo(() => scopeProjectViewData(data, visibleTasks), [data, visibleTasks]);
  const openTask = projectTasks.find((task) => task.id === openTaskId) || null;

  const activeTabId = resolveProjectView(tab) || 'tasks';

  const selectTab = (nextTab: ProjectCommandTab, office?: string) => { void requestNavigation(() => {
    if (office !== undefined) setFilters({ ...filters, office });
    setTabState(nextTab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.pathname = "/projects";
      url.searchParams.set("page", "Projects");
      url.searchParams.set("project", project.id);
      url.searchParams.set("view", nextTab);
      pushNavigationHistory(`${url.pathname}?${url.searchParams.toString()}`);
    }
    onWorkspaceTabChange?.(nextTab);
  }); };

  const hasBudgetData = Boolean(
    data.financial &&
      data.financial.summary &&
      data.financial.summary.approvedAmount > 0,
  );

  return (
    <ProjectOfficeContext.Provider value={officeState}><ProjectReadinessSummaryProvider projectId={project.id} refreshKey={`${project.updatedAt}:${project.status}:${projectTasks.map(task => `${task.id}:${task.updatedAt}`).join(',')}:${JSON.stringify(officeState.offices)}`}><div className="eflow-project-command space-y-4 font-sans">
      <ProjectHeader project={project} organizations={orgs} profiles={profiles} metrics={data.metrics} editable={canManage} onTitleChange={title => updateProject(project.id, { title })}
        participants={<ProjectParticipants offices={officeState} profiles={profiles} contributorIds={[project.ownerId || '', ...data.members.map(member => member.userId), ...officeState.members.map(member => member.user_id), ...projectTasks.flatMap(task => [task.assigneeId || '', ...(task.teamMemberIds || [])])]} />}
        utilities={<ProjectUtilities project={project} canManage={canManage} lifecycle={canManage ? lifecycleActions : {}} userId={authorizedProjectIds.length ? userProfile?.id || '' : ''} contextId={favoriteContextId} authorizedProjectIds={authorizedProjectIds} view={activeTabId} onOpenOffices={() => selectTab('offices')} />}
        readinessSummary={<ProjectReadinessSummary />} onOffices={() => selectTab('offices')} onReadiness={() => selectTab('readiness')} />
      {/* Extensible Workspace Tab Bar (Permanent core views + optional dynamic views) */}
      <ProjectViewTabBar
        projectId={project.id}
        activeTab={activeTabId}
        onSelectTab={selectTab}
        hasProposalContext={Boolean(project.sourceCollaborationDraftId)}
        hasBudgetData={hasBudgetData}
      />
      {['tasks', 'gantt', 'board', 'timeline', 'calendar', 'dashboard', 'offices'].includes(activeTabId) && <ProjectViewFilters value={filters} onChange={setFilters} profiles={profiles.filter(p => projectTasks.some(t => t.assigneeId === p.id) || p.org_id === project.orgId)} offices={orgs.filter(o => projectTasks.some(t => t.orgId === o.id) || o.id === project.orgId)} count={visibleTasks.length}/>}


      {/* Main Workspace Canvas Body */}
      {data.loading ? (
        <div
          className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5"
          aria-live="polite"
          role="status"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 space-y-2">
              <Skeleton type="text" width={230} />
              <Skeleton type="text" width={320} />
            </div>
            <Skeleton type="rectangle" size="custom" width={120} height={32} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton type="rectangle" size="custom" height={82} fullWidth />
            <Skeleton type="rectangle" size="custom" height={82} fullWidth />
            <Skeleton type="rectangle" size="custom" height={82} fullWidth />
          </div>
          <Skeleton type="rectangle" size="custom" height={260} fullWidth />
        </div>
      ) : data.error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700"
        >
          <p>{data.error}</p><button type="button" className="eflow-project-view-trigger" onClick={data.retryWorkflowFacts}>Retry workflow data</button>
        </div>
      ) : (
        <div className="pt-1">
          {activeTabId === "readiness" && <ProjectReadinessPanel project={project} canManage={canManage} onOpenTask={setOpenTaskId} onOpenOffices={()=>selectTab('offices')} onResolve={view=>selectTab(view)} refreshKey={`${project.updatedAt}:${projectTasks.map(task=>`${task.id}:${task.updatedAt}`).join(',')}:${JSON.stringify(officeState.offices)}`}/>}
          {activeTabId === "overview" && (
            <ProjectOverviewTab
              data={data}
              profiles={profiles}
              onOpenTask={setOpenTaskId}
            />
          )}
          {activeTabId === "tasks" && (
            <ProjectTableWorkspace data={data} profiles={profiles} orgs={orgs} canManage={canManage} onOpenTask={setOpenTaskId} onOpenLegacyBoard={()=>selectTab('board')} sharedFilters={filters} onFiltersChange={setFilters}/>
          )}
          {activeTabId === "board" && (
            <ProjectWorkTab
              data={viewData}
              profiles={profiles}
              canManage={canManage}
              onOpenTask={setOpenTaskId}
              onOpenTable={() => selectTab('tasks')}
            />
          )}
          {activeTabId === "gantt" && <ProjectGanttView data={viewData} allTasks={projectTasks} canManage={canManage} onOpenTask={setOpenTaskId} onOpenPlan={() => selectTab('timeline')}/>}
          {activeTabId === "offices" && <><ProjectOfficePanel projectId={project.id} projectTitle={project.title} projectStatus={project.status} leadOffice={project.orgId || ''} governed={!!project.sourceCollaborationDraftId} organizations={orgs} profiles={profiles} tasks={projectTasks} onOpenTask={(id, afterOpen) => inspector.openTask(id, { view: 'offices', restoreFocus: () => document.getElementById('project-office-search')?.focus() }, afterOpen)} onProposalContext={() => selectTab('proposal_context')}/><ProjectOfficesView tasks={visibleTasks} offices={orgs} onOpenTask={setOpenTaskId} onSelectOffice={office => selectTab('tasks', office)}/></>}
          {activeTabId === "timeline" && (
            <ProjectTimelineView
              data={viewData}
              profiles={profiles}
              canManage={canManage}
              onOpenTask={setOpenTaskId}
            />
          )}
          {activeTabId === "calendar" && (
            <ProjectCalendarView
              data={viewData}
              profiles={profiles}
              onOpenTask={setOpenTaskId}
              canManage={canManage}
              onOpenPlan={() => selectTab('timeline')}
              onOpenReviews={() => selectTab('proposal_context')}
              offices={orgs}
              officeFilter={filters.office}
            />
          )}
          {activeTabId === "reports" && (
            <ProjectReportsTab
              data={data}
              canExport={canExport}
            />
          )}
          {activeTabId === "proposal_context" && (
            <ProjectProposalContextTab
              draftId={project.sourceCollaborationDraftId || null}
              organizations={orgs}
              profiles={profiles}
            />
          )}
          {activeTabId === "activity" && (
            <ProjectActivityTab data={data} />
          )}
          {activeTabId === "reviews" && (
            <ProjectReviewsTab
              data={data}
              onOpenTask={setOpenTaskId}
            />
          )}
          {activeTabId === "dashboard" && (
            <><ProjectInsightsView data={viewData} profiles={profiles} offices={orgs} onOpenTask={setOpenTaskId}/><details className="pv-details"><summary>Delivery details, milestones and recent activity</summary><ProjectDashboardTab data={viewData} onOpenTask={setOpenTaskId}/></details></>
          )}
          {activeTabId === "workload" && (
            <ProjectTeamTab
              data={data}
              profiles={profiles}
              canManage={canManage && project.status !== "archived"}
            />
          )}
          {activeTabId === "budget" && (
            <ProjectBudgetTab data={data} />
          )}
          {activeTabId === "signoff" && (
            <ProjectGovernanceTab
              data={data}
              view="signoff"
              organizations={orgs}
              onOpenTask={setOpenTaskId}
            />
          )}
          {activeTabId === "evidence" && (
            <ProjectGovernanceTab
              data={data}
              view="evidence"
              organizations={orgs}
              onOpenTask={setOpenTaskId}
            />
          )}
          {activeTabId === "decisions" && (
            <ProjectGovernanceTab
              data={data}
              view="decisions"
              organizations={orgs}
              onOpenTask={setOpenTaskId}
            />
          )}
        </div>
      )}

      {/* Slide-over Task Detail Drawer */}
      <TaskDetailDrawer
        task={openTask}
        taskId={inspector.taskId || undefined}
        origin={inspector.origin}
        onClose={inspector.close}
        canReview={canReviewTasks}
        canSubmitForReview={true}
        readOnly={['completed','archived'].includes(project.status) || userProfile?.role==='admin' || !ownWorkAccess || !!openTask && shared && openTask.orgId !== userProfile?.org_id}
      />

    </div></ProjectReadinessSummaryProvider></ProjectOfficeContext.Provider>
  );
}
