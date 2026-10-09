import { useEffect, useMemo, useState } from 'react';
const PREFIX = 'eflow:navigation:v1:';
const PREFERENCE_EVENT = 'eflow:navigationpreferences';
export function clearNavigationPreferences(userId: string) {
  try { Object.keys(localStorage).filter(key => key.startsWith(`${PREFIX}${userId}:`)).forEach(key => localStorage.removeItem(key)); } catch { /* Storage may be disabled. */ }
}
export function useNavigationFavorites(userId: string, contextId: string, authorizedIds: string[], loaded = true) {
  const key = `${PREFIX}${userId}:${contextId}`;
  const [stored, setStored] = useState<{ key: string; ids: string[] }>({ key: '', ids: [] });
  useEffect(() => {
    const reload = () => {
    let ids: string[] = [];
    try { const value: unknown = JSON.parse(localStorage.getItem(key) || '[]'); if (Array.isArray(value)) ids = value.filter((id): id is string => typeof id === 'string').slice(0, 100); } catch { /* Ignore malformed or blocked local storage. */ }
    setStored({ key, ids });
    };
    const onStorage = (event: StorageEvent) => { if (event.key === key || event.key === null) reload(); };
    const onPreference = (event: Event) => { if ((event as CustomEvent<string>).detail === key) reload(); };
    reload(); window.addEventListener('storage', onStorage); window.addEventListener(PREFERENCE_EVENT, onPreference);
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener(PREFERENCE_EVENT, onPreference); };
  }, [key]);
  const allowedKey = JSON.stringify(authorizedIds);
  const favorites = useMemo(() => new Set(stored.key === key ? stored.ids.filter(id => authorizedIds.includes(id)) : []), [stored, key, allowedKey]);
  useEffect(() => {
    if (!loaded || stored.key !== key || stored.ids.length === favorites.size) return;
    const ids = [...favorites]; setStored({ key, ids });
    try { if (userId) localStorage.setItem(key, JSON.stringify(ids)); } catch { /* Local-only preference. */ }
  }, [stored, key, favorites, userId, loaded]);
  const persist = (ids: string[]) => {
    setStored({ key, ids });
    try { if (userId) { localStorage.setItem(key, JSON.stringify(ids)); window.dispatchEvent(new CustomEvent(PREFERENCE_EVENT, { detail: key })); } } catch { /* Keep reversible in-memory preference. */ }
  };
  const prune = () => persist([...favorites]);
  return { favorites, prune, toggle: (id: string) => {
    if (!userId || !authorizedIds.includes(id)) return;
    const next = new Set(favorites); if (next.has(id)) next.delete(id); else next.add(id);
    persist([...next]);
  } };
}
export function useNavigationDisclosure(userId: string, contextId: string) {
  const key = `${PREFIX}${userId}:${contextId}:disclosures`;
  const [stored, setStored] = useState<{ key: string; closed: string[] }>({ key: '', closed: [] });
  useEffect(() => {
    try { const value: unknown = JSON.parse(localStorage.getItem(key) || '[]'); setStored({ key, closed: Array.isArray(value) ? value.filter((id): id is string => ['projects', 'favorites'].includes(id)) : [] }); } catch { setStored({ key, closed: [] }); }
  }, [key]);
  const closed = stored.key === key ? stored.closed : [];
  return { isOpen: (id: string) => !closed.includes(id), setOpen: (id: string, open: boolean) => {
    const next = open ? closed.filter(value => value !== id) : [...new Set([...closed, id])]; setStored({ key, closed: next });
    try { if (userId) localStorage.setItem(key, JSON.stringify(next)); } catch { /* Preference stays in memory. */ }
  } };
}
