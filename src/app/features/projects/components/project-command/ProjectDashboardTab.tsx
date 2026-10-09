import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  FileCheck2,
  Layers,
  TrendingUp,
} from "lucide-react";
import type { ProjectCommandData } from "./types";
import { formatDate } from "../../../../components/workflow/primitives";
import { peso } from "../../../budget";
import { isOverdue } from "../../../tasks";

export function ProjectDashboardTab({
  data,
  onOpenTask,
}: {
  data: ProjectCommandData;
  onOpenTask?: (taskId: string) => void;
}) {
  const { metrics, tasks, milestones, activity, financial } = data;

  // Tasks by status
  const statusCounts = useMemo(() => {
    const counts = {
      todo: 0,
      in_progress: 0,
      for_review: 0,
      completed: 0,
      blocked: 0,
    };
    tasks.forEach((t) => {
      if (t.status === "completed") counts.completed++;
      else if (t.status === "for_review") counts.for_review++;
      else if (t.status === "in_progress") counts.in_progress++;
      else if (t.status === "cancelled") counts.blocked++;
      else counts.todo++;
    });
    return counts;
  }, [tasks]);

  // Urgent attention tasks
  const urgentTasks = useMemo(() => {
    const now = Date.now();
    return tasks
      .filter((t) => {
        if (t.status === "completed" || t.status === "cancelled") return false;
        const taskOverdue = isOverdue(t, now);
        const isReview = t.status === "for_review";
        const isChanges = Boolean(t.rejectionNote);
        const isHigh = t.priority === "high";
        return taskOverdue || isReview || isChanges || isHigh;
      })
      .slice(0, 6);
  }, [tasks]);

  // Upcoming milestones & deadlines
  const upcomingDeadlines = useMemo(() => {
    const items: Array<{ id: string; title: string; type: "milestone" | "task"; date: string; isPast: boolean }> = [];
    milestones.forEach((m) => {
      if (m.status !== "completed" && m.dueDate) {
        items.push({
          id: m.id,
          title: m.title,
          type: "milestone",
          date: m.dueDate,
          isPast: new Date(m.dueDate).getTime() < Date.now(),
        });
      }
    });
    tasks.forEach((t) => {
      if (t.status !== "completed" && t.deadline) {
        items.push({
          id: t.id,
          title: t.title,
          type: "task",
          date: t.deadline,
          isPast: new Date(t.deadline).getTime() < Date.now(),
        });
      }
    });

    items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return items.slice(0, 6);
  }, [milestones, tasks]);

  // Review & evidence bottlenecks
  const reviewSubmissions = data.facts.submissions.filter(
    (s) => s.status === "pending" || s.status === "changes_requested",
  );

  const totalTasks = tasks.length || 1;
  const completedPercent = Math.round((statusCounts.completed / totalTasks) * 100);
  const inProgressPercent = Math.round((statusCounts.in_progress / totalTasks) * 100);
  const reviewPercent = Math.round((statusCounts.for_review / totalTasks) * 100);
  const todoPercent = Math.round((statusCounts.todo / totalTasks) * 100);

  return (
    <div className="space-y-6 font-sans">
      {/* Top Health & Delivery Progress Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Overall Progress */}
        <div className="rounded-[10px] border border-border bg-card p-5 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Delivery Progress
            </span>
            <span className="rounded-lg bg-primary/10 p-1.5 text-primary">
              <TrendingUp size={16} />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-neutral-900 tracking-tight">
              {metrics.progress}%
            </span>
            <span className="text-xs font-semibold text-neutral-500">
              ({statusCounts.completed} of {metrics.taskTotal} tasks)
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-100 flex">
            <div style={{ width: `${completedPercent}%` }} className="bg-emerald-500" />
            <div style={{ width: `${inProgressPercent}%` }} className="bg-blue-500" />
            <div style={{ width: `${reviewPercent}%` }} className="bg-amber-500" />
            <div style={{ width: `${todoPercent}%` }} className="bg-neutral-300" />
          </div>
        </div>

        {/* Metric 2: Milestones & Activities */}
        <div className="rounded-[10px] border border-border bg-card p-5 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Milestone Completion
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
              <CheckCircle2 size={16} />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-neutral-900 tracking-tight">
              {metrics.milestoneCompleted} / {metrics.milestoneCompleted + metrics.milestoneOpen}
            </span>
            <span className="text-xs font-semibold text-neutral-500">
              milestones
            </span>
          </div>
          <p className="mt-3 text-xs text-neutral-500 flex items-center gap-1.5">
            <Layers size={13} className="text-neutral-400" />
            <span>{metrics.milestoneOpen} remaining activities</span>
          </p>
        </div>

        {/* Metric 3: Needs Attention */}
        <div className="rounded-[10px] border border-border bg-card p-5 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Needs Attention
            </span>
            <span className={`p-1.5 rounded-lg ${metrics.overdue > 0 ? "bg-rose-50 text-rose-700" : "bg-neutral-50 text-neutral-500"}`}>
              <AlertTriangle size={16} />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-3xl font-black tracking-tight ${metrics.overdue > 0 ? "text-rose-600" : "text-neutral-900"}`}>
              {metrics.overdue}
            </span>
            <span className="text-xs font-semibold text-neutral-500">overdue tasks</span>
          </div>
          <p className="mt-3 text-xs text-neutral-500 flex items-center gap-2">
            <span>{metrics.changesRequested} rework requests</span>
            <span>·</span>
            <span>{metrics.blocked} blocked</span>
          </p>
        </div>

        {/* Metric 4: Review Queue */}
        <div className="rounded-[10px] border border-border bg-card p-5 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Project Reviews
            </span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
              <FileCheck2 size={16} />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-neutral-900 tracking-tight">
              {metrics.awaitingReview}
            </span>
            <span className="text-xs font-semibold text-neutral-500">awaiting decision</span>
          </div>
          <p className="mt-3 text-xs text-neutral-500 flex items-center gap-1.5">
            <Clock size={13} className="text-neutral-400" />
            <span>{reviewSubmissions.length} review items in queue</span>
          </p>
        </div>
      </div>

      {/* Main Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Task Pipeline & Blockers */}
        <div className="lg:col-span-2 space-y-6">
          {/* Widget: Task Pipeline Distribution */}
          <div className="space-y-4 rounded-[10px] border border-border bg-card p-5 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
                  Task Execution Pipeline
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Realtime breakdown of work packages and delivery stages.
                </p>
              </div>
              <span className="text-xs font-bold text-neutral-700 bg-neutral-100 px-2.5 py-1 rounded-lg">
                {tasks.length} total tasks
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className="rounded-[14px] border border-border bg-muted/50 p-3.5">
                <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">To Do</div>
                <div className="text-2xl font-bold text-neutral-800 mt-1">{statusCounts.todo}</div>
                <div className="text-[11px] text-neutral-400 mt-0.5">{todoPercent}% of tasks</div>
              </div>
              <div className="rounded-[14px] border border-blue-100 bg-blue-50/50 p-3.5">
                <div className="text-[11px] font-semibold text-blue-700 uppercase tracking-wide">In Progress</div>
                <div className="text-2xl font-bold text-blue-900 mt-1">{statusCounts.in_progress}</div>
                <div className="text-[11px] text-blue-600 mt-0.5">{inProgressPercent}% active</div>
              </div>
              <div className="rounded-[14px] border border-amber-100 bg-amber-50/50 p-3.5">
                <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">For Review</div>
                <div className="text-2xl font-bold text-amber-900 mt-1">{statusCounts.for_review}</div>
                <div className="text-[11px] text-amber-600 mt-0.5">{reviewPercent}% waiting</div>
              </div>
              <div className="rounded-[14px] border border-emerald-100 bg-emerald-50/50 p-3.5">
                <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">Completed</div>
                <div className="text-2xl font-bold text-emerald-900 mt-1">{statusCounts.completed}</div>
                <div className="text-[11px] text-emerald-600 mt-0.5">{completedPercent}% delivered</div>
              </div>
            </div>
          </div>

          {/* Widget: Actionable Attention Items & Priority Queue */}
          <div className="space-y-4 rounded-[10px] border border-border bg-card p-5 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
                  Priority Attention Queue
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Overdue tasks, review bottlenecks, and high-priority items.
                </p>
              </div>
            </div>

            {urgentTasks.length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-400">
                <CheckCircle2 size={28} className="mx-auto text-emerald-500 mb-2" />
                No blockers or overdue items requiring immediate intervention.
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {urgentTasks.map((t) => {
                  const taskOverdue = isOverdue(t);
                  return (
                    <div
                      key={t.id}
                      onClick={() => onOpenTask?.(t.id)}
                      className="py-3 flex items-center justify-between gap-4 hover:bg-neutral-50/80 -mx-2 px-2 rounded-xl transition-colors cursor-pointer"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-neutral-900 truncate">
                            {t.title}
                          </span>
                          {taskOverdue && (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                              Overdue
                            </span>
                          )}
                          {t.status === "for_review" && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                              Needs Review
                            </span>
                          )}
                          {t.rejectionNote && (
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                              Rework
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-neutral-500">
                          <span>Assignee: {t.assigneeName || "Unassigned"}</span>
                          {t.deadline && <span>Due: {formatDate(t.deadline)}</span>}
                        </div>
                      </div>
                      <ArrowUpRight size={14} className="text-neutral-400 shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Upcoming Schedule, Financial & Activity */}
        <div className="space-y-6">
          {/* Upcoming Deadlines */}
          <div className="space-y-4 rounded-[10px] border border-border bg-card p-5 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
                <Calendar size={15} className="text-neutral-400" />
                <span>Upcoming Milestones</span>
              </h3>
            </div>

            {upcomingDeadlines.length === 0 ? (
              <div className="py-6 text-center text-xs text-neutral-400">
                No upcoming deadlines scheduled.
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingDeadlines.map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-neutral-800 truncate">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-neutral-400 capitalize">
                        {item.type}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 font-medium ${
                        item.isPast ? "text-rose-600 font-bold" : "text-neutral-600"
                      }`}
                    >
                      {formatDate(item.date)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Financial Snapshot (if budget data exists) */}
          {financial && financial.summary && financial.summary.approvedAmount > 0 && (
            <div className="space-y-4 rounded-[10px] border border-border bg-card p-5 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
                  Financial Overview
                </h3>
              </div>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Approved Budget:</span>
                  <strong className="text-neutral-900 font-bold">{peso.format(financial.summary.approvedAmount)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Total Spent:</span>
                  <strong className="text-neutral-900 font-bold">{peso.format(financial.summary.spentAmount)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Available Balance:</span>
                  <strong className="text-emerald-700 font-bold">{peso.format(financial.summary.availableAmount)}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Recent Activity */}
          <div className="space-y-4 rounded-[10px] border border-border bg-card p-5 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
                <Clock size={15} className="text-neutral-400" />
                <span>Recent Activity</span>
              </h3>
            </div>

            {data.activityError?<p role="alert">Recent audit activity unavailable: {data.activityError}</p>:activity.length === 0 ? (
              <div className="py-6 text-center text-xs text-neutral-400">
                No recent activity logged.
              </div>
            ) : (
              <div className="space-y-3">
                {activity.slice(0, 5).map((act) => (
                  <div key={act.id} className="text-xs space-y-0.5">
                    <div className="font-semibold text-neutral-800 line-clamp-1">
                      {act.actorName || "System"} {act.title}
                    </div>
                    <div className="text-[11px] text-neutral-400">
                      {new Date(act.occurredAt).toLocaleDateString()} · {act.detail}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
