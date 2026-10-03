import { useMemo, useState } from 'react';
import { CheckCircle2, ListTodo } from 'lucide-react';
import type { Task } from '../../../../services/taskService';
import { Card, LoadingState, PageHeader, ProgressBar, SearchInput, SectionEmpty, StatCard, WSelect, relativeDays } from '../../../../components/workflow/primitives';
import { PriorityPill, TaskStatusBadge } from '../../../../components/workflow/StatusBadges';
import { TaskDetailDrawer } from '../../../../components/workflow/TaskDetailDrawer';
import { useMyTasks } from './useMyTasks';

export function EmployeeMyTasks() {
  const { mine, loading } = useMyTasks();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [open, setOpen] = useState<Task | null>(null);

  const active = useMemo(() => mine.filter((t) => !t.archivedAt), [mine]);
  const filtered = useMemo(() => {
    let rows = active;
    if (statusFilter === "active") rows = rows.filter((t) => t.status !== "completed");
    else if (statusFilter !== "all") rows = rows.filter((t) => t.status === statusFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter((t) => t.title.toLowerCase().includes(q));
    }
    return rows.sort((a, b) => {
      const da = new Date(a.deadline || a.dueDate || 0).getTime();
      const db = new Date(b.deadline || b.dueDate || 0).getTime();
      return da - db;
    });
  }, [active, statusFilter, query]);

  // "Needs changes" is now the first-class changes_requested state (not an
  // in_progress task carrying a note), so history/reports separate rework from
  // ordinary work.
  const rejected = active.filter((t) => t.status === "changes_requested");

  if (loading) return <div className="p-8"><LoadingState label="Loading your tasks…" /></div>;

  return (
    <div className="p-6 sm:p-8 min-h-full">
      <PageHeader eyebrow="My Workspace · Tasks" title="My Tasks" subtitle="Post progress, discuss, and submit your work." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Active" value={active.filter((t) => t.status !== "completed").length} icon={<ListTodo size={15} />} />
        <StatCard label="In progress" value={active.filter((t) => t.status === "in_progress").length} tone="info" />
        <StatCard label="In review" value={active.filter((t) => t.status === "for_review").length} tone="warn" />
        <StatCard label="Needs changes" value={rejected.length} tone={rejected.length ? "bad" : "good"} />
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <SearchInput value={query} onChange={setQuery} placeholder="Search my tasks…" className="w-[240px]" />
        <WSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "active", label: "Active" },
            { value: "todo", label: "To Do" },
            { value: "in_progress", label: "In Progress" },
            { value: "changes_requested", label: "Needs Changes" },
            { value: "for_review", label: "In Review" },
            { value: "all", label: "All" },
          ]}
        />
      </div>

      <Card bodyClassName="p-0">
        {filtered.length === 0 ? (
          <SectionEmpty icon={<CheckCircle2 size={30} />} title="Nothing here" description="No tasks match — enjoy the clear queue!" />
        ) : (
          <div className="divide-y divide-neutral-100">
            {filtered.map((t) => {
              const rel = relativeDays(t.deadline || t.dueDate);
              const pct = t.percentComplete ?? 0;
              return (
                <button key={t.id} onClick={() => setOpen(t)} className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-neutral-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12.5px] font-medium text-neutral-900 truncate">{t.title}</span>
                      <PriorityPill priority={t.priority} />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-24"><ProgressBar value={pct} tone={pct === 100 ? "good" : rel.overdue ? "bad" : "neutral"} /></div>
                      <span className="text-[10.5px] text-neutral-400 tabular-nums">{pct}%</span>
                      <span className={`text-[10.5px] ${rel.overdue ? "text-red-600" : "text-neutral-400"}`}>{rel.label}</span>
                    </div>
                  </div>
                  <TaskStatusBadge status={t.status} size="sm" />
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <TaskDetailDrawer task={open} onClose={() => setOpen(null)} canPostProgress canDiscuss onChanged={() => {}} />
    </div>
  );
}

// ══════════════════════ My Projects ═══════════════════════════════
