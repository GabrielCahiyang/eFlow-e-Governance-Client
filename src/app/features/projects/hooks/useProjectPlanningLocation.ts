import { useCallback, useEffect } from 'react';
import { NAVIGATION_LOCATION_EVENT, pushNavigationHistory } from '../../../shared/navigationHistory';

export type ProjectPlanningView = 'portfolio' | 'drafts' | 'signoff';
export function readProjectPlanningView(): ProjectPlanningView {
  const params = new URLSearchParams(window.location.search);
  if (window.location.pathname !== '/projects' || params.has('project')) return 'portfolio';
  return params.get('plans') === 'saved' ? 'drafts' : params.get('plans') === 'review' ? 'signoff' : 'portfolio';
}

/** Contextual proposal workflows retain refresh/history without becoming sidebar destinations. */
export function useProjectPlanningLocation(onView: (view: ProjectPlanningView) => void) {
  useEffect(() => {
    const restore = () => { if (window.location.pathname === '/projects') onView(readProjectPlanningView()); };
    restore(); window.addEventListener(NAVIGATION_LOCATION_EVENT, restore);
    return () => window.removeEventListener(NAVIGATION_LOCATION_EVENT, restore);
  }, [onView]);
  return useCallback((view: 'drafts' | 'signoff') => {
    const url = new URL(window.location.href);
    url.pathname = '/projects'; url.searchParams.set('page', 'Projects');
    url.searchParams.delete('project'); url.searchParams.delete('view');
    url.searchParams.set('plans', view === 'drafts' ? 'saved' : 'review');
    pushNavigationHistory(`${url.pathname}${url.search}${url.hash}`);
  }, []);
}
