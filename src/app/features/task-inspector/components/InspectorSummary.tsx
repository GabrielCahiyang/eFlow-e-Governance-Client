import { Info } from 'lucide-react';
import type { Task } from '../../tasks';
import { ProgressBar } from '../../../components/workflow/primitives';
import { WorkBudgetCard } from '../../budget';
export function InspectorSummary({task, readOnly, dependencies, canManageSubtasks, overdue}: {task: Task; readOnly: boolean; dependencies: Task[]; canManageSubtasks: boolean; overdue: boolean}) {
 const unresolvedDependencies = dependencies.filter(t => t.status !== 'completed');
 const percent = task.percentComplete ?? 0;
 return <section aria-label="Task overview" className="space-y-4">              {readOnly && (
                <div className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50/70 p-3">
                  <Info size={15} className="mt-0.5 shrink-0 text-blue-600" />
                  <div>
                    <div className="text-[11.5px] font-medium text-blue-900">Read-only oversight record</div>
                    <p className="mt-0.5 text-[10.5px] leading-relaxed text-blue-700">Inspect delivery, evidence, discussion, and history here. Operational changes remain with the responsible organization.</p>
                  </div>
                </div>
              )}
              {task.description && (
                <div className="text-[13px] font-normal text-neutral-700 leading-relaxed whitespace-pre-wrap">
                  {task.description}
                </div>
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

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">Progress</span>
                  <span className="text-[12px] font-semibold text-neutral-900 tabular-nums">{percent}%</span>
                </div>
                <ProgressBar value={percent} tone={percent === 100 ? "good" : overdue ? "bad" : "neutral"} />
              </div>

              <WorkBudgetCard task={task} canManage={canManageSubtasks} />{(task.dependencyIds?.length || 0) > dependencies.length && <p role="status" className="text-sm text-amber-700">Some dependencies are unavailable. Their completion cannot be verified here.</p>}</section>;
}
