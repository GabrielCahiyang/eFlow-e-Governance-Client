import {workStateLabel} from '../../work-state';
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
          <div className="r10-work-row">
          <button
            type="button"
            data-work-key={row.key}
            data-personal-task={row.kind === "office-task" ? row.id : undefined}
            onClick={(e) => onOpen(row, e.currentTarget)}
          >
            <span className="r10-work-title">
              <strong>{row.title}</strong>
              <small>
                {row.kind.startsWith('personal') ? 'Personal' : 'Office'} · {row.workspaceName} · {row.projectTitle}
                {row.workContext?.path.length ? ` · ${row.workContext.path[row.workContext.path.length - 2]?.title || row.rootTitle || ''}` : row.rootTitle ? ` · ${row.rootTitle}` : ''}
              </small>
            </span>
            <span className="r10-work-people">
              <span className={row.relation === 'Needs reassignment' || row.workContext && !row.workContext.leadName ? 'r10-reassignment' : undefined}>
                {row.relation}
              </span>
              {row.workContext && <small>Lead: {row.workContext.leadName || 'Needs reassignment'} · Contributors ({row.workContext.contributors.length})</small>}
            </span>
            <span className="r10-work-due">
              {workDateLabel(row.due, row.timezone)}
            </span>
            <StatusPill
              label={workStateLabel(row.status,!!row.blocker)}
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
            <span className="r10-work-progress">{row.status==='completed'?'Approved':row.blocker?'Needs help':''}</span>
          </button>
          <details className="r10-row-details">
            <summary aria-label={`Work context for ${row.title}`}>Details</summary>
            <dl>
              <div><dt>Workspace</dt><dd>{row.kind.startsWith('personal') ? 'Personal' : 'Office'} · {row.workspaceName}{row.officeName ? ` · ${row.officeName}` : ''}</dd></div>
              <div><dt>Project</dt><dd>{row.projectTitle}</dd></div>
              <div><dt>Work path</dt><dd aria-label="Work path">{row.workContext?.pathLabel || [row.rootTitle, row.title].filter(Boolean).join(' / ')}</dd></div>
              <div><dt>Your relation</dt><dd>{row.relation}</dd></div>
              {row.workContext && <><div><dt>Lead</dt><dd>{row.workContext.leadName || 'Needs reassignment'}</dd></div><div><dt>Contributors ({row.workContext.contributors.length})</dt><dd>{row.workContext.contributors.map(person => person.name).join(', ') || 'No contributors assigned'}</dd></div></>}
              <div><dt>Date timezone</dt><dd>{row.timezone}</dd></div>
            </dl>
          </details>
          </div>
        </li>
      ))}
    </ul>
  );
}
