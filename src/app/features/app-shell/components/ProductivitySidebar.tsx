import { getPresentationGroup,getContextEntry, type NavigationGroupId, type ShellNavigationItem,type NavigationRestore } from '../../navigation';
import {useContextDestinations} from '../useContextDestinations';
import { GlobalNavigation } from './GlobalNavigation';
import { ContextRail } from './ContextRail';
import { useWorkspacePanelPreference } from '../workspacePanelPreferences';
import type { WorkspaceProjectLink } from './WorkspaceProjectLinks';
import type { ReactNode } from 'react';
export type { ShellNavigationItem } from '../../navigation';

/** Thin presentation adapter; permissions, routes and project state remain outside. */
export function ProductivitySidebar({ activePage, activeSection, navigationItems, personalToolItems, onPageSelect,onPrimarySelect, workspaceName = 'Organization not assigned', role = 'member', mobile = false, onSearch = () => {}, onHelp = () => {}, userId = '', workspaceId = 'unassigned', projects = [], projectsLoading = false, workspaceSelector, workspaceKind }: {
  activePage?: string; activeSection: string; navigationItems: ShellNavigationItem[];
  personalToolItems?: ShellNavigationItem[];
  onPageSelect: (section: string, page: string, projectId?: string,restore?:NavigationRestore) => void; workspaceName?: string; role?: string; mobile?: boolean;
  onSearch?: () => void; onHelp?: () => void;
  userId?: string; workspaceId?: string; projects?: WorkspaceProjectLink[]; projectsLoading?: boolean;
  workspaceSelector?: ReactNode; workspaceKind?: "office"|"personal";
  onPrimarySelect?:(group:NavigationGroupId)=>void;
}) {
  const group = getPresentationGroup(role, activeSection);
  const preference = useWorkspacePanelPreference(userId, group==='workspaces'?workspaceId:`context:${group}`);
  const remembered=useContextDestinations({user:userId,role,group,section:activeSection,page:activePage,workspaceId,items:navigationItems,loading:projectsLoading,enabled:!onPrimarySelect});
  const selectGroup = (next: NavigationGroupId) => {
    if(onPrimarySelect){onPrimarySelect(next);return;}
    const saved=next!==group?remembered(next):undefined;
    if(saved){onPageSelect(saved.section,saved.page,saved.parameters.project,saved);return;}
    const item=getContextEntry(navigationItems,next,activeSection);
    if (item) onPageSelect(item.id, item.id === activeSection ? activePage || item.pages[0].label : item.pages[0].label);
  };
  return <aside className={`eflow-productivity-sidebar${mobile ? ' eflow-productivity-sidebar--mobile' : ''}${preference.value.collapsed && !mobile ? ' eflow-productivity-sidebar--collapsed' : ''}`} aria-label="Primary navigation" data-tour-id="primary-navigation" data-navigation-density={preference.value.collapsed && !mobile ? 'collapsed' : 'expanded'}>
    <GlobalNavigation items={navigationItems} activeGroup={group} onSelect={selectGroup} onProfile={() => onPageSelect('settings', 'Profile')} onHelp={onHelp} />
    <ContextRail role={role} group={group} items={navigationItems} personalToolItems={personalToolItems} activeSection={activeSection} activePage={activePage} workspaceName={workspaceName} onPageSelect={onPageSelect} onSearch={onSearch} preference={preference} mobile={mobile} userId={userId} workspaceId={workspaceId} projects={projects} projectsLoading={projectsLoading} workspaceSelector={workspaceSelector} workspaceKind={workspaceKind} />
  </aside>;
}
