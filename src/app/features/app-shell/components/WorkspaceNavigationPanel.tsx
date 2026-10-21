import { Archive, Building2, ChevronDown, ChevronRight, Folder, MoreHorizontal, Search, Star, Wrench } from 'lucide-react';
import { type NavigationGroupId, type ShellNavigationItem } from '../../navigation';
import { ActionMenu, WorkspacePopover } from '../../../components/ui/workspace';
import { useNavigationFavorites } from '../../../shared/navigationPreferences';
import { getEflowNavigationIcon } from '../eflowNavigationIcons';
import { type WorkspaceSectionId, useWorkspacePanelPreference } from '../workspacePanelPreferences';
import { WorkspaceProjectLinks, type WorkspaceProjectLink } from './WorkspaceProjectLinks';
import { useEffect, useState, type ReactNode } from 'react';
import { NAVIGATION_LOCATION_EVENT } from '../../../shared/navigationHistory';
import {ContextRailHeader} from './ContextRailHeader';
import { groupOfficeTools } from '../officeToolGroups';

const sections = {
  'office-tools': { label: 'Office tools', Icon: Wrench }, favorites: { label: 'Favorites', Icon: Star },
  projects: { label: 'Projects', Icon: Folder }, archived: { label: 'Archived projects', Icon: Archive },
};
export function WorkspaceNavigationPanel({ items, activeSection, activePage, workspaceName, userId, workspaceId, projects, projectsLoading, onPageSelect, onSearch, preference, mobile, workspaceSelector, workspaceKind }: {
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
  const destinations = (destinations: ShellNavigationItem[]) => destinations.map(item => {
    return <div key={item.id} data-tour-section={item.id}>
      {item.pages.map(page => {const Icon=getEflowNavigationIcon(item.id,page.label);const label=workspaceKind !== 'personal' && item.id === 'tasks' && item.pages.length === 1 ? 'Office tasks' : item.pages.length === 1 ? item.label : page.label;return <button className="eflow-workspace-navigation__destination" type="button" key={page.label} aria-label={label} aria-current={activeSection === item.id && activePage === page.label ? 'page' : undefined} onClick={() => onPageSelect(item.id, page.label)}>
        <Icon size={17} aria-hidden="true" /><span>{label}</span>{'hasAlert' in item && item.hasAlert && <span className="eflow-navigation-alert" aria-label="Actions pending" />}
      </button>;})}
    </div>;
  });
  const projectLinks = (subset: WorkspaceProjectLink[]) => <WorkspaceProjectLinks projects={subset} favorites={favorites}
    activeProjectId={activeSection === 'projects' ? selectedProjectId : undefined}
    onOpen={id => onPageSelect('projects', 'Projects', id)} onToggleFavorite={toggle} />;
  const sectionBody = (id: WorkspaceSectionId) => {
    if (id === 'office-tools') return workspaceKind === 'personal'
      ? destinations(items.filter(item => item.group === 'workspaces' && item.id !== 'projects'))
      : groupOfficeTools(items).map(group => <div key={group.label}><h3>{group.label}</h3>{destinations(group.items)}</div>);
    if (projectsLoading) return <p role="status">Loading projects…</p>;
    const subset = allowedProjects.filter(project => id === 'favorites' ? favorites.has(project.id) : !favorites.has(project.id) && (project.status === 'archived') === (id === 'archived'));
    return <>{id === 'projects' && workspaceKind !== 'personal' && <button type="button" className="eflow-workspace-navigation__destination" aria-current={activeSection === 'projects' && !selectedProjectId ? 'page' : undefined} onClick={() => onPageSelect('projects', 'Projects')}><Folder size={17}/><span>All projects</span></button>}{projectLinks(subset)}{!subset.length && <p>{id === 'favorites' ? 'Star a project for quick access.' : id === 'archived' ? 'No archived projects.' : 'No active projects.'}</p>}</>;
  };
  return <section className="eflow-workspace-navigation eflow-scroll-region" aria-label="Workspace content" data-context-rail="workspaces">
    <header className="eflow-workspace-navigation__header">
      <ContextRailHeader title="Workspace" collapsed={collapsed} mobile={mobile} onCollapse={()=>preference.setCollapsed(!collapsed)} utilities={<ActionMenu trigger={<button type="button" aria-label="Workspace options"><MoreHorizontal size={18}/></button>} actions={[
        ...availableSections.map(id=>({id,label:`${preference.value.sections.includes(id)?'Hide':'Show'} ${scopedSections[id].label}`,onSelect:()=>preference.toggleSection(id)})),
      ]}/>}/>
      {!collapsed && <div className="eflow-workspace-navigation__selector-row">
        {workspaceSelector || (workspaceId === 'unassigned' ? <strong>{workspaceName}</strong> : <WorkspacePopover tooltip="Select workspace" trigger={<button type="button" className="eflow-workspace-selector" aria-label={`${workspaceName} Workspace`}><Building2 size={17} /><strong>{workspaceName} Workspace</strong><ChevronDown size={15} /></button>}>
          <p>Current workspace</p><p aria-current="true">{workspaceName} Workspace</p>
        </WorkspacePopover>)}
      </div>}
      <div className="eflow-workspace-navigation__controls">
        {!collapsed && <><button type="button" className="eflow-workspace-navigation__destination" onClick={onSearch}><Search size={17} /><span>Find pages and projects</span></button>
          </>}
      </div>
    </header>
    {!collapsed && <nav aria-label="Workspace destinations" className="eflow-workspace-navigation__destinations">
      {preference.value.sections.filter(id => availableSections.includes(id)).map(id => {
        const { label, Icon } = scopedSections[id]; const open = !preference.value.closed.includes(id);
        return <section key={id} aria-label={label} className="eflow-workspace-section" data-tour-section={id === 'projects' ? 'projects' : undefined}>
          <button type="button" className="eflow-workspace-section__disclosure" aria-expanded={open} aria-controls={`workspace-section-${id}`} onClick={() => preference.toggleDisclosure(id)}>
            {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}<Icon size={17} /><span>{label}</span>
          </button>
          <div id={`workspace-section-${id}`} hidden={!open}>{sectionBody(id)}</div>
        </section>;
      })}
    </nav>}
  </section>;
}
