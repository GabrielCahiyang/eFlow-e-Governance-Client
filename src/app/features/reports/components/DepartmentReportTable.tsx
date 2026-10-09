import { StatusPill } from "../../../components/ui/workspace";
import { Fragment, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatDate } from "../../../components/workflow/primitives";
import type { DepartmentReportRow } from "../types";

const tone = (priority: string) => {
  const value = priority.toLowerCase();
  if (value === "critical" || value === "high") return "negative";
  if (value === "warning" || value === "medium") return "warning";
  if (value === "approved" || value === "completed" || value === "low")
    return "positive";
  return "neutral";
};

export function DepartmentReportTable({
  rows,
  onOpenTask,
}: {
  rows: DepartmentReportRow[];
  onOpenTask: (taskId: string) => void;
}) {
  const [expandedRowId, setExpandedRowId] = useState<string>();

  return (
    <div
      className="eflow-analytics-table max-w-full overflow-x-auto"
      role="region"
      aria-label="Office report rows"
      tabIndex={0}
    >
      <table className="w-full min-w-[980px] table-fixed">
        <colgroup>
          <col className="w-[260px]" />
          <col className="w-[150px]" />
          <col className="w-[160px]" />
          <col className="w-[140px]" />
          <col className="w-[150px]" />
          <col className="w-[150px]" />
          <col className="w-[240px]" />
        </colgroup>
        <thead>
          <tr className="bg-muted border-b border-border">
            {[
              "Work item",
              "Person / role",
              "Project",
              "Status",
              "Signal",
              "Event / due",
              "Detail",
            ].map((header) => (
              <th
                key={header}
                className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider text-muted-foreground"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const expanded = expandedRowId === row.id;
            return (
              <Fragment key={row.id}>
                <tr className="border-b border-border align-top hover:bg-muted/70 transition-colors">
                  <td className="max-w-[250px] break-words px-4 py-3 align-top whitespace-normal">
                    <button
                      type="button"
                      disabled={!row.taskId}
                      onClick={() => row.taskId && onOpenTask(row.taskId)}
                      className={`text-left group ${row.taskId ? "cursor-pointer" : "cursor-default"}`}
                    >
                      <span className="line-clamp-3 break-words text-[12px] font-medium text-foreground group-hover:underline">
                        {row.title}
                      </span>
                      {row.taskId && (
                        <ArrowUpRight
                          size={11}
                          className="inline ml-1 text-muted-foreground"
                        />
                      )}
                      <span className="mt-0.5 block break-words text-[12px] text-muted-foreground line-clamp-2">
                        {row.parent}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-label={`${expanded ? "Collapse" : "Expand"} details for ${row.title}`}
                      onClick={() =>
                        setExpandedRowId((current) =>
                          current === row.id ? undefined : row.id,
                        )
                      }
                      className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      {expanded ? (
                        <ChevronUp size={13} />
                      ) : (
                        <ChevronDown size={13} />
                      )}
                      {expanded ? "Hide detail" : "Show detail"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-[13px] text-foreground">
                      {row.person}
                    </div>
                    <div className="mt-0.5 text-[12px] text-muted-foreground">
                      {row.role}
                    </div>
                  </td>
                  <td className="max-w-[180px] break-words px-4 py-3 text-[12px] text-muted-foreground whitespace-normal">
                    {row.project}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill label={row.status} tone={tone(row.status)} />
                    {typeof row.progress === "number" && (
                      <div className="w-24 mt-2">
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-neutral-800"
                            style={{
                              width: `${Math.max(0, Math.min(100, row.progress))}%`,
                            }}
                          />
                        </div>
                        <div className="mt-0.5 text-[12px] text-muted-foreground">
                          {row.progress}%
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill
                      label={row.priority}
                      tone={tone(row.priority)}
                    />
                    <div className="mt-1.5 text-[12px] text-muted-foreground">
                      {row.metric}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-nowrap">
                    {row.eventAt && <div>{formatDate(row.eventAt)}</div>}
                    {row.dueAt && (
                      <div className="flex items-center gap-1 mt-1">
                        <CalendarDays size={11} /> Due {formatDate(row.dueAt)}
                      </div>
                    )}
                  </td>
                  <td className="max-w-[240px] break-words px-4 py-3 text-[12px] text-muted-foreground whitespace-normal">
                    <span className="line-clamp-3">{row.detail}</span>
                  </td>
                </tr>
                {expanded && (
                  <tr className="border-b border-border bg-muted/70">
                    <td colSpan={7} className="px-4 py-3">
                      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <div>
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Full work item
                          </span>
                          <p className="mt-1 break-words text-[13px] leading-5 text-foreground">
                            {row.title}
                          </p>
                          <p className="mt-1 break-words text-[12px] leading-5 text-muted-foreground">
                            {row.parent}
                          </p>
                        </div>
                        <div>
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Report detail
                          </span>
                          <p className="mt-1 break-words text-[12px] leading-5 text-foreground">
                            {row.detail}
                          </p>
                          <p className="mt-1 break-words text-[12px] leading-5 text-muted-foreground">
                            {row.metric}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
