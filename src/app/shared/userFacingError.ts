/**
 * Keep authentication and transport details out of the product UI.
 * Backend errors are useful in logs, but they are not a safe or helpful
 * message for someone trying to manage a project.
 */
export const SESSION_REFRESH_MESSAGE =
  'Your sign-in session needs to refresh. Please refresh the page and try again.';

export const PROFILE_VERIFICATION_MESSAGE =
  'Your eFlow profile could not be verified yet. Please refresh the page and try again.';

function messageOf(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === 'string') return reason;
  if (reason && typeof reason === 'object' && 'message' in reason) {
    const message = (reason as { message?: unknown }).message;
    return typeof message === 'string' ? message : '';
  }
  return '';
}

export function isSessionError(reason: unknown): boolean {
  const message = messageOf(reason).toLowerCase();
  const code = reason && typeof reason === 'object' && 'code' in reason
    ? String((reason as { code?: unknown }).code || '').toLowerCase()
    : '';
  const status = reason && typeof reason === 'object' && 'status' in reason
    ? Number((reason as { status?: unknown }).status)
    : 0;
  return message === SESSION_REFRESH_MESSAGE.toLowerCase() || status === 401 || code === 'pgrst301' ||
    message.includes('invalid or expired supabase session') ||
    message.includes('valid supabase session is required') ||
    message.includes('jwt expired') || message.includes('jwt invalid') ||
    message.includes('token has expired') || message.includes('session has expired') ||
    message.includes('not authenticated');
}

export function isProfileVerificationError(reason: unknown): boolean {
  const message = messageOf(reason).toLowerCase();
  return message.includes('authenticated user does not have an eflow profile') ||
    message.includes('no eflow profile') ||
    message.includes('could not load your eflow profile');
}

export function userFacingError(reason: unknown, fallback: string): string {
  if (isSessionError(reason)) return SESSION_REFRESH_MESSAGE;
  if (isProfileVerificationError(reason)) return PROFILE_VERIFICATION_MESSAGE;
  const message = messageOf(reason).trim();
  return message || fallback;
}
