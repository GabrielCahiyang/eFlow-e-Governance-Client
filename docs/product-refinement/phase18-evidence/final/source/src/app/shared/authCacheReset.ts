const resets = new Set<() => void>();

export function registerAuthCacheReset(reset: () => void) {
  resets.add(reset);
  return () => { resets.delete(reset); };
}

/** Clear actor-owned snapshots even if logout's remote request fails. */
export function resetAuthCaches() {
  for (const reset of resets) {
    try { reset(); } catch { /* One cache cannot prevent logout or other cleanup. */ }
  }
}
