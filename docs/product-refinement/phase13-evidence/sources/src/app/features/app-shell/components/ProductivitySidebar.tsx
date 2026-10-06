import { getPresentationGroup, type NavigationGroupId, type ShellNavigationItem } from '../../navigation';
import { GlobalNavigation } from './GlobalNavigation';
import { WorkspaceNavigationPanel } from './WorkspaceNavigationPanel';
export type { ShellNavigationItem } from '../../navigation';

/** Thin presentation adapter; permissions, routes and project state remain outside. */
export function ProductivitySidebar({ activePage, activeSection, navigationItems, onPageSelect, workspaceName = 'Organization not assigned', role = 'member', mobile = false, onHome, onSearch = () => {}, onHelp = () => {}, setProjectHost }: {
  activePage?: string; activeSection: string; navigationItems: ShellNavigationItem[];
  onPageSelect: (section: string, page: string) => void; workspaceName?: string; role?: string; mobile?: boolean;
  onHome?: () => void; onSearch?: () => void; onHelp?: () => void; setProjectHost?: (host: HTMLDivElement | null) => void;
}) {
  const group = getPresentationGroup(role, activeSection);
  const selectGroup = (next: NavigationGroupId) => {
    const preferred = next === 'my-work' ? 'personal_work' : next === 'inbox' ? 'inbox' : '';
    const item = navigationItems.find(item => item.id === preferred) || navigationItems.find(item => item.group === next && item.id === activeSection) || navigationItems.find(item => item.group === next);
    if (item) onPageSelect(item.id, item.id === activeSection ? activePage || item.pages[0].label : item.pages[0].label);
  };
  return <aside className={`eflow-productivity-sidebar${mobile ? ' eflow-productivity-sidebar--mobile' : ''}`} aria-label="Primary navigation" data-tour-id="primary-navigation" data-navigation-density="expanded">
    <GlobalNavigation items={navigationItems} activeGroup={group} onSelect={selectGroup} onHome={onHome || (() => selectGroup('home'))} onSearch={onSearch} onProfile={() => onPageSelect('settings', 'Profile')} onHelp={onHelp} />
    <WorkspaceNavigationPanel group={group} items={navigationItems} activeSection={activeSection} activePage={activePage} workspaceName={workspaceName} onPageSelect={onPageSelect} setProjectHost={setProjectHost} />
  </aside>;
}
