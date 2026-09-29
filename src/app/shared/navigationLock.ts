const locks = new Set<symbol>();
/** Temporary operation locks only; normal navigation resumes on release. */
export function acquireNavigationLock() {
  const token = Symbol("operation"); locks.add(token);
  return () => { locks.delete(token); };
}
export function isNavigationLocked() { return locks.size > 0; }
