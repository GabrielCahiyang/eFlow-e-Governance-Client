import { useEffect, useMemo, useState } from "react";
import { Award, CalendarDays, ChevronDown, ChevronUp, Gauge, Medal, ShieldCheck, Timer, Trophy } from "lucide-react";
import type { Employee } from "../../employees";
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
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-100 bg-gradient-to-r from-amber-50 via-white to-violet-50 px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20"><Trophy size={19} /></div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-400">Approved contribution</div>
              <h2 className="mt-0.5 text-[17px] font-semibold text-neutral-900">Monthly leaderboard</h2>
              <p className="mt-1 max-w-2xl text-[10.5px] leading-5 text-neutral-500">Only approved work counts. Quality, effort, timeliness, and collaboration are scored separately so raw clicks and unapproved subtasks cannot inflate rank.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="relative flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[10.5px] text-neutral-600">
              <CalendarDays size={13} />
              <select value={periodKey} onChange={(event) => { setPeriodKey(event.target.value); setDepartment("all"); }} className="appearance-none bg-transparent pr-4 outline-none">
                {periods.map((period) => <option key={period.key} value={period.key}>{period.label}{period.key === current.key ? " · Live" : ""}</option>)}
              </select>
            </label>
            {allowDepartmentFilter && departmentOptions.length > 1 && (
              <select value={department} onChange={(event) => setDepartment(event.target.value)} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[10.5px] text-neutral-600 outline-none">
                <option value="all">All departments</option>
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
            ["Collaboration", "Approved subtasks · max 30", <Gauge size={13} />],
          ].map(([label, detail, icon]) => <div key={label as string} className="rounded-lg border border-white/80 bg-white/70 px-3 py-2"><div className="flex items-center gap-1.5 text-[10px] font-medium text-neutral-700">{icon}{label}</div><div className="mt-0.5 text-[9px] text-neutral-400">{detail}</div></div>)}
        </div>
      </div>

      {loadingHistory ? (
        <div className="py-20 text-center text-[11px] text-neutral-400">Loading the signed monthly snapshot…</div>
      ) : rows.length === 0 ? (
        <div className="py-20 text-center"><Trophy size={26} className="mx-auto text-neutral-300" /><h3 className="mt-3 text-[12px] font-medium text-neutral-700">No approved contribution for this period</h3><p className="mt-1 text-[10px] text-neutral-400">Work appears after an authorized reviewer approves it.</p></div>
      ) : (
        <div>
          <p className="px-4 py-2 text-[10px] text-neutral-500 sm:hidden">Swipe sideways to see all columns and row actions.</p>
          <div className="overflow-x-auto" role="region" aria-label="Monthly contribution table" tabIndex={0}>
          <table className="min-w-[920px] w-full border-collapse text-left">
            <thead><tr className="border-b border-neutral-100 bg-neutral-50/70 text-[9px] uppercase tracking-wider text-neutral-400"><th className="px-4 py-3">Rank</th><th className="px-3 py-3">Employee</th><th className="px-3 py-3 text-center">Tasks</th><th className="px-3 py-3 text-center">Subtasks</th><th className="px-3 py-3 text-center">On time</th><th className="px-3 py-3 text-center">Median cycle</th><th className="px-3 py-3 text-center">First pass</th><th className="px-3 py-3 text-right">Score</th><th className="px-4 py-3 text-right">Breakdown</th></tr></thead>
            <tbody>
              {rows.map((row) => {
                const expanded = expandedUserId === row.userId;
                const medalTone = row.rank === 1 ? "bg-amber-100 text-amber-700" : row.rank === 2 ? "bg-slate-100 text-slate-600" : row.rank === 3 ? "bg-orange-100 text-orange-700" : "bg-neutral-50 text-neutral-500";
                return [
                  <tr key={row.userId} className={`border-b border-neutral-100 text-[10.5px] transition ${row.userId === currentUserId ? "bg-blue-50/50" : "hover:bg-neutral-50/60"}`}>
                    <td className="px-4 py-3"><span className={`inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-full px-2 font-semibold ${medalTone}`}>{row.rank <= 3 && <Medal size={11} />}{row.rank}</span></td>
                    <td className="px-3 py-3"><div className="font-medium text-neutral-800">{row.employeeName}{row.userId === currentUserId ? <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[8px] text-blue-700">You</span> : null}</div><div className="mt-0.5 text-[9px] text-neutral-400">{row.departmentName || "Department"} · {row.source === "live" ? "Live" : "Closed snapshot"}</div></td>
                    <td className="px-3 py-3 text-center font-medium text-neutral-700">{row.approvedTasks}</td><td className="px-3 py-3 text-center font-medium text-neutral-700">{row.approvedSubtasks}</td><td className="px-3 py-3 text-center text-neutral-600">{percentage(row.onTimeRate)}</td><td className="px-3 py-3 text-center text-neutral-600">{duration(row.medianCycleHours)}</td><td className="px-3 py-3 text-center text-neutral-600">{percentage(row.firstPassApprovalRate)}</td>
                    <td className="px-3 py-3 text-right"><span className="text-[15px] font-semibold text-neutral-900">{row.contributionScore}</span></td>
                    <td className="px-4 py-3 text-right"><button type="button" onClick={() => setExpandedUserId(expanded ? undefined : row.userId)} className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[9.5px] font-medium text-neutral-600 hover:bg-neutral-50">View {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}</button></td>
                  </tr>,
                  expanded ? <tr key={`${row.userId}-breakdown`} className="border-b border-neutral-100 bg-neutral-50/60"><td colSpan={9} className="px-4 py-4"><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{Object.entries(row.breakdown).map(([key, value]) => <div key={key} className="rounded-xl border border-neutral-200 bg-white p-3"><div className="text-[9px] uppercase tracking-wider text-neutral-400">{key}</div><div className="mt-1 flex items-end justify-between"><strong className="text-[17px] text-neutral-900">{value}</strong><span className="text-[9px] text-neutral-400">points</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, value / (key === "collaboration" ? 30 : 40) * 100)}%` }} /></div></div>)}</div></td></tr> : null,
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
