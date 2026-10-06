import { useCallback, useEffect, useRef, useState } from 'react';
/** Each source has independent error/retry state. Scope and sequence reject late results. */
export function usePersonalFeed<T>(userId: string | undefined, read: (id: string) => Promise<T[]>, enabled = true) {
  const [state, setState] = useState<{ scope?: string; rows: T[]; loading: boolean; error: string }>({ rows: [], loading: true, error: '' });
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision(value => value + 1), []);
  const readRef = useRef(read); readRef.current = read;
  useEffect(() => {
    let active = true, sequence = 0, inFlight = false;
    setState({scope:userId, rows:[], loading:!!userId && enabled, error:''});
    if (!userId || !enabled) return;
    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      const current = ++sequence;
      try { const rows = await readRef.current(userId); if (active && sequence === current) setState({scope:userId,rows,loading:false,error:''}); }
      catch (error) { if (active && sequence === current) setState({scope:userId,rows:[],loading:false,error:error instanceof Error ? error.message : 'Could not load this source.'}); }
      finally { inFlight = false; }
    };
    void load();
    const timer = window.setInterval(load, 15000);
    const focus = () => void load(); window.addEventListener('focus',focus);
    return () => { active=false; ++sequence; window.clearInterval(timer); window.removeEventListener('focus',focus); };
  }, [userId,enabled,revision]);
  return {...(state.scope === userId ? state : {rows:[] as T[],loading:!!userId && enabled,error:''}), retry};
}
