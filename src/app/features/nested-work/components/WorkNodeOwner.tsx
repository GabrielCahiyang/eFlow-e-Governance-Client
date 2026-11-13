import { WorkPeopleSummary } from './WorkPeopleSummary';
import type { WorkNode, WorkPerson } from '../types';

export interface WorkNodeOwnerProps {
  node: WorkNode;
  people: readonly WorkPerson[];
  canStaff: boolean;
  disabled?: boolean;
  recoverable?: boolean;
  onStaff: (nodeId: string) => void;
}

export function WorkNodeOwner({ node, people, canStaff, disabled = false, recoverable = false, onStaff }: WorkNodeOwnerProps) {
  return (
    <div className="r7-work r7-root-owner">
      <WorkPeopleSummary leadId={node.lead_id} contributorIds={node.assigned_to_ids} people={people} compact />
      {canStaff && (
        <button
          type="button"
          aria-label={`Choose subtask lead and contributors for ${node.title}`}
          disabled={disabled}
          onClick={() => onStaff(node.id)}
        >
          {recoverable ? 'Recover people draft' : 'Choose people'}
        </button>
      )}
    </div>
  );
}
