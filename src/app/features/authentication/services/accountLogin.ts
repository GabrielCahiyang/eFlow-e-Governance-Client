import { supabase } from '../../../../lib/supabase';
import { normalizeControlPanelBase, resolveControlPanelBase } from '../../../shared/controlPanelClient';

export class AccountSignInError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = 'AccountSignInError'; }
}

/** Only the gateway verifies passwords and records failures; never report a browser counter. */
export async function signInWithAccountProtection(email: string, password: string) {
  let base: string;
  try { base = await resolveControlPanelBase(); }
  catch {
    // Signed-out users cannot read admin-only settings. This read-only RPC
    // exposes exactly the public routing address, never private configuration.
    const {data,error} = await supabase.rpc('eflow_login_gateway_endpoint');
    if (error || typeof data !== 'string' || !data.trim()) throw new Error('The secure sign-in service is unavailable. Please try again shortly.');
    base = normalizeControlPanelBase(data);
  }
  const response = await fetch(`${base}/auth/login`, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({email:email.trim(), password}), cache:'no-store',
    signal: AbortSignal.timeout(25_000),
  });
  const body = await response.json();
  if (!response.ok) throw new AccountSignInError(response.status,
    response.status === 423 ? 'Your account is locked. Contact an Admin to unlock it.' :
    response.status === 401 ? 'Email or password is incorrect.' :
    response.status === 403 ? 'This account cannot sign in yet. Confirm your email or contact an Admin.' :
    'Unable to sign in right now. Please try again shortly.');
  if (!body.access_token || !body.refresh_token) throw new Error('Unable to finish sign-in. Please try again.');
  const { error } = await supabase.auth.setSession({access_token:body.access_token, refresh_token:body.refresh_token});
  if (error) throw new Error('Unable to finish sign-in. Please try again.');
}
