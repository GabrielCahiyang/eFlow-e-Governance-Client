import {WorkActivity,WorkRootOwner,isTaskSubtaskPlanningBlocked,supportsNestedWork,useWorkTree,type WorkTreeController} from '../../nested-work';
import { isAppointedOfficeHead } from '../../../shared/officeAuthority';
import { pendingTaskDependencies, taskStartBlocker } from '../../tasks';
import { StaffingDialog, staffingEntryReason } from '../../staffing';
import { useOrgs } from '../../../hooks/useSupabaseData';
import { InspectorHeader } from './InspectorHeader';
import { useState } from "react";
import { InspectorFiles } from './InspectorFiles';
import { InspectorProgressUpdates } from './InspectorProgressUpdates';
import { InspectorExecution } from './InspectorExecution';
import { InspectorSummary } from './InspectorSummary';
import { InspectorWork } from './InspectorWork';
import { requestNavigation } from '../../../shared/navigationGuard';
import { useInspectorLifecycle } from '../hooks/useInspectorLifecycle';
import { ProjectOfficeContext, useProjectOffices, useProjectOfficeContext } from '../../project-offices';
import { type Task } from "../../tasks";
import { useAuth } from "../../../contexts/AuthContext";
import { ProjectStatusBadge } from "../../../components/workflow/StatusBadges";
import { relativeDays } from "../../../components/workflow/primitives";
import { WorkFinancialClearancePanel } from '../../budget';
import { TaskActivityTimeline } from "../../tasks";
import { TaskDiscussion } from "../../tasks";
import { TaskReviewPanel, canUserReviewTask } from "../../reviews";
import { useTasks } from "../../../hooks/useFirebaseData";
import { useProfiles, useProjectsData } from "../../../hooks/useSupabaseData";
import { isTaskLead, TaskEvidenceRecovery } from "../../tasks";
import { resolveSubtaskManagementCapability, resolveTaskDetailCapabilities } from "../../tasks";
import { TaskTeamEditorDialog } from "../../tasks";
import { useTaskSubtasks,SubitemInspector } from "../../subtasks";
import { InspectorSurface } from './InspectorSurface';
import { TaskPageHeader } from './TaskPageHeader';
import { TASK_INSPECTOR_SECTIONS, resolveTaskInspectorSection, type TaskInspectorOrigin, type TaskInspectorSection } from '../types';

