import { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { requestNavigation } from '../../../shared/navigationGuard';
import { fetchNotificationSubitem, useNotificationNavigationIntent } from '../../notifications';
import { SubtaskWorkDrawer, type Subtask } from '../../subtasks';
import type { Task } from '../../tasks';
import type { TaskInspectorOrigin } from '../../task-inspector';
import type { WorkRow } from '../types';

/** Keep notification targeting when retiring the duplicate Leading workspace.
 * Reads remain account scoped and exact-ID; the current Inspector owns actions. */
export function LeadingNotificationTarget({ rows, loading, onOpen }: {
  rows: WorkRow[];
  loading: boolean;
  onOpen: (row: WorkRow, element: HTMLElement, isCurrent: () => boolean) => Promise<boolean>;
}) {
  const { user } = useAuth();
  const [subitem, setSubitem] = useState<(Subtask & { parentTask: Task })>();
  const [origin, setOrigin] = useState<TaskInspectorOrigin>();
  const [error, setError] = useState('');
  useNotificationNavigationIntent(
    intent => intent.kind === 'leading_task',
    async (intent, isCurrent) => {
      if (loading) return false;
      const root = rows.find(row => row.kind === 'office-task' && row.id === intent.taskId);
      const opener = document.activeElement instanceof HTMLElement ? document.activeElement : document.body;
      if (intent.entityId) {
        try {
          const record = await fetchNotificationSubitem(intent, user?.id || '', root?.task);
          if (!isCurrent()) return false;
          return requestNavigation(() => {
            if (!isCurrent()) return;
            setSubitem(record);
            setOrigin({ view: 'My Work', section: 'work', returnFocus: opener,
              restoreFocus: () => document.getElementById('personal-work-search')?.focus() });
            setError('');
          });
        } catch (caught) {
          if (!isCurrent()) return false;
          return requestNavigation(() => {
            if (!isCurrent()) return;
            setSubitem(undefined);
            setError(caught instanceof Error ? caught.message : 'This subitem is unavailable.');
          });
        }
      }
      // Older notifications without an item ID retain their parent-task entrance.
      if (root && root.leading && !root.history) {
        const accepted = await onOpen(root, opener, isCurrent);
        if (accepted && isCurrent()) {
          setSubitem(undefined);
          setError('');
        }
        return accepted;
      }
      setError('This task is no longer available in your leading work.');
      return true;
    },
    [rows, loading],
  );
  return <>
    {error && <p role="alert">{error}</p>}
    <SubtaskWorkDrawer subtask={subitem || null} parentTask={subitem?.parentTask}
      origin={origin} initialSection="work" onClose={() => setSubitem(undefined)} />
  </>;
}
