/**
 * Keep authentication and transport details out of the product UI.
 * Backend errors are useful in logs, but they are not a safe or helpful
 * message for someone trying to manage a project.
 */
export const SESSION_REFRESH_MESSAGE =
  'Your sign-in session needs to refresh. Please refresh the page and try again.';

export const PROFILE_VERIFICATION_MESSAGE =
  'Your eFlow profile could not be verified yet. Please refresh the page and try again.';

export const NETWORK_ERROR_MESSAGE =
  'Unable to reach eFlow. Check your internet connection and try again.';

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

export function isNetworkError(reason: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const msg = messageOf(reason).toLowerCase();
    if (!msg || msg.includes('fetch') || msg.includes('network') || msg.includes('offline')) {
      return true;
    }
  }
  if (reason instanceof TypeError) return true;
  const message = messageOf(reason).toLowerCase();
  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network request failed') ||
    message.includes('load failed') ||
    message.includes('err_internet_disconnected') ||
    message.includes('err_name_not_resolved')
  );
}

export function userFacingError(reason: unknown, fallback: string): string {
  if (isSessionError(reason)) return SESSION_REFRESH_MESSAGE;
  if (isProfileVerificationError(reason)) return PROFILE_VERIFICATION_MESSAGE;
  if (isNetworkError(reason)) return NETWORK_ERROR_MESSAGE;
  const message = messageOf(reason).trim();
  return message || fallback;
}

/** UI copy only. Keep the original exception/code for workflow decisions and
 * logging; do not use this text to determine whether a write succeeded. */
export function readableUiError(reason: unknown, fallback: string, operation: 'read' | 'write' = 'write'): string {
  if (isSessionError(reason)) return 'Refresh the page to check your sign-in, then continue.';
  if (isProfileVerificationError(reason)) return "We couldn't check your eFlow account. Refresh the page. If this continues, contact your administrator.";
  const message = messageOf(reason).trim();
  const code = reason && typeof reason === 'object' && 'code' in reason ? String((reason as { code?: unknown }).code || '') : '';
  const status = reason && typeof reason === 'object' && 'status' in reason ? Number((reason as { status?: unknown }).status) : undefined;
  const network = /failed to fetch|networkerror|network request failed|load failed|err_internet_disconnected|err_name_not_resolved|upstream request timeout|canceling statement due to statement timeout|statement timeout|request timeout|gateway timeout|timed out|connection reset|connection refused|econnreset|econnrefused/i.test(message)
    || status === 0 || status === 408 || status === 502 || status === 503 || status === 504 || code === '57014'
    || (!message && typeof navigator !== 'undefined' && navigator.onLine === false);
  if (network) return operation === 'read'
    ? "Couldn't connect right now. Check your internet and reload this view."
    : "We couldn't confirm the result because the connection was interrupted. Check your internet and the current record before trying again.";
  const technical = /\b(?:RPC|RLS|SQLSTATE|PGRST\d+|Supabase|JWT|UUID|migration|payload)\b|schema cache|row.level security|violates .*constraint|relation .+does not exist|function .+does not exist|permission denied for|cannot read (?:properties|property)|is not a function|unexpected token|not valid JSON|invalid input syntax|^column .+does not exist|^null value in column|^(?:HTTP|Error)\s+\d{3}\b|\bat \S+\s*\([^)]*:\d+:\d+\)/i.test(message)
    || /^(?:42P01|42703|42883|42501|PGRST202|PGRST204|23505|23503)$/i.test(code);
  if (technical) {
    if (/not confirmed|unconfirmed|uncertain|unknown outcome/i.test(message)) return fallback;
    if (/row.level security|permission denied for/i.test(message) || code === '42501') return `${fallback} Your current account does not have permission for this action.`;
    if (/migration|schema cache|relation .+does not exist|function .+does not exist/i.test(message) || /^(?:42P01|42703|42883|PGRST202|PGRST204)$/i.test(code)) return `${fallback} Ask your administrator to check eFlow's setup.`;
    return fallback;
  }
  if (!message || /^(?:something went wrong|an? (?:unexpected )?error occurred|operation failed|request failed|invalid response|internal server error|unknown error)[.!]?$/i.test(message)) return fallback;
  return message;
}
