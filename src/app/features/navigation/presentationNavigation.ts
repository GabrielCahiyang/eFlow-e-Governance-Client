import { getRoleNavigationCandidates, isRoleNavigationItemVisible, type RoleNavItem } from './roleNavigation';
import { canOpenNavigationSection, isAdministrativeNavigationSection } from './navigationPermissions';
import { getSidebarContent } from './sidebarContent';
import { getAuthorizedSupportPages, resolveSupportPage } from './administrativePages';

export type NavigationGroupId = 'home' | 'my-work' | 'workspaces' | 'inbox' | 'accounting' | 'admin-center' | 'account';
export interface ShellNavigationItem extends RoleNavItem {
  group: NavigationGroupId;
  pages: { label: string }[];
  hasAlert?: boolean;
}
export const navigationGroupLabels: Record<NavigationGroupId, string> = {
  home: 'Home', 'my-work': 'My Work', workspaces: 'Workspaces', inbox: 'Inbox',
  accounting: 'Accounting', 'admin-center': 'Admin Center', account: 'Profile & Settings',
};
export const navigationGroupDescriptions: Partial<Record<NavigationGroupId, string>> = {
  'my-work': 'Your personal tasks, deadlines, leadership and work history.',
  inbox: 'Personal review actions and recent updates, with their existing workflow owners.',
  workspaces: 'Existing Office context and all projects you can access, including shared projects.',
  'admin-center': 'Account and system support under your granted permissions.',
};

export function getPresentationGroup(role: string, section: string): NavigationGroupId {
  if (section === 'settings') return 'account';
  if (section === 'users' || section === 'permissions' || isAdministrativeNavigationSection(section)) return 'admin-center';
  if (section.startsWith('accounting_')) return 'accounting';
  if (section === 'dashboard' || section === 'command') return 'home';
  if (section === 'inbox' || section === 'reviews' || section === 'announcements') return 'inbox';
  if (['projects', 'budget', 'team', 'identity', 'intelligence'].includes(section) || (role === 'head' && ['tasks', 'reports'].includes(section))) return 'workspaces';
  return 'my-work';
}

export function buildShellNavigation({ role, persistedRole = role, can, hasLeadingWork = false, alerts = {} }: {
  role: string; persistedRole?: string; can: (permission: string) => boolean; hasLeadingWork?: boolean;
  alerts?: { projects?: boolean; reviews?: boolean };
}): ShellNavigationItem[] {
  return getRoleNavigationCandidates(role)
    .filter(item => isRoleNavigationItemVisible(item, hasLeadingWork, persistedRole) && canOpenNavigationSection(role, item.id, can, Boolean(hasLeadingWork && (item.requiresLeadership || item.id === 'personal_work'))))
    .map(item => {
      let pages = getSidebarContent(role, item.id).sections.flatMap(group => group.items.map(page => ({ label: page.label })));
      if (item.id === 'users') pages = getAuthorizedSupportPages(role, can).filter(page => role === 'admin' || page.section === 'users').map(page => ({ label: page.label }));
      else if (isAdministrativeNavigationSection(item.id)) pages = [{ label: resolveSupportPage(item.id) || item.label }];
      return { ...item, group: getPresentationGroup(role, item.id), pages: pages.length ? pages : [{ label: item.label }], hasAlert: item.id === 'projects' ? alerts.projects : item.id === 'reviews' ? alerts.reviews : false };
    });
}

/** Only searches already authorized, loaded presentation records. Never fetches. */
export function searchNavigation(query: string, items: ShellNavigationItem[], projects: { id: string; title: string }[]) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];
  const destinations = items.flatMap(item => item.pages.map(page => ({ id: `${item.id}:${page.label}`, title: page.label, kind: navigationGroupLabels[item.group], section: item.id, page: page.label, projectId: undefined as string | undefined })));
  if (items.some(item => item.id === 'projects')) destinations.push(...projects.map(project => ({ id: project.id, title: project.title, kind: 'Project', section: 'projects', page: 'Projects', projectId: project.id })));
  return destinations.filter(item => `${item.title} ${item.kind}`.toLocaleLowerCase().includes(needle)).slice(0, 50);
}
