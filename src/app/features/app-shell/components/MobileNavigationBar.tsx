import { BriefcaseBusiness, Building2, Home, Inbox, Menu } from 'lucide-react';
import { getPresentationGroup, type ShellNavigationItem } from '../../navigation';
export function MobileNavigationBar({ items, role, activeSection, onNavigate, onHome, onMore }: {
  items: ShellNavigationItem[]; role: string; activeSection: string; onNavigate: (section: string, page: string) => void; onHome: () => void; onMore: () => void;
}) {
  const group = getPresentationGroup(role, activeSection);
  return <nav className="eflow-mobile-navigation-bar" aria-label="Mobile primary navigation" data-tour-id="primary-navigation">
    <button type="button" aria-current={group === 'home' ? 'page' : undefined} onClick={onHome}><Home size={19} /><span>Home</span></button>
    {([['my-work', 'My Work', BriefcaseBusiness], ['workspaces', 'Projects', Building2], ['inbox', 'Inbox', Inbox]] as const).map(([id, label, Icon]) => {
      const item = items.find(item => item.group === id && (id !== 'workspaces' || item.id === 'projects'));
      return item ? <button key={id} type="button" data-tour-section={item.id} aria-current={group === id ? 'page' : undefined} onClick={() => onNavigate(item.id, item.pages[0].label)}><Icon size={19} /><span>{label}</span></button> : null;
    })}
    <button type="button" aria-current={['accounting','admin-center','account'].includes(group) ? 'page' : undefined} onClick={onMore}><Menu size={19} /><span>More</span></button>
  </nav>;
}
