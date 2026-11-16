import { useMemo } from "react";
import { Award, ShieldCheck, Trophy } from "lucide-react";
import type { Employee } from "../../members";
import type { Task } from "../../tasks";
import type { ContributionWorkflowFacts } from "../types";
import { buildMonthlyContributionLeaderboard } from "../selectors/monthlyContributionSelectors";

export function MyMonthlyContributionCard({ employee, tasks, facts }: { employee: Employee; tasks: Task[]; facts: ContributionWorkflowFacts }) {
  const row = useMemo(() => buildMonthlyContributionLeaderboard([employee], tasks, facts)[0], [employee, facts, tasks]);
  return (
    <section className="mt-4 overflow-hidden rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
            <Trophy size={17} />
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-primary">This month · approved work</div>
            <h2 className="text-[15px] font-semibold text-foreground">My contribution score</h2>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[24px] font-semibold tabular-nums text-foreground">{row?.contributionScore ?? 0}</div>
          <div className="text-[11px] text-muted-foreground">transparent points</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          ["Approved tasks", row?.approvedTasks ?? 0, <Award size={13} />],
          ["Completed subitems", row?.approvedSubtasks ?? 0, <ShieldCheck size={13} />],
          ["On time", row?.onTimeRate == null ? "—" : `${Math.round(row.onTimeRate)}%`, null],
          ["First pass", row?.firstPassApprovalRate == null ? "—" : `${Math.round(row.firstPassApprovalRate)}%`, null],
        ].map(([label, value, icon]) => (
          <div key={label as string} className="rounded-lg border border-border bg-muted/50 p-3">
            <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {icon}
              {label}
            </div>
            <div className="mt-1 text-[16px] font-semibold tabular-nums text-foreground">{value}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-4 text-muted-foreground">Only authorized approvals count. This personal view never exposes another member’s restricted work details.</p>
    </section>
  );
}
