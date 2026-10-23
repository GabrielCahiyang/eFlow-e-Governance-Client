import { useEffect, useRef, useState } from 'react';
import { NAVIGATION_LOCATION_EVENT, pushNavigationHistory } from '../../../shared/navigationHistory';
import { requestNavigation } from '../../../shared/navigationGuard';

const readEntry = () => new URL(window.location.href).searchParams.get('journalEntry') || '';
export function useJournalEntryNavigation(scope: string) {
  const [selected, setSelected] = useState({ scope, id: readEntry() });
  const previousScope = useRef(scope);
  const opener = useRef<HTMLElement | null>(null);
  const scroll = useRef<{ element: HTMLElement; top: number; left: number }[]>([]);
  useEffect(() => {
    if (previousScope.current !== scope) { previousScope.current = scope; setSelected({ scope, id: '' }); opener.current = null; scroll.current = []; }
    const update = () => setSelected({ scope, id: readEntry() });
    window.addEventListener('popstate', update);
    window.addEventListener(NAVIGATION_LOCATION_EVENT, update);
    return () => { window.removeEventListener('popstate', update); window.removeEventListener(NAVIGATION_LOCATION_EVENT, update); };
  }, [scope]);
  useEffect(() => {
    if (selected.scope !== scope || selected.id || !opener.current) return;
    const frame = requestAnimationFrame(() => {
      scroll.current.forEach(saved => { if (saved.element.isConnected) { saved.element.scrollTop = saved.top; saved.element.scrollLeft = saved.left; } });
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [selected, scope]);
  const navigate = (id: string) => {
    void requestNavigation(() => {
      if (id) {
        opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        scroll.current = [];
        for (let element = opener.current; element; element = element.parentElement) {
          if (element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth) scroll.current.push({ element, top: element.scrollTop, left: element.scrollLeft });
        }
        if (document.scrollingElement instanceof HTMLElement) scroll.current.push({ element: document.scrollingElement, top: document.scrollingElement.scrollTop, left: document.scrollingElement.scrollLeft });
      }
      const url = new URL(window.location.href);
      if (id) url.searchParams.set('journalEntry', id); else url.searchParams.delete('journalEntry');
      pushNavigationHistory(url.pathname + url.search + url.hash);
    });
  };
  return { selectedId: selected.scope === scope ? selected.id : '', open: navigate, back: () => navigate('') };
}