function TaskInspectorContent({
  task,
  onClose,
  canReview = false,
  canPostProgress = false,
  canSubmitForReview = false,
  canDiscuss = true,
  readOnly = false,
  onChanged,
  origin,
  controller,
  presentation = 'drawer',
}: {
  task?: Task | null;
  taskId?: string;
  onClose: () => void;
  canReview?: boolean;
  canPostProgress?: boolean;
  canSubmitForReview?: boolean;
  canDiscuss?: boolean;
  readOnly?: boolean;
  onChanged?: () => void;
  origin?: TaskInspectorOrigin;
  controller?: WorkTreeController;
  presentation?: 'drawer' | 'page' | 'dialog';
}) {
  const [selectedTab, setTab] = useState<TaskInspectorSection>(() => resolveTaskInspectorSection(origin?.section));
  const [updatesView, setUpdatesView] = useState<'discussion' | 'activity'>(() =>
    origin?.section === 'activity' ? 'activity' : 'discussion',
  );
  const lifecycle = useInspectorLifecycle(task || null, onChanged, onClose);
  const officeState = useProjectOfficeContext();
  const { orgs } = useOrgs();
  const [staffingOpen, setStaffingOpen] = useState(false);
  const [openedSubitem,setOpenedSubitem]=useState<{id:string;section:'work'|'review';origin:TaskInspectorOrigin}>();
  const [teamEditorOpen, setTeamEditorOpen] = useState(false);
  const { user, userProfile } = useAuth();
  const { tasks } = useTasks();
  const { projects } = useProjectsData();
  const { profiles } = useProfiles();
  const { subtasks: taskSubtasks } = useTaskSubtasks(task?.id,user?.id||null);

  if (!task) return null;
  const operationalProject = task.linkedProjectId
    ? projects.find((project) => project.id === task.linkedProjectId)
    : undefined;
  readOnly = readOnly || ['completed', 'archived'].includes(operationalProject?.status || '');
  const isProjectOnHold = operationalProject?.status === 'on_hold';
  const isPrivatePlanning = operationalProject?.publicationState === 'draft';
  const proposedOffice = !!task.proposedOfficeIdentityId;
  const staffingReason = staffingEntryReason(task, userProfile, orgs, readOnly);
  const executionBlocked = proposedOffice || isProjectOnHold || isPrivatePlanning;
  const capabilities = resolveTaskDetailCapabilities(readOnly || executionBlocked, {
    canReview,
    canPostProgress,
    canSubmitForReview,
    canDiscuss,
  });
  const effectiveCanReview = capabilities.canReview && Boolean(user?.id);
  const dependencies = (task.dependencyIds || [])
    .map((id) => tasks.find((candidate) => candidate.id === id))
    .filter((dependency): dependency is Task => Boolean(dependency));
  const dependencyCount = task.dependencyIds?.length ? pendingTaskDependencies(task, tasks).length : 0;


  // Rework is now the first-class `changes_requested` state (plan §2.1).
  const rejected = task.status === "changes_requested";
  const currentUserIsLead = Boolean(user?.id && isTaskLead(task, user.id));
  const isOwnerOrLead = !!user?.id && task.assigneeId === user.id;
  const subtaskPlanningBlocked = isTaskSubtaskPlanningBlocked({
    isOfficeProject: Boolean(task.linkedProjectId) && !proposedOffice,
    projectStatus: operationalProject?.status ?? controller?.data?.root.project_status,
    projectLeadId: operationalProject?.projectLeadId,
    taskLeadId: task.assigneeId || task.recommendationLeadId || null,
    actorId: user?.id || null,
    actorRole: userProfile?.role || null,
  });
  const canManageSubtasks = resolveSubtaskManagementCapability(readOnly || proposedOffice || subtaskPlanningBlocked, currentUserIsLead);
  // Fiscal authority belongs to the appointed Office Head, independently of
  // task execution and project contributor selection.
  const canAuthorizeFunding = !readOnly && !executionBlocked && !task.archivedAt &&
    userProfile?.org_id === task.orgId && isAppointedOfficeHead(userProfile, orgs);
  const shared = officeState.offices.some(office => office.relationship_type !== 'lead');
  const teamBlocked = !supportsNestedWork(task) && (!!officeState.error || shared && userProfile?.role !== 'head');
  const canManageTaskTeam = !supportsNestedWork(task) && !teamBlocked && canManageSubtasks && !["for_review", "completed", "cancelled"].includes(task.status);

  // Task Leaders can start, resume, and submit parent work without posting
  // parent-level progress updates (those belong to individual subtasks).
  const canManageLifecycle = Boolean(capabilities.canPostProgress || capabilities.canSubmitForReview);
  const canResume = rejected && canManageLifecycle && isOwnerOrLead;
  const startBlockedReason = task.status === 'todo' ? taskStartBlocker(task, tasks, controller?.data?.root.scheduling?.today) : null;
  const canStart = canManageLifecycle && isOwnerOrLead && task.status === "todo" && !startBlockedReason;
  const canSubmit =
    canManageLifecycle && isOwnerOrLead && task.status === "in_progress";
  const rel = relativeDays(task.deadline || task.dueDate);


  const visibleTabs = TASK_INSPECTOR_SECTIONS;
  const tab = selectedTab;
  const reviewAvailable = effectiveCanReview && task.status === 'for_review' && canUserReviewTask(task, user?.id, userProfile?.role);
  const canExecuteWork = Boolean(capabilities.canPostProgress || canStart || canResume || canSubmit);
  const directSubtasks = taskSubtasks.filter(s => !s.parentSubtaskId);
  const completedSubtaskCount = directSubtasks.filter(s => s.status === 'completed').length;
  const overviewTeamSlot = supportsNestedWork(task) ? (
    <section aria-label="Task Lead and contributors">
      <WorkRootOwner rootId={task.id} controller={controller} readOnly={readOnly || proposedOffice || lifecycle.busy} layout="inline" />
    </section>
  ) : undefined;

  if(openedSubitem)return <SubitemInspector presentation={presentation} rootTask={task} itemId={openedSubitem.id} controller={controller} initialSection={openedSubitem.section} origin={openedSubitem.origin} readOnly={readOnly} executionBlocked={executionBlocked} onClose={()=>setOpenedSubitem(undefined)} onChanged={onChanged}/>;
  return (
    <>
      <InspectorSurface
        presentation={presentation}
        open={Boolean(task)}
        returnFocus={origin?.returnFocus}
        onReturnFocus={origin?.restoreFocus}
        onClose={() => { void requestNavigation(onClose); }}
        preventClose={lifecycle.busy}
        ariaLabel={`Task details: ${task.title}`}
        className="w-full font-sans sm:w-[520px]"
      >
        {presentation==='page'||presentation==='dialog'?<TaskPageHeader dialog={presentation==='dialog'} readOnly={readOnly} backLabel={origin?.view && origin.view !== "My Work" ? "Back to project" : "Back to My Work"} task={task} projectTitle={operationalProject?.title||task.projectTitle} tab={tab} tabs={visibleTabs} onTab={setTab} onClose={onClose} busy={lifecycle.busy}/>:<InspectorHeader task={task} tab={tab} tabs={visibleTabs} onTab={setTab} onClose={onClose} busy={lifecycle.busy}/>}

        {/* Body */}
        <div id={`task-panel-${task.id}`} role="tabpanel" aria-labelledby={`task-${task.id}-${tab}`} className={presentation==='page'?'task-page__body':presentation==='dialog'?'task-dialog__body':'task-drawer__body'}>
          {lifecycle.error && <p role="alert" className="pv-error">{lifecycle.error} Retry the action when resolved.</p>}
          {teamBlocked && currentUserIsLead && !readOnly && <p role="status" className="po-help">In shared projects, only the responsible Office Head can change the task team. Ask your Office Head to update members.</p>}
          {proposedOffice && <p role="status" className="po-help">Proposed Office responsibility requires directory linking, Office Head confirmation and explicit handover in Project Offices.</p>}
          {isPrivatePlanning && <p role="status" className="po-help">Project work starts after the Office Head activates this plan.</p>}
          {readOnly && presentation === 'drawer' && <p role="status" className="task-page__readonly-banner">Read-only oversight record</p>}

          {tab === 'overview' && (
            <section aria-label="Task details">
              <InspectorSummary
                task={task}
                projectTitle={operationalProject?.title}
                readOnly={readOnly}
                dependencies={dependencies}
                canManageSubtasks={canManageSubtasks}
                canAuthorizeFunding={canAuthorizeFunding}
                rejected={rejected}
                overdue={rel.overdue}
                authorityPending={!!controller&&(!controller.authorityFresh||controller.refreshPending||controller.pending)}
                fundingTask={controller?.data?{...task,assigneeId:controller.data.root.lead||undefined,recommendationLeadId:undefined}:undefined}
                budgetReadOnly={readOnly||!!task.archivedAt||executionBlocked||!!controller&&controller.data?.people.find(person=>person.id===user?.id)?.eligible!==true}
                subtaskSummary={{ total: directSubtasks.length, completed: completedSubtaskCount }}
                onOpenWork={() => void requestNavigation(() => setTab('work'))}
                teamSlot={overviewTeamSlot}
              />
            </section>
          )}

          {tab === 'work' && (
            <div className="task-page__stack">
              {user?.id && typeof TaskEvidenceRecovery === 'function' &&
                <TaskEvidenceRecovery key={`${user.id}:${task.id}`} task={task.id} actor={user.id} verifyOnly={readOnly || executionBlocked} onSaved={onChanged} />}
              {typeof WorkFinancialClearancePanel === 'function' && (
                <WorkFinancialClearancePanel
                  root={task.id}
                  readOnly={readOnly || executionBlocked}
                  onSaved={() => { onChanged?.(); }}
                />
              )}
              {reviewAvailable ? (
                <section aria-label="Submission review" className="task-page__review">
                  <TaskReviewPanel task={task} canReview showDecision onDone={() => { onChanged?.(); }} />
                </section>
              ) : canExecuteWork || isProjectOnHold || dependencyCount > 0 ? (
                <section aria-label="Update task work" className="task-page__card">
                  <InspectorExecution
                    hideClearancePanel
                    isProjectOnHold={isProjectOnHold}
                    pendingDependencies={dependencyCount}
                    startBlockedReason={startBlockedReason}
                    initialAction={origin?.section==='report-blocker'?'stuck':origin?.section==='submit-work'?'submit':undefined}
                    task={task}
                    subtasks={taskSubtasks}
                    canStart={canStart}
                    canResume={canResume}
                    canSubmit={canSubmit}
                    canPostProgress={capabilities.canPostProgress}
                    busy={lifecycle.busy}
                    onStart={lifecycle.start}
                    onChanged={onChanged}
                    onSubmitted={() => { onChanged?.(); }}
                  />
                </section>
              ) : (
                <div className="task-page__compact-status" role="status">
                  <strong>
                    {directSubtasks.length > 0
                      ? `${completedSubtaskCount} of ${directSubtasks.length} step${directSubtasks.length === 1 ? '' : 's'} complete`
                      : `Status: ${task.status.replace('_', ' ')}`}
                  </strong>
                  <span>Assigned team handles execution updates.</span>
                </div>
              )}

              {!reviewAvailable && (['for_review', 'completed', 'changes_requested'].includes(task.status) || Boolean(task.latestSubmission)) && (
                <details className="task-page__card work-secondary-card">
                  <summary>Submission notes & review history</summary>
                  <div className="work-secondary-card__body">
                    <TaskReviewPanel task={task} canReview={false} showDecision={false} compact />
                  </div>
                </details>
              )}

              <div className="task-work-page">
                <InspectorWork
                  onInspect={(id,section,origin)=>setOpenedSubitem({id,section,origin})}
                  presentation={presentation}
                  task={task}
                  profiles={profiles}
                  projectTitle={operationalProject?.title}
                  controller={controller}
                  canManageTaskTeam={canManageTaskTeam}
                  canManageSubtasks={canManageSubtasks}
                  currentUserIsLead={currentUserIsLead}
                  readOnly={readOnly || proposedOffice || lifecycle.busy}
                  subtaskReadOnly={readOnly || proposedOffice || lifecycle.busy || subtaskPlanningBlocked}
                  onManage={() => setTeamEditorOpen(true)}
                  staffingReason={staffingReason}
                  onRecommend={() => setStaffingOpen(true)}
                />
              </div>
            </div>
          )}

          {tab === 'updates' && (
            <div className="task-page__stack">
              <div className="task-updates__switcher" role="group" aria-label="Updates view">
                <button
                  type="button"
                  aria-pressed={updatesView === 'discussion'}
                  className={updatesView === 'discussion' ? 'is-active' : undefined}
                  onClick={() => setUpdatesView('discussion')}
                >
                  Discussion &amp; progress
                </button>
                <button
                  type="button"
                  aria-pressed={updatesView === 'activity'}
                  className={updatesView === 'activity' ? 'is-active' : undefined}
                  onClick={() => setUpdatesView('activity')}
                >
                  Activity log
                </button>
              </div>
              {updatesView === 'discussion' ? (
                <>
                  <section className="task-page__card" aria-label="Task discussion">
                    <div className="task-page__card-heading">
                      <h3>Discussion</h3>
                      <p>Threaded notes for task assignees and authorized reviewers.</p>
                    </div>
                    <TaskDiscussion taskId={task.id} canParticipate={capabilities.canDiscuss} />
                  </section>
                  <section className="task-page__card" aria-label="Task progress log">
                    <InspectorProgressUpdates taskId={task.id} />
                  </section>
                </>
              ) : (
                <>
                  <TaskActivityTimeline taskId={task.id} projectId={task.linkedProjectId} />
                  <WorkActivity roots={[task.id]} />
                </>
              )}
            </div>
          )}

          {tab === 'files' && <InspectorFiles task={task} readOnly={readOnly || executionBlocked} />}

        </div>
      </InspectorSurface>
      {staffingOpen && !staffingReason && <StaffingDialog task={task} controller={controller} onClose={() => setStaffingOpen(false)} onAssigned={onChanged}/>}
      <TaskTeamEditorDialog
        task={teamEditorOpen && canManageTaskTeam ? task : null}
        profiles={profiles}
        subtasks={taskSubtasks}
        responsibleOrgId={task.orgId || operationalProject?.orgId}
        readOnly={readOnly || executionBlocked || lifecycle.busy}
        onClose={() => setTeamEditorOpen(false)}
      />
      {lifecycle.dialog}
    </>
  );
}

