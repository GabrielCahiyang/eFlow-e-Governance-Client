import {supportsNestedWork,WorkRootOwner,type WorkTreeController} from '../../nested-work';
import { User, Building2, UsersRound } from 'lucide-react';
import { TaskTeamMemberList, getTaskTeamMemberIds, type Task } from '../../tasks';
import { TaskSubtasksWidget } from '../../subtasks';
import type { UserProfile } from '../../../types';
import { InspectorField as Field } from './InspectorSummary';
import type {TaskInspectorOrigin} from '../types';
export function InspectorTeam({task, profiles, projectLeadId, canManageTaskTeam: _canManageTaskTeam, canManageSubtasks, currentUserIsLead, onManage: _onManage,readOnly=false,subtaskReadOnly=false,controller,presentation='drawer',onInspect}: {task: Task; profiles: UserProfile[]; projectTitle?: string; projectLeadId?: string; canManageTaskTeam: boolean; canManageSubtasks: boolean; currentUserIsLead: boolean; onManage: () => void;readOnly?:boolean;subtaskReadOnly?:boolean;controller?:WorkTreeController;presentation?:'drawer'|'page'|'dialog';onInspect?:(id:string,section:'work'|'review',origin:TaskInspectorOrigin)=>void}) {
 const wide = presentation === 'page' || presentation === 'dialog';
 const legacyTeam=(<section className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-neutral-500"><UsersRound size={12} /> Task members · {getTaskTeamMemberIds(task).length}</div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5"><TaskTeamMemberList task={task} profiles={profiles} /></div>
              </section>);
 return <section aria-label="Task team and subtasks" className={wide?'task-page__work':undefined}>
              {presentation === 'drawer' && (
                <div>
                  {!supportsNestedWork(task)&&<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field icon={<User size={13} />} label="Assignee" value={task.teamMemberNames && task.teamMemberNames.length > 0 ? task.teamMemberNames.join(", ") : task.assigneeName || "Unassigned"} />
                    {task.teamName && <Field icon={<Building2 size={13} />} label="Team" value={task.teamName} />}
                  </div>}
                  {supportsNestedWork(task)?<section aria-label="Task Lead and contributors"><WorkRootOwner rootId={task.id} controller={controller} projectLeadId={projectLeadId} readOnly={readOnly} fallback={legacyTeam} layout="default"/></section>:legacyTeam}
                </div>
              )}
              {wide && !supportsNestedWork(task) && (
                <div className="task-page__people-bar">{legacyTeam}</div>
              )}
              <div className={wide?'task-page__subitems':'border-t border-neutral-100 pt-3'}>
                <TaskSubtasksWidget
                  onInspect={onInspect}
                  taskId={task.id}
                  controller={controller}
                  allowedAssignees={getTaskTeamMemberIds(task).map((id) => ({
                    id,
                    name: profiles.find((profile) => profile.id === id)?.full_name
                      || (task.teamMemberIds || []).map((memberId, index) => [memberId, task.teamMemberNames?.[index]] as const).find(([memberId]) => memberId === id)?.[1]
                      || (id === task.assigneeId ? task.assigneeName : undefined)
                      || "Team Member",
                  }))}
                  canManage={canManageSubtasks&&!readOnly&&!subtaskReadOnly}
                  readOnly={readOnly||subtaskReadOnly}
                  parentTask={task}
                  startParentOnCreate={currentUserIsLead}
                />
              </div></section>;
}
