import { useRef, useState } from 'react';
import { requestNavigation, useNavigationBlocker } from '../../../shared/navigationGuard';

export function usePlanningEditor<T>(initial: () => T, label: string, options: { closeOnSuccess?: boolean } = {}) {
  const [open, setOpen] = useState(false), [draft, setDraft] = useState(initial), [saved, setSaved] = useState(initial);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const dirty = open && JSON.stringify(draft) !== JSON.stringify(saved);
  useNavigationBlocker({ label, dirty, pending, pendingCheck: () => inFlight.current, onDiscard: () => { setDraft(saved); setError(''); setOpen(false); } });
  return { open, draft, setDraft, error, notice, pending, dirty,
    onOpenChange: (next: boolean) => {
      if (next) { const current = initial(); setDraft(current); setSaved(current); setError(''); setNotice(''); setOpen(true); }
      else void requestNavigation(() => { if (!dirty) setOpen(false); });
    },
    submit: async (operation: (value: T) => Promise<void>, message: string) => {
      if (inFlight.current || !dirty) return;
      inFlight.current = true; setPending(true); setError(''); setNotice('');
      try {
        await operation(draft); setSaved(draft); setNotice(message);
        if (options.closeOnSuccess) setOpen(false);
      }
      catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not save. Your changes are retained.'); }
      finally { inFlight.current = false; setPending(false); }
    },
  };
}
