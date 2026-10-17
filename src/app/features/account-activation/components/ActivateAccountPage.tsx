import { useEffect, useRef, useState } from 'react';
import { Button, TextField } from '@vibe/core';
import { EFlowMark } from '../../../../components/EFlowMark';
import { completeAccountActivation, validateAccountActivation } from '../services/activationService';
import { activationRoleLabel } from '../selectors';
import type { ActivationPreview, ActivationResult } from '../types';
import '../activation.css';

export function ActivateAccountPage() {
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token') || '');
  const [attempt] = useState(() => crypto.randomUUID());
  const [preview, setPreview] = useState<ActivationPreview>();
  const [result, setResult] = useState<ActivationResult>();
  const [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState(''), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => {
    window.history.replaceState({}, '', '/activate-account');
    const meta = document.createElement('meta'); meta.name = 'referrer'; meta.content = 'no-referrer'; document.head.append(meta);
    let current = true;
    if (!token) { setError('Open the activation link from your email.'); setLoading(false); }
    else void validateAccountActivation(token).then(data => { if (current) setPreview(data); })
      .catch(reason => { if (current) setError(reason.message); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; meta.remove(); };
  }, [token]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (inFlight.current || !preview) return;
    if (password.length < 12 || password.length > 128) { setError('Use a password with 12 to 128 characters.'); return; }
    if (password !== confirmation) { setError('The passwords do not match.'); return; }
    inFlight.current = true; setBusy(true); setError('');
    try { setResult(await completeAccountActivation(token, password, attempt)); setPassword(''); setConfirmation(''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not activate your account. Please try again.'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return <main className="eflow-activation-page"><section className="eflow-activation-card" aria-busy={loading || busy}>
    <EFlowMark height={42} state={busy ? 'submitting' : result ? 'success' : 'idle'}/>
    <p className="eflow-activation-eyebrow">ACCOUNT ACTIVATION</p>
    <h1>{result ? result.next_step === 'awaiting_authority' ? 'Your email is verified' : 'You’re ready to go' : 'Welcome to eFlow'}</h1>
    {loading ? <p role="status">Checking your invitation…</p> : result ? <>
      <p role="status">{result.next_step === 'awaiting_authority' ? 'Your Admin needs to approve your role before you can sign in.' : 'Your account is activated. Sign in with your email and new password.'}</p>
      <Button onClick={() => window.location.assign('/')} kind="primary">Go to sign in</Button>
    </> : preview ? <>
      <p>Set your password to finish creating your account.</p>
      <dl className="eflow-activation-identity"><div><dt>Name</dt><dd>{preview.full_name}</dd></div><div><dt>Email</dt><dd>{preview.email}</dd></div><div><dt>Office</dt><dd>{preview.office_name}</dd></div><div><dt>Role</dt><dd>{activationRoleLabel(preview.requested_privileged_role || preview.account_role)}</dd></div></dl>
      {preview.requested_privileged_role && <p className="eflow-activation-note">This role needs Admin approval after you verify your email.</p>}
      <form onSubmit={submit} noValidate>
        <TextField title="New password" inputAriaLabel="New password" type="password" maxLength={128} autoComplete="new-password" value={password} disabled={busy} onChange={value => { setPassword(value); setError(''); }} required/>
        <p className="eflow-activation-password-help">Use at least 12 characters.</p>
        <TextField title="Confirm password" inputAriaLabel="Confirm password" type="password" maxLength={128} autoComplete="new-password" value={confirmation} disabled={busy} onChange={value => { setConfirmation(value); setError(''); }} required/>
        {error && <p role="alert" className="eflow-activation-error">{error}</p>}
        <Button type="submit" kind="primary" loading={busy} disabled={busy || !password || !confirmation}>Activate account</Button>
      </form>
    </> : <><p role="alert">{error || 'This activation link is no longer valid.'}</p><p>Ask your Admin to send a new invitation.</p><Button kind="secondary" onClick={() => window.location.assign('/')}>Back to sign in</Button></>}
    <p className="eflow-activation-footnote">Your office and role were selected by your Admin. Your password stays private.</p>
  </section></main>;
}
