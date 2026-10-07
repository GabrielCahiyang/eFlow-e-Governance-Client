import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { signInWithAccountProtection } from '../../authentication';
import { EFlowMark } from '../../../../components/EFlowMark';
import { WorkspaceIllustration } from '../../../components/ui/WorkspaceIllustration';
import { acceptInvitation, createInvitedAccount, validateInvitation } from '../services/invitationService';
import type { InvitationMetadata } from '../types';
import '../invitations.css';

export function AcceptInvitationPage() {
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token') || '');
  const [attemptId] = useState(() => crypto.randomUUID());
  const [invite, setInvite] = useState<InvitationMetadata>();
  const [existing, setExisting] = useState(false);
  const [name, setName] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [email, setEmail] = useState<string>();
  useEffect(() => {
    // Keep the token only in this page's memory; never cache it or send it as referrer.
    window.history.replaceState({}, '', '/accept-invite');
    const referrer = document.createElement('meta'); referrer.name = 'referrer'; referrer.content = 'no-referrer'; document.head.append(referrer);
    let active = true;
    void validateInvitation(token).then(data => { if (active) { setInvite(data); setExisting(data.existing_account); } }).catch(reason => { if (active) setError(reason.message); });
    void supabase.auth.getUser().then(({ data }) => { if (active) setEmail(data.user?.email); });
    return () => { active = false; referrer.remove(); };
  }, [token]);
  const wrongAccount = email && invite && email.toLowerCase() !== invite.email.toLowerCase();
  const projectInvitation = invite?.invitation_type === 'project_office' || invite?.invitation_type === 'project_office_identity';
  async function finish(event: React.FormEvent) {
    event.preventDefault(); if (!invite) return;
    setBusy(true); setError('');
    try {
      if (!existing && !email) {
        if (password !== confirm) throw new Error('Passwords must match.');
        try { await createInvitedAccount(token, name, password, attemptId); }
        catch (creationError) {
          // Recover a committed create-account response lost in transit without creating twice.
          try { await signInWithAccountProtection(invite.email, password); }
          catch { throw creationError; }
          await acceptInvitation(token, name);
        }
        await signInWithAccountProtection(invite.email, password);
      } else {
        if (!email) {
          await signInWithAccountProtection(invite.email, password);
        }
        await acceptInvitation(token, name);
      }
      window.location.replace(invite.project_id ? '/projects?page=Projects&project=' + encodeURIComponent(invite.project_id) + '&view=offices' : '/');
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }
  return <main className="eflow-accept-page"><section className="eflow-accept-content"><EFlowMark variant="default" height={38} />
    {invite ? <><header><p className="eflow-eyebrow">YOU’RE INVITED</p><h1>{invite.project_title ? `Join ${invite.project_title}.` : `Join ${invite.office_name}’s team.`}</h1><p>{invite.project_title ? `${invite.office_name} has been invited to work with this project.` : 'Complete your details. Your Office is ready for you.'}</p></header>
      <div className="eflow-invited-context"><span>{invite.office_name}</span><span>{projectInvitation ? invite.workspace_access === 'observer' ? 'Observer · read only' : 'Collaborating Office' : invite.account_role === 'accounting_staff' ? 'Accounting Staff' : 'Member'}</span></div>
      <form onSubmit={finish} className="eflow-accept-form"><label>Email<input value={invite.email} readOnly type="email" aria-readonly="true" /></label>
        {wrongAccount ? <><p role="alert">You’re signed in as {email}. Switch accounts to accept this invitation.</p><button type="button" className="eflow-primary-button" onClick={async () => { await supabase.auth.signOut(); setEmail(undefined); setPassword(''); }}>Switch account</button></> : <>
          {((!existing && !email) || invite.needs_full_name) && <label>Full name<input required minLength={2} maxLength={160} autoComplete="name" placeholder="Enter your full name" value={name} onChange={event => setName(event.target.value)} /></label>}
          {!email && <label>Password<input required minLength={existing ? 1 : 12} maxLength={128} type="password" autoComplete={existing ? 'current-password' : 'new-password'} placeholder={existing ? 'Enter your password' : 'Enter at least 12 characters'} value={password} onChange={event => setPassword(event.target.value)} /></label>}
          {!existing && !email && <label>Confirm password<input required minLength={12} maxLength={128} type="password" autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} /></label>}
          <p className="eflow-invite-help">{projectInvitation ? 'Project access keeps your account role and Office membership unchanged. Directory linking and the appointed Office Head’s confirmation are required before staffing. Contacts can view project context; they cannot appoint themselves as Head.' : 'Your email, Office, and role are set by this invitation. Your password stays private.'}</p>
          <button className="eflow-primary-button" disabled={busy} type="submit">{busy ? 'Joining…' : existing || email ? invite.project_title ? 'Join project' : 'Join your Office' : 'Create account'} <span aria-hidden="true">→</span></button>
          {!email && <button className="eflow-text-button" type="button" onClick={() => { setExisting(current => !current); setPassword(''); setConfirm(''); }}>{existing ? 'Need to create an account?' : 'Already have an account? Sign in'}</button>}
        </>}
      </form></> : <div className="eflow-accept-empty"><h1>{error ? 'This invitation isn’t available.' : 'Getting your Office ready…'}</h1>{error && <p>Ask your Office Head for a fresh invitation.</p>}</div>}
    {error && <p className="eflow-form-error" role="alert">{error}</p>}
  </section><WorkspaceIllustration dark /></main>;
}
