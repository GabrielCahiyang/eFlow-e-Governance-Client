import {WorkActivity} from '../../nested-work';
import { StaffingDialog, staffingEntryReason } from '../../staffing';
import { useOrgs } from '../../../hooks/useSupabaseData';
import { InspectorHeader } from './InspectorHeader';
import { useState } from "react";
import { InspectorFiles } from './InspectorFiles';
import { InspectorProgressUpdates } from './InspectorProgressUpdates';
import { InspectorExecution } from './InspectorExecution';
import { TaskDepartmentLabel } from '../../tasks';
import { TaskStatusBadge, PriorityPill } from '../../../components/workflow/StatusBadges';
import { InspectorSummary } from './InspectorSummary';
import { InspectorTeam } from './InspectorTeam';
import { requestNavigation } from '../../../shared/navigationGuard';
import { useInspectorLifecycle } from '../hooks/useInspectorLifecycle';
import { ProjectOfficeContext, useProjectOffices, useProjectOfficeContext } from '../../project-offices';
import { type Task } from "../../tasks";
import { useAuth } from "../../../contexts/AuthContext";
import { ProjectStatusBadge } from "../../../components/workflow/StatusBadges";
import { relativeDays } from "../../../components/workflow/primitives";
import { TaskActivityTimeline } from "../../tasks";
import { TaskDiscussion } from "../../tasks";
import { TaskReviewPanel, canUserReviewTask } from "../../reviews";
import { useTasks } from "../../../hooks/useFirebaseData";
import { useProfiles, useProjectsData } from "../../../hooks/useSupabaseData";
import { isTaskLead } from "../../tasks";
import { resolveSubtaskManagementCapability, resolveTaskDetailCapabilities } from "../../tasks";
import { TaskTeamEditorDialog } from "../../tasks";
import { useTaskSubtasks } from "../../subtasks";
import { InspectorPanel } from "../../../shared/motion";

