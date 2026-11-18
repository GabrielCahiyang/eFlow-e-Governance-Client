import { ShieldCheck } from 'lucide-react';
import { EmptyState } from '../../../components/ui/EmptyState';
import { WorkFinancialClearancePanel } from '../../budget';
import type { WorkNode, WorkTreeSnapshot } from '../../nested-work';
import type { Task } from '../../tasks';
import type { useSubitemInspectorData } from '../hooks/useSubitemInspectorData';
import { getSubtaskDependencyBlocker, getSubtaskPrerequisite } from '../selectors/sequencing';
import { SubitemLeadReview } from './SubitemLeadReview';
import { SubtaskProgressHistory } from './SubtaskProgressHistory';
import { SubtaskSubmissionHistory } from './SubtaskSubmissionHistory';

type InspectorData = NonNullable<ReturnType<typeof useSubitemInspectorData>['data']>;

export interface SubitemEvidencePanelProps {
  rootTask: Task;
  node: WorkNode;
  tree: WorkTreeSnapshot;
  actorId: string | null;
  currentStatus: string;
  scopeReadOnly: boolean;
  startPaused: boolean;
  pending: boolean;
  submissions: InspectorData['submissions'];
  progressUpdates: InspectorData['progressUpdates'];
  onChanged: () => Promise<void>;
}

/** Dedicated modal body for subtask work evidence, submissions, and review. */
export function SubitemEvidencePanel({
  rootTask,
  node,
  tree,
  actorId,
  currentStatus,
  scopeReadOnly,
  startPaused,
  pending,
  submissions,
  progressUpdates,
  onChanged,
}: SubitemEvidencePanelProps) {
  const siblings = tree.nodes.map((item) => ({
    id: item.id,
    title: item.title,
    parentSubtaskId: item.parent_subtask_id || undefined,
    position: item.sibling_order,
    siblingOrder: item.sibling_order,
    isStandalone: item.is_standalone,
    isCompleted: item.status === 'completed',
    dependencyIds: item.dependency_ids,
  }));
  const currentSibling = siblings.find((item) => item.id === node.id);
  const dependencyBlockedReason = (node.restricted_dependency_count ?? 0) > 0
    ? 'A selected prerequisite is missing or restricted. Reload this work to verify its dependencies.'
    : (currentSibling ? getSubtaskDependencyBlocker(currentSibling, siblings) : null) ||
      ((node.pending_dependency_count ?? 0) > 0 ? 'Complete every selected prerequisite first.' : null);
  const unfinishedChild = tree.nodes.some((child) => child.parent_subtask_id === node.id && child.status !== 'completed');
  const reviewerName = actorId === node.lead_id
    ? tree.people.find((person) => person.id === tree.root.lead)?.name
    : undefined;
  const waitingToStart = !!tree.root.scheduling && node.status === 'todo' && !node.started_at;
  const prerequisite = currentSibling ? getSubtaskPrerequisite(currentSibling, siblings) : null;
  const evidenceTotal = submissions.length + progressUpdates.length;

  return (
    <section className="subitem-action-shell" aria-label="Subtask evidence and review">
      <header className="subitem-action-heading">
        <div className="subitem-action-heading__icon" aria-hidden="true">
          <ShieldCheck size={22} />
        </div>
        <div className="subitem-action-heading__copy">
          <h3>Evidence &amp; progress proof</h3>
          <p>Submitted work proof, completion evidence, and Lead review decisions.</p>
        </div>
        <div className="subitem-action-heading__meta">
          <span className={`subitem-action-pill ${evidenceTotal > 0 ? 'subitem-action-pill--accent' : ''}`}>
            {submissions.length} {submissions.length === 1 ? 'submission' : 'submissions'} · {progressUpdates.length}{' '}
            {progressUpdates.length === 1 ? 'update' : 'updates'}
          </span>
        </div>
      </header>

      {tree.root.kind === 'office' && (
        <WorkFinancialClearancePanel
          root={tree.root.id}
          node={node.id}
          readOnly={scopeReadOnly || startPaused || tree.root.project_status === 'on_hold'}
          leadName={tree.people.find((person) => person.id === node.lead_id)?.name}
          onSaved={onChanged}
        />
      )}

      {tree.root.kind === 'office' && !waitingToStart && actorId && (
        <SubitemLeadReview
          key={`${node.id}:${rootTask.updatedAt || ''}`}
          root={tree.root.id}
          node={node.id}
          actor={actorId}
          status={currentStatus}
          initialBlocker={progressUpdates[0]?.blocker || ''}
          readOnly={scopeReadOnly || startPaused}
          pending={pending}
          blocked={dependencyBlockedReason || (prerequisite && !prerequisite.isCompleted ? `Complete “${prerequisite.title}” first.` : undefined)}
          completionBlocked={unfinishedChild ? 'Complete the child subtasks first.' : undefined}
          reviewerName={reviewerName}
          onChanged={onChanged}
        />
      )}

      {submissions.length > 0 ? (
        <SubtaskSubmissionHistory submissions={submissions} />
      ) : (
        <article className="subitem-action-card">
          <header className="subitem-action-card__header">
            <div>
              <h4 className="subitem-action-card__title">Submission history</h4>
              <p className="subitem-action-card__subtitle">Formal completion requests and attached proof appear here.</p>
            </div>
            <span className="subitem-action-pill">0 submissions</span>
          </header>
          <div className="subitem-action-card__body">
            <EmptyState
              illustration="files"
              size="compact"
              title="No formal work submissions yet."
              description="Submitted work updates, completion evidence, and Lead review decisions appear here."
            />
          </div>
        </article>
      )}

      <SubtaskProgressHistory updates={progressUpdates} />
    </section>
  );
}
