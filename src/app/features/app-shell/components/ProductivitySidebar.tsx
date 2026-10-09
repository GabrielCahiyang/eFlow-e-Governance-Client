import { getPresentationGroup, type NavigationGroupId, type ShellNavigationItem } from '../../navigation';
import { GlobalNavigation } from './GlobalNavigation';
import { WorkspaceNavigationPanel } from './WorkspaceNavigationPanel';
import { useWorkspacePanelPreference } from '../workspacePanelPreferences';
import type { WorkspaceProjectLink } from './WorkspaceProjectLinks';
import type { ReactNode } from 'react';
export type { ShellNavigationItem } from '../../navigation';

/** Thin presentation adapter; permissions, routes and project state remain outside. */
export function ProductivitySidebar({ activePage, activeSection, navigationItems, onPageSelect, workspaceName = 'Organization not assigned', role = 'member', mobile = false, onSearch = () => {}, onHelp = () => {}, userId = '', workspaceId = 'unassigned', projects = [], projectsLoading = false, workspaceSelector, workspaceKind }: {
  activePage?: string; activeSection: string; navigationItems: ShellNavigationItem[];
  onPageSelect: (section: string, page: string, projectId?: string) => void; workspaceName?: string; role?: string; mobile?: boolean;
  onSearch?: () => void; onHelp?: () => void;
  userId?: string; workspaceId?: string; projects?: WorkspaceProjectLink[]; projectsLoading?: boolean;
  workspaceSelector?: ReactNode; workspaceKind?: "office"|"personal";
}) {
  const group = getPresentationGroup(role, activeSection);
  const preference = useWorkspacePanelPreference(userId, workspaceId);
  const selectGroup = (next: NavigationGroupId) => {
    const preferred = next === 'my-work' ? 'personal_work' : next === 'inbox' ? 'inbox' : next === 'workspaces' ? 'projects' : '';
    const item = navigationItems.find(item => item.id === preferred) || navigationItems.find(item => item.group === next && item.id === activeSection) || navigationItems.find(item => item.group === next);
    if (item) onPageSelect(item.id, item.id === activeSection ? activePage || item.pages[0].label : item.pages[0].label);
  };
  return <aside className={`eflow-productivity-sidebar${mobile ? ' eflow-productivity-sidebar--mobile' : ''}${preference.value.collapsed && !mobile ? ' eflow-productivity-sidebar--collapsed' : ''}`} aria-label="Primary navigation" data-tour-id="primary-navigation" data-navigation-density={preference.value.collapsed && !mobile ? 'collapsed' : 'expanded'}>
    <GlobalNavigation items={navigationItems} activeGroup={group} onSelect={selectGroup} onProfile={() => onPageSelect('settings', 'Profile')} onHelp={onHelp} />
    <WorkspaceNavigationPanel group={group} items={navigationItems} activeSection={activeSection} activePage={activePage} workspaceName={workspaceName} onPageSelect={onPageSelect} onSearch={onSearch} preference={preference} mobile={mobile} userId={userId} workspaceId={workspaceId} projects={projects} projectsLoading={projectsLoading} workspaceSelector={workspaceSelector} workspaceKind={workspaceKind} />
  </aside>;
}
