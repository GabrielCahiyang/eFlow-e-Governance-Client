import { ArrowUpRight, Pencil, UserMinus } from 'lucide-react';
import { StatusPill } from '../../../components/ui/workspace/StatusPill';
import type { AccessSnapshot } from '../../project-access';
import type { MembersSnapshot, SelectedMember } from '../types';

export function MemberDirectory({ members, snapshot, access, closed, onOpenTask, onEdit, onRemove }: {
  members: SelectedMember[];
  snapshot: MembersSnapshot;
  access?: AccessSnapshot;
  closed: boolean;
  onOpenTask: (id: string) => void;
  onEdit: (member: SelectedMember) => void;
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
        const canEditTerms = !closed && !['guest', 'share'].includes(member.state) &&
          (snapshot.kind === 'personal' && snapshot.can_select || snapshot.offices.some(office => office.office_id === member.office && office.can_select));
        const canRemove = access && (access.can_remove_personal || access.can_remove_offices.includes(member.office || ''));
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
          <td role="cell" data-label={canEditTerms || canRemove ? 'Actions' : undefined}>
            <div className="project-member-actions">
              {canEditTerms && <button type="button" aria-label={`Edit access terms for ${member.name}`} onClick={() => onEdit(member)}><Pencil size={14} aria-hidden="true" /> Edit terms</button>}
              {canRemove && <button type="button" aria-label={`Review removal · ${member.name}`} onClick={() => onRemove(member)}><UserMinus size={14} aria-hidden="true" /> Review removal</button>}
            </div>
          </td>
        </tr>;
      })}
    </tbody>
  </table>;
}
