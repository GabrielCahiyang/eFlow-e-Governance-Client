import {WorkStatusControl,approvedWorkProgress} from '../../work-state';
import type {TaskInspectorOrigin} from '../../task-inspector';
import { useConfirmation } from '../../../components/ui/useConfirmation';
import { assignTask, getTaskLeadId, type Task } from '../../tasks';
import { TaskOfficeControl } from '../../project-offices';
import type { Organization, UserProfile } from '../../../types';
import type { ProjectColumn, WorkspaceTaskPatch } from '../types';
import { TimelineCell, DependencyCell, NumberCell } from './PlanningCells';
import { supportsNestedWork, WorkRootOwner, type WorkTreeController } from '../../nested-work';
import { AsyncSelectCell } from './AsyncSelectCell';
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

export function ProjectTaskCell({ column, task, tasks, profiles, people, orgs, editable, busy, readOnly=false, controller, canSetOffice, hasStaffedSubitems, statuses, onOpenWork,canUpdateWork,canSubmitWork, save, write }: {
  onOpenWork?:(section:TaskInspectorOrigin['section'])=>void;canUpdateWork?:boolean;canSubmitWork?:boolean;column: ProjectColumn; task: Task; tasks: Task[]; profiles: UserProfile[]; people: UserProfile[]; orgs: Organization[]; editable: boolean; busy: boolean; readOnly?:boolean; controller?:WorkTreeController; canSetOffice: boolean; hasStaffedSubitems: boolean; statuses: Task['status'][]; save: (patch: WorkspaceTaskPatch) => Promise<void>; write: (operation: () => Promise<void>) => Promise<void>;
}) {
  const disabled = !editable || busy;
  if (column === 'office') return <TaskOfficeControl task={task} organizations={orgs} canManage={canSetOffice} hasStaffedSubitems={hasStaffedSubitems}/>;
  if (column === 'owner') {const legacy=<OwnerCell task={task} profiles={profiles} people={people} disabled={disabled || !!task.proposedOfficeIdentityId || task.status === 'for_review'} write={write}/>;return supportsNestedWork(task)?<WorkRootOwner rootId={task.id} controller={controller} readOnly={readOnly || busy || !!task.proposedOfficeIdentityId || !!task.archivedAt || ['for_review','completed','cancelled'].includes(task.status)} fallback={legacy}/>:legacy;}
  if (column === 'status') return <WorkStatusControl status={task.status} stuck={!!controller?.data?.root.blocker} disabled={busy||!canUpdateWork} onStart={statuses.includes('in_progress')||task.status==='in_progress'?()=>onOpenWork?.('work'):undefined} onBlocker={()=>onOpenWork?.('report-blocker')} onSubmit={canSubmitWork?()=>onOpenWork?.('submit-work'):undefined}/>;
  if (column === 'priority') return <AsyncSelectCell className={'pt-priority pt-priority--' + task.priority} value={task.priority || 'medium'} label={'Priority for ' + task.title} disabled={disabled} onSave={priority => save({ priority: priority as Task['priority'] })}>{['low','medium','high'].map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</AsyncSelectCell>;
  if (column === 'timeline') return <TimelineCell task={task} disabled={disabled} save={save}/>;
  if (column === 'effort') return <NumberCell label={'Estimated hours for ' + task.title} value={task.estimatedHours || 0} disabled={disabled} field="estimated_hours" save={save}/>;
  if (column === 'dependencies') return <DependencyCell task={task} tasks={tasks} disabled={disabled} save={save}/>;
  if (column === 'budget') return <NumberCell label={'Budget estimate for ' + task.title} value={task.budgetImpact || 0} disabled={disabled} field="budget_impact" save={save}/>;
  const steps=approvedWorkProgress(controller?.data?.nodes||[]);
  const progress=task.status==='completed'?100:steps.percent;
  return <div className="pt-progress" aria-label={'Progress for ' + task.title}><progress max={100} value={progress}/><span>{task.status==='completed'?'Approved':steps.total?`${steps.approved}/${steps.total} steps approved`:'Awaiting approval'}</span></div>;
}