type Tab = "updates" | "files" | "activity";

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
}: {
  task: Task | null;
  taskId?: string;
  onClose: () => void;
  canReview?: boolean;
  canPostProgress?: boolean;
  canSubmitForReview?: boolean;
  canDiscuss?: boolean;
  readOnly?: boolean;
  onChanged?: () => void;
  origin?: import("../hooks/useTaskInspector").TaskInspectorOrigin;
}) {
  const [selectedTab, setTab] = useState<Tab>("updates");
  const [detailsOpen, setDetailsOpen] = useState(origin?.section === 'details');
  const [reviewOpen, setReviewOpen] = useState(false);
  const lifecycle = useInspectorLifecycle(task, onChanged, onClose);
  const officeState = useProjectOfficeContext();
  const { orgs } = useOrgs();
  const [staffingOpen, setStaffingOpen] = useState(false);
  const [teamEditorOpen, setTeamEditorOpen] = useState(false);
  const { user, userProfile } = useAuth();
  const { tasks } = useTasks();
  const { projects } = useProjectsData();
  const { profiles } = useProfiles();
  const { subtasks: taskSubtasks } = useTaskSubtasks(task?.id);

  if (!task) return null;
  const operationalProject = task.linkedProjectId
    ? projects.find((project) => project.id === task.linkedProjectId)
    : undefined;
  readOnly = readOnly || ['completed', 'archived'].includes(operationalProject?.status || '');
  const staffingReason = staffingEntryReason(task, userProfile, orgs, readOnly);
  const executionBlocked = !!task.proposedOfficeIdentityId;
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


  // Rework is now the first-class `changes_requested` state (plan §2.1).
  const rejected = task.status === "changes_requested";
  const currentUserIsLead = Boolean(user?.id && isTaskLead(task, user.id));
  const isOwnerOrLead = task.assigneeId === user?.id || currentUserIsLead;
  const canManageSubtasks = resolveSubtaskManagementCapability(readOnly || executionBlocked, currentUserIsLead);
  const shared = officeState.offices.some(office => office.relationship_type !== 'lead');
  const teamBlocked = !!officeState.error || shared && userProfile?.role !== 'head';
  const canManageTaskTeam = !teamBlocked && canManageSubtasks && !["for_review", "completed", "cancelled"].includes(task.status);

  // Task Leaders can start, resume, and submit parent work without posting
  // parent-level progress updates (those belong to individual subtasks).
  const canManageLifecycle = Boolean(capabilities.canPostProgress || capabilities.canSubmitForReview);
  const canResume = rejected && canManageLifecycle && isOwnerOrLead;
  const canStart = canManageLifecycle && isOwnerOrLead && task.status === "todo";
  const canSubmit =
    canManageLifecycle && isOwnerOrLead && task.status === "in_progress";
  const rel = relativeDays(task.deadline || task.dueDate);


  const visibleTabs = [{id:'updates',label:'Updates'},{id:'files',label:'Files'},{id:'activity',label:'Activity'}];
  const tab = selectedTab;
  const reviewAvailable = effectiveCanReview && task.status === 'for_review' && canUserReviewTask(task, user?.id, userProfile?.role);

  return (
    <>
      <InspectorPanel
        open={Boolean(task)}
        returnFocus={origin?.returnFocus}
        onReturnFocus={origin?.restoreFocus}
        onClose={() => { void requestNavigation(onClose); }}
        preventClose={lifecycle.busy}
        ariaLabel={`Task details: ${task.title}`}
        className="w-full font-sans sm:w-[520px]"
      >
        <InspectorHeader task={task} tab={tab} tabs={visibleTabs} onTab={id => {setTab(id as Tab);setReviewOpen(false);}} onClose={onClose} busy={lifecycle.busy} actions={<>
          <button type="button" className="eflow-text-button" aria-expanded={detailsOpen} aria-controls={`task-details-${task.id}`} onClick={() => {if(detailsOpen)void requestNavigation(() => setDetailsOpen(false));else setDetailsOpen(true);}}>Details</button>
          {reviewAvailable && <button type="button" className="eflow-text-button" aria-expanded={reviewOpen} onClick={() => void requestNavigation(() => setReviewOpen(!reviewOpen))}>{reviewOpen?'Close review':'Review submission'}</button>}
        </>}/>

        {/* Body */}
        <div id={`task-panel-${task.id}`} role="tabpanel" aria-labelledby={`task-${task.id}-${tab}`} className="flex-1 min-h-0 overflow-y-auto p-4">
          {lifecycle.error && <p role="alert" className="pv-error">{lifecycle.error} Retry the action when resolved.</p>}
          {teamBlocked && currentUserIsLead && !readOnly && <p role="status" className="po-help">In shared projects, only the responsible Office Head can change the task team. Ask your Office Head to update members.</p>}
          {executionBlocked && <p role="status" className="po-help">Proposed Office responsibility: directory linking, Office Head confirmation and explicit handover in Project Offices are required before staffing, execution, evidence or funding.</p>}
          {readOnly && !detailsOpen && <p role="status" className="text-sm text-neutral-500 mb-3">Read-only oversight record</p>}
          {detailsOpen && <section id={`task-details-${task.id}`} aria-label="Task details" className="space-y-4 rounded-lg border border-neutral-200 p-3 mb-4">
            <div className="flex gap-2 flex-wrap"><TaskStatusBadge status={task.status} rejected={rejected}/><PriorityPill priority={task.priority}/></div>
            <TaskDepartmentLabel task={task}/>
            <InspectorSummary task={task} readOnly={readOnly} dependencies={dependencies} canManageSubtasks={canManageSubtasks} overdue={rel.overdue}/>
            <InspectorTeam task={task} profiles={profiles} projectTitle={operationalProject?.title} canManageTaskTeam={canManageTaskTeam} canManageSubtasks={canManageSubtasks} currentUserIsLead={currentUserIsLead} onManage={() => setTeamEditorOpen(true)}/>
            <section aria-label="Advisory staffing"><h3>Staffing suggestions</h3>{staffingReason ? <p className="po-help">{staffingReason}</p> : <><p className="po-help">Review confirmed professional evidence and Office workload before appointing an owner.</p><button className="eflow-text-button" onClick={() => void requestNavigation(() => setStaffingOpen(true))}>Recommend staff</button></>}</section>
          </section>}
          {reviewOpen && reviewAvailable && <section aria-label="Submission review" className="mb-4"><TaskReviewPanel task={task} canReview onDone={() => { onChanged?.(); void requestNavigation(onClose); }}/></section>}
          {tab === 'updates' && !(reviewOpen && reviewAvailable) && <div className="space-y-5">
            <InspectorExecution task={task} subtasks={taskSubtasks} canStart={canStart} canResume={canResume} canSubmit={canSubmit} canPostProgress={capabilities.canPostProgress} busy={lifecycle.busy} onStart={lifecycle.start} onChanged={onChanged} onSubmitted={() => { onChanged?.(); void requestNavigation(onClose); }}/>
            <section aria-label="Task discussion"><h3 className="text-sm font-semibold mb-2">Discussion</h3><TaskDiscussion taskId={task.id} canParticipate={capabilities.canDiscuss}/></section>
            <InspectorProgressUpdates taskId={task.id}/>
          </div>}
          {tab === 'files' && <InspectorFiles task={task} readOnly={readOnly || executionBlocked}/>}
          {tab === 'activity' && <><TaskActivityTimeline taskId={task.id} projectId={task.linkedProjectId}/><WorkActivity roots={[task.id]}/></>}

        </div>
      </InspectorPanel>
      {staffingOpen && !staffingReason && <StaffingDialog task={task} onClose={() => setStaffingOpen(false)} onAssigned={onChanged}/>}
      <TaskTeamEditorDialog
        task={teamEditorOpen && canManageTaskTeam ? task : null}
        profiles={profiles}
        subtasks={taskSubtasks}
        responsibleOrgId={task.orgId || operationalProject?.orgId}
        onClose={() => setTeamEditorOpen(false)}
      />
    </>
  );
}

