import { EmptyState } from '../../../../components/ui/EmptyState';
import { GitBranch, Link2, Unlink } from "lucide-react";
import type { Task } from "../../../../services/taskService";
import { statusMeta } from "./model";

export function DependenciesBoardView({
  tasks,
  onOpenTaskEditor,
}: {
  tasks: Task[];
  onOpenTaskEditor?: (task: Task) => void;
}) {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const taskRows = tasks.filter((task) => (task.dependencyIds || []).length > 0);

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm" aria-label="Task dependencies view">
      <header className="border-b border-neutral-200 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400"><GitBranch size={13} /> Dependencies</div>
        <h2 className="mt-1 text-base font-semibold text-neutral-900">Prerequisite work</h2>
        <p className="mt-1 text-xs leading-relaxed text-neutral-500">Only task records in the current board scope are shown. Dependencies outside that scope stay protected and are identified without exposing their details.</p>
      </header>
      {taskRows.length === 0 ? <EmptyState fill illustration="tasks" size="compact" title="No dependencies are recorded for the current scope."/> : <div className="divide-y divide-neutral-100">{taskRows.map((task) => (
        <article key={task.id} className="px-4 py-4 sm:px-5">
          {onOpenTaskEditor ? <button type="button" onClick={() => onOpenTaskEditor(task)} className="break-words text-left text-[13px] font-semibold leading-snug text-neutral-900 hover:text-violet-700">{task.title}</button> : <h3 className="break-words text-[13px] font-semibold leading-snug text-neutral-900">{task.title}</h3>}
          <div className="mt-2 flex flex-wrap gap-2">{task.dependencyIds?.map((dependencyId) => {
            const dependency = taskById.get(dependencyId);
            const meta = dependency ? statusMeta[dependency.status] : undefined;
            return <span key={dependencyId} className="inline-flex max-w-full items-start gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-[11px] text-neutral-700">{dependency ? <Link2 size={12} className="mt-0.5 shrink-0 text-violet-600" /> : <Unlink size={12} className="mt-0.5 shrink-0 text-neutral-400" />}<span className="min-w-0 break-words">{dependency ? dependency.title : "Dependency outside current scope"}{meta && <span className={`ml-1.5 inline-block rounded-full border px-1.5 py-0.5 text-[9px] ${meta.color}`}>{meta.label}</span>}</span></span>;
          })}</div>
        </article>
      ))}</div>}
    </section>
  );
}
