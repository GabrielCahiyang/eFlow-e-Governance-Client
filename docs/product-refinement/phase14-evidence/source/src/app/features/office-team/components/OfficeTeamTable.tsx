import { UserRound } from 'lucide-react';
import { StatusPill } from '../../../components/ui/workspace';
import { accountRoleLabel } from '../selectors';
import type { OfficeMember } from '../types';
export function OfficeTeamTable({ members, onOpen }: { members: OfficeMember[]; onOpen: (id: string) => void }) {
  return <div className="eflow-team-table-wrap"><table className="eflow-team-table"><caption className="sr-only">Active Office account members</caption><thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Account role</th><th scope="col">Status</th></tr></thead><tbody>{members.map(member => <tr key={member.id}><th scope="row"><button data-member-id={member.id} className="eflow-member-link" onClick={() => onOpen(member.id)}><span className="eflow-team-avatar"><UserRound size={17} /></span><span>{member.full_name}<small className="eflow-mobile-secondary">{member.email}</small></span></button></th><td data-label="Email">{member.email}</td><td data-label="Account role">{accountRoleLabel(member.role)}</td><td data-label="Status"><StatusPill label="Active" tone="positive" /></td></tr>)}</tbody></table></div>;
}
