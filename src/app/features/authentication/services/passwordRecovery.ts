import { supabase } from '../../../../lib/supabase';
import { normalizeControlPanelBase, resolveControlPanelBase } from '../../../shared/controlPanelClient';
import { readableUiError } from '../../../shared/userFacingError';

export const RESET_PASSWORD_MIN_LENGTH = 12;
export const RESET_PASSWORD_MAX_LENGTH = 128;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const pendingTokenVerifications = new Map<string, Promise<void>>();
const completedTokenVerifications = new Set<string>();

/** Validates an email address before requesting a password reset link. */
export function validateRecoveryEmail(email: string): string | undefined {
  const trimmed = email.trim();
  if (!trimmed) return 'Enter your email address.';
  if (!EMAIL_PATTERN.test(trimmed)) return 'Enter a valid email address.';
  return undefined;
}

/** Validates new-password fields using eFlow's 12–128 character policy. */
export function validateResetPasswordFields(
  password: string,
  confirmation: string,
): string | undefined {
  if (password.length < RESET_PASSWORD_MIN_LENGTH || password.length > RESET_PASSWORD_MAX_LENGTH) {
    return `Use a password with ${RESET_PASSWORD_MIN_LENGTH} to ${RESET_PASSWORD_MAX_LENGTH} characters.`;
  }
  if (password !== confirmation) {
    return 'The passwords do not match.';
  }
  return undefined;
}

function combinedUrlParams(search: string, hash: string): URLSearchParams {
  const merged = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const cleanHash = hash.startsWith('#') ? hash.slice(1) : hash;
  if (cleanHash) {
    const hashParams = new URLSearchParams(cleanHash);
    hashParams.forEach((value, key) => {
      if (!merged.has(key)) merged.set(key, value);
    });
  }
  return merged;
}

/** Extracts token_hash from a direct recovery link when present. */
export function extractRecoveryTokenHash(search: string, hash: string): string | null {
  const params = combinedUrlParams(search, hash);
  const tokenHash = params.get('token_hash')?.trim();
  const type = params.get('type')?.trim().toLowerCase();
  if (tokenHash && (!type || type === 'recovery')) {
    return tokenHash;
  }
  return null;
}

/** Detects whether the current URL carries Supabase recovery parameters. */
export function hasRecoveryParamsInUrl(search: string, hash: string): boolean {
  const params = combinedUrlParams(search, hash);
  return (
    params.get('type') === 'recovery' ||
    params.has('access_token') ||
    params.has('code') ||
    params.has('token_hash')
  );
}

/** Extracts a user-friendly recovery error message if Supabase redirected with an error. */
export function parseRecoveryErrorFromUrl(search: string, hash: string): string | null {
  const params = combinedUrlParams(search, hash);
  const errorCode = (params.get('error_code') || '').toLowerCase();
  const error = (params.get('error') || '').toLowerCase();
  const description = params.get('error_description') || '';

  if (!errorCode && !error && !description) return null;
  if (errorCode === 'otp_expired' || /expired/i.test(description)) {
    return 'This password reset link has expired. Request a new one from the sign-in page.';
  }
  if (/invalid|denied/i.test(error) || /invalid/i.test(description)) {
    return 'This password reset link is invalid. Request a new one from the sign-in page.';
  }
  return description.trim() || 'This password reset link is no longer valid.';
}

/** Builds the dedicated recovery redirect target on the current origin. */
export function getResetPasswordRedirectUrl(): string {
  return `${window.location.origin}/reset-password`;
}

async function resolvePublicGatewayBase(): Promise<string | null> {
  try {
    return await resolveControlPanelBase();
  } catch {
    try {
      const { data, error } = await supabase.rpc('eflow_login_gateway_endpoint');
      if (!error && typeof data === 'string' && data.trim()) {
        return normalizeControlPanelBase(data);
      }
    } catch {
      /* Gateway discovery unavailable; caller can fall back to Supabase Auth emailer. */
    }
    return null;
  }
}

/** Sends a password reset link via eFlow's email gateway (with Supabase fallback). */
export async function requestPasswordReset(email: string): Promise<void> {
  const validationError = validateRecoveryEmail(email);
  if (validationError) {
    throw new Error(validationError);
  }
  const trimmed = email.trim();

  const base = await resolvePublicGatewayBase();
  if (base) {
    try {
      const response = await fetch(`${base}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
        cache: 'no-store',
        signal: AbortSignal.timeout(30_000),
      });
      if (response.ok) return;
      if (response.status !== 404) {
        const body = (await response.json().catch(() => ({}))) as { detail?: string };
        throw new Error(
          body.detail ||
            (response.status === 429
              ? 'Too many reset requests. Please wait a few minutes and try again.'
              : 'Could not send a password reset email right now. Please try again.'),
        );
      }
    } catch (error) {
      // Only fall back to Supabase Auth directly if the gateway itself wasn't reachable.
      const isGatewayHttpError =
        error instanceof Error &&
        !/(failed to fetch|networkerror|network request failed|load failed|fetch|abort|timeout)/i.test(
          error.message,
        );
      if (isGatewayHttpError) throw error;
    }
  }

  const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
    redirectTo: getResetPasswordRedirectUrl(),
  });
  if (!error) return;

  const message = (error.message || '').toLowerCase();
  const status = (error as { status?: number }).status;
  if (status === 429 || message.includes('rate limit') || message.includes('too many')) {
    throw new Error('Too many reset requests. Please wait a minute and try again.');
  }
  if (status === 500 || message.includes('sending recovery email')) {
    throw new Error(
      'The email delivery service could not send the reset link right now. Ask an Admin to send a reset link or check SMTP settings.',
    );
  }
  throw new Error(
    readableUiError(error, 'Could not send a password reset email right now. Please try again.', 'write'),
  );
}

/** Verifies a direct recovery token_hash once (safe under React StrictMode double-mount). */
export async function verifyRecoveryTokenHash(tokenHash: string): Promise<void> {
  const trimmed = tokenHash.trim();
  if (!trimmed) {
    throw new Error('This password reset link is invalid. Request a new one from the sign-in page.');
  }
  if (completedTokenVerifications.has(trimmed)) return;
  const inFlight = pendingTokenVerifications.get(trimmed);
  if (inFlight) return inFlight;

  const task = (async () => {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: trimmed,
      type: 'recovery',
    });
    if (error) {
      throw new Error(
        'This password reset link is invalid or has expired. Request a new one from the sign-in page.',
      );
    }
    completedTokenVerifications.add(trimmed);
  })();

  pendingTokenVerifications.set(trimmed, task);
  try {
    await task;
  } finally {
    pendingTokenVerifications.delete(trimmed);
  }
}

/** Saves the new password on the active recovery session, then signs out locally. */
export async function completePasswordRecovery(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    const message = (error.message || '').toLowerCase();
    if (message.includes('same') && message.includes('password')) {
      throw new Error('Choose a new password that is different from your current password.');
    }
    throw new Error(
      readableUiError(error, 'Could not update your password. Request a new reset link and try again.', 'write'),
    );
  }

  await supabase.auth.signOut({ scope: 'local' });
}
