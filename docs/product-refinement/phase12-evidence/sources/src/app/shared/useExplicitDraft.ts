import { useRef } from 'react';
import { useNavigationBlocker } from './navigationGuard';
export function useExplicitDraft(label: string, dirty: boolean, pending: boolean, onDiscard: () => void) {
 const pendingRef = useRef(false);
 const guard = { dirty, pending, pendingCheck: () => pendingRef.current, label, onDiscard };
 const current = useRef(guard); current.current = guard;
 useNavigationBlocker(guard);
 return { pendingRef, markClean: () => { current.current.dirty = false; current.current.pending = false; pendingRef.current = false; } };
}
