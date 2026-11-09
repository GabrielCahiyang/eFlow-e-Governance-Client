import {workStateLabel} from '../../work-state';
import { StatusPill } from "../../../components/ui/workspace";
import { workDateLabel } from "../../../shared/workCalendar";
import type { WorkRow } from "../types";

export function WorkListSkeleton({
  rows = 4,
  label = "Loading work items…",
  statusText,
}: {
  rows?: number;
  label?: string;
  statusText?: string;
}) {
  const pulse = "animate-pulse rounded bg-muted";
  return (
    <div role="status" aria-label={label} aria-busy="true">
      {statusText && <span className="sr-only">{statusText}</span>}
      <ul className="r10-work-list" aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i}>
            <div className="r10-work-row">
              <div className="flex w-full flex-wrap items-center justify-between gap-3 px-3.5 py-3">
                <span className="r10-work-title flex-1 min-w-[200px] space-y-1.5">
                  <span className={`block h-4 w-3/5 ${pulse}`} />
                  <span className={`block h-3 w-2/5 ${pulse}`} />
                </span>
                <span className="r10-work-people min-w-[150px] space-y-1.5">
                  <span className={`block h-3.5 w-24 ${pulse}`} />
                  <span className={`block h-3 w-36 ${pulse}`} />
                </span>
                <span className="r10-work-due">
                  <span className={`inline-block h-3.5 w-20 ${pulse}`} />
                </span>
                <span className={`inline-block h-6 w-24 rounded-full ${pulse}`} />
                <span className="r10-work-progress">
                  <span className={`inline-block h-3 w-14 ${pulse}`} />
                </span>
              </div>
              <div className="r10-row-details px-3.5 py-1.5">
                <span className={`inline-block h-3 w-12 ${pulse}`} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
