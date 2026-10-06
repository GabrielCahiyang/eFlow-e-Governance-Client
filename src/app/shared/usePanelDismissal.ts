import { useCallback, useEffect, useRef, type RefObject } from 'react';
/** Keyboard and focus contract for existing movable, non-modal utility panels. */
export function usePanelDismissal(open: boolean, panel: RefObject<HTMLElement | null>, trigger: RefObject<HTMLElement | null>, close: () => void) {
  const latestClose = useRef(close); latestClose.current = close;
  const dismiss = useCallback(() => { latestClose.current(); trigger.current?.focus(); }, [trigger]);
  useEffect(() => {
    if (!open) return;
    const element = panel.current;
    element?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const target = event.target instanceof Element ? event.target : null;
      // A nested dialog/menu owns its first Escape.
      const nested = target?.closest('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]');
      if (nested && nested !== element) return;
      if (target && target !== document.body && !element?.contains(target) && !trigger.current?.contains(target)) return;
      event.preventDefault(); event.stopPropagation(); latestClose.current(); trigger.current?.focus();
    };
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('keydown', escape);
      if (element?.contains(document.activeElement)) requestAnimationFrame(() => trigger.current?.focus());
    };
  }, [open, panel, trigger]);
  return dismiss;
}
