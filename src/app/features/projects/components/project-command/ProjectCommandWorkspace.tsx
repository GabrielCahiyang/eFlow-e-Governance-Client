import { useMemo, useState, useEffect } from "react";
import { Skeleton } from "@vibe/core";
import type { Organization } from "../../../../types";
import { useProfiles } from "../../../../hooks/useSupabaseData";
import { useTasks } from "../../../../hooks/useFirebaseData";
import { useToast } from "../../../../components/ui/Toast";
import { TaskDetailDrawer } from "../../../../components/workflow/TaskDetailDrawer";
import { tasksForProject } from "../../../../services/taskSelectors";
import type { Project } from "../../services/projectService";
import { useProjectCommandData } from "../../hooks/useProjectCommandData";
import { ProjectDeleteDialog } from "../ProjectDeleteDialog";
import { ProjectHeader } from "./ProjectHeader";
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
import type { ProjectCommandTab } from "./types";
import "../projectsVibe.css";
import { ProjectTableWorkspace } from '../../../project-table';
import { InlineEditableText } from '../../../../components/ui/workspace';
import { updateProject } from '../../services/projectMutationService';
import { useAuth } from '../../../../contexts/AuthContext';
import { ProjectViewFilters, ProjectGanttView, ProjectOfficesView, ProjectInsightsView, EMPTY_PROJECT_FILTERS, filterProjectViewTasks, type ProjectViewFilterState } from '../../../project-views';
import { buildProjectCommandMetrics } from '../../selectors/projectCommandSelectors';
import { getTaskScopedBudgetBundle } from '../../../budget';
import { ProjectOfficeContext, ProjectOfficePanel, useProjectOffices, canStaffProjectOffice } from '../../../project-offices';
import { ProjectReadinessPanel } from '../../../project-readiness';

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
}

