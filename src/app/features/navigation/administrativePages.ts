/** One support-page contract for discovery and direct content resolution. */
export const administrativePages = [
  { label: 'All Users', section: 'users', permission: 'navigation.user_management' },
  { label: 'Role Defaults', section: 'users', permission: 'navigation.user_management', adminOnly: true },
  { label: 'User Access', section: 'users', permission: 'navigation.user_management', adminOnly: true },
  { label: 'Office Structure', section: 'org_tree', permission: 'navigation.organization' },
  { label: 'Account Audit', section: 'audit', permission: 'navigation.audit' },
  { label: 'System Settings', section: 'administration', permission: 'navigation.system_settings' },
  { label: 'Backup & Export', section: 'migration', permission: 'navigation.data_tools' },
] as const;

export function getAuthorizedSupportPages(role: string, can: (permission: string) => boolean) {
  return administrativePages.filter(page => can(page.permission) && (!('adminOnly' in page) || role === 'admin'));
}

export function resolveSupportPage(section: string, page?: string) {
  if (section === 'permissions') return 'Role Defaults';
  if (section !== 'users') return administrativePages.find(item => item.section === section)?.label;
  return administrativePages.find(item => item.label === page)?.label || 'All Users';
}
