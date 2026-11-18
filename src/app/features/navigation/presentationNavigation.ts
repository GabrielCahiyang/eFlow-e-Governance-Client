import { getRoleNavigationCandidates, isRoleNavigationItemVisible, type RoleNavItem } from './roleNavigation';
import { canOpenNavigationSection, isAdministrativeNavigationSection } from './navigationPermissions';
import { getSidebarContent } from './sidebarContent';
import { pageDisplayLabel } from './pageDisplayLabel';
import { administrativeSubPages, getAuthorizedSupportPages, resolveSupportPage } from './administrativePages';

export type NavigationGroupId = 'my-work' | 'workspaces' | 'inbox' | 'accounting' | 'admin-center' | 'account';
export interface ShellNavigationItem extends RoleNavItem {
  group: NavigationGroupId;
  pages: { label: string }[];
  hasAlert?: boolean;
}
export const navigationGroupLabels: Record<NavigationGroupId, string> = {
  'my-work': 'My Work', workspaces: 'Workspace', inbox: 'Inbox',
  accounting: 'Accounting', 'admin-center': 'Admin Center', account: 'Profile & Settings',
};
export const navigationGroupDescriptions: Partial<Record<NavigationGroupId, string>> = {
  'my-work': 'Your personal tasks, deadlines, leadership and work history.',
  inbox: 'Personal review actions and recent updates, with their existing workflow owners.',
  workspaces: 'Office workspace tools, pages, and projects you can access.',
  'admin-center': 'Account and system support under your granted permissions.',
};
export function getContextEntry(items:ShellNavigationItem[],group:NavigationGroupId,activeSection:string){
 const preferred=group==='my-work'?'personal_work':group==='inbox'?'inbox':group==='workspaces'?'projects':'';
 return items.find(item=>item.id===preferred)||items.find(item=>item.group===group&&item.id===activeSection)||items.find(item=>item.group===group);
}

export function getPresentationGroup(role: string, section: string): NavigationGroupId {
  if (section === 'settings') return 'account';
  if (section === 'users' || section === 'permissions' || isAdministrativeNavigationSection(section)) return 'admin-center';
  if (section.startsWith('accounting_')) return 'accounting';
  if (section === 'dashboard' || section === 'command') return 'workspaces';
  if (section === 'inbox' || section === 'messages' || section === 'reviews') return 'inbox';
  if (['projects', 'budget', 'team', 'identity', 'intelligence'].includes(section) || (role === 'head' && ['tasks', 'reports'].includes(section))) return 'workspaces';
  return 'my-work';
}

export function buildShellNavigation({ role, persistedRole = role, can, hasLeadingWork = false, alerts = {} }: {
  role: string; persistedRole?: string; can: (permission: string) => boolean; hasLeadingWork?: boolean;
  alerts?: { projects?: boolean; reviews?: boolean };
}): ShellNavigationItem[] {
  return getRoleNavigationCandidates(role)
    .filter(item => item.id !== 'announcements')
    .filter(item => isRoleNavigationItemVisible(item, hasLeadingWork, persistedRole) && canOpenNavigationSection(role, item.id, can, Boolean(hasLeadingWork && (item.requiresLeadership || item.id === 'personal_work'))))
    .filter(item=>item.id!=='intelligence'||!canOpenNavigationSection(role,'team',can,false))
    .filter(item=>item.id!=='identity'||!canOpenNavigationSection(role,'team',can,false))
    .filter(item=>!(role==='head'&&item.id==='reports'&&(canOpenNavigationSection(role,'team',can,false)||canOpenNavigationSection(role,'intelligence',can,false))))
    .map(item => {
      let pages = getSidebarContent(role, item.id).sections.flatMap(group => group.items.map(page => ({ label: page.label })));
      if (item.id === 'users') pages = getAuthorizedSupportPages(role, can).filter(page => (role === 'admin' || page.section === 'users') && page.label !== 'Backup & Export').map(page => ({ label: page.label }));
      else if (isAdministrativeNavigationSection(item.id)) {
        const support = getAuthorizedSupportPages(role, can).filter(page => page.section === item.id && page.label !== 'Backup & Export');
        pages = support.length ? support.map(page => ({ label: page.label })) : [{ label: resolveSupportPage(item.id) || item.label }];
      }
      return { ...item, label: item.id === 'dashboard' ? 'Workspace Overview' : item.label, group: getPresentationGroup(role, item.id), pages: pages.length ? pages : [{ label: item.label }], hasAlert: item.id === 'projects' ? alerts.projects : item.id === 'reviews' ? alerts.reviews : false };
    });
}

/** Only searches already authorized, loaded presentation records. Never fetches. */
export function searchNavigation(query: string, items: ShellNavigationItem[], projects: { id: string; title: string }[]) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];
  const destinations = items.flatMap(item => item.pages.map(page => ({ id: `${item.id}:${page.label}`, title: pageDisplayLabel(item.id, page.label), kind: navigationGroupLabels[item.group], section: item.id, page: page.label, projectId: undefined as string | undefined })));
  const isAdmin = items.some(item => item.pages.some(page => page.label === 'Roles & Access'));
  for (const sub of administrativeSubPages) {
    if ('adminOnly' in sub && sub.adminOnly && !isAdmin) continue;
    if (!items.some(item => item.id === sub.section)) continue;
    if (!destinations.some(entry => entry.title === sub.label)) {
      destinations.push({ id: `${sub.section}:sub:${sub.label}`, title: sub.label, kind: sub.kind, section: sub.section, page: sub.page, projectId: undefined });
    }
  }
  if (items.some(item => item.id === 'projects')) destinations.push(...projects.map(project => ({ id: project.id, title: project.title, kind: 'Project', section: 'projects', page: 'Projects', projectId: project.id })));
  return destinations.filter(item => `${item.title} ${item.kind} ${item.page}`.toLocaleLowerCase().includes(needle)).slice(0, 50);
}
