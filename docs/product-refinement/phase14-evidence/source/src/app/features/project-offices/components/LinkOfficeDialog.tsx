import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../../components/ui/dialog';
import type { Organization } from '../../../types';
import type { OfficeIdentity } from '../types';
import { linkOfficeIdentity } from '../services/officeIdentityService';

export function LinkOfficeDialog({ identity, organizations, leadOffice, onClose, onLinked }: {
  identity: OfficeIdentity; organizations: Organization[]; leadOffice: string; onClose: () => void; onLinked: () => Promise<void>;
}) {
  const [office, setOffice] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [done, setDone] = useState(false), [discard, setDiscard] = useState(false);
  const inFlight = useRef(false);
  const close = () => { if (!busy) { if (office && !done) setDiscard(true); else onClose(); } };
  return <Dialog open onOpenChange={value => { if (!value) close(); }}><DialogContent className="po-local-dialog">
    <DialogTitle>Link {identity.display_name}</DialogTitle>
    <DialogDescription>Confirm the canonical directory record. This link cannot be replaced. Its appointed Head controls its people.</DialogDescription>
    {done ? <><p role="status">Office linked. Confirm participation before resolving task responsibility.</p><button type="button" onClick={onClose}>Done</button></> : <form onSubmit={async event => {
      event.preventDefault(); if (inFlight.current) return; inFlight.current = true; setBusy(true); setError('');
      try { await linkOfficeIdentity(identity.id, office); setDone(true); try { await onLinked(); } catch { setError('Linked, but could not refresh. Retry loading Project Offices.'); } }
      catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not link this Office.'); }
      finally { setBusy(false); inFlight.current = false; }
    }}>
      <label>Directory Office<select required value={office} disabled={busy} onChange={event => setOffice(event.target.value)}><option value="">Choose an Office</option>{organizations.filter(o => o.is_active && o.id !== leadOffice).map(o => <option value={o.id} key={o.id}>{o.name}</option>)}</select></label>
      <p className="po-help">{identity.display_name} → {organizations.find(o => o.id === office)?.name || 'Choose a directory record'}. No account membership changes. Each proposed task still requires explicit handover after participation is confirmed.</p>
      <footer><button type="button" disabled={busy} onClick={close}>Cancel</button><button className="po-primary" disabled={busy || !office}>{busy ? 'Linking…' : 'Confirm Office link'}</button></footer>
    </form>}
    {error && <p role="alert" className="po-error">{error}</p>}
    {discard && <div role="alert" className="po-discard"><p>Discard this Office selection?</p><button type="button" onClick={() => setDiscard(false)}>Keep editing</button><button type="button" onClick={onClose}>Discard</button></div>}
  </DialogContent></Dialog>;
}
