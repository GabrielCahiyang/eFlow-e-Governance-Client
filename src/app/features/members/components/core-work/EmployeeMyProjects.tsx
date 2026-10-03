import { useMemo, useState } from 'react';
import { FolderKanban } from 'lucide-react';
import { useProjectsData } from '../../../../hooks/useSupabaseData';
import type { Task } from '../../../../services/taskService';
import { LoadingState, PageHeader, ProgressBar, SectionEmpty, formatDate, relativeDays } from '../../../../components/workflow/primitives';
import { PriorityPill, ProjectStatusBadge, TaskStatusBadge } from '../../../../components/workflow/StatusBadges';
import { TaskDetailDrawer } from '../../../../components/workflow/TaskDetailDrawer';
import { useMyTasks } from './useMyTasks';

export function EmployeeMyProjects() {
  const { mine } = useMyTasks();
  const { projects, loading } = useProjectsData();
  const [open, setOpen] = useState<Task | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Projects I have tasks in (via linked_project_id) — no confidential data.
  const myProjectIds = useMemo(() => new Set(mine.map((t) => t.linkedProjectId).filter(Boolean) as string[]), [mine]);
  const myProjects = useMemo(() => projects.filter((p) => myProjectIds.has(p.id)), [projects, myProjectIds]);

  if (loading) return <div className="p-8"><LoadingState label="Loading your projects…" /></div>;

  return (
    <div className="p-6 sm:p-8 min-h-full">
      <PageHeader eyebrow="My Workspace · Projects" title="My Projects" subtitle="Projects you're contributing to." />

      {myProjects.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl">
          <SectionEmpty icon={<FolderKanban size={30} />} title="No projects yet" description="Projects you're assigned tasks in will appear here." />
        </div>
      ) : (
        <div className="space-y-3">
          {myProjects.map((p) => {
            const pTasks = mine.filter((t) => t.linkedProjectId === p.id && !t.archivedAt);
            const done = pTasks.filter((t) => t.status === "completed").length;
            const pct = pTasks.length ? Math.round((done / pTasks.length) * 100) : 0;
            const isExp = expandedId === p.id;
            return (
              <div key={p.id} className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                <button onClick={() => setExpandedId(isExp ? null : p.id)} className="w-full text-left p-4 hover:bg-neutral-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1"><ProjectStatusBadge status={p.status} size="sm" /><PriorityPill priority={p.priority} /></div>
                      <h3 className="text-[14px] font-semibold text-neutral-900">{p.title}</h3>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[18px] font-semibold text-neutral-900 tabular-nums">{pct}%</div>
                      <div className="text-[10px] text-neutral-400">{done}/{pTasks.length} my tasks</div>
                    </div>
                  </div>
                  <div className="mt-2"><ProgressBar value={pct} tone={pct === 100 ? "good" : "neutral"} /></div>
                </button>
                {isExp && (
                  <div className="border-t border-neutral-100 divide-y divide-neutral-50">
                    {pTasks.map((t) => {
                      const rel = relativeDays(t.deadline || t.dueDate);
                      return (
                        <button key={t.id} onClick={() => setOpen(t)} className="w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50">
                          <span className="text-[12px] font-normal text-neutral-800 truncate flex-1">{t.title}</span>
                          <span className={`text-[10.5px] ${rel.overdue ? "text-red-600" : "text-neutral-400"}`}>{formatDate(t.deadline || t.dueDate)}</span>
                          <TaskStatusBadge status={t.status} size="sm" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <TaskDetailDrawer task={open} onClose={() => setOpen(null)} canPostProgress canDiscuss />
    </div>
  );
}

// ══════════════════════ Task History ══════════════════════════════
