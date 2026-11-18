import type { ChecklistStep } from './types';
export function onboardingChecklist(role: string): ChecklistStep[] {
  if (role === 'admin') return [
    { id: 'account', label: 'Access Admin Center' },
    { id: 'users', label: 'Review People & Accounts', section: 'users', page: 'People & Accounts' },
    { id: 'roles', label: 'Configure Roles & Access', section: 'roles', page: 'Roles & Access' },
    { id: 'audit', label: 'Inspect Account Audit', section: 'audit', page: 'Account Audit' },
    { id: 'settings', label: 'Maintain System & Maintenance', section: 'system', page: 'System & Maintenance' },
  ];
  if (role === 'head') return [
    { id: 'account', label: 'Access your Office' }, { id: 'invite', label: 'Invite your first team member', section: 'team', page: 'Office Team' },
    { id: 'team', label: 'Review your Office Team', section: 'team', page: 'Office Team' },
    { id: 'projects', label: 'Explore Projects', section: 'projects', page: 'Projects' },
    { id: 'reviews', label: 'Explore Reviews', section: 'reviews', page: 'For Review' },
    { id: 'reports', label: 'Open Reports', section: 'reports', page: 'Reports' },
  ];
  if (role === 'accounting_staff') return [
    { id: 'account', label: 'Create your account' }, { id: 'work', label: 'Explore My Work', section: 'tasks', page: 'My Tasks' },
    { id: 'accounting', label: 'Open Accounting', section: 'accounting_overview', page: 'Accounting Overview' },
    { id: 'release', label: 'Review release workflow', section: 'accounting_releases', page: 'Voucher & Cash Releases' },
    { id: 'settlement', label: 'Review settlement workflow', section: 'accounting_releases', page: 'Voucher & Cash Releases' },
  ];
  return [
    { id: 'account', label: 'Create your account' }, { id: 'profile', label: 'Complete your professional profile', action: 'profile' },
    { id: 'work', label: 'Explore My Work', section: 'tasks', page: 'My Tasks' },
    { id: 'task', label: 'Open your first task', section: 'tasks', page: 'My Tasks' },
    { id: 'notifications', label: 'View notifications', action: 'notifications' },
    { id: 'evidence', label: 'Learn evidence submission', section: 'tasks', page: 'My Tasks', action: 'tour' },
  ];
}
