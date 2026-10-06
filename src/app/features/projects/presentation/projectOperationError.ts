/** Supabase errors may be plain objects; present their message without changing service contracts. */
export function projectOperationError(error: unknown, fallback: string): string {
  return error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message ? error.message : fallback;
}
