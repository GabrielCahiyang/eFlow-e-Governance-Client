import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../../components/ui/dialog';
import { saveOfficeIdentity, inviteOfficeIdentity } from '../services/officeIdentityService';
import type { OfficeIdentity } from '../types';
import { useNavigationBlocker } from '../../../shared/navigationGuard';
import { projectOfficeError } from '../presentation';

export function LocalOfficeDialog({ projectId, initialName = '', evidence = '', identity, onClose, onSaved }: {
  projectId: string; initialName?: string; evidence?: string; identity?: OfficeIdentity;
  onClose: () => void; onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(identity?.display_name || initialName);
  const [email, setEmail] = useState(identity?.contact_email || '');
  const [access, setAccess] = useState<'collaborating' | 'observer'>(identity?.relationship_type === 'observer' ? 'observer' : 'collaborating');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [done, setDone] = useState('');
  const savedId = useRef(identity?.id || crypto.randomUUID());
  const identitySaved = useRef(!!identity);
  const inFlight = useRef(false);
  const dirty = !done && (name !== (identity?.display_name || initialName) || email !== (identity?.contact_email || '') || access !== (identity?.relationship_type === 'observer' ? 'observer' : 'collaborating'));
  const [discard, setDiscard] = useState(false);
  useNavigationBlocker({ label: 'Named Office contact', dirty, pending: busy, onDiscard: onClose });
  const close = () => { if (!busy) { if (dirty) setDiscard(true); else onClose(); } };
  return <Dialog open onOpenChange={value => { if (!value) close(); }}><DialogContent className="po-local-dialog">
    <DialogTitle>{identity ? 'Invite Office contact' : 'Add named Office'}</DialogTitle>
    <DialogDescription>Retain the Office name before directory linking. A contact invitation does not appoint a Head or assign staff.</DialogDescription>
    <form onSubmit={async event => {
      event.preventDefault(); if (inFlight.current) return;
      inFlight.current = true; setBusy(true); setError('');
      try {
        const saved = await saveOfficeIdentity(projectId, savedId.current, name, evidence);
        savedId.current = saved.id;
        identitySaved.current = true;
        if (email.trim()) {
          const invite = await inviteOfficeIdentity(saved.id, email, access);
          setDone(invite.delivery_error ? 'Office and invitation saved. Email delivery failed; use Resend or Copy fresh link in Project Offices.' : 'Office saved and contact invited. Directory linking and Head confirmation remain required.');
        } else setDone('Office name saved. Invite a contact when you are ready.');
        try { await onSaved(); } catch { setError('Saved, but could not refresh. Close this dialog and retry loading Project Offices.'); }
      } catch (reason) { setError((identitySaved.current ? 'Office name is saved. Check Project Offices for the contact invitation before retrying. ' : '') + projectOfficeError(reason, 'Could not save this Office. Your draft is retained.')); }
      finally { setBusy(false); inFlight.current = false; }
    }}>
      {done ? <><p role="status">{done}</p><button type="button" className="po-primary" onClick={onClose}>Done</button></> : <>
        <label>Office name<input required maxLength={200} value={name} disabled={busy || !!identity} onChange={event => setName(event.target.value)}/></label>
        {evidence && <p className="po-help">Source: {evidence}</p>}
        <label>Contact email {identity ? '' : '(optional)'}<input type="email" required={!!identity} maxLength={254} value={email} disabled={busy} onChange={event => setEmail(event.target.value)}/></label>
        {!!email.trim() && <label>Project access<select value={access} disabled={busy} onChange={event => setAccess(event.target.value as typeof access)}><option value="collaborating">Collaborating Office</option><option value="observer">Observer · read only</option></select></label>}
        <p className="po-help">{email.trim() ? `Send a ${access === 'observer' ? 'read-only observer' : 'collaborating Office contact'} invitation to ${email}. Existing account role and Office membership stay unchanged.` : 'Saving a name grants no access. Proposed work remains unassigned.'}</p>
        <footer><button type="button" disabled={busy} onClick={close}>Cancel</button><button className="po-primary" disabled={busy || !name.trim()}>{busy ? 'Saving…' : email.trim() ? 'Save & invite contact' : 'Save Office'}</button></footer>
      </>}
      {error && <p role="alert" className="po-error">{error}</p>}
    </form>
    {discard && <div role="alert" className="po-discard"><p>Discard your unsaved Office details?</p><button type="button" onClick={() => setDiscard(false)}>Keep editing</button><button type="button" onClick={onClose}>Discard</button></div>}
  </DialogContent></Dialog>;
}
