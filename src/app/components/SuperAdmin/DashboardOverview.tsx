// ─── Super Admin Dashboard — Supabase Metrics ────────────────────
import { useMemo } from "react";
import {
  useDashboardMetrics,
  useOrgs,
  useProfiles,
  useTasksData,
} from "../../hooks/useSupabaseData";
import { MetricCard, MetricCardWide } from "../ui/MetricCard";
import { DataHealthPanel } from "./DataHealthPanel";

// ─── Pure CSS Gauge ──────────────────────────────────────────────
function CSSGauge({ value, label, color }: { value: number; label: string; color: string }) {
  const clamp = Math.min(100, Math.max(0, value));
  const angle = (clamp / 100) * 180;
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[140px] h-[75px] overflow-hidden">
        <div className="absolute inset-0 rounded-t-full border-[10px] border-neutral-100" style={{ borderBottom: "none" }} />
        <div
          className="absolute inset-0 rounded-t-full border-[10px] border-transparent"
          style={{
            borderBottom: "none",
            borderColor: `${color} transparent transparent ${color}`,
            transform: `rotate(${angle - 180}deg)`,
            transformOrigin: "center bottom",
            transition: "transform 1s ease-out",
          }}
        />
      </div>
      <div className="text-[24px] font-semibold text-neutral-900 -mt-4 tabular-nums">
        {clamp}%
      </div>
      <div className="text-[11px] font-medium text-neutral-500 mt-0.5">{label}</div>
    </div>
  );
}

