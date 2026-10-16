import type { ShellNavigationItem } from '../navigation';
/** Group only supplied, authorized destinations. No routes or authority are added. */
export function groupOfficeTools(items: ShellNavigationItem[]) {
  const groups = [
    { label: 'Office', ids: ['dashboard', 'overview', 'tasks', 'budget'] },
    { label: 'People', ids: ['team', 'identity', 'intelligence'] },
    { label: 'Reports', ids: ['reports'] },
  ];
  const tools = items.filter(item => item.group === 'workspaces' && item.id !== 'projects');
  return [...groups.map(group => ({ label: group.label, items: group.ids.flatMap(id => tools.filter(item => item.id === id)) })),
    { label: 'Other Office tools', items: tools.filter(item => !groups.some(group => group.ids.includes(item.id))) },
  ].filter(group => group.items.length > 0);
}
