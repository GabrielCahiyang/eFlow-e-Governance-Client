import { useEffect, useState } from 'react';
import { getProfileAvatarUrl } from '../../../services/userSettingsService';
import type { UserProfile } from '../../../types';

/** Resolve only already authorized profile paths through the existing private avatar adapter. */
export function useParticipantAvatars(profiles: UserProfile[], ids: string[], scope: string) {
  const paths = ids.slice(0, 4).map(id => ({ id, path: profiles.find(p => p.id === id)?.avatar_path })).filter(p => p.path);
  const key = JSON.stringify([scope, paths]);
  const [state, setState] = useState<{ key: string; urls: Record<string, string> }>({ key: '', urls: {} });
  useEffect(() => {
    let disposed = false;
    void Promise.all(paths.map(async ({id, path}) => {
      try { return [id, await getProfileAvatarUrl(path)] as const; } catch { return [id, null] as const; }
    })).then(results => { if (!disposed) setState({ key, urls: Object.fromEntries(results.filter((pair): pair is readonly [string, string] => Boolean(pair[1]))) }); });
    return () => { disposed = true; };
  }, [key]);
  return state.key === key ? state.urls : {};
}
