import { isNavigationLocked } from "../../shared/navigationLock";
import { hasDirtyNavigation, requestNavigation } from '../../shared/navigationGuard';
import { NAVIGATION_LOCATION_EVENT, replaceNavigationHistory } from '../../shared/navigationHistory';
import { useCallback, useEffect, useRef, useState } from "react";
import { getDefaultSection } from "./roleNavigation";
import {
  readNavigationLocation,
  type NavigationLocation,
  writeNavigationLocation,
} from "./navigationUrl";

export function useRoleNavigationState(
  role: string,
  getInitialPage: (section: string) => string | undefined,
) {
  const [activeSection, setActiveSection] = useState(() => {
    if (typeof window === "undefined") return getDefaultSection(role);
    return readNavigationLocation(role, getInitialPage).section;
  });
  const [activePage, setActivePage] = useState<string | undefined>(() => {
    if (typeof window === "undefined") return getInitialPage(getDefaultSection(role));
    return readNavigationLocation(role, getInitialPage).page;
  });

  const currentLocation = useRef<NavigationLocation>({ section: activeSection, page: activePage });
  useEffect(() => {
    let currentHref = window.location.href;
    let currentIndex = window.history.state?.eflowIndex ?? 0;
    let restoring = false;
    let replaying = false;
    let waitingForRestore: (() => void) | undefined;
    const syncFromUrl = () => {
      if (isNavigationLocked()) { writeNavigationLocation(currentLocation.current.section, currentLocation.current.page, "replace"); return; }
      const next = readNavigationLocation(role, getInitialPage);
      currentLocation.current = next;
      setActiveSection(next.section);
      setActivePage(next.page);
      writeNavigationLocation(next.section, next.page, "replace");
      currentHref = window.location.href;
      currentIndex = window.history.state?.eflowIndex ?? 0;
    };
    const onPopState = (event: PopStateEvent) => {
      if (restoring) { event.stopImmediatePropagation(); restoring = false; waitingForRestore?.(); return; }
      if (replaying) { replaying = false; syncFromUrl(); window.dispatchEvent(new Event(NAVIGATION_LOCATION_EVENT)); return; }
      if (!hasDirtyNavigation() && !isNavigationLocked()) { syncFromUrl(); window.dispatchEvent(new Event(NAVIGATION_LOCATION_EVENT)); return; }
      event.stopImmediatePropagation();
      const requestedHref = window.location.href;
      const requestedIndex = window.history.state?.eflowIndex;
      const delta = typeof requestedIndex === 'number' ? requestedIndex - currentIndex : 0;
      if (delta) {
        restoring = true;
        const restored = new Promise<void>(resolve => { waitingForRestore = resolve; });
        window.history.go(-delta);
        void restored.then(() => requestNavigation(() => { replaying = true; window.history.go(delta); }));
      } else {
        replaceNavigationHistory(currentHref);
        void requestNavigation(() => { replaceNavigationHistory(requestedHref); syncFromUrl(); window.dispatchEvent(new Event(NAVIGATION_LOCATION_EVENT)); });
      }
    };

    replaceNavigationHistory(window.location.href);
    syncFromUrl();
    window.addEventListener('popstate', onPopState, true);
    window.addEventListener(NAVIGATION_LOCATION_EVENT, syncFromUrl);
    return () => { window.removeEventListener('popstate', onPopState, true); window.removeEventListener(NAVIGATION_LOCATION_EVENT, syncFromUrl); };
  }, [getInitialPage, role]);

  const selectPageAsync = useCallback(
    (section: string, page: string, context?: { project?: string; view?: string }) => requestNavigation(() => {
      currentLocation.current = { section, page };
      setActiveSection(section);
      setActivePage(page);
      writeNavigationLocation(section, page, "push", context);
    }),
    [],
  );

  const selectPage = useCallback((section: string, page: string) => { void selectPageAsync(section, page); }, [selectPageAsync]);
  return { activePage, activeSection, selectPage, selectPageAsync };
}
