// ─── Department Head Dashboard (command center) ──────────────────
// Driven entirely by scoped organization data — no sample cards. Every metric
// reconciles with the underlying filtered tasks and is click-through to the
// source list. Project health, overdue work, pending reviews, workload by
// employee, completion rate, and upcoming deadlines.

import { useMemo, useState } from "react";
import { workloadByEmployee } from "../../features/tasks";
import {
  AlertTriangle,
  Inbox,
  CheckCircle2,
  Users,
  CalendarClock,
  FolderKanban,
  TrendingUp,
  Flame,
} from "lucide-react";
import { useTasks } from "../../hooks/useFirebaseData";
import { useProjectsData, useScopedOrgIds } from "../../hooks/useSupabaseData";
import { useAuth } from "../../contexts/AuthContext";
import type { Task } from "../../services/taskService";
import {
  isArchived,
  isOverdue,
  isUnassigned,
  parseDueDate,
  projectStats,
} from "../../services/taskSelectors";
import {
  PageHeader,
  StatCard,
  Card,
  WSelect,
  SectionEmpty,
  ProgressBar,
  relativeDays,
} from "../workflow/primitives";
import {
  HEALTH_META,
  type Health,
  InitialsAvatar,
} from "../workflow/StatusBadges";
import { TaskDetailDrawer } from "../workflow/TaskDetailDrawer";
import { TaskRow } from "./DeptHeadDashboardTaskRow";
import { getHeadWorkspaceLabel } from "../../shared/roles";

type FocusList = null | "overdue" | "review" | "unassigned" | "completed";

function DeptHeadDashboardSkeleton() {
  const block = "animate-pulse rounded-lg bg-muted";
  return (
    <div className="min-h-full bg-muted/20 p-3 sm:p-6 lg:p-8" role="status" aria-live="polite">
      <div className="mx-auto max-w-[1480px] space-y-5">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className={`${block} h-3 w-44`} />
          <div className={`${block} mt-3 h-9 w-64`} />
          <div className={`${block} mt-3 h-4 w-full max-w-xl`} />
          <div className={`${block} mt-6 h-10 w-40 sm:mt-5`} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-32 rounded-xl border border-border bg-card p-5 shadow-sm"><div className={`${block} h-3 w-28`} /><div className={`${block} mt-5 h-8 w-16`} /><div className={`${block} mt-3 h-3 w-32`} /></div>)}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2"><div className="h-48 rounded-xl border border-border bg-card p-5 shadow-sm" /><div className="h-64 rounded-xl border border-border bg-card p-5 shadow-sm" /></div>
          <div className="space-y-4"><div className="h-64 rounded-xl border border-border bg-card p-5 shadow-sm" /><div className="h-56 rounded-xl border border-border bg-card p-5 shadow-sm" /></div>
        </div>
        <span className="sr-only">Loading your department dashboard…</span>
      </div>
    </div>
  );
}

