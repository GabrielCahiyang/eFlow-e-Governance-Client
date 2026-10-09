import { Folder, Star } from 'lucide-react';

export interface WorkspaceProjectLink { id: string; title: string; status: string }

export function WorkspaceProjectLinks({ projects, favorites, activeProjectId, onOpen, onToggleFavorite }: {
  projects: WorkspaceProjectLink[]; favorites: Set<string>; activeProjectId?: string;
  onOpen: (id: string) => void; onToggleFavorite: (id: string) => void;
}) {
  return <div className="eflow-workspace-projects">{projects.map(project => <div key={project.id} className="eflow-workspace-projects__row">
    <button type="button" className="eflow-workspace-navigation__destination" aria-current={project.id === activeProjectId ? 'page' : undefined} onClick={() => onOpen(project.id)}>
      <Folder size={17} aria-hidden="true" /><span>{project.title}</span>
    </button>
    <button type="button" className="eflow-workspace-projects__favorite" aria-label={`${favorites.has(project.id) ? 'Remove' : 'Add'} ${project.title} ${favorites.has(project.id) ? 'from' : 'to'} favorites`} aria-pressed={favorites.has(project.id)} onClick={() => onToggleFavorite(project.id)}>
      <Star size={15} fill={favorites.has(project.id) ? 'currentColor' : 'none'} aria-hidden="true" />
    </button>
  </div>)}</div>;
}
