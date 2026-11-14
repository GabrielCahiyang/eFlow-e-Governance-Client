import { EmptyState } from '../../../../components/ui/EmptyState';
import { useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, CalendarClock, Clock, Inbox } from 'lucide-react';
import type { Task } from '../../../../services/taskService';
import { isActive } from '../../../../services/taskSelectors';
import { Card, PageHeader, StatCard, relativeDays } from '../../../../components/workflow/primitives';
import { TaskDetailDrawer } from "../../../task-inspector";
import { TaskStatusLabel } from '../../../tasks';
import { workDay } from '../../../../shared/workCalendar';
import { useMyTasks } from './useMyTasks';

function EmployeeDeadlinesGroupsSkeleton() {
  const pulse = "animate-pulse rounded bg-neutral-200/80";
  return (
    <div role="status" aria-label="Loading deadlines…" aria-busy="true">
      <span className="sr-only">Loading deadlines…</span>
      {["Overdue", "Due today", "Awaiting review", "Upcoming"].map((title) => (
        <Card key={title} title={title} bodyClassName="p-0" className="mb-3">
          <div className="divide-y divide-neutral-100" aria-hidden="true">
            {[0, 1].map((row) => (
              <div key={row} className="flex w-full items-center gap-3 px-4 py-2.5">
                <span className={`h-2 w-2 rounded-full shrink-0 ${pulse}`} />
                <span className={`h-4 flex-1 max-w-[320px] ${pulse}`} />
                <span className={`h-3 w-20 ${pulse}`} />
                <span className={`h-5 w-20 rounded-full ${pulse}`} />
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

export function EmployeeDeadlines() {
  const { mine, loading } = useMyTasks();
  const [open, setOpen] = useState<Task | null>(null);

  const active = useMemo(() => mine.filter(isActive), [mine]);

  const groups = useMemo(() => {
    const todayDay = workDay(Date.now());
    const overdue: Task[] = [], today: Task[] = [], upcoming: Task[] = [], awaiting: Task[] = [];
    active.forEach((t) => {
      if (t.status === "for_review") { awaiting.push(t); return; }
      const dl = t.deadline || t.dueDate;
      if (!dl || (typeof dl === "string" && /month|phase|week|quarter|ongoing|tbd|q[1-4]/i.test(dl))) { upcoming.push(t); return; }
      const day = workDay(dl);
      if (day === null || todayDay === null) { upcoming.push(t); return; }
      if (day < todayDay) overdue.push(t);
      else if (day === todayDay) today.push(t);
      else upcoming.push(t);
    });
    const byDate = (a: Task, b: Task) => (workDay(a.deadline || a.dueDate) ?? Infinity) - (workDay(b.deadline || b.dueDate) ?? Infinity);
    return { overdue: overdue.sort(byDate), today: today.sort(byDate), upcoming: upcoming.sort(byDate), awaiting };
  }, [active]);

  const statVal = (n: number) =>
    loading ? <span className="inline-block h-6 w-10 animate-pulse rounded bg-muted" /> : n;

  const section = (title: string, tasks: Task[], tone: "bad" | "warn" | "neutral" | "info", _icon: ReactNode) => (
    <Card title={`${title} (${tasks.length})`} bodyClassName="p-0" className="mb-3">
      {tasks.length === 0 ? (
        <EmptyState illustration="tasks" size="compact" title="Nothing here."/>
      ) : (
        <div className="divide-y divide-neutral-100">
          {tasks.map((t) => {
            const rel = relativeDays(t.deadline || t.dueDate);
            return (
              <button key={t.id} onClick={() => setOpen(t)} className="flex w-full flex-wrap items-center gap-2 px-4 py-2.5 text-left hover:bg-neutral-50 sm:flex-nowrap sm:gap-3">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tone === "bad" ? "bg-red-500" : tone === "warn" ? "bg-amber-500" : tone === "info" ? "bg-blue-500" : "bg-neutral-400"}`} />
                <span className="min-w-0 basis-[calc(100%-1rem)] break-words text-[12.5px] font-normal text-neutral-800 sm:basis-auto sm:flex-1 sm:truncate">{t.title}</span>
                <span className={`text-[10.5px] font-medium ${rel.overdue ? "text-red-600" : "text-neutral-400"}`}>{t.status === "for_review" ? "Awaiting review" : rel.label}</span>
                <TaskStatusLabel customStatusId={t.customStatusId} status={t.status} />
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );

  return (
    <div className="eflow-operational-workspace min-h-full p-4 sm:p-8">
      <PageHeader eyebrow="My Workspace · Deadlines" title="Deadlines" subtitle="Stay ahead of what's due and what's waiting on review." />

      <div className="mb-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Overdue" value={statVal(groups.overdue.length)} tone={groups.overdue.length ? "bad" : "good"} icon={<AlertTriangle size={15} />} />
        <StatCard label="Due today" value={statVal(groups.today.length)} tone={groups.today.length ? "warn" : "neutral"} icon={<Clock size={15} />} />
        <StatCard label="Upcoming" value={statVal(groups.upcoming.length)} tone="info" icon={<CalendarClock size={15} />} />
        <StatCard label="Awaiting review" value={statVal(groups.awaiting.length)} icon={<Inbox size={15} />} />
      </div>

      {loading ? (
        <EmployeeDeadlinesGroupsSkeleton />
      ) : (
        <>
          {section("Overdue", groups.overdue, "bad", null)}
          {section("Due today", groups.today, "warn", null)}
          {section("Awaiting review", groups.awaiting, "neutral", null)}
          {section("Upcoming", groups.upcoming, "info", null)}
        </>
      )}

      <TaskDetailDrawer task={open} onClose={() => setOpen(null)} canPostProgress canDiscuss />
    </div>
  );
}
