import { useMemo, useState } from 'react';
import { Tab, TabList, TabsContext } from '@vibe/core';
import { Archive, CheckCircle2, History, RotateCcw, XCircle } from 'lucide-react';
import type { Task } from '../../../../services/taskService';
import { Card, PageHeader, SectionEmpty, formatDate } from '../../../../components/workflow/primitives';
import { TaskDetailDrawer } from "../../../task-inspector";
import { TaskStatusLabel } from '../../../tasks';
import { useMyTasks } from './useMyTasks';

function EmployeeTaskHistoryListSkeleton() {
  const pulse = "animate-pulse rounded bg-neutral-200/80";
  return (
    <div
      className="divide-y divide-neutral-100"
      role="status"
      aria-label="Loading your history…"
      aria-busy="true"
    >
      <span className="sr-only">Loading your history…</span>
      {[0, 1, 2, 3].map((row) => (
        <div key={row} aria-hidden="true" className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1 min-w-0 space-y-1.5">
            <span className={`block h-4 w-64 max-w-full ${pulse}`} />
            <span className={`block h-3 w-40 ${pulse}`} />
          </div>
          <span className={`h-5 w-20 rounded-full ${pulse}`} />
        </div>
      ))}
    </div>
  );
}

export function EmployeeTaskHistory() {
  const { mine, loading } = useMyTasks();
  const [tab, setTab] = useState<"completed" | "rejected" | "reopened" | "archived">("completed");
  const [open, setOpen] = useState<Task | null>(null);

  const buckets = useMemo(() => ({
    completed: mine.filter((t) => t.status === "completed" && !t.archivedAt),
    rejected: mine.filter((t) => t.status === "changes_requested" && !t.archivedAt),
    reopened: mine.filter((t) => t.reopenReason && !t.archivedAt),
    archived: mine.filter((t) => !!t.archivedAt),
  }), [mine]);

  const rows = buckets[tab];
  const tabMeta = [
    { id: "completed", label: "Completed", icon: <CheckCircle2 size={13} /> },
    { id: "rejected", label: "Needs changes", icon: <XCircle size={13} /> },
    { id: "reopened", label: "Reopened", icon: <RotateCcw size={13} /> },
    { id: "archived", label: "Archived", icon: <Archive size={13} /> },
  ] as const;

  return (
    <div className="eflow-operational-workspace min-h-full p-4 sm:p-8">
      <PageHeader eyebrow="My Workspace · History" title="Task History" subtitle="Your finished and past work, kept out of your active queue." />

      <div className="mb-4 max-w-full overflow-x-auto">
        <TabsContext
          id="member-task-history-tabs"
          activeTabId={tabMeta.findIndex((item) => item.id === tab)}
        >
          <TabList id="member-task-history-tab-list">
        {tabMeta.map((t) => (
          <Tab
            key={t.id}
            id={`member-task-history-${t.id}`}
            active={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            <span className="inline-flex items-center gap-1.5">{t.icon} {t.label} <span className="eflow-tabular opacity-70">({loading ? "…" : buckets[t.id].length})</span></span>
          </Tab>
        ))}
          </TabList>
        </TabsContext>
      </div>

      <Card bodyClassName="p-0">
        {loading ? (
          <EmployeeTaskHistoryListSkeleton />
        ) : rows.length === 0 ? (
          <SectionEmpty fill illustration="tasks" icon={<History size={30} />} title="Nothing here yet" description="This history bucket is empty." />
        ) : (
          <div className="divide-y divide-neutral-100">
            {rows.map((t) => (
              <button key={t.id} onClick={() => setOpen(t)} className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-neutral-50">
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium text-neutral-900 truncate">{t.title}</div>
                  <div className="text-[10.5px] text-neutral-400 mt-0.5">
                    {tab === "completed" ? `Completed ${formatDate(t.updatedAt)}` :
                     tab === "rejected" ? `Feedback: ${t.rejectionNote}` :
                     tab === "reopened" ? `Reopened: ${t.reopenReason}` :
                     `Archived ${formatDate(t.archivedAt)}`}
                  </div>
                </div>
                <TaskStatusLabel customStatusId={t.customStatusId} status={t.archivedAt ? "archived" : t.status} />
              </button>
            ))}
          </div>
        )}
      </Card>

      <TaskDetailDrawer task={open} onClose={() => setOpen(null)} canDiscuss={false} />
    </div>
  );
}
