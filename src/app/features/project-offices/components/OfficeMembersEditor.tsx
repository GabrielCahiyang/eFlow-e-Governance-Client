import '../projectOffices.css';
import '../../../../styles/people-management.css';
import {previewSelection,saveSelection,type SelectionImpact} from '../../project-access';
import { useEffect, useRef, useState } from 'react';
import { useExplicitDraft } from '../../../shared/useExplicitDraft';
import { requestNavigation } from '../../../shared/navigationGuard';
import { useConfirmation } from '../../../components/ui/useConfirmation';
import type { UserProfile } from '../../../types';
import type { Task } from '../../tasks';
import { selectProjectOfficeMembersChecked } from '../services/projectOfficeService';
import { readStaffingAuthority } from '../services/staffingAuthority';
import { membershipDiff, removalWork } from '../presentation';
import type { ProjectOffice, ProjectOfficeMember } from '../types';
export function OfficeMembersEditor({ office, profiles, members, tasks, actorId, disabledReason, onCancel, onSaved, onOpenTask }: { office: Pick<ProjectOffice, 'id' | 'project_id' | 'office_id'>; profiles: UserProfile[]; members: ProjectOfficeMember[]; tasks: Task[]; actorId: string; disabledReason: string; onCancel: () => void; onSaved: () => Promise<void>; onOpenTask?: (id: string) => void }) {
  const savedRequest=useRef<{id:string;users:string[];expected:string[];fingerprint?:string} | undefined>(undefined);
  const initial = members.filter(m => m.project_office_id === office.id).map(m => m.user_id);
  const [baseline, setBaseline] = useState(initial), [selected, setSelected] = useState(initial), [query, setQuery] = useState('');
  const [reviewed,setReviewed]=useState(false);
  useEffect(()=>{let active=true;void previewSelection(office.id,initial).then(result=>{if(active)setReviewed(Boolean(result));}).catch(()=>{});return()=>{active=false;};},[office.id,actorId]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false);
  const diff = membershipDiff(baseline, selected), blockers = removalWork(office, diff.removed, tasks);
  const changed = !!(diff.added.length + diff.removed.length);
  const guard = useExplicitDraft('Project Office member selection', changed && !saved, busy, () => setSelected(baseline));
  const authority = useRef({ actorId, disabledReason }); authority.current = { actorId, disabledReason };
  const confirmation = useConfirmation();
  const people = profiles.filter(p => p.org_id === office.office_id && p.is_active && p.role !== 'admin' && `${p.full_name} ${p.email}`.toLowerCase().includes(query.trim().toLowerCase()));
  const name = (id: string) => profiles.find(p => p.id === id)?.full_name || 'Previously selected member';
  const refreshAfterSave = async () => { try { await onSaved(); onCancel(); } catch { setError('Project team saved. Refresh failed; retry loading without saving again.'); } };
  async function save() {
    if (guard.pendingRef.current || disabledReason || !reviewed&&blockers.length || !changed || saved) return;
    guard.pendingRef.current = true; setBusy(true); setError('');
    try {
      const latest = await readStaffingAuthority(office.project_id, office.id, actorId);
      const remoteDiff = membershipDiff(baseline, latest);
      if (!savedRequest.current && (remoteDiff.added.length || remoteDiff.removed.length)) throw new Error('Project membership changed while you were editing. Reload selection before saving.');
      const impact:SelectionImpact|null=reviewed?await previewSelection(office.id,selected):null;
      if(reviewed&&!impact)throw new Error('Reviewed removal is unavailable. Reload selection.');
      if (!await confirmation.confirm({ title: 'Save project team?', description: impact?'Confirmation unassigns all affected current tasks and descendants, clears delegated Leads and ends selected project access. Historical work stays recorded.':'Selected people gain project access. Removing people removes that selected access; active work must be reassigned first.', actionLabel: 'Save project team', danger: diff.removed.length > 0, impact: <><p>Added: {diff.added.map(name).join(', ') || 'None'}</p><p>Removed: {diff.removed.map(name).join(', ') || 'None'}</p>{impact?.removed.map(person=><div key={person.user}><p>{name(person.user)}: {person.tasks.length} tasks · {person.nodes.length} subitems across the complete scope</p><ul>{person.tasks.map(t=><li key={t.id}>{t.title} · {t.status}</li>)}{person.nodes.map(n=><li key={n.id}>{n.title} · {n.status}</li>)}</ul></div>)}</> })) return;
      if (authority.current.actorId !== actorId || authority.current.disabledReason) throw new Error('Your current Office authority has changed. Refresh before retrying.');
      // Recheck immediately before the write; the RPC rechecks again transactionally.
      const checked = await readStaffingAuthority(office.project_id, office.id, actorId);
      const changedAgain = membershipDiff(latest, checked);
      if (!savedRequest.current && (changedAgain.added.length || changedAgain.removed.length)) throw new Error('Project membership changed during review. Reload selection before saving.');
      if(!savedRequest.current)savedRequest.current={id:crypto.randomUUID(),users:[...selected],expected:[...checked],fingerprint:impact?.fingerprint};
      if(savedRequest.current.fingerprint)await saveSelection(office.id,savedRequest.current.users,savedRequest.current.fingerprint,savedRequest.current.id);else await selectProjectOfficeMembersChecked(office.id,savedRequest.current.users,savedRequest.current.expected,savedRequest.current.id);
      setSaved(true); setBaseline(selected); guard.markClean(); await refreshAfterSave();
    } catch (e) { setError((e as Error).message); }
    finally { guard.pendingRef.current = false; setBusy(false); }
  }
  async function reloadSelection() {
    void requestNavigation(async () => { savedRequest.current=undefined;guard.pendingRef.current = true; setBusy(true); setError(''); try { const ids = await readStaffingAuthority(office.project_id, office.id, actorId); setSelected(ids); setBaseline(ids); } catch (e) { setError((e as Error).message); } finally { guard.pendingRef.current = false; setBusy(false); } });
  }
  return <section aria-label="Own Office project team" className="po-member-editor">
    <p className="po-help">Select your own Office members. Project access keeps account roles unchanged; task execution teams are managed in the task inspector.</p>
    {disabledReason && <p role="status">{disabledReason}</p>}
    <input className="po-search" aria-label="Search Office members" placeholder="Search your Office’s people" value={query} onChange={e => setQuery(e.target.value)}/>
    <div className="po-member-list">{people.map(p => <label key={p.id}><input type="checkbox" checked={selected.includes(p.id)} disabled={busy || !!disabledReason || saved || !!savedRequest.current} onChange={e => setSelected(ids => e.target.checked ? [...ids, p.id] : ids.filter(id => id !== p.id))}/><span className="po-avatar">{p.full_name.split(' ').map(w => w[0]).slice(0,2).join('')}</span><span><strong>{p.full_name}</strong><small>{p.email}</small></span><span>{p.role === 'head' ? 'Head' : p.role === 'accounting_staff' ? 'Accounting Staff' : 'Member'}</span></label>)}{!people.length && <p>No active Office members match your search. Clear the search to choose existing staff. If nobody is onboarded, use Head-approved project Invitations in Members.</p>}</div>
    <div className="po-membership-impact" aria-live="polite"><h3>Membership changes</h3><p>{selected.length} selected · Added: {diff.added.map(name).join(', ') || 'None'} · Removed: {diff.removed.map(name).join(', ') || 'None'}</p><p className="po-help">Already selected people retain their current access until this change is saved. The server reviews all affected work, including work outside this view. With R9, confirmation unassigns unfinished work rather than refusing removal.</p>{blockers.length > 0 && !reviewed && <div role="alert"><p>Reassign active work before removing its project members.</p><ul>{blockers.map(task => <li key={task.id}>{onOpenTask ? <button onClick={() => onOpenTask(task.id)}>{task.title}</button> : task.title}</li>)}</ul></div>}</div>
    {error && <p role="alert" className="po-error">{error}</p>}{saved && <p role="status">Project team saved.</p>}
    <footer><button onClick={() => void requestNavigation(onCancel)} disabled={busy}>{saved ? 'Done' : 'Cancel'}</button>{saved ? <button disabled={busy} onClick={() => void refreshAfterSave()}>Retry loading</button> : <><button disabled={busy} onClick={() => void reloadSelection()}>Reload selection</button><button className="po-primary" disabled={busy || !changed || !!disabledReason || !reviewed&&blockers.length > 0} onClick={() => void save()}>{busy ? 'Saving…' : 'Save project team'}</button></>}</footer>
    {confirmation.dialog}
  </section>;
}
