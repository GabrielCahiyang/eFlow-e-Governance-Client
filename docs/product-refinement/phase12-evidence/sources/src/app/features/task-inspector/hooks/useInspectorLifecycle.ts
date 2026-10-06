import { useRef, useState } from 'react';
import { updateTaskStatus, type Task } from '../../tasks';
import { useAuth } from '../../../contexts/AuthContext';
import { requestNavigation, useNavigationBlocker } from '../../../shared/navigationGuard';
export function useInspectorLifecycle(task: Task | null, onChanged?: () => void, onClose?: () => void) {
 const { user, userProfile } = useAuth();
 const pending = useRef(false);
 const [busy, setBusy] = useState(false), [error, setError] = useState('');
 useNavigationBlocker({ dirty: false, pending: busy, pendingCheck: () => pending.current, label: 'Task lifecycle', onDiscard: () => {} });
 const execute = async () => {
  if (!task || pending.current) return;
  pending.current = true; setBusy(true); setError('');
  try { await updateTaskStatus(task.id, 'in_progress', user?.id ? { id: user.id, name: userProfile?.full_name || '' } : undefined); onChanged?.(); onClose?.(); }
  catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update this task.'); }
  finally { pending.current = false; setBusy(false); }
 };
 const start = () => { if (!pending.current) void requestNavigation(() => { void execute(); }); };
 return { busy, error, start };
}
