import { createContext, useContext } from 'react';

/** The shell owns persistent project links; project workflows can close its mobile drawer. */
export const WorkspaceNavigationContext = createContext<{
  closeNavigation: () => void;
} | null>(null);
export const useWorkspaceNavigationHost = () => useContext(WorkspaceNavigationContext);
