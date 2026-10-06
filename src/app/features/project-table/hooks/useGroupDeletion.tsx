import { useRef, useState } from 'react';
import { useConfirmation } from '../../../components/ui/useConfirmation';
import { useNavigationBlocker } from '../../../shared/navigationGuard';
import { deleteProjectGroup } from '../services/workspaceService';
import type { ProjectGroup } from '../types';

export function useGroupDeletion(group: ProjectGroup, refresh: () => Promise<void>) {
  const { confirm, dialog } = useConfirmation();
  const [error, setError] = useState(''), [refreshFailed, setRefreshFailed] = useState(false), [busy, setBusy] = useState(false);
  const pending = useRef(false), trigger = useRef<HTMLButtonElement>(null);
  useNavigationBlocker({ label: `Deleting group ${group.title}`, dirty: false, pending: busy, pendingCheck: () => pending.current, onDiscard: () => {} });
  const retryRefresh = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true);
    try { await refresh(); setRefreshFailed(false); setError(''); }
    catch (caught) { setError('Group deleted, but could not refresh: ' + (caught instanceof Error ? caught.message : 'Please reload.')); }
    finally { pending.current = false; setBusy(false); }
  };
  const remove = async () => {
    if (pending.current || refreshFailed) return;
    // Let the menu release its focus scope before opening the confirmation.
    await new Promise<void>(resolve => requestAnimationFrame(() => { trigger.current?.focus(); resolve(); }));
    if (!await confirm({ title: `Delete ${group.title}?`, description: 'This empty group will be removed from the project table. No tasks or task history will be deleted.', danger: true, actionLabel: 'Delete group', impact: <p>Group: {group.title} · 0 tasks</p> })) return;
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      await deleteProjectGroup(group.id);
      setRefreshFailed(true);
      try { await refresh(); setRefreshFailed(false); }
      catch (caught) { setError('Group deleted, but could not refresh: ' + (caught instanceof Error ? caught.message : 'Please reload.')); }
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not delete this group.'); }
    finally { pending.current = false; setBusy(false); }
  };
  return { trigger, dialog, error, busy, refreshFailed, remove, retryRefresh };
}