export { ProjectStatusBadge };

export function TaskInspector(props: Parameters<typeof TaskInspectorContent>[0]) {
 const { tasks, loading } = useTasks();
 const { user, userProfile } = useAuth();
 const context = useProjectOfficeContext();
 const taskId = props.taskId || props.task?.id;
 if (!taskId) return null;
 const canonical = tasks.find(task => task.id === taskId);
 if (loading === false && (!props.task || !canonical || props.task.linkedProjectId && canonical.linkedProjectId !== props.task.linkedProjectId)) return <InspectorPanel open onClose={props.onClose} returnFocus={props.origin?.returnFocus} onReturnFocus={props.origin?.restoreFocus} ariaLabel="Task unavailable" className="w-full sm:w-[520px]"><div className="p-5"><h2>Task unavailable</h2><p>This task was removed or your access changed. Reopen it from an authorized workspace.</p><button onClick={props.onClose}>Close task details</button></div></InspectorPanel>;
 if (!props.task) return null;
 const accountReadOnly = !userProfile || userProfile.is_active === false || userProfile.role === 'admin';
 if (!(canonical || props.task).linkedProjectId) return <TaskInspectorContent key={props.task.id+user?.id} {...props} task={canonical || props.task} readOnly={props.readOnly || accountReadOnly}/>;
 return <ScopedTaskInspector key={props.task.id+user?.id} {...props} task={canonical || props.task} context={context} userId={user?.id || ''} profile={userProfile}/>;
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
 return <ProjectOfficeContext.Provider value={offices}><TaskInspectorContent {...props} readOnly={props.readOnly || restricted}/></ProjectOfficeContext.Provider>;
}
