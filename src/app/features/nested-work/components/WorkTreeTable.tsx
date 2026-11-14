import type { ReactNode } from 'react';
import { workDateLabel } from '../../../shared/workCalendar';
import { InlineCreateRow, type InlineCreateRequest, type WorkspaceAction } from '../../../components/ui/workspace';
import { ProjectSubtaskBudgetCell, ProjectWorkExpensesCell } from '../../budget';
import type { Task } from '../../tasks';
import { SUBTASK_COLUMNS, useWorkTableColumns, type SubtaskColumn } from '../hooks/useWorkTableColumns';
import { selectNodeWorkCapability } from '../selectors/capabilities';
import type { WorkCapabilityContext, WorkNode, WorkTreeController, WorkTreeSnapshot } from '../types';
import { InlineWorkCreateRow } from './InlineWorkCreateRow';
import { WorkNodeActionMenu } from './WorkNodeActionMenu';
import { WorkNodeOwner } from './WorkNodeOwner';
import { WorkNodeDependenciesCell, WorkNodePriorityCell } from './WorkNodePlanningCells';
import { WorkNodeDue, WorkNodeStatus, WorkNodeTitle, type WorkTreeRowsProps } from './WorkNodePresentation';
import { WorkNodeTimelineCell } from './WorkNodeTimelineCell';
import { WorkPeopleSummary } from './WorkPeopleSummary';
import { AddSubtaskColumnButton, WorkTableColumnHeader } from './WorkTableColumnHeader';

export interface WorkTreeTableProjectSurfaceProps {
  snapshot: WorkTreeSnapshot;
  context: WorkCapabilityContext;
  controller?: WorkTreeController;
  authorityFresh: boolean;
  parentTask?: Task;
  parentTitle?: string;
  parentStartDate?: string;
  canInlineCreate: boolean;
  inlineCreateDisabled?: boolean;
  recoverableStaffNodeIds?: ReadonlySet<string>;
  onCreateInline?: (title: string, request: InlineCreateRequest) => Promise<void>;
  onRenameNode?: (node: WorkNode, title: string) => Promise<void>;
  onStaffNode?: (nodeId: string) => void;
}

