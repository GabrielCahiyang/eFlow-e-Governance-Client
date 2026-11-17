import { UsersRound } from 'lucide-react';
import { WorkspaceTooltip } from '../../../components/ui/workspace';
import { resolveWorkPersonName } from '../selectors/people';
import { OwnerAvatarStack } from './OwnerAvatarStack';
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
  const leadName = node.lead_id ? resolveWorkPersonName(people, node.lead_id) : 'Unassigned';
  const contributorIds = node.assigned_to_ids.filter(id => id && id !== node.lead_id);
  const contributorNames = contributorIds.map(id => resolveWorkPersonName(people, id));
  const summaryText = `Lead: ${leadName}${contributorNames.length ? ` · Contributors (${contributorNames.length}): ${contributorNames.join(', ')}` : ''}`;

  return (
    <div className="r7-work r7-root-owner r7-root-owner--table">
      <OwnerAvatarStack
        leadName={leadName}
        hasLead={!!node.lead_id}
        memberNames={contributorNames}
        srSummary={summaryText}
      />
      {canStaff && (
        <WorkspaceTooltip content={recoverable ? 'Recover people draft' : 'Choose people'}>
          <button
            type="button"
            className="r7-owner-edit r7-owner-edit--icon"
            aria-label={`Choose subtask lead and contributors for ${node.title}`}
            disabled={disabled}
            onClick={() => onStaff(node.id)}
          >
            <UsersRound size={14} aria-hidden="true" />
            <span className="sr-only">{recoverable ? 'Recover people draft' : 'Choose people'}</span>
          </button>
        </WorkspaceTooltip>
      )}
    </div>
  );
}
