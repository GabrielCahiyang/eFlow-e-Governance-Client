import { StatusPill } from "../../../components/ui/workspace";
import { workDateLabel } from "../../../shared/workCalendar";
import type { WorkRow } from "../types";
export function WorkList({
  rows,
  onOpen,
  label = "Work items",
}: {
  rows: WorkRow[];
  onOpen: (row: WorkRow, element: HTMLElement) => void;
  label?: string;
}) {
  return (
    <ul className="r10-work-list" aria-label={label}>
      {rows.map((row) => (
        <li key={row.key}>
          <button
            type="button"
            data-work-key={row.key}
            data-personal-task={row.kind === "office-task" ? row.id : undefined}
            onClick={(e) => onOpen(row, e.currentTarget)}
          >
            <span className="r10-work-title">
              <strong>{row.title}</strong>
              <small>
                {row.workspaceName} · {row.projectTitle}
                {row.rootTitle ? ` · ${row.rootTitle}` : ""}
              </small>
              <small>
                {row.relation}
                {row.node ? ` · Depth ${row.node.depth}` : ""} ·{" "}
                {row.kind.startsWith("personal") ? "Personal" : "Office"}
                {row.officeName ? ` · ${row.officeName}` : ""}
              </small>
            </span>
            <span className="r10-work-due">
              {workDateLabel(row.due, row.timezone)}
              <small>{row.timezone}</small>
            </span>
            <StatusPill
              label={row.status.replace(/_/g, " ")}
              tone={
                row.status === "completed"
                  ? "positive"
                  : ["for_review", "submitted"].includes(row.status)
                    ? "warning"
                    : row.status === "in_progress"
                      ? "info"
                      : "neutral"
              }
            />
            <span className="r10-work-progress">{row.progress}%</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
