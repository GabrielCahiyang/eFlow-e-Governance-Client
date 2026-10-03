import { useCurrentUserTasks } from '../../../../hooks/useCurrentUserTasks';

export function useMyTasks() {
  const { tasks, loading } = useCurrentUserTasks();
  return { mine: tasks, loading };
}

// ══════════════════════ My Tasks ══════════════════════════════════
// Active work with a detail drawer that exposes progress updates + discussion.
