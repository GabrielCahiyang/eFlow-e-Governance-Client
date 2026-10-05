import { useState } from 'react';
import { Plus, Paperclip, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../../components/ui/dialog';
import { WorkspaceIllustration } from '../../../components/ui/WorkspaceIllustration';
import { uploadPds } from '../../professional-profile';
import { sendInvitations } from '../services/invitationService';
import type { InvitedRole } from '../types';
import '../invitations.css';

type Row = { id: string; email: string; account_role: InvitedRole; file?: File };
const emptyRow = (): Row => ({ id: crypto.randomUUID(), email: '', account_role: 'member' });

export function InviteMemberDialog({ officeName, open, onOpenChange, onSent }: { officeName: string; open: boolean; onOpenChange: (open: boolean) => void; onSent: () => void }) {
  const [rows, setRows] = useState<Row[]>(() => [emptyRow(), emptyRow()]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const change = (id: string, values: Partial<Row>) => setRows(current => current.map(row => row.id === id ? { ...row, ...values } : row));
  async function send(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    const selected = rows.filter(row => row.email.trim());
    try {
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
      onSent();
      setRows(current => current.filter(row => !created.has(row.id)));
      if (errors.length) setMessage(errors.join('\n'));
      else { onOpenChange(false); setRows([emptyRow(), emptyRow()]); }
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={value => { if (!busy) onOpenChange(value); }}><DialogContent className="eflow-invite-dialog" aria-describedby="invite-description">
    <form className="eflow-invite-form" onSubmit={send}><div><DialogTitle className="eflow-invite-title">Now, let’s bring the team in.</DialogTitle><DialogDescription id="invite-description">Invite people to {officeName}. They’ll create their own eFlow account.</DialogDescription></div>
      <div className="eflow-invite-rows">{rows.map((row, index) => <fieldset key={row.id} className="eflow-invite-row" disabled={busy}><legend className="sr-only">Person {index + 1}</legend><div className="eflow-invite-inputs">
        <label className="sr-only" htmlFor={`email-${row.id}`}>Email address {index + 1}</label><input id={`email-${row.id}`} type="email" autoComplete="email" placeholder="Add email here" value={row.email} maxLength={254} onChange={event => change(row.id, { email: event.target.value })} />
        <label className="sr-only" htmlFor={`role-${row.id}`}>Role {index + 1}</label><select id={`role-${row.id}`} value={row.account_role} onChange={event => change(row.id, { account_role: event.target.value as InvitedRole })}><option value="member">Member</option><option value="accounting_staff">Accounting Staff</option></select>
        {rows.length > 1 && <button type="button" className="eflow-icon-button" aria-label={`Remove person ${index + 1}`} onClick={() => setRows(current => current.filter(item => item.id !== row.id))}><Trash2 size={16} /></button>}
      </div><label className="eflow-pds-attachment"><Paperclip size={14} /><span>{row.file?.name || 'Attach PDS PDF'} <small>Optional · up to 10 MB</small></span><input type="file" accept="application/pdf,.pdf" aria-label={`PDS PDF ${index + 1}`} onChange={event => { const file = event.target.files?.[0]; if (file && (file.size > 10485760 || !file.name.toLowerCase().endsWith('.pdf'))) { setMessage('Choose a PDF smaller than 10 MB.'); event.target.value = ''; return; } change(row.id, { file }); }} /></label></fieldset>)}</div>
      {rows.length < 5 && <button type="button" className="eflow-text-button" disabled={busy} onClick={() => setRows(current => [...current, emptyRow()])}><Plus size={17} /> Add another person</button>}
      {message && <p role="alert" className="eflow-form-error" id="invite-errors">{message}</p>}
      <footer className="eflow-invite-footer"><button type="button" className="eflow-text-button" disabled={busy} onClick={() => onOpenChange(false)}>Remind me later</button><button type="submit" className="eflow-primary-button" aria-describedby={message ? 'invite-errors' : undefined} disabled={busy || !rows.some(row => row.email.trim())}>{busy ? 'Sending…' : 'Send invitations'}</button></footer>
    </form><WorkspaceIllustration />
  </DialogContent></Dialog>;
}
