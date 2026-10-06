import { createContext, useContext } from 'react';

/** DOM presentation host only. Project controllers and records stay feature-owned. */
export const WorkspaceNavigationContext = createContext<{
  projectHost: HTMLElement | null;
  closeNavigation: () => void;
} | null>(null);
export const useWorkspaceNavigationHost = () => useContext(WorkspaceNavigationContext);
