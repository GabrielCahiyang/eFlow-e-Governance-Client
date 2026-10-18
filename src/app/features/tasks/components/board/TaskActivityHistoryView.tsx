import { EmptyState } from '../../../../components/ui/EmptyState';
import { useEffect, useMemo, useState } from "react";
import { Activity, CircleDot, History, RefreshCw } from "lucide-react";
import type { Task } from "../../../../services/taskService";
import {
  fetchTaskActivityHistory,
  type BoardActivityItem,
} from "../../services/taskActivityService";
import { formatShortDateTime } from "./model";

export function TaskActivityHistoryView({
  tasks,
  onOpenTaskEditor,
}: {
  tasks: Task[];
  onOpenTaskEditor?: (task: Task) => void;
}) {
  const taskIds = useMemo(() => tasks.map((task) => task.id).sort(), [tasks]);
  const taskIdsKey = taskIds.join(",");
  const taskById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );
  const [items, setItems] = useState<BoardActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void fetchTaskActivityHistory(taskIds)
      .then((next) => {
        if (active) setItems(next);
      })
      .catch((loadError) => {
        if (active) {
          setItems([]);
          setError(loadError instanceof Error ? loadError.message : "Activity history could not be loaded.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [taskIds, taskIdsKey, revision]);

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm" aria-label="Task activity history">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
            <History size={13} /> Activity history
          </div>
          <h2 className="mt-1 text-base font-semibold text-neutral-900">Work record activity</h2>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">Status and task activity for the same scoped records shown in every core board view.</p>
        </div>
        <button
          type="button"
          onClick={() => setRevision((value) => value + 1)}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 text-[11px] font-medium text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </header>

      {loading ? (
        <div className="space-y-3 px-5 py-6" aria-live="polite" role="status">
          {[0, 1, 2].map((item) => <div key={item} className="h-12 animate-pulse rounded-lg bg-neutral-50" />)}
        </div>
      ) : error ? (
        <div className="px-5 py-8 text-center text-xs text-rose-700" role="alert">{error}</div>
      ) : items.length === 0 ? (
        <EmptyState fill illustration="tasks" size="compact" title="No recorded activity for the current task scope."/>
      ) : (
        <ol className="divide-y divide-neutral-100">
          {items.map((item) => {
            const task = taskById.get(item.taskId);
            return (
              <li key={item.id} className="flex gap-3 px-4 py-3.5 sm:px-5">
                <span className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${item.kind === "status" ? "bg-violet-50 text-violet-700" : "bg-sky-50 text-sky-700"}`}>
                  {item.kind === "status" ? <CircleDot size={13} /> : <Activity size={13} />}
                </span>
                <div className="min-w-0 flex-1">
                  {task && onOpenTaskEditor ? (
                    <button type="button" onClick={() => onOpenTaskEditor(task)} className="text-left text-[12px] font-semibold leading-snug text-neutral-900 hover:text-violet-700">
                      {task.title}
                    </button>
                  ) : (
                    <div className="break-words text-[12px] font-semibold leading-snug text-neutral-900">{task?.title || "Task no longer in this scope"}</div>
                  )}
                  <p className="mt-0.5 break-words text-[12px] leading-relaxed text-neutral-600">{item.details}</p>
                  <p className="mt-1 text-[10.5px] text-neutral-400">{item.userName || "System"} · {formatShortDateTime(item.timestamp)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
