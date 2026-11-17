import { useEffect, useMemo, useState } from "react";
import { Award, CalendarDays, ChevronDown, ChevronUp, Gauge, Medal, ShieldCheck, Timer, Trophy } from "lucide-react";
import type { Employee } from "../../members";
import type { Task } from "../../tasks";
import { buildMonthlyContributionLeaderboard, getManilaMonthPeriod, getRecentManilaMonthPeriods } from "../selectors/monthlyContributionSelectors";
import { fetchMonthlyProductivitySnapshots } from "../services/productivitySnapshotService";
import type { ContributionWorkflowFacts, MonthlyContributionRow } from "../types";

interface MonthlyLeaderboardProps {
  employees: Employee[];
  tasks: Task[];
  facts: ContributionWorkflowFacts;
  currentUserId?: string;
  allowDepartmentFilter?: boolean;
}

const percentage = (value: number | null) => value == null ? "—" : `${Math.round(value)}%`;
const duration = (hours: number | null) => {
  if (hours == null) return "—";
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${(hours / 24).toFixed(hours < 240 ? 1 : 0)}d`;
};

export function MonthlyLeaderboard({ employees, tasks, facts, currentUserId, allowDepartmentFilter = false }: MonthlyLeaderboardProps) {
  const periods = useMemo(() => getRecentManilaMonthPeriods(12), []);
  const current = periods[0] || getManilaMonthPeriod();
  const [periodKey, setPeriodKey] = useState(current.key);
  const [department, setDepartment] = useState("all");
  const [historicalRows, setHistoricalRows] = useState<MonthlyContributionRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState<string>();
  const isCurrent = periodKey === current.key;
  const liveRows = useMemo(
    () => buildMonthlyContributionLeaderboard(employees, tasks, facts, current),
    [current.end, current.start, employees, facts, tasks],
  );

  useEffect(() => {
    if (isCurrent) return;
    let active = true;
    setLoadingHistory(true);
    void fetchMonthlyProductivitySnapshots(`${periodKey}-01`)
      .then((rows) => { if (active) setHistoricalRows(rows); })
      .catch(() => { if (active) setHistoricalRows([]); })
      .finally(() => { if (active) setLoadingHistory(false); });
    return () => { active = false; };
  }, [isCurrent, periodKey]);

  const departmentOptions = useMemo(() => Array.from(new Set(
    (isCurrent ? liveRows : historicalRows).map((row) => row.departmentName).filter((name): name is string => Boolean(name)),
  )).sort(), [historicalRows, isCurrent, liveRows]);
  const rows = (isCurrent ? liveRows : historicalRows)
    .filter((row) => department === "all" || row.departmentName === department)
    .map((row, index) => ({ ...row, rank: index + 1 }));

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border bg-card px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-primary/20 bg-primary/10 text-primary"><Trophy size={18} /></div>
            <div>
              <div className="text-[12px] font-medium text-muted-foreground">Approved contribution</div>
              <h2 className="mt-0.5 text-[16px] font-semibold text-foreground">Monthly leaderboard</h2>
              <p className="mt-1 max-w-2xl text-[12px] leading-5 text-muted-foreground">Scores reflect approved tasks and completed subtasks across delivery, quality, speed, and collaboration.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="relative flex items-center gap-2 rounded-[6px] border border-border bg-card px-3 py-1.5 text-[12px] text-foreground">
              <CalendarDays size={13} className="text-muted-foreground" />
              <select value={periodKey} onChange={(event) => { setPeriodKey(event.target.value); setDepartment("all"); }} className="appearance-none bg-transparent pr-4 outline-none">
                {periods.map((period) => <option key={period.key} value={period.key}>{period.label}{period.key === current.key ? " · Live" : ""}</option>)}
              </select>
            </label>
            {allowDepartmentFilter && departmentOptions.length > 1 && (
              <select value={department} onChange={(event) => setDepartment(event.target.value)} className="rounded-[6px] border border-border bg-card px-3 py-1.5 text-[12px] text-foreground outline-none">
                <option value="all">All offices</option>
                {departmentOptions.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            ["Delivery", "Priority + estimated effort", <Award size={13} />],
            ["Quality", "On-time + first pass", <ShieldCheck size={13} />],
            ["Speed", "Effort-normalized and capped", <Timer size={13} />],
            ["Collaboration", "Completed subitems · max 30", <Gauge size={13} />],
          ].map(([label, detail, icon]) => <div key={label as string} className="rounded-lg border border-border bg-muted/50 px-3 py-2"><div className="flex items-center gap-1.5 text-[12px] font-medium text-foreground">{icon}{label}</div><div className="mt-0.5 text-[11px] text-muted-foreground">{detail}</div></div>)}
        </div>
      </div>

      {loadingHistory ? (
        <div className="py-16 text-center text-[12px] text-muted-foreground">Loading monthly results…</div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center"><Trophy size={24} className="mx-auto text-muted-foreground/60" /><h3 className="mt-3 text-[13px] font-medium text-foreground">No approved contribution for this period</h3><p className="mt-1 text-[12px] text-muted-foreground">Work appears after an authorized reviewer approves it.</p></div>
      ) : (
        <div>
          <p className="px-4 py-2 text-[11px] text-muted-foreground sm:hidden">Swipe sideways to see all columns and row actions.</p>
          <div className="overflow-x-auto" role="region" aria-label="Monthly contribution table" tabIndex={0}>
          <table className="min-w-[920px] w-full border-collapse text-left">
            <thead><tr className="border-b border-border bg-muted text-[12px] font-semibold text-muted-foreground"><th className="px-4 py-2.5">Rank</th><th className="px-3 py-2.5">Member</th><th className="px-3 py-2.5 text-center">Tasks</th><th className="px-3 py-2.5 text-center">Subtasks</th><th className="px-3 py-2.5 text-center">On time</th><th className="px-3 py-2.5 text-center">Median cycle</th><th className="px-3 py-2.5 text-center">First pass</th><th className="px-3 py-2.5 text-right">Score</th><th className="px-4 py-2.5 text-right">Breakdown</th></tr></thead>
            <tbody>
              {rows.map((row) => {
                const expanded = expandedUserId === row.userId;
                const medalTone = row.rank === 1
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : row.rank === 2
                    ? "border-slate-200 bg-slate-50 text-slate-700"
                    : row.rank === 3
                      ? "border-orange-200 bg-orange-50 text-orange-800"
                      : "border-border bg-muted text-muted-foreground";
                return [
                  <tr key={row.userId} className={`border-b border-border text-[12px] transition-colors ${row.userId === currentUserId ? "bg-primary/5" : "hover:bg-muted/50"}`}>
                    <td className="px-4 py-3"><span className={`inline-flex h-6 min-w-7 items-center justify-center gap-1 rounded-[6px] border px-2 text-[12px] font-semibold tabular-nums ${medalTone}`}>{row.rank <= 3 && <Medal size={11} />}{row.rank}</span></td>
                    <td className="px-3 py-3"><div className="font-medium text-foreground">{row.employeeName}{row.userId === currentUserId ? <span className="ml-2 rounded-[6px] border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">You</span> : null}</div><div className="mt-0.5 text-[11px] text-muted-foreground">{row.departmentName || "Office"} · {row.source === "live" ? "Live" : "Finalized monthly results"}</div></td>
                    <td className="px-3 py-3 text-center font-medium tabular-nums text-foreground">{row.approvedTasks}</td><td className="px-3 py-3 text-center font-medium tabular-nums text-foreground">{row.approvedSubtasks}</td><td className="px-3 py-3 text-center tabular-nums text-muted-foreground">{percentage(row.onTimeRate)}</td><td className="px-3 py-3 text-center tabular-nums text-muted-foreground">{duration(row.medianCycleHours)}</td><td className="px-3 py-3 text-center tabular-nums text-muted-foreground">{percentage(row.firstPassApprovalRate)}</td>
                    <td className="px-3 py-3 text-right"><span className="text-[15px] font-semibold tabular-nums text-foreground">{row.contributionScore}</span></td>
                    <td className="px-4 py-3 text-right"><button type="button" onClick={() => setExpandedUserId(expanded ? undefined : row.userId)} className="inline-flex items-center gap-1 rounded-[6px] border border-border bg-card px-2.5 py-1 text-[12px] font-medium text-foreground transition-colors hover:bg-muted">View {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}</button></td>
                  </tr>,
                  expanded ? <tr key={`${row.userId}-breakdown`} className="border-b border-border bg-muted/40"><td colSpan={9} className="px-4 py-3"><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{Object.entries(row.breakdown).map(([key, value]) => <div key={key} className="rounded-lg border border-border bg-card p-3"><div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{key}</div><div className="mt-1 flex items-end justify-between"><strong className="text-[17px] tabular-nums text-foreground">{value}</strong><span className="text-[11px] text-muted-foreground">points</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-[3px] bg-muted"><div className="h-full rounded-[3px] bg-primary" style={{ width: `${Math.min(100, value / (key === "collaboration" ? 30 : 40) * 100)}%` }} /></div></div>)}</div></td></tr> : null,
                ];
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </section>
  );
}
