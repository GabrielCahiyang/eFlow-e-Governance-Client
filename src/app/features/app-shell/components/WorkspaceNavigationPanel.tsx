import { navigationGroupLabels, navigationGroupDescriptions, type NavigationGroupId, type ShellNavigationItem } from '../../navigation';
import { getEflowNavigationIcon } from '../eflowNavigationIcons';

export function WorkspaceNavigationPanel({ group, items, activeSection, activePage, workspaceName, onPageSelect, setProjectHost }: {
  group: NavigationGroupId; items: ShellNavigationItem[]; activeSection: string; activePage?: string; workspaceName: string;
  onPageSelect: (section: string, page: string) => void; setProjectHost?: (host: HTMLDivElement | null) => void;
}) {
  const contextItems = group === 'account' ? [{ id: 'settings', label: 'Account', group, icon: null, pages: ['Profile', 'Appearance', 'Notifications', 'Security'].map(label => ({ label })) }] : items.filter(item => item.group === group);
  const destinations = contextItems.filter(item => !(activeSection === 'projects' && item.id === 'projects' && setProjectHost)).map(item => {
    const Icon = getEflowNavigationIcon(item.id);
    return <div key={item.id} data-tour-section={item.id}>
      {item.pages.length > 1 && <h3>{item.label}</h3>}
      {item.pages.map(page => <button className="eflow-workspace-navigation__destination" type="button" key={page.label} aria-label={item.pages.length === 1 ? item.label : page.label} aria-current={activeSection === item.id && activePage === page.label ? 'page' : undefined} onClick={() => onPageSelect(item.id, page.label)}>
        <Icon size={17} aria-hidden="true" /><span>{item.pages.length === 1 ? item.label : page.label}</span>{'hasAlert' in item && item.hasAlert && <span className="eflow-navigation-alert" aria-label="Actions pending" />}
      </button>)}
    </div>;
  });
  return <section className="eflow-workspace-navigation eflow-scroll-region" aria-label="Workspace content">
    <header className="eflow-workspace-navigation__header">
      <p>Current context</p><strong title={workspaceName}>{workspaceName}</strong>
      <h2>{navigationGroupLabels[group]}</h2>
      {navigationGroupDescriptions[group] && <p>{navigationGroupDescriptions[group]}</p>}
    </header>
    <nav aria-label="Workspace destinations" className="eflow-workspace-navigation__destinations">
      {activeSection === 'projects' && destinations.length > 0 ? <details className="eflow-workspace-navigation__office-tools"><summary>Office tools</summary>{destinations}</details> : destinations}
    </nav>
    {activeSection === 'projects' && setProjectHost && <div className="eflow-workspace-navigation__project-host" ref={setProjectHost} />}
  </section>;
}
