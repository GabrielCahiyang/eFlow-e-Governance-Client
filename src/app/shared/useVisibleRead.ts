import { useEffect, useRef } from 'react';

export interface VisibleReadOptions {
  intervalMs?: number;
  minResumeGapMs?: number;
}

/** Recheck authorized reads after reconnect or when a visible tab misses an event. */
export function useVisibleRead(
  refresh: () => void,
  enabled = true,
  options?: VisibleReadOptions,
) {
  const intervalMs = options?.intervalMs ?? 60_000;
  const minResumeGapMs = options?.minResumeGapMs ?? 10_000;
  const latest = useRef(refresh);
  latest.current = refresh;
  useEffect(() => {
    if (!enabled) return;
    let lastCheckedAt = Date.now();
    const run = (minGapMs: number) => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastCheckedAt < minGapMs) return;
      lastCheckedAt = now;
      latest.current();
    };
    const checkResume = () => run(minResumeGapMs);
    const checkOnline = () => run(0);
    const timer = window.setInterval(() => run(intervalMs - 1000), intervalMs);
    window.addEventListener('focus', checkResume);
    window.addEventListener('online', checkOnline);
    document.addEventListener('visibilitychange', checkResume);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', checkResume);
      window.removeEventListener('online', checkOnline);
      document.removeEventListener('visibilitychange', checkResume);
    };
  }, [enabled, intervalMs, minResumeGapMs]);
}
