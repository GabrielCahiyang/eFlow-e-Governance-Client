import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../../components/ui/dialog';
import { WorkspaceIllustration } from '../../../components/ui/WorkspaceIllustration';
import { useConfirmation } from '../../../components/ui/useConfirmation';
import { useExplicitDraft } from '../../../shared/useExplicitDraft';
import { requestNavigation } from '../../../shared/navigationGuard';
import { uploadPds } from '../../professional-profile';
import { sendInvitations } from '../services/invitationService';
import {InvitationPersonFields} from './InvitationPersonFields';
import type { InvitedRole } from '../types';
import '../invitations.css';

type Row = { id: string; email: string; account_role: InvitedRole; file?: File };
const emptyRow = (): Row => ({ id: crypto.randomUUID(), email: '', account_role: 'member' });

export function InviteMemberDialog({ officeName, open, onOpenChange, onSent }: { officeName: string; open: boolean; onOpenChange: (open: boolean) => void; onSent: () => void }) {
  const [rows, setRows] = useState<Row[]>(() => [emptyRow(), emptyRow()]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [receipt, setReceipt] = useState('');
  const confirmation = useConfirmation();
  const reset = () => { setRows([emptyRow(), emptyRow()]); setMessage(''); setReceipt(''); };
  const guard = useExplicitDraft('Office invitations', open && rows.some(row => !!row.email.trim() || !!row.file || row.account_role !== 'member'), open && busy, reset);
  const close = () => { if (!guard.pendingRef.current) void requestNavigation(() => { reset(); onOpenChange(false); }); };
  const change = (id: string, values: Partial<Row>) => setRows(current => current.map(row => row.id === id ? { ...row, ...values } : row));
  async function send(event: React.FormEvent) {
    event.preventDefault(); if (guard.pendingRef.current) return;
    const selected = rows.filter(row => row.email.trim());
    if (!selected.length) return;
    guard.pendingRef.current = true;
    try {
      if (!await confirmation.confirm({ title: 'Send Office invitations?', description: `Invite these people to ${officeName}. They create their own accounts with the account roles shown.`, actionLabel: 'Send invitations', impact: <ul>{selected.map(row => <li key={row.id}>{row.email.trim()} · {row.account_role === 'member' ? 'Member' : 'Accounting Staff'}{row.file ? ' · PDS attached' : ''}</li>)}</ul> })) return;
      setBusy(true); setMessage(''); setReceipt('');
      const { results } = await sendInvitations(selected.map(({ email, account_role }) => ({ email, account_role })));
      const errors: string[] = []; const created = new Set<string>();
      for (const [index, result] of results.entries()) {
        if (result.error) errors.push(`${result.email}: ${result.error}`);
        if (result.invitation) {
          created.add(selected[index].id);
          if (result.invitation.delivery_error) errors.push(`${result.email}: ${result.invitation.delivery_error}`);
          if (selected[index].file) {
            try { await uploadPds(selected[index].file!, result.invitation.id); }
            catch (error) { errors.push(`${result.email}: invitation created; PDS upload failed. ${(error as Error).message}`); }
          }
        }
      }
      if (created.size) { onSent(); setReceipt(`${created.size} invitation${created.size === 1 ? '' : 's'} created. Successful rows will not be sent again. Delivery or PDS failures can be retried from Invitations.`); }
      setRows(current => current.filter(row => !created.has(row.id)));
      if (errors.length) setMessage(errors.join('\n'));
      else { guard.markClean(); onOpenChange(false); reset(); }
    } catch (error) { setMessage((error as Error).message); }
    finally { guard.pendingRef.current = false; setBusy(false); }
  }
  return <><Dialog open={open} onOpenChange={value => { if (!value) close(); }}><DialogContent className="eflow-invite-dialog">
    <form className="eflow-invite-form" onSubmit={send}><div><DialogTitle className="eflow-invite-title">Now, let’s bring the team in.</DialogTitle><DialogDescription>Invite people to {officeName}. They’ll create their own eFlow account.</DialogDescription></div>
      <div className="eflow-invite-rows">{rows.map((row, index) => <InvitationPersonFields compact key={row.id} id={row.id} index={index} email={row.email} file={row.file} disabled={busy} onEmail={email=>change(row.id,{email})} onFile={file=>change(row.id,{file})} onError={setMessage}>
        <label className="sr-only" htmlFor={`role-${row.id}`}>Role {index+1}</label><select id={`role-${row.id}`} value={row.account_role} onChange={event=>change(row.id,{account_role:event.target.value as InvitedRole})}><option value="member">Member</option><option value="accounting_staff">Accounting Staff</option></select>
        {rows.length>1&&<button type="button" className="eflow-icon-button" aria-label={`Remove person ${index+1}`} onClick={()=>setRows(current=>current.filter(item=>item.id!==row.id))}><Trash2 size={16}/></button>}
        </InvitationPersonFields>)}</div>
      {rows.length < 5 && <button type="button" className="eflow-text-button" disabled={busy} onClick={() => setRows(current => [...current, emptyRow()])}><Plus size={17} /> Add another person</button>}
      {message && <p role="alert" className="eflow-form-error" id="invite-errors">{message}</p>}
      {receipt && <p role="status">{receipt}</p>}
      <footer className="eflow-invite-footer"><button type="button" className="eflow-text-button" disabled={busy} onClick={close}>Remind me later</button><button type="submit" className="eflow-primary-button" aria-describedby={message ? 'invite-errors' : undefined} disabled={busy || !rows.some(row => row.email.trim())}>{busy ? 'Sending…' : 'Send invitations'}</button></footer>
    </form><WorkspaceIllustration />
  </DialogContent></Dialog>{confirmation.dialog}</>;
}
