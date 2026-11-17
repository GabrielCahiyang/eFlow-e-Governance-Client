import { ArrowUpRight, UserMinus } from 'lucide-react';
import { StatusPill } from '../../../components/ui/workspace/StatusPill';
import type { AccessSnapshot } from '../../project-access';
import type { MembersSnapshot, SelectedMember } from '../types';

export function MemberDirectory({ members, snapshot, access, closed, onOpenTask, onRemove }: {
  members: SelectedMember[];
  snapshot: MembersSnapshot;
  access?: AccessSnapshot;
  closed: boolean;
  onOpenTask: (id: string) => void;
  onRemove: (member: SelectedMember) => void;
}) {
  const dateFormat = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: snapshot.timezone || 'Asia/Manila' });
  return <table className="project-members-table" aria-label="Selected project members" role="table">
    <thead><tr role="row">{['Member', 'Project access', 'Responsibilities', 'Actions'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
    <tbody>
      {members.map(member => {
        const canRead = member.can_read ?? member.eligible;
        const accessLabel = canRead ? (member.access || 'member').replace(/_/g, ' ') : member.access_ended_at ? 'Ended' : 'Unavailable';
        const initials = member.name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase() || '?';
        const canRemove = !closed && access && (access.can_remove_personal || access.can_remove_offices.includes(member.office || ''));
        return <tr role="row" key={`${member.office}:${member.user_id}`}>
          <td role="cell">
            <div className="project-member-person">
              <span aria-hidden="true" className="project-member-avatar">{initials}</span>
              <div><strong>{member.name}</strong><span>{member.office_name || 'Personal project'}</span><span>{member.engagement}</span></div>
            </div>
          </td>
          <td role="cell" data-label="Project access">
            <div className="project-member-access">
              <StatusPill label={accessLabel} tone={canRead ? member.eligible ? 'positive' : 'info' : 'neutral'} />
              <span>{member.eligible ? 'Assigned work and delegation within their branch' : member.can_read ? 'View authorized project information; no execution or delegation' : 'Historical membership'}</span>
              {member.access_end && <span>Ends {dateFormat.format(new Date(member.access_end))}</span>}
              {member.until_close && <span>Until project closes</span>}
              {member.state === 'guest' && !member.eligible && <span>Renew with a Head-approved invitation.</span>}
            </div>
          </td>
          <td role="cell" data-label="Responsibilities">
            <div className="project-member-work">
              {member.responsibilities?.length ? member.responsibilities.map(role =>
                <button className="project-member-work-link" key={`${role.root}:${role.node || ''}:${role.role}`} type="button" onClick={() => onOpenTask(role.root)}>
                  <span>{role.title} · {role.role}</span><ArrowUpRight size={14} aria-hidden="true" />
                </button>
              ) : <span>No assigned responsibility</span>}
            </div>
          </td>
          <td role="cell" data-label={canRemove ? 'Actions' : undefined}>
            <div className="project-member-actions">
              {canRemove && <button type="button" aria-label={`Review removal · ${member.name}`} onClick={() => onRemove(member)}><UserMinus size={14} aria-hidden="true" /> Review removal</button>}
            </div>
          </td>
        </tr>;
      })}
    </tbody>
  </table>;
}
