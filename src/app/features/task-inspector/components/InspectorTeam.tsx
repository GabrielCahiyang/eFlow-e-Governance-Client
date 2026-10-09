import {supportsNestedWork,WorkRootOwner} from '../../nested-work';
import { Calendar, User, Building2, Layers, Pencil, UsersRound } from 'lucide-react';
import { TaskTeamMemberList, getTaskTeamMemberIds, type Task } from '../../tasks';
import { TaskSubtasksWidget } from '../../subtasks';
import type { UserProfile } from '../../../types';
import { formatDate, relativeDays } from '../../../components/workflow/primitives';
export function InspectorTeam({task, profiles, projectTitle, canManageTaskTeam, canManageSubtasks, currentUserIsLead, onManage}: {task: Task; profiles: UserProfile[]; projectTitle?: string; canManageTaskTeam: boolean; canManageSubtasks: boolean; currentUserIsLead: boolean; onManage: () => void}) {
 const legacyTeam=(<section className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-neutral-500"><UsersRound size={12} /> Task members · {getTaskTeamMemberIds(task).length}</div>
                  {canManageTaskTeam && <button type="button" onClick={() => onManage()} className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[9.5px] font-medium text-neutral-600 hover:text-neutral-900"><Pencil size={10} /> Manage</button>}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5"><TaskTeamMemberList task={task} profiles={profiles} /></div>
              </section>);
 const rel = relativeDays(task.deadline || task.dueDate);
 return <section aria-label="Task team and subtasks">              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field icon={<User size={13} />} label="Assignee" value={task.teamMemberNames && task.teamMemberNames.length > 0 ? task.teamMemberNames.join(", ") : task.assigneeName || "Unassigned"} />
                <Field icon={<Calendar size={13} />} label="Deadline" value={formatDate(task.deadline || task.dueDate)} hint={rel.label} hintTone={rel.overdue ? "bad" : undefined} />
                {task.startDate && <Field icon={<Calendar size={13}/>} label="Start date" value={formatDate(task.startDate)}/>}
                {task.estimatedHours != null && <Field icon={<Layers size={13}/>} label="Estimated hours" value={String(task.estimatedHours)}/>}
                {task.teamName && <Field icon={<Building2 size={13} />} label="Team" value={task.teamName} />}
                {(projectTitle || task.projectTitle) && (
                  <Field
                    icon={<Layers size={13} />}
                    label="Project"
                    value={projectTitle || task.projectTitle || "—"}
                  />
                )}
                {task.programTitle && <Field icon={<Layers size={13} />} label="Program" value={task.programTitle} />}
              </div>

              {supportsNestedWork(task)?<section aria-label="Task lead and contributors"><WorkRootOwner rootId={task.id} fallback={legacyTeam}/></section>:legacyTeam}
              <div className="border-t border-neutral-100 pt-3">
                <TaskSubtasksWidget
                  taskId={task.id}
                  allowedAssignees={getTaskTeamMemberIds(task).map((id) => ({
                    id,
                    name: profiles.find((profile) => profile.id === id)?.full_name
                      || (task.teamMemberIds || []).map((memberId, index) => [memberId, task.teamMemberNames?.[index]] as const).find(([memberId]) => memberId === id)?.[1]
                      || (id === task.assigneeId ? task.assigneeName : undefined)
                      || "Team Member",
                  }))}
                  canManage={canManageSubtasks}
                  parentTask={task}
                  startParentOnCreate={currentUserIsLead}
                />
              </div></section>;
}

function Field({
  icon,
  label,
  value,
  hint,
  hintTone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  hintTone?: "bad";
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[10.5px] font-medium uppercase tracking-wider text-neutral-400 mb-0.5">
        {icon} {label}
      </div>
      <div className="text-[12.5px] font-medium text-neutral-900 truncate">{value}</div>
      {hint && (
        <div className={`text-[10.5px] font-normal ${hintTone === "bad" ? "text-red-600" : "text-neutral-400"}`}>
          {hint}
        </div>
      )}
    </div>
  );
}