export function WorkTreeTable({
  rows,
  people,
  collapsedIds,
  focusedNodeId,
  onToggle,
  onOpenNode,
  tableSurface = false,
  createAction,
  headerAction,
  surfaceProps,
}: WorkTreeRowsProps & {
  tableSurface?: boolean;
  createAction?: WorkspaceAction;
  headerAction?: ReactNode;
  surfaceProps?: WorkTreeTableProjectSurfaceProps;
}) {
  const { columns, canReset, hideColumn, showColumn, resetColumns } = useWorkTableColumns(
    surfaceProps?.snapshot.root.id || '',
    surfaceProps?.context.actorId,
  );

  function renderProjectCell(column: SubtaskColumn, row: WorkTreeRowsProps['rows'][number]) {
    if (!surfaceProps) return null;
    if (column === 'owner') {
      const canStaffNode =
        selectNodeWorkCapability(surfaceProps.snapshot, row.node.id, 'manage_contributors', surfaceProps.context).allowed ||
        selectNodeWorkCapability(surfaceProps.snapshot, row.node.id, 'appoint_lead', surfaceProps.context).allowed;
      return (
        <td key={column} className="nw-col nw-col--owner">
          <WorkNodeOwner
            node={row.node}
            people={people}
            canStaff={canStaffNode}
            disabled={!surfaceProps.authorityFresh || !!surfaceProps.controller?.pending}
            recoverable={surfaceProps.recoverableStaffNodeIds?.has(row.node.id)}
            onStaff={id => surfaceProps.onStaffNode?.(id)}
          />
        </td>
      );
    }
    if (column === 'status') {
      return (
        <td key={column} className="pt-cell pt-cell--status nw-col nw-col--status">
          <WorkNodeStatus node={row.node} tableSurface />
        </td>
      );
    }
    if (column === 'timeline') {
      return (
        <td key={column} className="pt-cell pt-cell--timeline nw-col nw-col--timeline">
          <WorkNodeTimelineCell
            node={row.node}
            snapshot={surfaceProps.snapshot}
            context={surfaceProps.context}
            controller={surfaceProps.controller}
            parentStartDate={surfaceProps.parentStartDate}
            disabled={!surfaceProps.authorityFresh || !!surfaceProps.controller?.pending}
          />
        </td>
      );
    }
    if (column === 'budget') {
      return (
        <td key={column} className="pt-cell nw-col nw-col--budget">
          <ProjectSubtaskBudgetCell
            task={surfaceProps.parentTask}
            subtaskId={row.node.id}
            subtaskTitle={row.node.title}
            readOnly={!surfaceProps.authorityFresh || !!surfaceProps.context.readOnly}
            isPersonal={surfaceProps.snapshot.root.kind === 'personal'}
          />
        </td>
      );
    }
    if (column === 'actualExpenses') {
      return <td key={column} className="pt-cell nw-col nw-col--actualExpenses">
        <ProjectWorkExpensesCell task={surfaceProps.parentTask} subtaskId={row.node.id} personal={surfaceProps.snapshot.root.kind === 'personal'}/>
      </td>;
    }
    const { snapshot, controller, context, authorityFresh } = surfaceProps;
    const node = row.node;
    const disabled = !authorityFresh || !controller || controller.pending || snapshot.root.kind !== 'office' ||
      !selectNodeWorkCapability(snapshot, node.id, 'edit_details', context).allowed;
    const save = async (patch: { priority: WorkNode['priority'] } | { dependency_ids: string[] }) => {
      if (disabled || !controller) return;
      await controller.save({
        id: crypto.randomUUID(), command: 'edit', revision: snapshot.revision,
        payload: { id: node.id, title: node.title, due: node.due_date, standalone: node.is_standalone, note: '', ...patch },
      });
    };
    return (
      <td key={column} className={`pt-cell pt-cell--${column} nw-col nw-col--${column}`}>
        {column === 'priority'
          ? <WorkNodePriorityCell node={node} disabled={disabled} save={save} />
          : <WorkNodeDependenciesCell node={node} nodes={snapshot.nodes} supported={snapshot.supportsSubtaskDependencies === true} disabled={disabled} save={save} />}
      </td>
    );
  }

  return (
    <div className="nw-hierarchy-table-scroll">
      <table className={`nw-hierarchy-table${tableSurface ? ' eflow-data-table' : ''}`} data-density={tableSurface ? 'compact' : undefined}>
        <caption className="sr-only">Subtask hierarchy</caption>
        <thead>
          {tableSurface ? (
            <tr>
              <th scope="col" className="nw-actions-cell" aria-label="Actions">{headerAction}</th>
              <WorkTableColumnHeader
                column="subtask"
                label="Subtask"
                canReset={canReset}
                onHide={hideColumn}
                onReset={resetColumns}
              />
              {columns.map(col => (
                <WorkTableColumnHeader
                  key={col}
                  column={col}
                  label={SUBTASK_COLUMNS.find(item => item.id === col)!.label}
                  canReset={canReset}
                  onHide={hideColumn}
                  onReset={resetColumns}
                />
              ))}
              <th scope="col" className="pt-add-column-col" aria-label="Column customization">
                <AddSubtaskColumnButton columns={columns} onAdd={showColumn} />
              </th>
            </tr>
          ) : (
            <tr>
              <th scope="col" className="nw-actions-cell" aria-label="Actions">{headerAction}</th>
              {['Subtask', 'Lead', 'Contributors', 'Status', 'Start date', 'Due'].map(label => (
                <th key={label} scope="col">{label}</th>
              ))}
            </tr>
          )}
        </thead>
        <tbody>
          {rows.map(row => {
            const canEditNode = Boolean(
              tableSurface &&
              surfaceProps?.authorityFresh &&
              !surfaceProps.controller?.pending &&
              surfaceProps.onRenameNode &&
              selectNodeWorkCapability(surfaceProps.snapshot, row.node.id, 'edit_details', surfaceProps.context).allowed,
            );
            return (
              <tr key={row.node.id} data-work-row={row.node.id} data-selected-work={row.node.id === focusedNodeId || undefined}>
                <td className="nw-actions-cell">
                  <WorkNodeActionMenu compact={tableSurface} label={`Actions for ${row.node.title}`} actions={row.actions} />
                </td>
                <td className={tableSurface ? 'nw-col nw-col--subtask' : undefined}>
                  <WorkNodeTitle
                    row={row}
                    collapsed={collapsedIds.has(row.node.id)}
                    onToggle={() => onToggle(row.node.id)}
                    onOpenNode={() => onOpenNode(row.node.id)}
                    inlineEdit={
                      tableSurface && surfaceProps?.onRenameNode
                        ? { canEdit: canEditNode, revision: surfaceProps.snapshot.revision, onSaveTitle: surfaceProps.onRenameNode }
                        : undefined
                    }
                  />
                </td>
                {tableSurface && surfaceProps ? (
                  <>
                    {columns.map(col => renderProjectCell(col, row))}
                    <td className="pt-column-spacer" />
                  </>
                ) : tableSurface ? (
                  <>
                    <td className="nw-col nw-col--owner"><WorkPeopleSummary leadId={row.node.lead_id} contributorIds={row.node.assigned_to_ids} people={people} compact /></td>
                    <td className="pt-cell pt-cell--status nw-col nw-col--status"><WorkNodeStatus node={row.node} tableSurface /></td>
                    <td className="pt-cell pt-cell--timeline nw-col nw-col--timeline"><WorkNodeDue node={row.node} /></td>
                    {columns.filter(column => !['owner', 'status', 'timeline'].includes(column)).map(column => <td key={column}>—</td>)}
                    <td className="pt-column-spacer" />
                  </>
                ) : (
                  <>
                    <td><WorkPeopleSummary leadId={row.node.lead_id} contributorIds={row.node.assigned_to_ids} people={people} compact part="lead" /></td>
                    <td><WorkPeopleSummary leadId={row.node.lead_id} contributorIds={row.node.assigned_to_ids} people={people} compact part="contributors" /></td>
                    <td><WorkNodeStatus node={row.node} /></td>
                    <td>{row.node.start_date ? workDateLabel(row.node.start_date, 'Asia/Manila') : '—'}</td>
                    <td><WorkNodeDue node={row.node} /></td>
                  </>
                )}
              </tr>
            );
          })}
          {tableSurface && !rows.length && (
            <tr><td colSpan={columns.length + 3} className="nw-empty-row">No subtasks yet.</td></tr>
          )}
        </tbody>
        {tableSurface && (surfaceProps?.canInlineCreate && surfaceProps.onCreateInline ? (
          <tfoot>
            <tr className="pt-add-row nw-inline-create-row">
              <td className="nw-actions-cell" />
              <td className="pt-add-title" colSpan={columns.length + 2}>
                <InlineCreateRow
                  label={surfaceProps.parentTitle ? `Add subtask to ${surfaceProps.parentTitle}` : 'Add subtask'}
                  itemName="subitem"
                  saveOnLeave
                  maxLength={200}
                  disabled={surfaceProps.inlineCreateDisabled}
                  onCreate={surfaceProps.onCreateInline}
                />
              </td>
            </tr>
          </tfoot>
        ) : createAction && !surfaceProps?.onCreateInline ? (
          <tfoot><InlineWorkCreateRow action={createAction} /></tfoot>
        ) : null)}
      </table>
    </div>
  );
}
