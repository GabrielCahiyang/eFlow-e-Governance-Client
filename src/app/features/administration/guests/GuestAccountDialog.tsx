import { useEffect, useRef, useState } from 'react';
import { Clock3, ShieldCheck, UserRound } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/button';
import { FeedbackState } from '../../../components/ui/FeedbackState';
import { changeGuestState, readGuestHistory } from './service';
import { guestStatus, type GuestAccountEvent, type ProjectGuest } from './types';

const labels: Record<string, string> = {countdown_started: 'Assignment window started', countdown_cancelled: 'Project assigned', auto_deactivated: 'Automatically deactivated', warning_sent: 'Reminder sent', cleanup_paused: 'Cleanup paused', reactivated: 'Login reactivated', deactivated: 'Account deactivated'};
export function GuestAccountDialog({guest, mode, onClose, onSaved}: {guest: ProjectGuest; mode: 'details' | 'activate' | 'deactivate'; onClose: () => void; onSaved: () => void}) {
  const [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [history, setHistory] = useState<GuestAccountEvent[]>([]), [loading, setLoading] = useState(mode === 'details');
  const key = useRef(crypto.randomUUID()), pending = useRef(false);
  const title = mode === 'details' ? 'Guest account details' : mode === 'activate' ? 'Reactivate this guest account?' : 'Deactivate this guest account?';
  useEffect(() => {
    if (mode !== 'details') return;
    let active = true;
    void readGuestHistory(guest.user_id).then(events => {if(active)setHistory(events);}).catch(e => {if(active)setError(e.message);}).finally(() => {if(active)setLoading(false);});
    return () => { active = false; };
  }, [guest.user_id, mode]);
  async function save() {
    if (pending.current || reason.trim().length < 3) return;
    pending.current = true; setBusy(true); setError('');
    try { await changeGuestState(guest.user_id, mode === 'activate', reason.trim(), key.current); onSaved(); }
    catch(e) { setError(e instanceof Error ? e.message : 'Could not update this account.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <Modal isOpen title={title} description={`${guest.full_name} · ${guest.email}`} width="max-w-3xl" preventClose={busy} onClose={onClose}
    footer={<div className="guest-dialog-actions"><Button variant="outline" disabled={busy} onClick={onClose}>{mode === 'details' ? 'Close' : 'Cancel'}</Button>{mode !== 'details' && <Button variant={mode === 'deactivate' ? 'destructive' : 'default'} disabled={busy || reason.trim().length < 3} onClick={() => void save()}>{busy ? 'Saving…' : mode === 'activate' ? 'Reactivate for 7 days' : 'Deactivate account'}</Button>}</div>}>
    <div className="guest-dialog-content">
      {mode === 'details' ? <>
        <dl className="guest-facts"><div><dt>Sponsoring office</dt><dd>{guest.sponsor_office}</dd></div><div><dt>Status</dt><dd>{guestStatus(guest).label}</dd></div><div><dt>Project access</dt><dd>{guest.projects.map(p => p.title).join(', ') || 'No active project'}</dd></div><div><dt>Financial responsibility</dt><dd>{guest.finance_open ? 'Open cash · cleanup paused' : 'No open cash responsibility'}</dd></div></dl>
        {guest.deactivation_reason && <p className="guest-info">{guest.deactivation_reason}</p>}
        <h3><Clock3 size={18}/> Account history</h3>
        {loading ? <p role="status">Loading account history…</p> : history.length ? <ol className="guest-history">{history.map(event => <li key={event.id}><ShieldCheck size={18}/><div><strong>{labels[event.action] || event.action.replace(/_/g, ' ')}</strong><p>{event.reason}</p><small>{event.actor} · {new Date(event.created_at).toLocaleString()}</small></div></li>)}</ol> : <p>No account changes recorded yet.</p>}
      </> : <>
        <div className="guest-info"><UserRound size={20}/><p>{mode === 'activate' ? 'They can sign in again. Assign an active project within 7 days to keep the login active. Expired project access will not be restored.' : 'They will lose login access. Their tasks, messages, receipts and account history will be kept.'}</p></div>
        <label className="guest-reason">Reason <span aria-hidden="true">*</span><textarea aria-label="Reason" required minLength={3} maxLength={1000} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} placeholder={mode === 'activate' ? 'Why does this guest need access again?' : 'Why are you deactivating this account?'}/></label>
      </>}
      {error && <FeedbackState tone="error" title="Could not update guest account">{error}</FeedbackState>}
    </div>
  </Modal>;
}
