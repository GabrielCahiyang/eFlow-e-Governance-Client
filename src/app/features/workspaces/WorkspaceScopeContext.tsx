import { createContext, useContext } from 'react';
import type { Workspace } from './types';
export const WorkspaceScopeContext = createContext<{ workspace: Workspace; userId: string; officeProjectIds: string[]; projectIds?: string[]; includeCreatedOfficeProject?: (project:{id:string;title:string;status:string;orgId?:string})=>void } | null>(null);
export const useWorkspaceScope = () => useContext(WorkspaceScopeContext);
