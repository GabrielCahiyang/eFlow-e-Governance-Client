import { BriefcaseBusiness, Building2, Inbox, Menu, ShieldCheck, Wallet } from 'lucide-react';
import { getPresentationGroup,getContextEntry, type ShellNavigationItem,type NavigationGroupId } from '../../navigation';
export function MobileNavigationBar({ items, role, activeSection, onNavigate, onMore,onPrimarySelect }: {
  items: ShellNavigationItem[]; role: string; activeSection: string; onNavigate: (section: string, page: string) => void; onMore: () => void;
  onPrimarySelect?:(group:NavigationGroupId)=>void;
}) {
  const group = getPresentationGroup(role, activeSection);
  return <nav className="eflow-mobile-navigation-bar" aria-label="Mobile primary navigation" data-tour-id="primary-navigation">
    {([['my-work', 'My Work', BriefcaseBusiness], ['workspaces', 'Projects', Building2], ['inbox', 'Inbox', Inbox], ['accounting', 'Accounting', Wallet], ['admin-center', 'Admin Center', ShieldCheck]] as const).map(([id, label, Icon]) => {
      const item=getContextEntry(items,id,activeSection);
      return item ? <button key={id} type="button" data-tour-section={item.id} aria-current={group === id ? 'page' : undefined} onClick={() => onPrimarySelect?onPrimarySelect(id):onNavigate(item.id, item.pages[0].label)}><Icon size={19} /><span>{label}</span></button> : null;
    })}
    <button type="button" aria-current={group === 'account' ? 'page' : undefined} onClick={onMore}><Menu size={19} /><span>More</span></button>
  </nav>;
}
