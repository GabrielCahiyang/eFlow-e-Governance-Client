import { isNavigationLocked } from "../../shared/navigationLock";
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
    const syncFromUrl = () => {
      if (isNavigationLocked()) { writeNavigationLocation(currentLocation.current.section, currentLocation.current.page, "replace"); return; }
      const next = readNavigationLocation(role, getInitialPage);
      currentLocation.current = next;
      setActiveSection(next.section);
      setActivePage(next.page);
      writeNavigationLocation(next.section, next.page, "replace");
    };

    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, [getInitialPage, role]);

  const selectPage = useCallback(
    (section: string, page: string) => {
      if (isNavigationLocked()) return;
      currentLocation.current = { section, page };
      setActiveSection(section);
      setActivePage(page);
      writeNavigationLocation(section, page, "push");
    },
    [],
  );

  return { activePage, activeSection, selectPage };
}
