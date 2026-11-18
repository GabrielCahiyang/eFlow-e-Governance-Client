import { useEffect, useState } from 'react';
import { readPendingAction, removePendingAction, writePendingAction } from './pendingActionStore';

export function usePendingAction<T>(key: string) {
  const [state, setState] = useState<{ key: string; ready: boolean; value?: T; error?: string }>();
  useEffect(() => {
    let active = true;
    let version = 0;
    const load = () => {
      const run = ++version;
      void readPendingAction<T>(key).then(value => {
        if (active && run === version) setState({ key, ready: true, value });
      }).catch(() => {
        if (active && run === version) setState({ key, ready: false, error: 'The saved action could not be read. Reopen this form to check it.' });
      });
    };
    const changed = (event: Event) => { if ((event as CustomEvent<string>).detail === key) load(); };
    window.addEventListener('eflow:pending-action', changed);
    load();
    return () => { active = false; window.removeEventListener('eflow:pending-action', changed); };
  }, [key]);
  const current = state?.key === key ? state : undefined;
  return {
    value: current?.value,
    ready: current?.ready === true,
    error: current?.error,
    async save(value: T, create = false) {
      await writePendingAction(key, value, create);
      setState({ key, ready: true, value });
      window.dispatchEvent(new CustomEvent('eflow:pending-action', { detail: key }));
    },
    async clear() {
      await removePendingAction(key);
      setState({ key, ready: true });
      window.dispatchEvent(new CustomEvent('eflow:pending-action', { detail: key }));
    },
  };
}
