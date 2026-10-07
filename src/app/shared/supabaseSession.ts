import { supabase } from '../../lib/supabase';
import { isSessionError, SESSION_REFRESH_MESSAGE } from './userFacingError';

type SupabaseResult = { error?: unknown };

/** Retry one Supabase read/write after an expired or rotated browser session. */
export async function withSupabaseSessionRetry<T extends SupabaseResult>(
  request: () => PromiseLike<T>,
): Promise<T> {
  let first: T;
  try {
    first = await request();
  } catch (reason) {
    if (!isSessionError(reason)) throw reason;
    await refreshSession();
    return retryOrThrow(request);
  }

  if (!first.error || !isSessionError(first.error)) return first;
  await refreshSession();
  return retryOrThrow(request);
}

async function retryOrThrow<T extends SupabaseResult>(request: () => PromiseLike<T>): Promise<T> {
  try {
    const result = await request();
    if (result.error && isSessionError(result.error)) throw new Error(SESSION_REFRESH_MESSAGE);
    return result;
  } catch (reason) {
    if (isSessionError(reason)) throw new Error(SESSION_REFRESH_MESSAGE);
    throw reason;
  }
}

async function refreshSession(): Promise<void> {
  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data.session) throw new Error(SESSION_REFRESH_MESSAGE);
}
