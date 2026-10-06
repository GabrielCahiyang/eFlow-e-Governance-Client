import { useEffect, useRef, useState } from 'react';
import { autosaveCollaborationDraft, type buildCollaborationSnapshot } from '../../interdepartment-collaboration';
type Snapshot = ReturnType<typeof buildCollaborationSnapshot>;
/** Serialize saves so an older autosave cannot overwrite a newer explicit save. */
export function useProposalDraftPersistence(scope: string, id: string | null, snapshot: Snapshot | null, enabled: boolean, validationError: string) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState(''), [writing, setWriting] = useState(false);
  const saved = useRef(''), flight = useRef<Promise<unknown> | null>(null), version = useRef(0);
  const latest = useRef({ scope, snapshot }); latest.current = { scope, snapshot };
  const signature = snapshot ? JSON.stringify(snapshot) : '';
  useEffect(() => { saved.current = ''; setState('idle'); setError(''); return () => { ++version.current; }; }, [scope]);
  const markSaved = (value: Snapshot) => { saved.current = JSON.stringify(value); setState('saved'); setError(''); };
  const persist = async (targetId = id, value = snapshot) => {
    if (!targetId || !value || validationError) throw new Error(validationError || 'Generate a persistent draft first.');
    const request = version.current, targetScope = scope, sig = JSON.stringify(value);
    while (flight.current) await flight.current.catch(() => {});
    if (request !== version.current || latest.current.scope !== targetScope) throw new Error('The draft context changed. Reopen its current review.');
    if (saved.current === sig) return;
    setWriting(true); setState('saving'); setError('');
    const write = autosaveCollaborationDraft(targetId, value.title, value); flight.current = write;
    try {
      await write;
      if (request !== version.current) return;
      saved.current = sig;
      setState(JSON.stringify(latest.current.snapshot) === sig ? 'saved' : 'saving');
    } catch (reason) { if (request === version.current) { setState('error'); setError((reason as Error).message || 'Draft save failed. Your edits remain here.'); } throw reason; }
    finally { if (flight.current === write) flight.current = null; if (request === version.current) setWriting(false); }
  };
  useEffect(() => {
    if (!enabled || !id || !snapshot || signature === saved.current) return;
    if (validationError) { setState('error'); setError(validationError); return; }
    setState('saving');
    const timer = window.setTimeout(() => { void persist(id, snapshot).catch(() => {}); }, 900);
    return () => window.clearTimeout(timer);
  }, [id, signature, enabled, validationError]);
  return { state, error, dirty: enabled && signature !== saved.current, pending: writing, persist, markSaved, savedSnapshot: () => saved.current ? JSON.parse(saved.current) as Snapshot : null };
}
