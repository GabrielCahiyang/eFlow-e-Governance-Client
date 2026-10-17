import {supportsNestedWork,WorkRootOwner,type WorkTreeController} from '../../nested-work';
import { User, Building2, Pencil, UsersRound } from 'lucide-react';
import { TaskTeamMemberList, getTaskTeamMemberIds, type Task } from '../../tasks';
import { TaskSubtasksWidget } from '../../subtasks';
import type { UserProfile } from '../../../types';
import { InspectorField as Field } from './InspectorSummary';
import {Heading} from '@vibe/core';
export function InspectorTeam({task, profiles, canManageTaskTeam, canManageSubtasks, currentUserIsLead, onManage,readOnly=false,controller,presentation='drawer'}: {task: Task; profiles: UserProfile[]; projectTitle?: string; canManageTaskTeam: boolean; canManageSubtasks: boolean; currentUserIsLead: boolean; onManage: () => void;readOnly?:boolean;controller?:WorkTreeController;presentation?:'drawer'|'page'}) {
 const legacyTeam=(<section className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-neutral-500"><UsersRound size={12} /> Task members · {getTaskTeamMemberIds(task).length}</div>
                  {canManageTaskTeam && !readOnly && !supportsNestedWork(task) && <button type="button" onClick={() => onManage()} className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[9.5px] font-medium text-neutral-600 hover:text-neutral-900"><Pencil size={10} /> Manage</button>}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5"><TaskTeamMemberList task={task} profiles={profiles} /></div>
              </section>);
 return <section aria-label="Task team and subtasks" className={presentation==='page'?'task-page__work':undefined}>
              <div className={presentation==='page'?'task-page__card task-page__team':undefined}>
              {presentation==='page'&&<div className="task-page__card-heading"><Heading type="h2">Task team</Heading><p>Who’s leading and helping with this task.</p></div>}
              {!(presentation==='page'&&supportsNestedWork(task))&&<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field icon={<User size={13} />} label="Assignee" value={task.teamMemberNames && task.teamMemberNames.length > 0 ? task.teamMemberNames.join(", ") : task.assigneeName || "Unassigned"} />
                {task.teamName && <Field icon={<Building2 size={13} />} label="Team" value={task.teamName} />}
              </div>}

              {supportsNestedWork(task)?<section aria-label="Task lead and contributors"><WorkRootOwner rootId={task.id} controller={controller} readOnly={readOnly} fallback={legacyTeam}/></section>:legacyTeam}
              </div>
              <div className={presentation==='page'?'task-page__card task-page__subitems':'border-t border-neutral-100 pt-3'}>
                <TaskSubtasksWidget
                  taskId={task.id}
                  controller={controller}
                  allowedAssignees={getTaskTeamMemberIds(task).map((id) => ({
                    id,
                    name: profiles.find((profile) => profile.id === id)?.full_name
                      || (task.teamMemberIds || []).map((memberId, index) => [memberId, task.teamMemberNames?.[index]] as const).find(([memberId]) => memberId === id)?.[1]
                      || (id === task.assigneeId ? task.assigneeName : undefined)
                      || "Team Member",
                  }))}
                  canManage={canManageSubtasks&&!readOnly}
                  readOnly={readOnly}
                  parentTask={task}
                  startParentOnCreate={currentUserIsLead}
                />
              </div></section>;
}
