import { readableUiError } from '../../../shared/userFacingError';
import { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { requestNavigation } from '../../../shared/navigationGuard';
import { fetchNotificationSubitem, resolveNotificationSubitem, useNotificationNavigationIntent } from '../../notifications';
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
  const [subitemSection, setSubitemSection] = useState<'work' | 'review'>('work');
  const [origin, setOrigin] = useState<TaskInspectorOrigin>();
  const [error, setError] = useState('');
  useNotificationNavigationIntent(
    intent =>
      intent.kind === 'leading_task' ||
      intent.kind === 'personal_work' ||
      intent.kind === 'subtask' ||
      intent.kind === 'task' ||
      (intent.kind === 'budget' && Boolean(intent.taskId)),
    async (intent, isCurrent) => {
      if (loading) return false;
      const opener = document.activeElement instanceof HTMLElement ? document.activeElement : document.body;
      if (intent.kind === 'task' || intent.kind === 'budget') {
        const taskRow =
          rows.find(row => row.id === intent.taskId && row.kind.endsWith('task')) ||
          rows.find(row => row.rootId === intent.taskId && row.kind.endsWith('task'));
        if (taskRow) {
          const accepted = await onOpen(taskRow, opener, isCurrent);
          if (accepted && isCurrent()) {
            setSubitem(undefined);
            setError('');
          }
          return accepted;
        }
        setError('This task is no longer available in your accessible work.');
        return true;
      }
      if (intent.kind === 'subtask') {
        if (intent.entityId) {
          const direct = rows.find(row => row.kind === 'office-node' && row.id === intent.entityId);
          if (direct) {
            const accepted = await onOpen(direct, opener, isCurrent);
            if (accepted && isCurrent()) { setSubitem(undefined); setError(''); }
            return accepted;
          }
          try {
            const root = rows.find(row => row.kind === 'office-task' && row.id === intent.taskId);
            const record = await fetchNotificationSubitem(intent, user?.id || '', root?.task);
            if (!isCurrent()) return false;
            return requestNavigation(() => {
              if (!isCurrent()) return;
              const nextSection = intent.inspectorSection ?? 'work';
              setSubitem(record);
              setSubitemSection(nextSection);
              setOrigin({ view: 'My Work', section: nextSection, returnFocus: opener,
                restoreFocus: () => document.getElementById('personal-work-search')?.focus() });
              setError('');
            });
          } catch (caught) {
            if (!isCurrent()) return false;
            return requestNavigation(() => {
              if (!isCurrent()) return;
              setSubitem(undefined);
              setError(readableUiError(caught, "This subtask is no longer available to your account.", 'read'));
            });
          }
        }
        const candidates = rows
          .filter(row => row.kind === 'office-node' && (!intent.taskId || row.rootId === intent.taskId))
          .map(row => ({ id: row.id, taskId: row.rootId, title: row.title, row }));
        const resolved = resolveNotificationSubitem(intent, candidates);
        if (resolved.status === 'resolved') {
          const accepted = await onOpen(resolved.item.row, opener, isCurrent);
          if (accepted && isCurrent()) { setSubitem(undefined); setError(''); }
          return accepted;
        }
        setError('This subtask is no longer available in your assigned subtasks.');
        return true;
      }
      if (intent.kind === 'personal_work') {
        const target = rows.find(row => row.rootId === intent.taskId && (!intent.projectId || row.projectId === intent.projectId)
          && (intent.entityId ? row.kind === 'personal-node' && row.id === intent.entityId : row.kind === 'personal-task'));
        if (!target) { setError('This personal work is unavailable. Refresh My Work to check your current project access.'); return true; }
        const accepted = await onOpen(target, opener, isCurrent);
        if (accepted && isCurrent()) setError('');
        return accepted;
      }
      const root = rows.find(row => row.kind === 'office-task' && row.id === intent.taskId);
      if (intent.entityId) {
        try {
          const record = await fetchNotificationSubitem(intent, user?.id || '', root?.task);
          if (!isCurrent()) return false;
          return requestNavigation(() => {
            if (!isCurrent()) return;
            const nextSection = intent.inspectorSection ?? 'work';
            setSubitem(record);
            setSubitemSection(nextSection);
            setOrigin({ view: 'My Work', section: nextSection, returnFocus: opener,
              restoreFocus: () => document.getElementById('personal-work-search')?.focus() });
            setError('');
          });
        } catch (caught) {
          if (!isCurrent()) return false;
          return requestNavigation(() => {
            if (!isCurrent()) return;
            setSubitem(undefined);
            setError(readableUiError(caught, "This subtask is no longer available to your account.", 'write'));
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
    {subitem && (
      <SubtaskWorkDrawer
        subtask={subitem}
        parentTask={subitem.parentTask}
        origin={origin}
        initialSection={subitemSection}
        onClose={() => setSubitem(undefined)}
      />
    )}
  </>;
}