export { ProjectStatusBadge };

type TaskInspectorProps = Omit<Parameters<typeof TaskInspectorContent>[0], 'controller'>;
function SupportedTaskInspector(props: TaskInspectorProps) {
 const controller = useWorkTree(props.task!.id);
 return <TaskInspectorContent {...props} controller={controller}/>;
}
function TaskInspectorOwner(props: TaskInspectorProps) {
 return props.task && supportsNestedWork(props.task) ? <SupportedTaskInspector {...props}/> : <TaskInspectorContent {...props}/>;
}
export function TaskInspector(props: TaskInspectorProps) {
 const { tasks, loading } = useTasks();
 const { user, userProfile } = useAuth();
 const context = useProjectOfficeContext();
 const taskId = props.taskId || props.task?.id;
 if (!taskId) return null;
 const canonical = tasks.find(task => task.id === taskId);
 if (loading === false && (!canonical || props.task?.linkedProjectId && canonical.linkedProjectId !== props.task.linkedProjectId)) return <InspectorSurface presentation={props.presentation} open onClose={() => { void requestNavigation(props.onClose); }} returnFocus={props.origin?.returnFocus} onReturnFocus={props.origin?.restoreFocus} ariaLabel="Task unavailable" className="w-full sm:w-[520px]"><div className="p-5"><h2>Task unavailable</h2><p>This task was removed or your access changed. Reopen it from an authorized workspace.</p><button onClick={() => { void requestNavigation(props.onClose); }}>{props.presentation==='page'?'Back to My Work':'Close task details'}</button></div></InspectorSurface>;
 const task = canonical || props.task;
 if (!task) return null;
 const accountReadOnly = !userProfile || userProfile.is_active === false || userProfile.role === 'admin';
 if (!task.linkedProjectId) return <TaskInspectorOwner key={task.id+user?.id} {...props} task={task} readOnly={props.readOnly || accountReadOnly}/>;
 return <ScopedTaskInspector key={task.id+user?.id} {...props} task={task} context={context} userId={user?.id || ''} profile={userProfile}/>;
}
function ScopedTaskInspector({context, userId, profile, ...props}: Parameters<typeof TaskInspectorContent>[0] & {context: ReturnType<typeof useProjectOfficeContext>;userId:string;profile:ReturnType<typeof useAuth>['userProfile']}) {
 if (context.projectId === props.task?.linkedProjectId) return <ResolvedTaskInspector {...props} userId={userId} profile={profile} offices={context}/>;
 return <ConnectedTaskInspector {...props} userId={userId} profile={profile}/>;
}
function ConnectedTaskInspector(props: Parameters<typeof TaskInspectorContent>[0] & {userId:string;profile:ReturnType<typeof useAuth>['userProfile']}) {
 const offices = useProjectOffices(props.task!.linkedProjectId!);
 return <ResolvedTaskInspector {...props} offices={offices}/>;
}
function ResolvedTaskInspector({offices, userId, profile, ...props}: Parameters<typeof TaskInspectorContent>[0] & {offices:ReturnType<typeof useProjectOfficeContext>;userId:string;profile:ReturnType<typeof useAuth>['userProfile']}) {
 const task = props.task!;
 const shared = offices.offices.some(office => office.relationship_type !== 'lead');
 const own = offices.offices.find(office => office.office_id === profile?.org_id);
 const selected = own && offices.members.some(member => member.project_office_id === own.id && member.user_id === userId);
 const restricted = !profile || profile.is_active === false || profile.role === 'admin' || !!task.archivedAt || offices.loading || !!offices.error || shared && (!own || own.invitation_status !== 'joined' || own.relationship_type === 'observer' || task.orgId !== profile.org_id || profile.role !== 'head' && own.relationship_type !== 'lead' && !selected);
 return <ProjectOfficeContext.Provider value={offices}><TaskInspectorOwner {...props} readOnly={props.readOnly || restricted}/></ProjectOfficeContext.Provider>;
}
