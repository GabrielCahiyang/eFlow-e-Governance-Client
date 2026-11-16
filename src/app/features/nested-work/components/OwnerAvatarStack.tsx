import type { ReactNode } from 'react';
import { WorkspaceTooltip } from '../../../components/ui/workspace';

function toInitials(name: string): string {
  return name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase() || '?';
}

/** Compact overlapping avatar stack with Vibe tooltips for Main table task and subtask Owner cells. */
export function OwnerAvatarStack({
  leadName,
  hasLead,
  memberNames,
  srSummary,
}: {
  leadName: string;
  hasLead: boolean;
  memberNames: string[];
  srSummary?: ReactNode;
}) {
  const visible = memberNames.slice(0, 2);
  const hidden = memberNames.slice(2);
  return (
    <div className="r7-owner-summary r7-owner-summary--avatars">
      <WorkspaceTooltip content={hasLead ? `Lead: ${leadName}` : 'Lead: Needs reassignment'}>
        <span
          tabIndex={0}
          className={`r7-owner-avatar r7-owner-avatar--lead${!hasLead ? ' r7-owner-avatar--missing' : ''}`}
          aria-label={hasLead ? `Lead: ${leadName}` : 'Lead: Needs reassignment'}
        >
          {hasLead ? toInitials(leadName) : '?'}
        </span>
      </WorkspaceTooltip>
      {visible.map((name, idx) => (
        <WorkspaceTooltip key={`${name}:${idx}`} content={name}>
          <span tabIndex={0} className="r7-owner-avatar" aria-label={name}>
            {toInitials(name)}
          </span>
        </WorkspaceTooltip>
      ))}
      {hidden.length > 0 && (
        <WorkspaceTooltip content={hidden.join(', ')}>
          <span
            tabIndex={0}
            className="r7-owner-avatar r7-owner-avatar--more"
            aria-label={`${hidden.length} more: ${hidden.join(', ')}`}
          >
            +{hidden.length}
          </span>
        </WorkspaceTooltip>
      )}
      {srSummary && <span className="sr-only">{srSummary}</span>}
    </div>
  );
}
