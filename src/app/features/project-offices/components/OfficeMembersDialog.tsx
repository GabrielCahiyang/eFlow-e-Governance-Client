import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../../components/ui/dialog';
import type { UserProfile } from '../../../types';
import { selectProjectOfficeMembers } from '../services/projectOfficeService';
import type { ProjectOffice, ProjectOfficeMember } from '../types';
export function OfficeMembersDialog({ office, name, profiles, members, onClose, onSaved }: { office: ProjectOffice; name: string; profiles: UserProfile[]; members: ProjectOfficeMember[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [selected, setSelected] = useState(members.filter(m => m.project_office_id === office.id).map(m => m.user_id));
  const [query, setQuery] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const people = profiles.filter(p => p.org_id === office.office_id && p.is_active && p.role !== 'admin' && `${p.full_name} ${p.email}`.toLowerCase().includes(query.toLowerCase()));
  return <Dialog open onOpenChange={v => { if (!v && !busy) onClose(); }}><DialogContent className="po-members-dialog"><DialogTitle>{name}’s project team</DialogTitle><DialogDescription>Select your own Office members. Selected people can access this project; the responsible Head assigns their tasks.</DialogDescription>
    <input className="po-search" aria-label="Search Office members" placeholder="Search your Office’s people" value={query} onChange={e => setQuery(e.target.value)}/>
    <div className="po-member-list">{people.map(p => <label key={p.id}><input type="checkbox" checked={selected.includes(p.id)} disabled={busy} onChange={e => setSelected(ids => e.target.checked ? [...ids, p.id] : ids.filter(id => id !== p.id))}/><span className="po-avatar">{p.full_name.split(' ').map(w => w[0]).slice(0, 2).join('')}</span><span><strong>{p.full_name}</strong><small>{p.email}</small></span><span>{p.role === 'head' ? 'Head' : p.role === 'accounting_staff' ? 'Accounting Staff' : 'Member'}</span></label>)}{!people.length && <p>No active Office members match your search.</p>}</div>
    <p className="po-help">{selected.length} selected. Invite new people through Office Team; only your Office Head can add global Office members.</p>
    {error && <p role="alert" className="po-error">{error}</p>}
    <footer><button onClick={onClose} disabled={busy}>Cancel</button><button className="po-primary" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await selectProjectOfficeMembers(office.id, selected); await onSaved(); onClose(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>{busy ? 'Saving…' : 'Save project team'}</button></footer>
  </DialogContent></Dialog>;
}
