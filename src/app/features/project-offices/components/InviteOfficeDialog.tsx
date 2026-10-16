import { useEffect, useRef, useState } from 'react';
import { Button } from '@vibe/core';
import { Modal } from '../../../components/ui/Modal';
import { FormField, TextInput, SelectInput } from '../../../components/ui/FormField';
import { useConfirmation } from '../../../components/ui/useConfirmation';
import { useExplicitDraft } from '../../../shared/useExplicitDraft';
import { requestNavigation } from '../../../shared/navigationGuard';
import type { Organization, UserProfile } from '../../../types';
import { inviteProjectOffice } from '../services/projectOfficeService';
import type { ProjectOffice } from '../types';
import { projectOfficeError } from '../presentation';

export function InviteOfficeDialog({ open, onClose, projectId, projectTitle, offices, organizations, profiles, initialOffice, onSent }: {
  open: boolean; onClose: () => void; projectId: string; projectTitle: string; offices: ProjectOffice[];
  organizations: Organization[]; profiles: UserProfile[]; initialOffice: string; onSent: () => Promise<void>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [office, setOffice] = useState(initialOffice), [email, setEmail] = useState(''), [access, setAccess] = useState<'collaborating' | 'observer'>('collaborating');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [sent, setSent] = useState(false);
  const confirmation = useConfirmation();
  const guard = useExplicitDraft('Project Office invitation', !sent && (!!email || office !== initialOffice || access !== 'collaborating'), busy, () => { setOffice(initialOffice); setEmail(''); setAccess('collaborating'); });
  const close = () => { if (!guard.pendingRef.current) void requestNavigation(onClose); };
  async function refreshSaved() { try { await onSent(); } catch { setError('Invitation created. Refresh failed; retry loading without sending again.'); } }
  const available = organizations.filter(o => o.is_active && !offices.some(p => p.office_id === o.id && ['joined', 'awaiting_head'].includes(p.invitation_status)));
  useEffect(() => {
    const head = organizations.find(o => o.id === office)?.head_user_id;
    setEmail(profiles.find(p => p.id === head)?.email || '');
  }, [office, profiles, organizations]);
  return <><Modal isOpen={open} onClose={close} preventClose={busy} title="Let’s bring another Office in." description={`Invite an Office to ${projectTitle}. Its Head chooses its own personnel.`} width="max-w-2xl"
    footer={sent ? <Button onClick={close}>Done</Button> : <><Button kind="tertiary" onClick={close} disabled={busy}>Remind me later</Button><Button disabled={!office || !email || busy} loading={busy} onClick={() => formRef.current?.requestSubmit()}>Invite Office</Button></>}>
      <form ref={formRef} className="eflow-head-dialog-form" onSubmit={async e => {
        e.preventDefault(); if (guard.pendingRef.current || sent) return; guard.pendingRef.current = true;
        try {
          if (!await confirmation.confirm({title:'Invite this Office?',description:`${organizations.find(o => o.id === office)?.name || 'Office'} · ${email} · ${access === 'observer' ? 'Observer (read only)' : 'Collaborating Office'}. Account roles stay unchanged.`,actionLabel:'Invite Office'})) return;
          setBusy(true); setError(''); const result = await inviteProjectOffice(projectId, office, email, access);
          setSent(true); guard.markClean(); if (result.delivery_error) setError('Invitation created; email delivery failed. Use Resend or Copy fresh link in the Office inspector.');
          await refreshSaved();
        }
        catch (e) { setError(projectOfficeError(e, 'Could not invite this Office.')); }
        finally { guard.pendingRef.current = false; setBusy(false); }
      }}>
        {sent ? <div role="status" className="po-success"><h3>Invitation sent</h3><p>Invitation created. The contact accepts through its private link; email delivery is shown separately in the Office inspector. No employee is assigned automatically.</p>{error && <Button type="button" kind="secondary" disabled={busy} onClick={() => void refreshSaved()}>Retry loading</Button>}</div> : <>
          <FormField label="Office" required><SelectInput required value={office} disabled={busy} onChange={e => setOffice(e.target.value)} options={[{value:'',label:'Choose an Office'},...available.map(o=>({value:o.id,label:o.name}))]}/></FormField>
          <FormField label="Head / contact email" required><TextInput required type="email" maxLength={254} placeholder="head@office.gov.ph" value={email} disabled={busy} onChange={e => setEmail(e.target.value)}/></FormField>
          <FormField label="Project access"><SelectInput value={access} disabled={busy} onChange={e => setAccess(e.target.value as typeof access)} options={[{value:'collaborating',label:'Collaborating Office'},{value:'observer',label:'Observer · read only'}]}/></FormField>
          <p className="po-help">Project access keeps account roles unchanged. A collaborating Office’s appointed Head confirms participation before choosing its staff.</p>
        </>}
        {error && <p role="alert" className="po-error">{error}</p>}
      </form>
  </Modal>{confirmation.dialog}</>;
}
