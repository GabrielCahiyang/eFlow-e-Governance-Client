import '../projectOffices.css';
import '../../../../styles/people-management.css';
import '../memberEditing.css';
import {previewSelection,saveSelection,saveSelectionWithEditors,type SelectionImpact} from '../../project-access';
import { useEffect, useRef, useState } from 'react';
import { useExplicitDraft } from '../../../shared/useExplicitDraft';
import { requestNavigation } from '../../../shared/navigationGuard';
import { useConfirmation } from '../../../components/ui/useConfirmation';
import type { UserProfile } from '../../../types';
import type { Task } from '../../tasks';
import { selectProjectOfficeMembersChecked } from '../services/projectOfficeService';
import { readStaffingAuthority } from '../services/staffingAuthority';
import { membershipDiff, removalWork, projectOfficeError } from '../presentation';
import type { ProjectOffice, ProjectOfficeMember } from '../types';
export function OfficeMembersEditor({ office, projectLeadId, profiles, members, tasks, actorId, disabledReason, onCancel, onSaved, onOpenTask, hideCancel = false }: { projectLeadId?:string; office: Pick<ProjectOffice, 'id' | 'project_id' | 'office_id'>; profiles: UserProfile[]; members: ProjectOfficeMember[]; tasks: Task[]; actorId: string; disabledReason: string; onCancel: () => void; onSaved: () => Promise<void>; onOpenTask?: (id: string) => void; hideCancel?: boolean }) {
  const savedRequest=useRef<{id:string;users:string[];expected:string[];editors?:string[];fingerprint?:string} | undefined>(undefined);
  const roster = members.filter(m => m.project_office_id === office.id);
  const initial = roster.map(m => m.user_id);
  const initialEditors = roster.filter(m => m.can_edit).map(m => m.user_id);
  const [baseline, setBaseline] = useState(initial), [selected, setSelected] = useState(initial), [query, setQuery] = useState('');
  const [editorBaseline,setEditorBaseline]=useState(initialEditors), [editors,setEditors]=useState(initialEditors);
  const [reviewed,setReviewed]=useState(false);
  useEffect(()=>{let active=true;void previewSelection(office.id,initial).then(result=>{if(active)setReviewed(Boolean(result));}).catch(()=>{});return()=>{active=false;};},[office.id,actorId]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false);
  const diff = membershipDiff(baseline, selected), blockers = removalWork(office, diff.removed, tasks);
  const nextEditors = editors.filter(id => selected.includes(id));
  const editDiff = membershipDiff(editorBaseline, nextEditors);
  const editingChanged = !!(editDiff.added.length + editDiff.removed.length);
  const changed = !!(diff.added.length + diff.removed.length) || editingChanged;
  const staleEditors = membershipDiff(editorBaseline, initialEditors);
  const remoteSelection = JSON.stringify([initial.slice().sort(), initialEditors.slice().sort()]);
  // Quiet membership updates (including AI enrollment) appear checked without
  // discarding an unsaved manual selection or changing an uncertain retry.
  useEffect(() => {
    if (!changed && !busy && !saved && !savedRequest.current) {
      setBaseline(initial); setSelected(initial);
      setEditorBaseline(initialEditors); setEditors(initialEditors);
    }
  }, [remoteSelection, changed, busy, saved]);
  const guard = useExplicitDraft('Project Office member selection', changed && !saved, busy, () => { setSelected(baseline); setEditors(editorBaseline); });
  const authority = useRef({ actorId, disabledReason }); authority.current = { actorId, disabledReason };
  const confirmation = useConfirmation();
  const people = profiles.filter(p => p.org_id === office.office_id && (p.is_active || initial.includes(p.id) || p.id===projectLeadId) && p.role !== 'admin' && `${p.full_name} ${p.email}`.toLowerCase().includes(query.trim().toLowerCase()));
  const name = (id: string) => profiles.find(p => p.id === id)?.full_name || 'Previously selected member';
  const refreshAfterSave = async () => { try { await onSaved(); onCancel(); } catch { setError('Project team saved. Refresh failed; retry loading without saving again.'); } };
  async function save() {
    if (guard.pendingRef.current || disabledReason || !reviewed&&blockers.length || !changed || saved) return;
    guard.pendingRef.current = true; setBusy(true); setError('');
    try {
      if (!savedRequest.current && (staleEditors.added.length || staleEditors.removed.length)) throw new Error('Editing access changed. Reopen Add people to review the current team.');
      const expectedEditors=editingChanged&&!savedRequest.current?editorBaseline:undefined;
      const latest = await readStaffingAuthority(office.project_id, office.id, actorId, expectedEditors);
      const remoteDiff = membershipDiff(baseline, latest);
      if (!savedRequest.current && (remoteDiff.added.length || remoteDiff.removed.length)) throw new Error('The project team changed. Close and reopen Add people to review the current team. Your changes have not been saved.');
      const impact:SelectionImpact|null=reviewed||editingChanged?await previewSelection(office.id,selected):null;
      if(editingChanged&&!impact)throw new Error('Editing access is unavailable until the project access update is installed.');
      if(reviewed&&!impact)throw new Error('Team changes could not be checked. Close and reopen Add people.');
      if (!await confirmation.confirm({ title: 'Save project team?', description: diff.removed.length&&impact?'Confirmation unassigns all affected current tasks and descendants, clears delegated Leads and ends selected project access. Historical work stays recorded.':diff.removed.length?'Selected people gain project access. Removing people removes that selected access; active work must be reassigned first.':'Membership and editing access apply to this project.', actionLabel: 'Save project team', danger: diff.removed.length > 0, impact: <><p>Added: {diff.added.map(name).join(', ') || 'None'}</p><p>Removed: {diff.removed.map(name).join(', ') || 'None'}</p>{editingChanged && <><p>Can edit: {editDiff.added.map(name).join(', ') || 'None added'}</p><p>Editing removed: {editDiff.removed.map(name).join(', ') || 'None'}</p></>}{impact?.removed.map(person=><div key={person.user}><p>{name(person.user)}: {person.tasks.length} tasks · {person.nodes.length} subitems across the complete scope</p><ul>{person.tasks.map(t=><li key={t.id}>{t.title} · {t.status}</li>)}{person.nodes.map(n=><li key={n.id}>{n.title} · {n.status}</li>)}</ul></div>)}</> })) return;
      if (authority.current.actorId !== actorId || authority.current.disabledReason) throw new Error('Your current Office authority has changed. Refresh before retrying.');
      // Recheck immediately before the write; the RPC rechecks again transactionally.
      const checked = await readStaffingAuthority(office.project_id, office.id, actorId, expectedEditors);
      const changedAgain = membershipDiff(latest, checked);
      if (!savedRequest.current && (changedAgain.added.length || changedAgain.removed.length)) throw new Error('The project team changed during review. Close and reopen Add people to review the current team.');
      if(!savedRequest.current)savedRequest.current={id:crypto.randomUUID(),users:[...selected],expected:[...checked],editors:editingChanged?[...nextEditors]:undefined,fingerprint:impact?.fingerprint};
      const request=savedRequest.current;
      if(request.fingerprint && request.editors) await saveSelectionWithEditors(office.id,request.users,request.editors,request.fingerprint,request.id);
      else if(request.fingerprint) await saveSelection(office.id,request.users,request.fingerprint,request.id);
      else await selectProjectOfficeMembersChecked(office.id,request.users,request.expected,request.id);
      setSaved(true); setBaseline(selected); setEditorBaseline(nextEditors); guard.markClean(); await refreshAfterSave();
    } catch (e) { setError(projectOfficeError(e, 'Could not save the project team.')); }
    finally { guard.pendingRef.current = false; setBusy(false); }
  }
  const locked=busy || !!disabledReason || saved || !!savedRequest.current;
  return <section aria-label="Own Office project team" className="po-member-editor">
    <p className="po-help">Save the project team first. Then use Can edit to let a member edit the project name and task details.</p>
    {disabledReason && <p role="status">{disabledReason}</p>}
    <input className="po-search" aria-label="Search Office members" placeholder="Search your Office’s people" value={query} onChange={e => setQuery(e.target.value)}/>
    <div className="po-member-list po-member-access-list">
      <div className="po-member-access-heading"><span>Office members</span><span>Editing access</span></div>
      {people.map(p => {
        const included=selected.includes(p.id);
        const onProjectTeam=included && baseline.includes(p.id) && initial.includes(p.id);
        const officeHead=p.id===actorId;
        return <div className="po-member-access-row" data-selected={included || undefined} key={p.id}>
          <label className="po-member-access-person">
            <input type="checkbox" aria-label={`Include ${p.full_name}`} checked={included || p.id===projectLeadId} disabled={locked || p.id===projectLeadId || !p.is_active}
              onChange={e => {
                const checked=e.target.checked;
                setSelected(ids => checked ? [...ids,p.id] : ids.filter(id=>id!==p.id));
                if(!checked) setEditors(ids=>ids.filter(id=>id!==p.id));
              }}/>
            <span className="po-avatar">{p.full_name.split(' ').map(w=>w[0]).slice(0,2).join('')}</span>
            <span><strong>{p.full_name}</strong><small>{p.email}</small></span>
            <span className="po-member-account-role">{p.role==='head'?'Head':p.role==='accounting_staff'?'Accounting Staff':'Member'}</span>
          </label>
          {onProjectTeam && (officeHead ? <span className="po-member-edit-head">Office Head</span> : <label className="po-member-edit-check">
            <input type="checkbox" aria-label={`Can edit · ${p.full_name}`} checked={editors.includes(p.id)}
              disabled={locked}
              onChange={e=>{const checked=e.target.checked;setEditors(ids=>checked?[...ids,p.id]:ids.filter(id=>id!==p.id));}}/>
            <span>Can edit</span>
          </label>)}
        </div>;
      })}
      {!people.length && <p>No active Office members match your search.</p>}
    </div>
    <div className="po-membership-impact" aria-live="polite"><h3>Membership changes</h3><p>{selected.length} selected · Added: {diff.added.map(name).join(', ') || 'None'} · Removed: {diff.removed.map(name).join(', ') || 'None'}</p><p className="po-help">Your changes apply when you save. Removing someone may also unassign their unfinished work. Review the affected tasks before confirming.</p>{blockers.length > 0 && !reviewed && <div role="alert"><p>Reassign active work before removing its project members.</p><ul>{blockers.map(task => <li key={task.id}>{onOpenTask ? <button onClick={() => onOpenTask(task.id)}>{task.title}</button> : task.title}</li>)}</ul></div>}</div>
    {error && <p role="alert" className="po-error">{error}</p>}{saved && <p role="status">Project team saved.</p>}
    <footer>{(!hideCancel || saved) && <button onClick={() => void requestNavigation(onCancel)} disabled={busy}>{saved ? 'Done' : 'Cancel'}</button>}{saved ? <button disabled={busy} onClick={() => void refreshAfterSave()}>Retry loading</button> : <button className="po-primary" disabled={busy || !changed || !!disabledReason || !reviewed&&blockers.length > 0} onClick={() => void save()}>{busy ? 'Saving…' : 'Save project team'}</button>}</footer>
    {confirmation.dialog}
  </section>;
}
