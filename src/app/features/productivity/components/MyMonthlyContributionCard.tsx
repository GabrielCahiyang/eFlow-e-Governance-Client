import { useMemo } from "react";
import { Award, ShieldCheck, Trophy } from "lucide-react";
import type { Employee } from "../../employees";
import type { Task } from "../../tasks";
import type { ContributionWorkflowFacts } from "../types";
import { buildMonthlyContributionLeaderboard } from "../selectors/monthlyContributionSelectors";

export function MyMonthlyContributionCard({ employee, tasks, facts }: { employee: Employee; tasks: Task[]; facts: ContributionWorkflowFacts }) {
  const row = useMemo(() => buildMonthlyContributionLeaderboard([employee], tasks, facts)[0], [employee, facts, tasks]);
  return (
    <section className="mt-5 overflow-hidden rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-amber-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20"><Trophy size={17} /></div><div><div className="text-[10px] uppercase tracking-wider text-violet-600">This month · approved work</div><h2 className="text-[15px] font-semibold text-neutral-900">My contribution score</h2></div></div>
        <div className="text-right"><div className="text-[25px] font-semibold text-neutral-900">{row?.contributionScore ?? 0}</div><div className="text-[8.5px] text-neutral-400">transparent points</div></div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          ["Approved tasks", row?.approvedTasks ?? 0, <Award size={13} />],
          ["Approved subtasks", row?.approvedSubtasks ?? 0, <ShieldCheck size={13} />],
          ["On time", row?.onTimeRate == null ? "—" : `${Math.round(row.onTimeRate)}%`, null],
          ["First pass", row?.firstPassApprovalRate == null ? "—" : `${Math.round(row.firstPassApprovalRate)}%`, null],
        ].map(([label, value, icon]) => <div key={label as string} className="rounded-lg border border-white bg-white/80 p-3"><div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-neutral-400">{icon}{label}</div><div className="mt-1 text-[16px] font-medium text-neutral-800">{value}</div></div>)}
      </div>
      <p className="mt-3 text-[9.5px] leading-4 text-neutral-500">Only authorized approvals count. This personal view never exposes another employee’s restricted work details.</p>
    </section>
  );
}
