import { useEffect, useRef } from 'react';

/** Retry background reads with backoff, and recover promptly on reconnect. */
export function useQuietOfficeRefresh(refresh: () => Promise<unknown>, needsRetry: boolean, scope: string) {
  const latest = useRef(refresh);
  latest.current = refresh;
  const attempt = useRef(0);
  useEffect(() => { attempt.current = 0; }, [scope]);
  useEffect(() => {
    if (!needsRetry) { attempt.current = 0; return; }
    let active = true, pending = false;
    let timer: ReturnType<typeof window.setTimeout>;
    const delay = () => Math.min(30_000, 1_500 * 2 ** Math.min(attempt.current++, 5));
    const retry = () => {
      if (pending || !active) return;
      pending = true;
      window.clearTimeout(timer);
      void latest.current().catch(() => {}).finally(() => {
        pending = false;
        if (active) timer = window.setTimeout(retry, delay());
      });
    };
    timer = window.setTimeout(retry, delay());
    const visible = () => { if (document.visibilityState === 'visible') retry(); };
    window.addEventListener('online', retry);
    window.addEventListener('focus', retry);
    document.addEventListener('visibilitychange', visible);
    return () => {
      active = false;
      window.clearTimeout(timer);
      window.removeEventListener('online', retry);
      window.removeEventListener('focus', retry);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [needsRetry, refresh, scope]);
}
