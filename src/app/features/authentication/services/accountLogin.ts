import { supabase } from '../../../../lib/supabase';
import type { LoginPortal } from './loginPortal';

export class AccountSignInError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = 'AccountSignInError'; }
}

function resolveWebSignInEndpoint(): { url: string; anonKey: string } {
  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!supabaseUrl || !anonKey) {
    throw new Error('The secure sign-in service is unavailable. Please try again shortly.');
  }
  return { url: `${supabaseUrl}/functions/v1/web-sign-in`, anonKey };
}

/** Only the hosted Supabase Edge Function verifies passwords and records failures; never report a browser counter. */
export async function signInWithAccountProtection(email: string, password: string, portal?: LoginPortal) {
  const { url, anonKey } = resolveWebSignInEndpoint();
  const payload = portal
    ? { email: email.trim(), password, portal }
    : { email: email.trim(), password };
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
    // Allow hosted login_begin + auth/token + login_finish round-trips to settle without premature client abort.
    signal: AbortSignal.timeout(60_000),
  });
  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
  };
  if (!response.ok) throw new AccountSignInError(response.status,
    response.status === 423 ? 'Your account is locked. Contact an Admin to unlock it.' :
    response.status === 401 ? 'Email or password is incorrect.' :
    response.status === 403 ? 'This account cannot sign in yet. Confirm your email or contact an Admin.' :
    'Unable to sign in right now. Please try again shortly.');
  if (!body.access_token || !body.refresh_token) throw new Error('Unable to finish sign-in. Please try again.');
  const { error } = await supabase.auth.setSession({access_token:body.access_token, refresh_token:body.refresh_token});
  if (error) throw new Error('Unable to finish sign-in. Please try again.');
}
