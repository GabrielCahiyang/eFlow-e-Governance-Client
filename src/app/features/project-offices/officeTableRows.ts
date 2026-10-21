import type { Invitation } from '../invitations';
import type { OfficeIdentity, ProjectOffice } from './types';
import { officeParticipation } from './presentation';
import {officePersonStatus,type OfficePerson} from './services/officePeople';

export interface OfficeTableRow {
  key: string; name: string; contact: string; status: string; statusLabel: string;
  relationship: ProjectOffice['relationship_type'];
  participation?: ProjectOffice; identity?: OfficeIdentity;
  peopleCount?:number;needsAttention?:boolean;
}
export interface OfficeTableFilters { query: string; relationship: string; status: string }

/** Join existing records for display, without inventing participation. */
export function officeTableRows(offices: ProjectOffice[], identities: OfficeIdentity[], name: (id: string) => string, invitations: Invitation[], people:OfficePerson[]=[]): OfficeTableRow[] {
  const visible = identities.filter(i => !i.provenance.removed);
  const matches = (o: ProjectOffice, i: OfficeIdentity) => i.project_office_id === o.id || i.canonical_office_id === o.office_id;
  const canonical = offices.map(o => {
    const identity = visible.find(i => matches(o, i) && i.provenance.source !== 'canonical_backfill') || visible.find(i => matches(o, i));
    const invitation = invitations.find(i => i.project_office_id === o.id);
    return { key: o.id, name: name(o.office_id), contact: o.contact_email || identity?.contact_email || '',
      relationship: o.relationship_type, status: o.invitation_status,
      statusLabel: o.invitation_status === 'pending' && identity?.contact_status === 'none' && !o.contact_email
        ? 'Contact invitation required' : officeParticipation(o, invitation), participation: o, identity };
  });
  const named = visible.filter(i => !offices.some(o => matches(o, i))).map(i => {
    const guests=people.filter(person=>person.identity_id===i.id),joined=guests.filter(person=>person.active),pending=guests.filter(person=>person.invitation.state==='approved');
    const invitation = invitations.find(invite => invite.project_office_identity_id === i.id);
    const label = invitation?.status === 'expired' ? 'Contact invitation expired' :
      i.contact_status === 'accepted' ? 'Contact accepted' : i.contact_status === 'invited' ? 'Contact invited' :
        i.contact_status === 'revoked' ? 'Invitation revoked' : 'Planning only';
    const status = i.contact_status === 'accepted' ? 'contact_accepted' : i.contact_status === 'invited' ? 'pending' :
      i.contact_status === 'revoked' ? 'revoked' : 'planning';
    return { key: i.id, name: i.display_name, contact: i.contact_email || pending[0]?.invitation.email || joined[0]?.invitation.email || '', relationship: i.relationship_type,
      status:guests.length?joined.length?'joined':pending.length?'pending':'planning':status,
      statusLabel:guests.length?joined.length?'Joined':officePersonStatus(pending[0]||guests[0]):i.contact_status==='none'?'Needs contact':label,
      identity: i,peopleCount:joined.length,needsAttention:guests.length?!joined.length:i.contact_status!=='accepted' };
  });
  return [...canonical, ...named];
}

export function filterOfficeTableRows(rows: OfficeTableRow[], filters: OfficeTableFilters) {
  const query = filters.query.trim().toLowerCase();
  return rows.filter(row => `${row.name} ${row.identity?.display_name || ''} ${row.contact}`.toLowerCase().includes(query)
    && (filters.relationship === 'all' || filters.relationship === row.relationship)
    && (filters.status === 'all' || filters.status === row.status));
}