// ─── Pure CSS Horizontal Bar Chart ───────────────────────────────
function HorizontalBarChart({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex flex-col gap-2.5">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="text-[11px] font-normal text-neutral-600 w-28 truncate shrink-0">
            {d.label}
          </span>
          <div className="flex-1 h-5 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${(d.value / max) * 100}%`, backgroundColor: color }}
            />
          </div>
          <span className="text-[11px] font-mono text-neutral-700 w-8 text-right tabular-nums">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Recent Activity List ────────────────────────────────────────
function RecentList({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: { id: string; primary: string; secondary: string; badge?: string; badgeColor?: string }[];
  emptyText: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-100">
        <span className="text-[12px] font-semibold text-neutral-700">{title}</span>
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-8 text-center text-[12px] font-normal text-neutral-400">
          {emptyText}
        </div>
      ) : (
        <div className="divide-y divide-neutral-50">
          {items.map((item) => (
            <div key={item.id} className="px-4 py-3 flex items-center justify-between hover:bg-neutral-50/50 transition-colors">
              <div>
                <div className="text-[12px] font-medium text-neutral-900">{item.primary}</div>
                <div className="text-[11px] font-normal text-neutral-500">{item.secondary}</div>
              </div>
              {item.badge && (
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{
                    backgroundColor: `${item.badgeColor || "#6366f1"}15`,
                    color: item.badgeColor || "#6366f1",
                  }}
                >
                  {item.badge}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Department Capacity & Load ──────────────────────────────────
interface DeptCapacityItem {
  id: string;
  name: string;
  staff: number;
  activeTasks: number;
  status: "available" | "balanced" | "overloaded" | "unstaffed";
}

function DepartmentCapacityCard({
  data,
  loading,
}: {
  data: DeptCapacityItem[];
  loading?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[12px] font-semibold text-neutral-800">
            Department Capacity & Load
          </div>
          <div className="text-[10.5px] text-neutral-400">
            Workload distribution across offices
          </div>
        </div>
        <span className="text-[11px] font-medium text-neutral-400">
          {data.length} {data.length === 1 ? "office" : "offices"}
        </span>
      </div>

      {loading ? (
        <div className="text-[12px] text-neutral-400 py-8 text-center">Loading capacity data…</div>
      ) : data.length === 0 ? (
        <div className="text-[12px] text-neutral-400 py-8 text-center">No active departments found</div>
      ) : (
        <div className="space-y-2 overflow-y-auto max-h-[300px] pr-1">
          {data.map((dept) => {
            const badgeConfig = {
              overloaded: {
                label: "Overloaded",
                badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
                barColor: "bg-rose-500",
                dotColor: "bg-rose-500",
              },
              balanced: {
                label: "Balanced",
                badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
                barColor: "bg-sky-500",
                dotColor: "bg-sky-500",
              },
              available: {
                label: "Available",
                badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
                barColor: "bg-emerald-500",
                dotColor: "bg-emerald-500",
              },
              unstaffed: {
                label: "Unstaffed",
                badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
                barColor: "bg-amber-500",
                dotColor: "bg-amber-500",
              },
            }[dept.status];

            const loadPercent = dept.staff > 0
              ? Math.min(100, Math.round((dept.activeTasks / (dept.staff * 4)) * 100))
              : dept.activeTasks > 0 ? 100 : 0;

            return (
              <div
                key={dept.id}
                className="rounded-lg border border-neutral-100 bg-neutral-50/60 p-2.5 transition-colors hover:bg-neutral-50"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${badgeConfig.dotColor} shrink-0`} />
                      <span className="text-[12px] font-semibold text-neutral-900 truncate">
                        {dept.name}
                      </span>
                    </div>
                    <div className="text-[10.5px] text-neutral-500 mt-0.5">
                      {dept.activeTasks} active {dept.activeTasks === 1 ? "task" : "tasks"} · {dept.staff} {dept.staff === 1 ? "staff" : "staff"}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold shrink-0 ${badgeConfig.badgeClass}`}
                  >
                    {badgeConfig.label}
                  </span>
                </div>

                <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200/70">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${badgeConfig.barColor}`}
                    style={{ width: `${Math.max(6, loadPercent)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-auto pt-3 border-t border-neutral-100 flex items-center justify-center gap-4 text-[10px] text-neutral-500">
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500" /> Available
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-sky-500" /> Balanced
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-rose-500" /> Overloaded
        </span>
      </div>
    </div>
  );
}

// ─── Main Dashboard Component ────────────────────────────────────
export function DashboardOverview() {
  const { metrics, loading: metricsLoading } = useDashboardMetrics();
  const { profiles, loading: profilesLoading } = useProfiles();
  const { orgs, loading: orgsLoading } = useOrgs();
  const { tasks, loading: tasksLoading } = useTasksData();

  const loading = metricsLoading || profilesLoading || orgsLoading || tasksLoading;

  // Compute department capacity & load metrics
  const deptCapacity = useMemo(() => {
    const activeOrgs = orgs.filter((o) => o.is_active);
    const activeProfiles = profiles.filter((u) => u.is_active && u.role !== "super_admin");

    const staffMap: Record<string, number> = {};
    activeProfiles.forEach((u) => {
      if (u.org_id) {
        staffMap[u.org_id] = (staffMap[u.org_id] || 0) + 1;
      }
    });

    const taskMap: Record<string, number> = {};
    tasks.forEach((t) => {
      if (t.status !== "completed" && t.orgId) {
        taskMap[t.orgId] = (taskMap[t.orgId] || 0) + 1;
      }
    });

    return activeOrgs
      .map((org) => {
        const staff = staffMap[org.id] || 0;
        const activeTasks = taskMap[org.id] || 0;
        const ratio = staff > 0 ? activeTasks / staff : activeTasks > 0 ? 999 : 0;

        let status: "available" | "balanced" | "overloaded" | "unstaffed";
        if (staff === 0 && activeTasks > 0) {
          status = "unstaffed";
        } else if (ratio >= 4) {
          status = "overloaded";
        } else if (ratio >= 1.5) {
          status = "balanced";
        } else {
          status = "available";
        }

        return {
          id: org.id,
          name: org.name,
          staff,
          activeTasks,
          status,
        };
      })
      .sort((a, b) => b.activeTasks - a.activeTasks || b.staff - a.staff);
  }, [orgs, profiles, tasks]);

  // Compute derived data
  const deptDistribution = useMemo(() => {
    const countMap: Record<string, number> = {};
    profiles
      .filter((u) => u.is_active)
      .forEach((u) => {
        if (u.org_id) {
          countMap[u.org_id] = (countMap[u.org_id] || 0) + 1;
        }
      });
    return orgs
      .filter((o) => o.is_active)
      .map((o) => ({ label: o.name, value: countMap[o.id] || 0 }))
      .sort((a, b) => b.value - a.value);
  }, [profiles, orgs]);

  const latestUsers = useMemo(
    () =>
      [...profiles]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
        .map((u) => ({
          id: u.id,
          primary: u.full_name,
          secondary: u.email,
          badge: u.role.replace("_", " "),
          badgeColor:
            u.role === "super_admin"
              ? "#ef4444"
              : u.role === "dept_head"
                ? "#6366f1"
                : u.role === "assistant_head"
                  ? "#4f46e5"
                  : "#10b981",
        })),
    [profiles]
  );

  return (
    <div>
      {/* Breadcrumb */}
      <div className="text-[11px] font-normal text-neutral-400 mb-3">
        Super Admin <span className="mx-1.5">/</span>{" "}
        <span className="text-neutral-700">Dashboard Overview</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h2 className="font-semibold text-[20px] text-neutral-900">
          Dashboard Overview
        </h2>
      </div>

      {/* Primary Metrics */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        <MetricCard
          label="Total Users"
          value={metrics.totalUsers}
          loading={loading}
          icon={<svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor"><path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"/></svg>}
          color="#6366f1"
        />
        <MetricCard
          label="Org Units"
          value={metrics.totalDepartments}
          loading={loading}
          icon={<svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor"><path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zM2.5 2a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zm6.5.5A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zM1 10.5A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zm6.5.5A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3z"/></svg>}
          color="#10b981"
        />
        <MetricCard
          label="Active Projects"
          value={metrics.activeProjects}
          loading={loading}
          icon={<svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor"><path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h11A1.5 1.5 0 0 1 15 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9zM2.5 3a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-11z"/><path d="M3.5 5.5a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 0 1H4a.5.5 0 0 1-.5-.5zM3.5 8a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1H4a.5.5 0 0 1-.5-.5z"/></svg>}
          color="#f59e0b"
        />
        <MetricCard
          label="Active Tasks"
          value={metrics.activeTasks}
          loading={loading}
          icon={<svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor"><path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/><path d="M10.97 4.97a.75.75 0 0 1 1.071 1.05l-3.992 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425a.236.236 0 0 1 .02-.022z"/></svg>}
          color="#3b82f6"
        />
      </div>

      {/* Secondary Metrics */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5 xl:gap-4">
        <MetricCardWide label="Pending Tasks" value={metrics.pendingTasks} color="#f59e0b" loading={loading} />
        <MetricCardWide label="Completed Tasks" value={metrics.completedTasks} color="#10b981" loading={loading} />
        <MetricCardWide label="Heads" value={metrics.departmentHeads} color="#6366f1" loading={loading} />
        <MetricCardWide label="Overloaded" value={metrics.overloadedEmployees} color="#ef4444" loading={loading} />
        <MetricCardWide label="Avg. Workload" value={metrics.averageWorkload} suffix="%" color="#3b82f6" loading={loading} />
      </div>

      {/* Charts Row */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <div className="text-[12px] font-semibold text-neutral-700 mb-3">
            Users per Org Unit
          </div>
          {deptDistribution.length > 0 ? (
            <HorizontalBarChart data={deptDistribution} color="#6366f1" />
          ) : (
            <div className="text-[12px] text-neutral-400 py-4 text-center">No org units yet</div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <div className="text-[12px] font-semibold text-neutral-700 mb-3">
            Average Workload Gauge
          </div>
          <div className="flex justify-center">
            <CSSGauge
              value={metrics.averageWorkload}
              label="Org-wide Average"
              color={metrics.averageWorkload >= 80 ? "#ef4444" : metrics.averageWorkload >= 60 ? "#f59e0b" : "#10b981"}
            />
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecentList title="Latest Users" items={latestUsers} emptyText="No users yet" />
        <DepartmentCapacityCard data={deptCapacity} loading={loading} />
      </div>

      {/* Operational data integrity (plan §5) */}
      <DataHealthPanel />
    </div>
  );
}