export function DeptHeadDashboard() {
  const { userProfile } = useAuth();
  const workspaceLabel = getHeadWorkspaceLabel(userProfile?.role);
  const { tasks, loading: tasksLoading } = useTasks();
  const { projects } = useProjectsData();
  const { scopedOrgIds, isSuperAdmin } = useScopedOrgIds();

  const [horizon, setHorizon] = useState("14");
  const [period, setPeriod] = useState("30");
  const [focus, setFocus] = useState<FocusList>(null);
  const [openTask, setOpenTask] = useState<Task | null>(null);

  // Scope tasks to the head's org subtree (super admin sees everything).
  const scoped = useMemo(() => {
    const active = tasks.filter((t) => !isArchived(t));
    if (isSuperAdmin || scopedOrgIds.length === 0) return active;
    return active.filter((t) => !t.orgId || scopedOrgIds.includes(t.orgId));
  }, [tasks, scopedOrgIds, isSuperAdmin]);

  const scopedProjects = useMemo(() => {
    const active = projects.filter((p) => p.status !== "archived");
    if (isSuperAdmin || scopedOrgIds.length === 0) return active;
    return active.filter((p) => !p.orgId || scopedOrgIds.includes(p.orgId));
  }, [projects, scopedOrgIds, isSuperAdmin]);

  // ─ Metrics ─
  const overdue = useMemo(() => scoped.filter(isOverdue), [scoped]);
  const forReview = useMemo(() => scoped.filter((t) => t.status === "for_review"), [scoped]);
  const unassigned = useMemo(
    () => scoped.filter(isUnassigned),
    [scoped],
  );

  const completionWindow = useMemo(() => {
    const days = Number(period);
    const since = Date.now() - days * 86400000;
    const inWindow = scoped.filter((t) => t.updatedAt >= since);
    const completed = inWindow.filter((t) => t.status === "completed");
    const rate = inWindow.length ? Math.round((completed.length / inWindow.length) * 100) : 0;
    return { completed: completed.length, total: inWindow.length, rate };
  }, [scoped, period]);

  const completedList = useMemo(
    () => scoped.filter((t) => t.status === "completed").sort((a, b) => b.updatedAt - a.updatedAt),
    [scoped],
  );

  // Project health buckets (derive per-project from linked tasks + fall back to
  // proposal-hierarchy grouping when there are no operational project rows yet).
  const healthBuckets = useMemo(() => {
    const buckets: Record<Health, number> = {
      on_track: 0,
      at_risk: 0,
      delayed: 0,
      complete: 0,
      no_data: 0,
    };
    if (scopedProjects.length > 0) {
      scopedProjects.forEach((p) => {
        buckets[projectStats(p, scoped).health]++;
      });
    }
    return buckets;
  }, [scopedProjects, scoped]);

  // Use the same task-duration and deadline calculation as the task board.
  const workload = useMemo(() => workloadByEmployee(scoped), [scoped]);

  // Upcoming deadlines within horizon.
  const upcoming = useMemo(() => {
    const days = Number(horizon);
    const until = Date.now() + days * 86400000;
    return scoped
      .filter((t) => {
        const due = parseDueDate(t);
        return due !== null && t.status !== "completed" && due <= until;
      })
      .sort((a, b) => (parseDueDate(a) ?? 0) - (parseDueDate(b) ?? 0));
  }, [scoped, horizon]);

  const urgentFive = useMemo(
    () => [...scoped]
      .filter((t) => t.status !== "completed" && parseDueDate(t) !== null)
      .sort((a, b) => (parseDueDate(a) ?? 0) - (parseDueDate(b) ?? 0))
      .slice(0, 5),
    [scoped],
  );

  const focusRows: Task[] =
    focus === "overdue" ? overdue :
    focus === "review" ? forReview :
    focus === "unassigned" ? unassigned :
    focus === "completed" ? completedList :
    [];

  if (tasksLoading) return <DeptHeadDashboardSkeleton />;

  const totalHealth = Object.values(healthBuckets).reduce((s, n) => s + n, 0);

  return (
    <div className="min-h-full bg-muted/20 p-3 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1480px] space-y-5">
        <section className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/5 via-card to-card p-5 shadow-sm sm:p-6">
          <PageHeader
            eyebrow={isSuperAdmin ? "Administration · Command Center" : `${workspaceLabel} · Command Center`}
            title={`Good day, ${(userProfile?.full_name || "there").split(" ")[0]}`}
            subtitle="Your department at a glance — manage by exception."
            actions={
              <div className="flex w-full flex-col items-stretch gap-1.5 sm:w-auto sm:items-end">
                <span className="text-[11px] font-medium text-muted-foreground">Completion window</span>
                <WSelect
                  value={period}
                  onChange={setPeriod}
                  options={[
                    { value: "7", label: "Last 7 days" },
                    { value: "30", label: "Last 30 days" },
                    { value: "90", label: "Last 90 days" },
                  ]}
                  className="min-w-[160px]"
                />
              </div>
            }
          />
          <div className="flex flex-wrap items-center gap-2 border-t border-primary/10 pt-4 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 ring-1 ring-border"><FolderKanban size={13} className="text-primary" /> {totalHealth} active projects</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 ring-1 ring-border"><Inbox size={13} className="text-primary" /> {scoped.length} active tasks</span>
            {overdue.length > 0 ? <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1.5 text-destructive"><AlertTriangle size={13} /> {overdue.length} overdue</span> : <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700"><CheckCircle2 size={13} /> No overdue tasks</span>}
          </div>
        </section>

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Overdue tasks"
          value={overdue.length}
          hint={overdue.length ? "Needs attention now" : "Nothing overdue"}
          tone={overdue.length ? "bad" : "good"}
          icon={<AlertTriangle size={15} />}
          onClick={() => setFocus(focus === "overdue" ? null : "overdue")}
          active={focus === "overdue"}
        />
        <StatCard
          label="Pending review"
          value={
            <span className="inline-flex items-center gap-2">
              <span>{forReview.length}</span>
              {forReview.length > 0 && (
                <span className="relative flex h-2.5 w-2.5" title="Items awaiting your review">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.9)]" />
                </span>
              )}
            </span>
          }
          hint="Awaiting your decision"
          tone={forReview.length ? "warn" : "neutral"}
          icon={<Inbox size={15} />}
          onClick={() => setFocus(focus === "review" ? null : "review")}
          active={focus === "review"}
        />
        <StatCard
          label="Unassigned"
          value={unassigned.length}
          hint="No owner yet"
          tone={unassigned.length ? "info" : "neutral"}
          icon={<Users size={15} />}
          onClick={() => setFocus(focus === "unassigned" ? null : "unassigned")}
          active={focus === "unassigned"}
        />
        <StatCard
          label={`Completion · ${period}d`}
          value={`${completionWindow.rate}%`}
          hint={`${completionWindow.completed}/${completionWindow.total} tasks`}
          tone="good"
          icon={<TrendingUp size={15} />}
          onClick={() => setFocus(focus === "completed" ? null : "completed")}
          active={focus === "completed"}
        />
      </div>

      {/* Focus list (drill-down from a KPI) */}
      {focus && (
        <Card
          className="mb-4"
          title={
            focus === "overdue" ? `Overdue tasks (${overdue.length})` :
            focus === "review" ? `Awaiting review (${forReview.length})` :
            focus === "unassigned" ? `Unassigned tasks (${unassigned.length})` :
            `Recently completed (${completedList.length})`
          }
          right={
            <button onClick={() => setFocus(null)} className="rounded-md px-2 py-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              Close
            </button>
          }
          bodyClassName="p-0"
        >
          {focusRows.length === 0 ? (
            <SectionEmpty icon={<CheckCircle2 size={28} />} title="All clear" description="Nothing in this list right now." />
          ) : (
            <div className="max-h-[360px] overflow-y-auto divide-y divide-border/70">
              {focusRows.slice(0, 40).map((t) => (
                <TaskRow key={t.id} task={t} onOpen={() => setOpenTask(t)} />
              ))}
            </div>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Project health */}
          <Card className="overflow-hidden" title="Project health" subtitle={`${totalHealth} active project(s) in scope`}>
            {totalHealth === 0 ? (
              <SectionEmpty
                icon={<FolderKanban size={26} />}
                title="No projects yet"
                description="Create a project to start tracking health here."
              />
            ) : (
              <div className="space-y-3">
                <div className="flex h-3 overflow-hidden rounded-full bg-muted" aria-label="Project health distribution">
                  {(Object.keys(healthBuckets) as Health[]).map((h) =>
                    healthBuckets[h] ? (
                      <div
                        key={h}
                        title={`${HEALTH_META[h].label}: ${healthBuckets[h]}`}
                        style={{ width: `${(healthBuckets[h] / totalHealth) * 100}%`, background: HEALTH_META[h].color }}
                      />
                    ) : null,
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {(Object.keys(healthBuckets) as Health[]).map((h) => (
                    <div key={h} className="flex min-w-0 items-center gap-2 rounded-lg border border-border/70 bg-muted/25 px-2.5 py-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: HEALTH_META[h].color }} />
                      <span className="min-w-0 truncate text-[12px] font-medium text-secondary-foreground">{HEALTH_META[h].label}</span>
                      <span className="ml-auto text-[12px] font-semibold tabular-nums text-foreground">{healthBuckets[h]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Most urgent */}
          <Card className="overflow-hidden" title="Most urgent" subtitle="The five nearest deadlines still open" bodyClassName="p-0">
            {urgentFive.length === 0 ? (
              <SectionEmpty icon={<CalendarClock size={26} />} title="No open deadlines" />
            ) : (
              <div className="divide-y divide-border/70">
                {urgentFive.map((t) => (
                  <TaskRow key={t.id} task={t} onOpen={() => setOpenTask(t)} />
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Workload */}
          <Card className="overflow-hidden" title="Workload by employee" subtitle="Task duration and deadline pressure">
            {workload.length === 0 ? (
              <SectionEmpty icon={<Users size={24} />} title="No assigned work" />
            ) : (
              <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                {workload.slice(0, 12).map((w) => {
                  const heavy = w.workload?.level === "high" || w.workload?.level === "very_high";
                  return (
                    <div key={w.id}>
                      <div className="flex items-center gap-2 mb-1">
                        <InitialsAvatar name={w.name} size={22} />
                        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground">{w.name}</span>
                        {heavy && <Flame size={12} className="text-red-500" />}
                        <span className="text-[11.5px] font-semibold tabular-nums text-foreground">{w.active} tasks · {w.workload?.label}</span>
                      </div>
                      <ProgressBar value={Math.min(100, w.workload?.pressurePercent || 0)} tone={heavy ? "bad" : w.workload?.level === "unknown" ? "warn" : "neutral"} />
                      <p className="mt-1 text-[10px] text-muted-foreground">{w.workload?.explanation}</p>
                      {(w.overdue > 0 || w.review > 0) && (
                        <div className="mt-1 flex gap-3 text-[10px] font-medium text-muted-foreground">
                          {w.overdue > 0 && <span className="text-red-500">{w.overdue} overdue</span>}
                          {w.review > 0 && <span className="text-amber-500">{w.review} in review</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
                {unassigned.length > 0 && (
                  <div className="mt-2 flex items-center gap-2 border-t border-border pt-3 text-[11.5px] font-medium text-muted-foreground">
                    <Users size={12} /> {unassigned.length} unassigned task(s) need an owner
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Upcoming deadlines */}
          <Card
            className="overflow-hidden"
            title="Upcoming deadlines"
            right={
              <WSelect
                value={horizon}
                onChange={setHorizon}
                options={[
                  { value: "7", label: "7 days" },
                  { value: "14", label: "14 days" },
                  { value: "30", label: "30 days" },
                ]}
                className="h-[28px] text-[11px]"
              />
            }
            bodyClassName="p-0"
          >
            {upcoming.length === 0 ? (
              <SectionEmpty icon={<CalendarClock size={24} />} title="Nothing due soon" />
            ) : (
              <div className="max-h-[260px] overflow-y-auto divide-y divide-border/70">
                {upcoming.slice(0, 20).map((t) => {
                  const rel = relativeDays(t.deadline || t.dueDate);
                  return (
                    <button
                      key={t.id}
                      onClick={() => setOpenTask(t)}
                      className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-accent/60"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${rel.overdue ? "bg-red-500" : "bg-amber-500"}`} />
                      <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground">{t.title}</span>
                      <span className={`text-[10.5px] font-medium tabular-nums ${rel.overdue ? "text-destructive" : "text-muted-foreground"}`}>
                        {rel.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      <TaskDetailDrawer
        task={openTask}
        onClose={() => setOpenTask(null)}
        canReview
        onChanged={() => { /* realtime subscription refreshes lists */ }}
      />
      </div>
    </div>
  );
}
