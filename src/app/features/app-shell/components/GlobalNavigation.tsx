import { BriefcaseBusiness, Building2, CircleHelp, Home, Inbox, Search, Settings2, ShieldCheck, UserRound, Wallet } from 'lucide-react';
import { navigationGroupLabels, type NavigationGroupId, type ShellNavigationItem } from '../../navigation';
import eflowIcon from '../../../shared/branding/icon.svg';

const icons = { home: Home, 'my-work': BriefcaseBusiness, workspaces: Building2, inbox: Inbox, accounting: Wallet, 'admin-center': ShieldCheck, account: UserRound };
export function GlobalNavigation({ items, activeGroup, onSelect, onHome, onSearch, onProfile, onHelp }: {
  items: ShellNavigationItem[]; activeGroup: NavigationGroupId;
  onSelect: (group: NavigationGroupId) => void; onHome: () => void; onSearch: () => void; onProfile: () => void; onHelp: () => void;
}) {
  const groups = (['home', 'my-work', 'workspaces', 'inbox', 'accounting', 'admin-center'] as const).filter(group => group === 'home' || items.some(item => item.group === group));
  return <nav className="eflow-global-navigation eflow-scroll-region" aria-label="Global navigation">
    <img className="eflow-global-navigation__brand" alt="eFlow" src={eflowIcon} />
    {groups.map(group => {
      const Icon = icons[group]; const first = items.find(item => item.group === group);
      return <button key={group} type="button" aria-label={navigationGroupLabels[group]} data-tour-section={first?.id} aria-current={activeGroup === group ? 'page' : undefined} className="eflow-global-navigation__item" onClick={() => group === 'home' ? onHome() : onSelect(group)}>
        <span className="eflow-global-navigation__icon"><Icon size={21} aria-hidden="true" />{items.some(item => item.group === group && item.hasAlert) && <span className="eflow-navigation-alert" aria-label="Actions pending" />}</span>
        <span>{navigationGroupLabels[group]}</span>
      </button>;
    })}
    <button type="button" className="eflow-global-navigation__item" onClick={onSearch}><Search size={21} aria-hidden="true" /><span>Search</span></button>
    <div className="eflow-global-navigation__spacer" />
    <button type="button" className="eflow-global-navigation__item" onClick={onHelp}><CircleHelp size={21} aria-hidden="true" /><span>Help</span></button>
    <button type="button" className="eflow-global-navigation__item" aria-current={activeGroup === 'account' ? 'page' : undefined} onClick={onProfile}><Settings2 size={21} aria-hidden="true" /><span>Profile</span></button>
  </nav>;
}
