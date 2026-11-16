import { Trophy } from "lucide-react";
import type { MonthlyContributionRow } from "../types";

export function ContributionSummaryCard({ rows, title = "Monthly contribution" }: { rows: MonthlyContributionRow[]; title?: string }) {
  const leader = rows[0];
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-primary">
          <Trophy size={14} />
          {title}
        </div>
        <span className="rounded-[6px] border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          Approved work only
        </span>
      </div>
      {leader ? (
        <>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <div className="text-[11px] text-muted-foreground">Current leader</div>
              <div className="mt-0.5 text-[14px] font-semibold text-foreground">{leader.employeeName}</div>
              <div className="text-[11px] text-muted-foreground">
                {leader.approvedTasks} tasks · {leader.approvedSubtasks} subtasks
              </div>
            </div>
            <div className="text-right">
              <div className="text-[22px] font-semibold tabular-nums text-foreground">{leader.contributionScore}</div>
              <div className="text-[11px] text-muted-foreground">contribution score</div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {rows.slice(0, 3).map((row) => (
              <span
                key={row.userId}
                className={`truncate rounded-[6px] border px-2 py-1 text-[11px] font-medium ${
                  row.rank === 1
                    ? "border-primary/25 bg-primary/10 text-primary"
                    : "border-border bg-muted/60 text-muted-foreground"
                }`}
              >
                #{row.rank} {row.employeeName}
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-3 text-[12px] text-muted-foreground">No approved contributions this month yet.</p>
      )}
    </div>
  );
}
