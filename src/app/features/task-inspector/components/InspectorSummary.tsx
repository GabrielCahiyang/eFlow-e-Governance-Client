import { Building2, Calendar, CalendarDays, Clock3, FolderKanban, Info, Layers } from 'lucide-react';
import { TaskDepartmentLabel, type Task } from '../../tasks';
import { formatDate } from '../../../components/workflow/primitives';
import { TaskStatusBadge, PriorityPill } from '../../../components/workflow/StatusBadges';
import { DeadlineBadge } from '../../../components/ui/DeadlineBadge';
import { WorkBudgetCard } from '../../budget';
import {supportsNestedWork} from '../../nested-work';
import './taskOverview.css';
export function InspectorSummary({task, projectTitle, readOnly, dependencies, canManageSubtasks,rejected,canAuthorizeFunding=false,authorityPending=false,fundingTask,budgetReadOnly}: {task: Task; projectTitle?: string; readOnly: boolean; dependencies: Task[]; canManageSubtasks: boolean; overdue: boolean;rejected?:boolean;canAuthorizeFunding?:boolean;authorityPending?:boolean;fundingTask?:Task;budgetReadOnly?:boolean}) {
 const unresolvedDependencies = dependencies.filter(t => t.status !== 'completed');
 return <section aria-label="Task overview" className="task-overview">              {readOnly && (
                <div className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50/70 p-3">
                  <Info size={15} className="mt-0.5 shrink-0 text-blue-600" />
                  <div>
                    <div className="text-[11.5px] font-medium text-blue-900">Read-only oversight record</div>
                    <p className="mt-0.5 text-[10.5px] leading-relaxed text-blue-700">Inspect delivery, evidence, discussion, and history here. Operational changes remain with the responsible organization.</p>
                  </div>
                </div>
              )}
              <div className="task-overview__summary">
                <div className="task-overview__heading">
                  <h2>Task overview</h2>
                  <div className="task-overview__office"><Building2 size={15} aria-hidden="true"/><TaskDepartmentLabel task={task}/></div>
                </div>
                <div className="task-overview__state">
                  <div><span>Status</span><TaskStatusBadge status={task.status} rejected={rejected}/></div>
                  <div><span>Priority</span><PriorityPill priority={task.priority}/></div>
                </div>
                <div className="task-overview__facts">
                  <InspectorField icon={<CalendarDays size={16} aria-hidden="true"/>} label="Deadline" value={<DeadlineBadge value={task.deadline || task.dueDate} status={task.status}/>}/>
                  <InspectorField icon={<Calendar size={16} aria-hidden="true"/>} label="Start date" value={task.startDate ? formatDate(task.startDate) : 'Not set'}/>
                  <InspectorField icon={<FolderKanban size={16} aria-hidden="true"/>} label="Project" value={projectTitle || task.projectTitle || 'No linked project'}/>
                  {task.estimatedHours != null && <InspectorField icon={<Clock3 size={16} aria-hidden="true"/>} label="Estimated hours" value={String(task.estimatedHours)}/>}
                  {task.programTitle && <InspectorField icon={<Layers size={16} aria-hidden="true"/>} label="Program" value={task.programTitle}/>}
                </div>
              </div>
              {task.description && (
                <section className="task-overview__description" aria-label="Task description"><h3>Description</h3><p>{task.description}</p></section>
              )}

              {task.status === "cancelled" && (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Cancelled</div>
                  <div className="mt-0.5 text-[12.5px] text-neutral-700">
                    {task.cancellationReason || "No cancellation reason recorded."}
                  </div>
                </div>
              )}

              {(Boolean(task.acceptanceCriteria?.length) || task.definitionOfDone) && (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Completion standard</div>
                  {task.acceptanceCriteria?.length ? (
                    <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[12px] text-neutral-700">
                      {task.acceptanceCriteria.map((criterion) => <li key={criterion}>{criterion}</li>)}
                    </ul>
                  ) : null}
                  {task.definitionOfDone && (
                    <div className="mt-2 text-[11.5px] text-neutral-600">Done when: {task.definitionOfDone}</div>
                  )}
                </div>
              )}

              {dependencies.length > 0 && (
                <div className={`rounded-xl border p-3 ${unresolvedDependencies.length ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-600">
                    Dependencies · {dependencies.length - unresolvedDependencies.length}/{dependencies.length} complete
                  </div>
                  <div className="mt-1.5 space-y-1 text-[11.5px] text-neutral-700">
                    {dependencies.map((dependency) => (
                      <div key={dependency.id}>{dependency.status === "completed" ? "✓" : "○"} {dependency.title}</div>
                    ))}
                  </div>
                </div>
              )}

              <WorkBudgetCard task={fundingTask||task} canManage={canManageSubtasks} canAuthorizeFunding={canAuthorizeFunding} readOnly={supportsNestedWork(task)?(budgetReadOnly??readOnly):false} authorityPending={authorityPending}/>{(task.dependencyIds?.length || 0) > dependencies.length && <p role="status" className="text-sm text-amber-700">Some dependencies are unavailable. Their completion cannot be verified here.</p>}</section>;
}

export function InspectorField({
  icon,
  label,
  value,
  hint,
  hintTone,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
  hintTone?: "bad";
}) {
  return (
    <div className="inspector-field">
      <div className="flex items-center gap-1 text-[10.5px] font-medium uppercase tracking-wider text-neutral-400 mb-0.5">
        {icon} {label}
      </div>
      <div className="inspector-field__value text-[12.5px] font-medium text-neutral-900">{value}</div>
      {hint && (
        <div className={`text-[10.5px] font-normal ${hintTone === "bad" ? "text-red-600" : "text-neutral-400"}`}>
          {hint}
        </div>
      )}
    </div>
  );
}
