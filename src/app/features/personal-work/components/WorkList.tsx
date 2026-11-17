import { Fragment } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, FolderKanban } from 'lucide-react';
import {resolveStatus, useWorkStatuses} from '../../work-status';
import {workStateLabel} from '../../work-state';
import { collectSubtaskTeamIds, OwnerAvatarStack, resolveWorkPersonName } from '../../nested-work';
import { StatusPill } from "../../../components/ui/workspace";
import { deadlinePresentation } from '../../../shared/deadlinePresentation';
import { workDateLabel } from "../../../shared/workCalendar";
import type { WorkRow } from "../types";

function formatUpdatedDate(timestamp?: number) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

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
  groupByParent = false,
  historyView = false,
}: {
  rows: WorkRow[];
  onOpen: (row: WorkRow, element: HTMLElement) => void;
  label?: string;
  groupByParent?: boolean;
  historyView?: boolean;
}) {
  const { definitions } = useWorkStatuses();

  const renderColumnsHeader = (includeLeadingLabel = true) => (
    <div
      className="r10-work-list__head"
      data-history={historyView ? "true" : "false"}
      aria-hidden={!includeLeadingLabel || undefined}
    >
      <div className="r10-work-list__cols">
        <span>{groupByParent ? "Subtask" : historyView ? "Work item" : "Task"}</span>
        <span>Your role</span>
        <span>Due date</span>
        <span>Status</span>
        {historyView && <span className="text-right">Updated</span>}
      </div>
      <span className="r10-work-list__head-action">Context</span>
    </div>
  );

  const renderRow = (row: WorkRow) => {
    const dueSignal = row.due && !historyView ? deadlinePresentation(row.due, row.status) : undefined;
    const isTerminal = ['completed', 'cancelled', 'canceled'].includes(row.status);
    const parentLabel = row.workContext?.path.length
      ? row.workContext.path[row.workContext.path.length - 2]?.title || row.rootTitle || ''
      : row.rootTitle || '';
    const subtitleParts = groupByParent
      ? [
          row.workContext && row.workContext.path.length > 2 && parentLabel
            ? `Under: ${parentLabel}`
            : "",
        ].filter(Boolean)
      : [
          row.kind.startsWith('personal') ? 'Personal' : '',
          row.projectTitle ? `Project: ${row.projectTitle}` : '',
          parentLabel ? `Task: ${parentLabel}` : '',
        ].filter(Boolean);

    return (
      <li key={row.key}>
        <div className="r10-work-row">
          <div className="r10-work-row__grid">
            <button
              type="button"
              data-work-key={row.key}
              data-history={historyView ? "true" : "false"}
              data-personal-task={row.kind === "office-task" ? row.id : undefined}
              onClick={(e) => onOpen(row, e.currentTarget)}
            >
              <span className="r10-work-title">
                <strong>
                  {row.title}
                  {row.blocker && !historyView && (
                    <span className="r10-blocker-tag">
                      <AlertTriangle size={12} aria-hidden="true" />
                      Needs help
                    </span>
                  )}
                </strong>
                {subtitleParts.length > 0 && <small>{subtitleParts.join(' · ')}</small>}
              </span>
              <span className="r10-work-people">
                <span className="r10-work-people__row">
                  <span className={row.relation === 'Needs reassignment' || (row.workContext && !row.workContext.leadName) ? 'r10-reassignment' : 'r10-role-label'}>
                    {row.relation}
                  </span>
                  {(() => {
                    if (row.workContext) {
                      const hasLead = Boolean(row.workContext.leadName);
                      const leadName = row.workContext.leadName || 'Needs reassignment';
                      const memberNames = row.workContext.contributors.map(person => person.name);
                      return (
                        <OwnerAvatarStack
                          leadName={leadName}
                          hasLead={hasLead}
                          memberNames={memberNames}
                          focusableAvatars={false}
                          srSummary={
                            <>Lead: {leadName} · Contributors ({row.workContext.contributors.length})</>
                          }
                        />
                      );
                    }
                    if (row.tree) {
                      const leadId = row.tree.root.lead;
                      const leadName = leadId ? resolveWorkPersonName(row.tree.people, leadId) : 'Needs reassignment';
                      const team = collectSubtaskTeamIds(row.tree.root.lead, row.tree.root.people, row.tree.nodes);
                      const memberNames = team.teamIds.map(id => resolveWorkPersonName(row.tree!.people, id));
                      return (
                        <OwnerAvatarStack
                          leadName={leadName}
                          hasLead={Boolean(leadId)}
                          memberNames={memberNames}
                          focusableAvatars={false}
                        />
                      );
                    }
                    if (row.task && (row.task.assigneeId || row.task.assigneeName)) {
                      const hasLead = Boolean(row.task.assigneeId || row.task.assigneeName);
                      const leadName = row.task.assigneeName || 'Needs reassignment';
                      return (
                        <OwnerAvatarStack
                          leadName={leadName}
                          hasLead={hasLead}
                          memberNames={[]}
                          focusableAvatars={false}
                        />
                      );
                    }
                    return null;
                  })()}
                </span>
              </span>
              <span className="r10-work-due">
                <span className="r10-work-due__date">{workDateLabel(row.due, row.timezone)}</span>
                {dueSignal && !isTerminal && dueSignal.date && (
                  <span className="r10-work-due__urgency" data-tone={dueSignal.tone}>
                    {dueSignal.label}
                  </span>
                )}
              </span>
              <StatusPill
                {...resolveStatus(
                  definitions,
                  row.status === 'in_progress' && row.blocker ? 'stuck' : row.status,
                  workStateLabel(row.status, !!row.blocker),
                  row.task?.customStatusId ?? (row.node?.custom_status_id === undefined ? row.subtask?.customStatusId : row.node.custom_status_id),
                )}
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
              {historyView && (
                <span className="r10-work-progress">{formatUpdatedDate(row.updatedAt)}</span>
              )}
            </button>
            <details className="r10-row-details">
              <summary aria-label={`Work context for ${row.title}`}>
                <span>Details</span>
                <ChevronDown size={13} aria-hidden="true" />
              </summary>
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
        </div>
      </li>
    );
  };

  if (groupByParent && rows.length > 0) {
    const groups: { key: string; project: string; parent: string; items: WorkRow[] }[] = [];
    const byKey = new Map<string, (typeof groups)[number]>();
    for (const row of rows) {
      const parent = row.rootTitle || row.workContext?.path[0]?.title || 'Assigned task';
      const key = `${row.projectTitle}::${parent}`;
      let entry = byKey.get(key);
      if (!entry) {
        entry = { key, project: row.projectTitle, parent, items: [] };
        byKey.set(key, entry);
        groups.push(entry);
      }
      entry.items.push(row);
    }
    return (
      <div className="r10-work-groups" aria-label={label}>
        {groups.map((group, index) => (
          <section key={group.key} className="r10-work-group">
            <header className="r10-work-group__header">
              <span className="r10-work-group__title">
                <span className="r10-work-group__crumb">
                  <span className="r10-work-group__tag">
                    <FolderKanban size={13} aria-hidden="true" />
                    <span>Project</span>
                  </span>
                  <strong>{group.project}</strong>
                </span>
                <ChevronRight size={14} aria-hidden="true" className="r10-work-group__sep" />
                <span className="r10-work-group__crumb">
                  <span className="r10-work-group__tag">Task</span>
                  <span className="r10-work-group__parent">{group.parent}</span>
                </span>
              </span>
              <span className="r10-work-group__count">
                {group.items.length} {group.items.length === 1 ? 'step' : 'steps'}
              </span>
            </header>
            {renderColumnsHeader(index === 0)}
            <ul className="r10-work-list">{group.items.map(renderRow)}</ul>
          </section>
        ))}
      </div>
    );
  }

  return (
    <Fragment>
      <div className="r10-work-table" aria-label={label}>
        {renderColumnsHeader(true)}
        <ul className="r10-work-list">
          {rows.map(renderRow)}
        </ul>
      </div>
    </Fragment>
  );
}
