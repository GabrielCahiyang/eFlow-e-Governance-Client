import { useEffect, useRef } from 'react';

/** Recheck authorized reads after reconnect or when a visible tab misses an event. */
export function useVisibleRead(refresh: () => void, enabled = true) {
  const latest = useRef(refresh);
  latest.current = refresh;
  useEffect(() => {
    if (!enabled) return;
    const check = () => {
      if (document.visibilityState === 'visible') latest.current();
    };
    const timer = window.setInterval(check, 15_000);
    window.addEventListener('focus', check);
    window.addEventListener('online', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', check);
      window.removeEventListener('online', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, [enabled]);
}