const projectTabFromUrl = (value: string | null): ProjectCommandTab | null => {
  const valid: ProjectCommandTab[] = ["readiness", "overview", "tasks", "board", "gantt", "offices", "timeline", "calendar", "reports", "proposal_context", "activity", "reviews", "dashboard", "workload", "budget", "signoff", "evidence", "decisions"];
  return value && valid.includes(value as ProjectCommandTab) ? value as ProjectCommandTab : null;
};

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
  onDeleted,
  canReviewTasks,
  canExport = true,
  onOpenSourceGovernance: _onOpenSourceGovernance,
}: ProjectCommandWorkspaceProps) {
  const { tasks } = useTasks();
  const { profiles } = useProfiles();
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const officeState = useProjectOffices(project.id);
  const canManage = requestedManage && (project.sourceCollaborationDraftId ? true : userProfile?.role === 'head' && userProfile.org_id === project.orgId);
  const shared = officeState.offices.some(o => o.relationship_type !== 'lead');
  const ownOffice = officeState.offices.find(o => o.office_id === userProfile?.org_id);
  const ownWorkAccess = !officeState.error && (!shared || ownOffice?.invitation_status === 'joined' && ownOffice.relationship_type !== 'observer' && (ownOffice.relationship_type === 'lead' || canStaffProjectOffice(ownOffice, userProfile, orgs) || officeState.members.some(m => m.project_office_id === ownOffice.id && m.user_id === userProfile?.id)));
  const [tab, setTabState] = useState<ProjectCommandTab>(() => projectTabFromUrl(typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("view") : null) || initialTool || initialTab);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [filters, setFilters] = useState<ProjectViewFilterState>({ ...EMPTY_PROJECT_FILTERS });
  useEffect(() => setFilters({ ...EMPTY_PROJECT_FILTERS }), [project.id]);

  useEffect(() => {
    if (initialTool) {
      setTabState(initialTool);
    }
  }, [initialTool]);

  useEffect(() => {
    const onPopState = () => {
      const next = projectTabFromUrl(new URLSearchParams(window.location.search).get("view"));
      const projectId = new URLSearchParams(window.location.search).get("project");
      if (next && (!projectId || projectId === project.id)) setTabState(next);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [project.id]);

  const projectTasks = useMemo(
    () => tasksForProject(tasks, project.id),
    [project.id, tasks],
  );
  const data = useProjectCommandData(project, projectTasks);
  const visibleTasks = useMemo(() => filterProjectViewTasks(projectTasks, filters), [projectTasks, filters]);
  const viewData = useMemo(() => {
    const ids = new Set(visibleTasks.map(task => task.id));
    const facts = { subtasks: data.facts.subtasks.filter(f => ids.has(f.taskId)), progress: data.facts.progress.filter(f => ids.has(f.taskId)), submissions: data.facts.submissions.filter(f => ids.has(f.taskId)), statusHistory: data.facts.statusHistory.filter(f => ids.has(f.taskId)), evidence: data.facts.evidence.filter(f => ids.has(f.taskId)) };
    const attention = data.attention.filter(item => ids.has(item.taskId));
    return { ...data, tasks: visibleTasks, facts, attention, metrics: buildProjectCommandMetrics(project, visibleTasks, data.milestones, facts, attention), financial: getTaskScopedBudgetBundle(data.financial, [...ids]) };
  }, [data, project, visibleTasks]);
  const openTask = projectTasks.find((task) => task.id === openTaskId) || null;

  // Map legacy tab requests (plan, work, people, delivery)
  const activeTabId =
    tab === "plan" || tab === "delivery"
      ? "timeline"
      : tab === "work"
        ? "tasks"
        : tab === "people" || tab === "team"
          ? "workload"
          : tab;

  const selectTab = (nextTab: ProjectCommandTab) => {
    setTabState(nextTab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.pathname = "/projects";
      url.searchParams.set("page", "Projects");
      url.searchParams.set("project", project.id);
      url.searchParams.set("view", nextTab);
      window.history.pushState({ page: "Projects", project: project.id, view: nextTab }, "", `${url.pathname}?${url.searchParams.toString()}`);
    }
    onWorkspaceTabChange?.(nextTab);
  };

  const hasBudgetData = Boolean(
    data.financial &&
      data.financial.summary &&
      data.financial.summary.approvedAmount > 0,
  );

  return (
    <ProjectOfficeContext.Provider value={officeState}><div className="eflow-project-command space-y-4 font-sans">
      <header className="pt-project-heading" data-tour-id="project-table-heading"><div><h1><InlineEditableText value={project.title} label="project name" disabled={!canManage || ['completed','archived'].includes(project.status)} onSave={title=>updateProject(project.id,{title})}/></h1><p>{orgs.find(o=>o.id===project.orgId)?.name || 'Project workspace'} · {project.status.replace(/_/g,' ')} · {projectTasks.length} tasks</p></div><div className="flex flex-wrap gap-2"><button className="pt-primary" onClick={()=>selectTab('offices')}>Project Offices</button><button className="pt-primary" onClick={()=>selectTab('readiness')}>Readiness & closeout</button></div></header>
      {/* Extensible Workspace Tab Bar (Permanent core views + optional dynamic views) */}
      <ProjectViewTabBar
        projectId={project.id}
        activeTab={activeTabId}
        onSelectTab={selectTab}
        hasProposalContext={Boolean(project.sourceCollaborationDraftId)}
        hasBudgetData={hasBudgetData}
      />
      {['tasks', 'gantt', 'board', 'timeline', 'calendar', 'dashboard', 'offices'].includes(activeTabId) && <ProjectViewFilters value={filters} onChange={setFilters} profiles={profiles.filter(p => projectTasks.some(t => t.assigneeId === p.id) || p.org_id === project.orgId)} offices={orgs.filter(o => projectTasks.some(t => t.orgId === o.id) || o.id === project.orgId)} count={visibleTasks.length}/>}

      {activeTabId === "overview" && (
        <ProjectHeader
          project={project}
          organizations={orgs}
          profiles={profiles}
          metrics={data.metrics}
          hideTitle
        />
      )}

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
          {data.error}
        </div>
      ) : (
        <div className="pt-1">
          {activeTabId === "readiness" && <ProjectReadinessPanel project={project} canManage={canManage} onOpenTask={setOpenTaskId}/>}
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
            />
          )}
          {activeTabId === "gantt" && <ProjectGanttView data={viewData} allTasks={projectTasks} canManage={canManage} onOpenTask={setOpenTaskId} onOpenPlan={() => selectTab('timeline')}/>}
          {activeTabId === "offices" && <><ProjectOfficePanel projectId={project.id} projectTitle={project.title} projectStatus={project.status} leadOffice={project.orgId || ''} governed={!!project.sourceCollaborationDraftId} organizations={orgs} profiles={profiles}/><ProjectOfficesView tasks={visibleTasks} offices={orgs} onOpenTask={setOpenTaskId} onSelectOffice={office => { setFilters(current => ({ ...current, office })); selectTab('tasks'); }}/></>}
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
        onClose={() => setOpenTaskId(null)}
        canReview={canReviewTasks}
        canSubmitForReview={true}
        readOnly={userProfile?.role==='admin' || !ownWorkAccess || !!openTask && shared && openTask.orgId !== userProfile?.org_id}
      />

      {/* Delete Confirmation Dialog */}
      <ProjectDeleteDialog
        projectId={project.id}
        projectTitle={project.title}
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => {
          setDeleteOpen(false);
          toast(
            "Project permanently deleted. Existing tasks were retained.",
            "success",
          );
          onDeleted();
        }}
      />
    </div></ProjectOfficeContext.Provider>
  );
}
