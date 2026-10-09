import { Archive, Building2, ChevronDown, ChevronRight, ChevronsLeft, ChevronsRight, Folder, MoreHorizontal, Plus, Search, Star, Wrench } from 'lucide-react';
import { navigationGroupLabels, type NavigationGroupId, type ShellNavigationItem } from '../../navigation';
import { ActionMenu, WorkspacePopover } from '../../../components/ui/workspace';
import { useNavigationFavorites } from '../../../shared/navigationPreferences';
import { getEflowNavigationIcon } from '../eflowNavigationIcons';
import { type WorkspaceSectionId, useWorkspacePanelPreference } from '../workspacePanelPreferences';
import { WorkspaceProjectLinks, type WorkspaceProjectLink } from './WorkspaceProjectLinks';
import { useEffect, useState, type ReactNode } from 'react';
import { NAVIGATION_LOCATION_EVENT } from '../../../shared/navigationHistory';

const sections = {
  'office-tools': { label: 'Office tools', Icon: Wrench }, favorites: { label: 'Favorites', Icon: Star },
  projects: { label: 'Projects', Icon: Folder }, archived: { label: 'Archived projects', Icon: Archive },
};
export function WorkspaceNavigationPanel({ group, items, activeSection, activePage, workspaceName, userId, workspaceId, projects, projectsLoading, onPageSelect, onSearch, preference, mobile, workspaceSelector, workspaceKind }: {
  group: NavigationGroupId; items: ShellNavigationItem[]; activeSection: string; activePage?: string; workspaceName: string;
  userId: string; workspaceId: string; projects: WorkspaceProjectLink[]; projectsLoading: boolean;
  onPageSelect: (section: string, page: string, projectId?: string) => void; onSearch: () => void;
  preference: ReturnType<typeof useWorkspacePanelPreference>; mobile: boolean;
  workspaceSelector?: ReactNode; workspaceKind?: "office"|"personal";
}) {
  const scopedSections={...sections,"office-tools":{...sections["office-tools"],label:workspaceKind==="personal"?"Workspace tools":"Office tools"}};
  const [selectedProjectId, setSelectedProjectId] = useState<string>();
  useEffect(() => {
    const read = () => setSelectedProjectId(new URLSearchParams(window.location.search).get('project') || undefined);
    read(); window.addEventListener(NAVIGATION_LOCATION_EVENT, read); window.addEventListener('popstate', read);
    return () => { window.removeEventListener(NAVIGATION_LOCATION_EVENT, read); window.removeEventListener('popstate', read); };
  }, [workspaceId, userId]);
  const canOpenProjects = items.some(item => item.id === 'projects');
  const allowedProjects = canOpenProjects ? projects : [];
  const { favorites, toggle } = useNavigationFavorites(userId, workspaceId, allowedProjects.map(project => project.id), !projectsLoading);
  const collapsed = preference.value.collapsed && !mobile;
  const availableSections = (Object.keys(sections) as WorkspaceSectionId[]).filter(id => id === 'office-tools'
    ? items.some(item => item.group === 'workspaces' && item.id !== 'projects') : canOpenProjects);
  const contextItems = group === 'account' ? [{ id: 'settings', label: 'Account', group, icon: null, pages: ['Profile', 'Appearance', 'Notifications', 'Security'].map(label => ({ label })) }]
    : items.filter(item => item.group === group && group !== 'workspaces'&&(group!=='my-work'||item.id==='personal_work'));
  const destinations = (destinations: typeof contextItems) => destinations.map(item => {
    const Icon = getEflowNavigationIcon(item.id);
    return <div key={item.id} data-tour-section={item.id}>
      {item.pages.length > 1 && <h3>{item.label}</h3>}
      {item.pages.map(page => <button className="eflow-workspace-navigation__destination" type="button" key={page.label} aria-label={item.pages.length === 1 ? item.label : page.label} aria-current={activeSection === item.id && activePage === page.label ? 'page' : undefined} onClick={() => onPageSelect(item.id, page.label)}>
        <Icon size={17} aria-hidden="true" /><span>{item.pages.length === 1 ? item.label : page.label}</span>{'hasAlert' in item && item.hasAlert && <span className="eflow-navigation-alert" aria-label="Actions pending" />}
      </button>)}
    </div>;
  });
  const projectLinks = (subset: WorkspaceProjectLink[]) => <WorkspaceProjectLinks projects={subset} favorites={favorites}
    activeProjectId={activeSection === 'projects' ? selectedProjectId : undefined}
    onOpen={id => onPageSelect('projects', 'Projects', id)} onToggleFavorite={toggle} />;
  const sectionBody = (id: WorkspaceSectionId) => {
    if (id === 'office-tools') return destinations(items.filter(item => item.group === 'workspaces' && item.id !== 'projects'));
    if (projectsLoading) return <p role="status">Loading projects…</p>;
    const subset = allowedProjects.filter(project => id === 'favorites' ? favorites.has(project.id) : (project.status === 'archived') === (id === 'archived'));
    return <>{id === 'projects' && <button className="eflow-workspace-navigation__destination" type="button" data-tour-section="projects" onClick={() => onPageSelect('projects', 'Projects')}><Folder size={17} /><span>Open projects</span></button>}
      {projectLinks(subset)}{!subset.length && <p>{id === 'favorites' ? 'Star a project for quick access.' : id === 'archived' ? 'No archived projects.' : 'No active projects.'}</p>}</>;
  };
  return <section className="eflow-workspace-navigation eflow-scroll-region" aria-label="Workspace content">
    <header className="eflow-workspace-navigation__header">
      {!collapsed && <div className="eflow-workspace-navigation__selector-row">
        {workspaceSelector || (workspaceId === 'unassigned' ? <strong>{workspaceName}</strong> : <WorkspacePopover tooltip="Select workspace" trigger={<button type="button" className="eflow-workspace-selector" aria-label={`${workspaceName} Workspace`}><Building2 size={17} /><strong>{workspaceName} Workspace</strong><ChevronDown size={15} /></button>}>
          <p>Current workspace</p><p aria-current="true">{workspaceName} Workspace</p>
        </WorkspacePopover>)}
        <WorkspacePopover tooltip="Show or hide workspace sections" trigger={<button type="button" aria-label="Add or hide workspace sections"><Plus size={18} /></button>}>
          <p>Workspace sections</p>{availableSections.map(id => <label className="eflow-workspace-section-choice" key={id}><input type="checkbox" checked={preference.value.sections.includes(id)} onChange={() => preference.toggleSection(id)} />{scopedSections[id].label}</label>)}
        </WorkspacePopover>
      </div>}
      <div className="eflow-workspace-navigation__controls">
        {!collapsed && <><button type="button" className="eflow-workspace-navigation__destination" onClick={onSearch}><Search size={17} /><span>Search workspace</span></button>
          <ActionMenu trigger={<button type="button" aria-label="Workspace options"><MoreHorizontal size={18} /></button>} actions={[
            { id: 'search', label: 'Search workspace', onSelect: onSearch },
            ...availableSections.map(id => ({ id, label: `${preference.value.sections.includes(id) ? 'Hide' : 'Show'} ${scopedSections[id].label}`, onSelect: () => preference.toggleSection(id) })),
          ]} /></>}
        {!mobile && <button type="button" aria-label={collapsed ? 'Restore workspace sidebar' : 'Collapse workspace sidebar'} onClick={() => preference.setCollapsed(!collapsed)}>{collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}</button>}
      </div>
    </header>
    {!collapsed && <nav aria-label="Workspace destinations" className="eflow-workspace-navigation__destinations">
      {contextItems.length > 0 && <section aria-label={navigationGroupLabels[group]}><h2>{navigationGroupLabels[group]}</h2>{destinations(contextItems)}</section>}
      {preference.value.sections.filter(id => availableSections.includes(id)).map(id => {
        const { label, Icon } = scopedSections[id]; const open = !preference.value.closed.includes(id);
        return <section key={id} aria-label={label} className="eflow-workspace-section">
          <button type="button" className="eflow-workspace-section__disclosure" aria-expanded={open} aria-controls={`workspace-section-${id}`} onClick={() => preference.toggleDisclosure(id)}>
            {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}<Icon size={17} /><span>{label}</span>
          </button>
          <div id={`workspace-section-${id}`} hidden={!open}>{sectionBody(id)}</div>
        </section>;
      })}
    </nav>}
  </section>;
}
