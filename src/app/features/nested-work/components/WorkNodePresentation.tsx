import type { CSSProperties } from 'react';
import { PanelRight } from 'lucide-react';
import { DeadlineBadge } from '../../../components/ui/DeadlineBadge';
import { InlineEditableText } from '../../../components/ui/workspace';
import { StatusPill } from '../../../components/ui/workspace/StatusPill';
import type { WorkspaceAction } from '../../../components/ui/workspace/ActionMenu';
import { workStateLabel } from '../../work-state';
import type { WorkDisplayRow } from '../selectors/displayTree';
import type { WorkNode, WorkPerson } from '../types';

export interface WorkHierarchyRow {
  node: WorkNode;
  display: WorkDisplayRow;
  actions: WorkspaceAction[];
}

export interface WorkTreeRowsProps {
  rows: WorkHierarchyRow[];
  people: readonly WorkPerson[];
  collapsedIds: ReadonlySet<string>;
  focusedNodeId?: string;
  onToggle: (nodeId: string) => void;
  onOpenNode: (nodeId: string) => void;
}

export interface WorkNodeTitleInlineProps {
  canEdit: boolean;
  revision: number;
  onSaveTitle: (node: WorkNode, title: string) => Promise<void>;
}

export function WorkNodeTitle({
  row,
  collapsed,
  onToggle,
  onOpenNode,
  inlineEdit,
}: {
  row: WorkHierarchyRow;
  collapsed: boolean;
  onToggle: () => void;
  onOpenNode: () => void;
  inlineEdit?: WorkNodeTitleInlineProps;
}) {
  const { display, node } = row;
  return (
    <div className="nw-hierarchy-title" style={{ '--nw-indent': display.indentLevel } as CSSProperties}>
      <div className="nw-hierarchy-title-line">
        {display.hasChildren ? (
          <button
            type="button"
            className="nw-hierarchy-control nw-hierarchy-disclosure"
            aria-label={`${collapsed ? 'Expand' : 'Collapse'} children of ${node.title}`}
            aria-expanded={!collapsed}
            onClick={onToggle}
          >
            <span aria-hidden="true">{collapsed ? '▸' : '▾'}</span>
          </button>
        ) : (
          <span className="nw-hierarchy-leaf" aria-hidden="true" />
        )}
        {inlineEdit ? (
          <>
            <InlineEditableText
              value={node.title}
              label={'subtask ' + node.title}
              maxLength={200}
              disabled={!inlineEdit.canEdit}
              revision={inlineEdit.revision}
              onSave={title => inlineEdit.onSaveTitle(node, title)}
            />
            <button
              type="button"
              className="pt-subitem-open"
              title={display.pathLabel}
              data-work-open={node.id}
              aria-label={'Open subtask ' + node.title}
              onClick={onOpenNode}
            >
              <PanelRight size={15} aria-hidden="true" />
            </button>
          </>
        ) : (
          <button
            type="button"
            className="nw-hierarchy-open"
            title={display.pathLabel}
            data-work-open={node.id}
            onClick={onOpenNode}
          >
            {node.title}
          </button>
        )}
      </div>
      {display.pathLabel !== node.title && (
        <p className="nw-hierarchy-path" aria-label={`Path for ${node.title}`}>{display.pathLabel}</p>
      )}
      {display.context && (
        <p className="nw-hierarchy-context">
          {display.context === 'missing_parent' ? 'Parent context unavailable' : 'Hierarchy context incomplete'}
        </p>
      )}
    </div>
  );
}

const statuses = {
  todo: { label: 'Not started', tone: 'neutral' },
  in_progress: { label: 'In progress', tone: 'info' },
  for_review: { label: 'Ready to finish', tone: 'info' },
  changes_requested: { label: 'In progress', tone: 'info' },
  completed: { label: 'Completed', tone: 'positive' },
} as const;

export function WorkNodeStatus({ node, tableSurface = false }: { node: WorkNode; tableSurface?: boolean }) {
  const effectiveStatus = node.effective_status || node.status;
  const blocked = effectiveStatus === 'in_progress' && Boolean(node.blocker);
  if (tableSurface) {
    return (
      <span className={`work-status-trigger work-status-trigger--${blocked ? 'stuck' : effectiveStatus}`}>
        {workStateLabel(effectiveStatus, blocked)}
      </span>
    );
  }
  return <StatusPill {...statuses[node.status]} label={node.status === 'in_progress' && node.blocker ? 'Stuck' : statuses[node.status].label} />;
}

export function WorkNodeDue({ node }: { node: WorkNode }) {
  return <DeadlineBadge value={node.due_date} status={node.status} />;
}
