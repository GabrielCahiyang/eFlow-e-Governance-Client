import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import type { AccountDirectoryNavigation } from '../components/user-management';
import { DEFAULT_USER_DIRECTORY_FILTERS } from '../selectors/userDirectory';

function emptyDirectory(actorId: string): AccountDirectoryNavigation {
  return { actorId, selectedUserId: '', returnAccountId: '', fromDirectory: false, returnFocus: false,
    filters: DEFAULT_USER_DIRECTORY_FILTERS, table: { search: '', sortKey: null, sortDir: 'asc' } };
}

/** Account intent stays with its feature owner, outside destination preferences. */
export function useAccountDirectoryNavigation(actorId: string, role: string) {
  const scope = `${actorId}:${role}`;
  const current = useRef({ scope, generation: 0 });
  if (current.current.scope !== scope) current.current = { scope, generation: current.current.generation + 1 };
  const generation = current.current.generation;
  const [entry, setEntry] = useState(() => ({ generation, state: emptyDirectory(actorId) }));
  const navigation = entry.generation === generation ? entry.state : emptyDirectory(actorId);
  useEffect(() => {
    // A late mount/reset effect must not overwrite an already accepted handoff.
    setEntry(previous => previous.generation === generation ? previous : { generation, state: emptyDirectory(actorId) });
  }, [actorId, generation]);
  const update = useCallback((change: SetStateAction<AccountDirectoryNavigation>) => {
    if (current.current.generation !== generation) return;
    setEntry(previous => {
      if (current.current.generation !== generation) return previous;
      const state = previous.generation === generation ? previous.state : emptyDirectory(actorId);
      return { generation, state: typeof change === 'function' ? change(state) : change };
    });
  }, [actorId, generation]);
  return { navigation, update };
}
