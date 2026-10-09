import { useEffect } from 'react';
import { NAVIGATION_LOCATION_EVENT } from '../../../shared/navigationHistory';

/** Restore project context from accepted URLs using the existing access-filtered list. */
export function useProjectLocation({ projects, loading, activeProjectId, onOpen, onUnavailable, workspaceId }: {
  projects: { id: string }[]; loading: boolean; activeProjectId?: string;
  onOpen: (id: string, historyMode: false) => void; onUnavailable: (id: string) => void;
  workspaceId?: string;
}) {
  useEffect(() => {
    const restore = () => {
      if (loading || window.location.pathname !== '/projects') return;
      // The old mounted Office must not rewrite a destination in a newly selected home.
      if(workspaceId && new URLSearchParams(window.location.search).get('workspace')!==workspaceId)return;
      const id = new URLSearchParams(window.location.search).get('project');
      if (!id) return;
      if (!projects.some(project => project.id === id)) onUnavailable(id);
      else if (id !== activeProjectId) onOpen(id, false);
    };
    restore(); window.addEventListener(NAVIGATION_LOCATION_EVENT, restore);
    return () => window.removeEventListener(NAVIGATION_LOCATION_EVENT, restore);
  }, [projects, loading, activeProjectId, onOpen, onUnavailable,workspaceId]);
}
