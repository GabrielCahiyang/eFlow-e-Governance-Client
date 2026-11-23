import { useRef, useState } from 'react';
import { UserPlus, Mail, AlertTriangle } from 'lucide-react';
import { BoundedTextInput } from '../../../components/ui/BoundedInput';
import { Modal, ModalButton } from '../../../components/ui/Modal';
import { FormField, SelectInput } from '../../../components/ui/FormField';
import { WorkspaceTooltip } from '../../../components/ui/workspace/WorkspaceTooltip';
import { INPUT_LIMITS } from '../../../shared/inputLimits';
import { useNavigationBlocker } from '../../../shared/navigationGuard';
import { inviteOfficePerson } from '../services/officePeople';
import type { OfficeIdentity } from '../types';

export function OfficePeopleDialog({ office, onClose, onSaved }: { office: OfficeIdentity; onClose: () => void; onSaved: () => Promise<void> }) {
  const [email, setEmail] = useState(''), [emailTouched, setEmailTouched] = useState(false), [role, setRole] = useState<'representative' | 'employee'>('employee'), [busy, setBusy] = useState(false), [error, setError] = useState(''), [done, setDone] = useState('');
  const request = useRef(crypto.randomUUID()), pending = useRef(false), attempted = useRef(false);
  useNavigationBlocker({ label: 'Sending project invitation', dirty: !!email && !done, pending: busy, pendingCheck: () => pending.current, onDiscard: onClose });
  const trimmedEmail = email.trim();
  const emailError = !trimmedEmail
    ? 'Email address is required.'
    : !/^\S+@\S+\.\S+$/.test(trimmedEmail)
      ? 'Enter a valid email address (for example, name@office.gov.ph).'
      : '';
  const visibleEmailError = emailTouched || email.length > 0 ? emailError : '';
  const sendDisabled = busy || Boolean(emailError);
  const sendTip = busy ? '' : emailError;
  const send = async () => {
    setEmailTouched(true);
    if (pending.current || emailError) return;
    pending.current = true; attempted.current = true; setBusy(true); setError('');
    try {
      const receipt = await inviteOfficePerson(request.current, office.id, trimmedEmail, role);
      setDone(receipt.delivery_error ? 'Invitation saved. Email delivery failed; retry from the office’s invitation list.' : 'Invitation sent. Waiting for acceptance.');
      await onSaved();
    } catch (reason) {
      setError((reason as Error).message);
      await onSaved().catch(() => {});
    } finally {
      pending.current = false; setBusy(false);
    }
  };
  return <Modal isOpen preventClose={busy} title={`Invite people · ${office.display_name}`} description="They choose their own password and complete their details after opening the email. Access is limited to this project." onClose={() => { if (!busy) onClose(); }} width="max-w-xl"
    footer={<>
      <ModalButton disabled={busy} onClick={onClose}>{done ? 'Done' : 'Close'}</ModalButton>
      {!done && (
        <WorkspaceTooltip content={sendTip} disabled={!sendTip}>
          <span className="inline-flex">
            <ModalButton variant="primary" pending={busy} disabled={sendDisabled} onClick={() => void send()}><Mail size={16} /> Send invitation</ModalButton>
          </span>
        </WorkspaceTooltip>
      )}
    </>}>
    {done ? <p role="status">{done}</p> : <div className="eflow-head-dialog-form">
      <FormField label="Email address" required>
        <BoundedTextInput
          type="email"
          maxLength={INPUT_LIMITS.EMAIL}
          className="eflow-form-input h-10 w-full rounded-lg border border-border bg-input-background px-3 text-[13px] font-normal text-foreground placeholder:text-muted-foreground outline-none transition-all hover:border-neutral-400 focus:border-ring focus:ring-2 focus:ring-ring/15"
          placeholder="name@office.gov.ph"
          value={email}
          disabled={busy || attempted.current}
          error={visibleEmailError || undefined}
          onBlur={() => setEmailTouched(true)}
          onChange={event => {
            setEmail(event.target.value);
            if (!emailTouched) setEmailTouched(true);
          }}
        />
      </FormField>
      <FormField label="Invite as"><SelectInput value={role} disabled={busy || attempted.current} onChange={event => setRole(event.target.value as typeof role)} options={[{ value: 'employee', label: 'Office employee' }, { value: 'representative', label: 'Office representative / Head' }]} /></FormField>
      <p className="po-project-person-note"><UserPlus size={16} />Both can join assigned work. The lead Office’s Head manages invitations and staffing.</p><p className="po-help">Project access ends at completion or archive. Their permanent account role and Office stay unchanged.</p>
    </div>}
    {error && <p role="alert"><AlertTriangle size={16} />{error} Your request is retained; retry uses the same invitation.</p>}
  </Modal>;
}
