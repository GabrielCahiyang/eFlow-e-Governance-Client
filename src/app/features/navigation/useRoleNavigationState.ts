import { isNavigationLocked } from "../../shared/navigationLock";
import { hasDirtyNavigation, requestNavigation } from '../../shared/navigationGuard';
import { NAVIGATION_LOCATION_EVENT, replaceNavigationHistory } from '../../shared/navigationHistory';
import { useCallback, useEffect, useRef, useState } from "react";
import { getDefaultSection } from "./roleNavigation";
import {claimNavigationIdentity,isForeignNavigationActor} from '../../shared/navigationIdentity';
import {
  readNavigationLocation,
  type NavigationLocation,
  writeNavigationLocation,
} from "./navigationUrl";

export function useRoleNavigationState(
  role: string,
  getInitialPage: (section: string) => string | undefined,
  actorId?: string,
) {
  const readLocation = () => {
    const differentActor = actorId && typeof window !== 'undefined' && isForeignNavigationActor(actorId,role);
    const section = getDefaultSection(role);
    return differentActor ? {section, page: getInitialPage(section)} : readNavigationLocation(role, getInitialPage);
  };
  const [activeSection, setActiveSection] = useState(() => {
    if (typeof window === "undefined") return getDefaultSection(role);
    return readLocation().section;
  });
  const [activePage, setActivePage] = useState<string | undefined>(() => {
    if (typeof window === "undefined") return getInitialPage(getDefaultSection(role));
    return readLocation().page;
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
      if(actorId) claimNavigationIdentity(actorId,role);
      const next = readLocation();
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
  }, [getInitialPage, role, actorId]);

  const selectPageAsync = useCallback(
    async (section: string, page: string, context?: { project?: string; view?: string;parameters?:Record<string,string>;isCurrent?:()=>boolean }) => {
      let moved=false;
      const accepted=await requestNavigation(() => {
      if(context?.isCurrent?.()===false)return;
      moved=true;
      currentLocation.current = { section, page };
      setActiveSection(section);
      setActivePage(page);
      writeNavigationLocation(section, page, "push", context);
    });return accepted&&moved;},
    [],
  );

  const selectPage = useCallback((section: string, page: string) => { void selectPageAsync(section, page); }, [selectPageAsync]);
  return { activePage, activeSection, selectPage, selectPageAsync };
}
