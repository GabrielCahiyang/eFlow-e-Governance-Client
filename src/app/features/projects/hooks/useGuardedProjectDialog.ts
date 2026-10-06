import { requestNavigation, useNavigationBlocker } from '../../../shared/navigationGuard';

/** Keep lifecycle drafts until explicit discard; pending operations retain their surface. */
export function useGuardedProjectDialog({ open = true, dirty, pending, pendingCheck, onClose, onDiscard, label }: {
  open?: boolean; dirty: boolean; pending: boolean; pendingCheck?: () => boolean; onClose: () => void; onDiscard: () => void; label: string;
}) {
  useNavigationBlocker({ label, dirty: open && dirty, pending: open && pending, pendingCheck: () => open && Boolean(pendingCheck?.()), onDiscard: () => { onDiscard(); onClose(); } });
  return () => { void requestNavigation(() => { if (!dirty) onClose(); }); };
}
