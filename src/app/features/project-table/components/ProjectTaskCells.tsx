import {approvedWorkProgress,workStateLabel,WorkStatusControl} from '../../work-state';
import {useWorkStatus} from '../../work-status';
import { ProjectTaskBudgetCell, ProjectWorkExpensesCell } from '../../budget';
import { useConfirmation } from '../../../components/ui/useConfirmation';
import { assignTask, getTaskLeadId, type Task } from '../../tasks';
import { TaskOfficeControl } from '../../project-offices';
import type { Organization, UserProfile } from '../../../types';
import type { ProjectColumn, WorkspaceTaskPatch } from '../types';
import { TimelineCell, DependencyCell, NumberCell } from './PlanningCells';
import { supportsNestedWork, WorkRootOwner, type WorkTreeController } from '../../nested-work';
import { AsyncSelectCell, PriorityCell } from '../../../components/ui/workspace';
import '../cellEditors.css';

function OwnerCell({ task, people, profiles, disabled, write }: { task: Task; people: UserProfile[]; profiles: UserProfile[]; disabled: boolean; write: (operation: () => Promise<void>) => Promise<void> }) {
  const owner = getTaskLeadId(task), person = profiles.find(profile => profile.id === owner), { confirm, dialog } = useConfirmation();
  return <><div className="pt-owner"><span className="pt-avatar" aria-hidden="true">{person?.full_name?.split(' ').map(part => part[0]).slice(0, 2).join('') || '+'}</span>
    <AsyncSelectCell value={task.assigneeId || ''} label={'Owner for ' + task.title} disabled={disabled} onSave={async id => {
      const selected = people.find(profile => profile.id === id);
      if (!await confirm({ title: 'Change task lead', description: 'Appoint ' + (selected?.full_name || 'Unassigned') + ' for ' + task.title + '? Existing contributors are retained. Its responsible Office keeps control of staffing.', actionLabel: 'Confirm task lead' })) return false;
      await write(() => assignTask(task.id, id, selected?.full_name || '', { teamId: task.teamId, teamName: task.teamName, teamMemberIds: [...new Set([...(task.teamMemberIds || []), id].filter(Boolean))] }));
    }}><option value="">Unassigned</option>{people.map(profile => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}{owner && !people.some(profile => profile.id === owner) && <option value={owner}>{person?.full_name || task.assigneeName || 'Assigned person'}</option>}</AsyncSelectCell>
  </div>{dialog}</>;
}

export function ProjectTaskCell({ column, task, tasks, profiles, people, orgs, editable, busy, readOnly=false, controller, canSetOffice, hasStaffedSubitems, save, write, canUpdateWork, canSubmitWork, statuses = [], onOpenWork }: {
  column: ProjectColumn; task: Task; tasks: Task[]; profiles: UserProfile[]; people: UserProfile[]; orgs: Organization[]; editable: boolean; busy: boolean; readOnly?:boolean; controller?:WorkTreeController; canUpdateWork?:boolean;canSubmitWork?:boolean;statuses?:Task['status'][];onOpenWork?:(section?:import('../../task-inspector').TaskInspectorOrigin['section'])=>void; canSetOffice: boolean; hasStaffedSubitems: boolean; save: (patch: WorkspaceTaskPatch) => Promise<void>; write: (operation: () => Promise<void>) => Promise<void>;
}) {
  const disabled = !editable || busy;
  const blocked=!!controller?.data?.root.blocker;
  const status=useWorkStatus(blocked?'stuck':task.status,workStateLabel(task.status,blocked),task.customStatusId);
  if (column === 'office') return <TaskOfficeControl task={task} organizations={orgs} canManage={canSetOffice} hasStaffedSubitems={hasStaffedSubitems}/>;
  if (column === 'owner') {const legacy=<OwnerCell task={task} profiles={profiles} people={people} disabled={disabled || !!task.proposedOfficeIdentityId || task.status === 'for_review'} write={write}/>;return supportsNestedWork(task)?<WorkRootOwner rootId={task.id} controller={controller} readOnly={readOnly || busy || !!task.proposedOfficeIdentityId || !!task.archivedAt || ['for_review','completed','cancelled'].includes(task.status)} fallback={legacy}/>:legacy;}
  if (column === 'status') return canUpdateWork && onOpenWork
    ? <WorkStatusControl status={task.status} customStatusId={task.customStatusId} stuck={blocked} disabled={busy} onStart={statuses.includes('in_progress')||task.status==='in_progress'?()=>onOpenWork('work'):undefined} onBlocker={()=>onOpenWork('report-blocker')} onSubmit={canSubmitWork?()=>onOpenWork('submit-work'):undefined}/>
    : <span className={`work-status-trigger work-status-trigger--${blocked?'stuck':task.status}`} style={status.color ? {boxShadow:`inset 3px 0 ${status.color}`} : undefined}>{status.label}</span>;
  if (column === 'priority') return <PriorityCell value={task.priority} title={task.title} disabled={disabled} onSave={priority => save({ priority })}/>;
  if (column === 'timeline') return <TimelineCell task={task} disabled={disabled} save={save}/>;
  if (column === 'effort') return <NumberCell label={'Estimated hours for ' + task.title} value={task.estimatedHours || 0} disabled={disabled} field="estimated_hours" save={save}/>;
  if (column === 'dependencies') return <DependencyCell task={task} tasks={tasks} disabled={disabled} save={save}/>;
  if (column === 'budget') return <ProjectTaskBudgetCell task={task} readOnly={readOnly||busy||!editable}/>;
  if (column === 'actualExpenses') return <ProjectWorkExpensesCell task={task}/>;
  const steps=approvedWorkProgress(controller?.data?.nodes||[]);
  const progress=task.status==='completed'?100:steps.percent;
  return <div className="pt-progress" aria-label={'Progress for ' + task.title}><progress max={100} value={progress}/><span>{task.status==='completed'?'Approved':steps.total?`${steps.approved}/${steps.total} steps complete`:workStateLabel(task.status)}</span></div>;
}
