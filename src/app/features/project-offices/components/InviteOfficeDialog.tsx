import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../../components/ui/dialog';
import { WorkspaceIllustration } from '../../../components/ui/WorkspaceIllustration';
import type { Organization, UserProfile } from '../../../types';
import { inviteProjectOffice } from '../services/projectOfficeService';
import type { ProjectOffice } from '../types';

export function InviteOfficeDialog({ open, onClose, projectId, projectTitle, offices, organizations, profiles, initialOffice, onSent }: {
  open: boolean; onClose: () => void; projectId: string; projectTitle: string; offices: ProjectOffice[];
  organizations: Organization[]; profiles: UserProfile[]; initialOffice: string; onSent: () => Promise<void>;
}) {
  const [office, setOffice] = useState(initialOffice), [email, setEmail] = useState(''), [access, setAccess] = useState<'collaborating' | 'observer'>('collaborating');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [sent, setSent] = useState(false);
  const available = organizations.filter(o => o.is_active && !offices.some(p => p.office_id === o.id && p.invitation_status !== 'revoked'));
  useEffect(() => {
    const head = organizations.find(o => o.id === office)?.head_user_id;
    setEmail(profiles.find(p => p.id === head)?.email || '');
  }, [office, profiles, organizations]);
  return <Dialog open={open} onOpenChange={value => { if (!value && !busy) onClose(); }}><DialogContent className="po-invite-dialog">
    <section className="po-invite-content"><DialogTitle>Let’s bring another Office in.</DialogTitle><DialogDescription>Invite an Office to {projectTitle}. Its Head chooses its own personnel.</DialogDescription>
      <form onSubmit={async e => {
        e.preventDefault(); if (busy) return; setBusy(true); setError('');
        try { const result = await inviteProjectOffice(projectId, office, email, access); await onSent(); if (result.delivery_error) setError(result.delivery_error + ' Use Resend or Copy fresh link below.'); else setSent(true); }
        catch (e) { setError(e instanceof Error ? e.message : 'Could not invite this Office.'); }
        finally { setBusy(false); }
      }}>
        {sent ? <div role="status" className="po-success"><h3>Invitation sent</h3><p>The invited contact can accept by email. No employee is assigned automatically.</p><button type="button" onClick={onClose}>Done</button></div> : <>
          <label>Office<select required value={office} disabled={busy} onChange={e => setOffice(e.target.value)}><option value="">Choose an Office</option>{available.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
          <label>Head / contact email<input required type="email" maxLength={254} placeholder="head@office.gov.ph" value={email} disabled={busy} onChange={e => setEmail(e.target.value)}/></label>
          <label>Project access<select value={access} disabled={busy} onChange={e => setAccess(e.target.value as typeof access)}><option value="collaborating">Collaborating Office</option><option value="observer">Observer · read only</option></select></label>
          <p className="po-help">Project access keeps account roles unchanged. A collaborating Office’s appointed Head confirms participation before choosing its staff.</p>
          <footer><button type="button" onClick={onClose} disabled={busy}>Remind me later</button><button className="po-primary" disabled={!office || !email || busy}>{busy ? 'Sending…' : 'Invite Office'}</button></footer>
        </>}
        {error && <p role="alert" className="po-error">{error}</p>}
      </form>
    </section><WorkspaceIllustration/>
  </DialogContent></Dialog>;
}
