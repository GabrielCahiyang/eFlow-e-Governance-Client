import type { ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { officeRelationship } from '../presentation';
import type { OfficeTableRow } from '../officeTableRows';
import type { ProjectOffice, ProjectOfficeMember } from '../types';

export interface ProjectOfficeTableProps {
  rows: OfficeTableRow[]; members: ProjectOfficeMember[];
  name: (id: string) => string; onOpen: (id: string, team?: boolean) => void;
  canStaff: (office: ProjectOffice) => boolean; canRemove: boolean; removalBusy: boolean;
  onRemove: (office: ProjectOffice) => void;
  identityActions: (row: OfficeTableRow) => ReactNode;
}

export function ProjectOfficeTable({ rows, members, name, onOpen, canStaff, canRemove, removalBusy, onRemove, identityActions }: ProjectOfficeTableProps) {
  return <div className="po-table-wrap"><table className="po-office-table">
    <caption className="sr-only">Project Office participation and selected project members</caption>
    <thead><tr><th scope="col">Office</th><th scope="col">Relationship</th><th scope="col">Contact</th><th scope="col">Participation status</th><th scope="col">Selected members</th><th scope="col">Actions</th></tr></thead>
    <tbody>{rows.map(row => {
      const o = row.participation, identity = row.identity;
      return <tr key={row.key} data-office-identity-id={identity?.id}>
        <th scope="row">
          {o ? <button data-project-office-id={o.id} onClick={() => onOpen(o.id)}>{row.name}</button> : <span>{row.name}</span>}
          {o && identity && identity.display_name !== row.name && <small className="po-office-detail">Named as {identity.display_name}</small>}
          {identity?.provenance.evidence && <small className="po-office-detail">Source: {identity.provenance.evidence}</small>}
        </th>
        <td data-label="Relationship">{officeRelationship({ relationship_type: row.relationship } as ProjectOffice)}</td>
        <td data-label="Contact">{row.contact || 'Not provided'}</td>
        <td data-label="Participation status"><span className={'po-badge po-badge--' + row.status}>{row.statusLabel}</span>
          {!o && <small className="po-office-detail">{row.status === 'planning' ? 'Not linked to the directory' : 'Planning only · not linked to the directory'}</small>}
        </td>
        <td data-label="Selected members">{o ? members.filter(m => m.project_office_id === o.id).length + ' selected project members' : 'Available after linking and Head confirmation'}</td>
        <td data-label="Actions"><div className="po-actions-cell">
          {o && <><button onClick={() => onOpen(o.id, canStaff(o))}>{canStaff(o) ? 'Select own members' : 'Open details'}</button>
            {canRemove && o.relationship_type !== 'lead' && <button className="po-withdraw-btn" disabled={removalBusy} aria-label={'Remove ' + name(o.office_id) + ' from project'} onClick={() => onRemove(o)}><Trash2 size={14}/>Remove Office</button>}</>}
          {identityActions(row)}
        </div></td>
      </tr>;
    })}</tbody>
  </table></div>;
}
