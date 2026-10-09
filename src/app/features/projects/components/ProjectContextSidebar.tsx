import * as React from "react";
import { Button, Dialog, DialogContentContainer, IconButton, Menu, MenuItem } from "@vibe/core";
import { Add, Archive, Check, Delete, MoreActions, Work } from "@vibe/icons";
import * as m from "motion/react-m";
import { motionTransition } from "../../../shared/motion";
import type { Project } from "../services/types";
import { Star } from 'lucide-react';
import { ActionMenu } from '../../../components/ui/workspace';
import { useNavigationFavorites, useNavigationDisclosure } from '../../../shared/navigationPreferences';
import { useProjectCompletionAvailability } from '../hooks/useProjectCompletionAvailability';

/**
 * The project context keeps project switching and the people responsible for
 * delivery visible without duplicating any project or task state. It is a
 * presentation-only companion to the existing portfolio and command tabs.
 */
export function ProjectContextSidebar({
  activeProjectId,
  canAdd,
  onCreateProject,
  onImportProposal,
  userId = '',
  contextId = '',
  canArchive = false,
  canComplete = false,
  canDelete = true,
  onOpenPortfolio,
  onOpenProject,
  onArchiveProject,
  onCompleteProject,
  onRestoreProject,
  onDeleteProject,
  projects,
  departmentFilter,
}: {
  activeProjectId?: string;
  canAdd: boolean;
  onCreateProject?: () => void;
  onImportProposal?: () => void;
  userId?: string;
  contextId?: string;
  canArchive?: boolean;
  canComplete?: boolean;
  canDelete?: boolean;
  onOpenPortfolio: () => void;
  onOpenProject: (projectId: string) => void;
  onCompleteProject?: (projectId: string, projectTitle: string) => void;
  onArchiveProject?: (projectId: string, projectTitle: string) => void;
  onRestoreProject?: (projectId: string, projectTitle: string) => void;
  onDeleteProject?: (projectId: string, projectTitle: string) => void;
  projects: Project[];
  departmentFilter?: {
    value: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
  };
}) {
  const [contextMenuProjectId, setContextMenuProjectId] = React.useState<string | null>(null);
  const completion = useProjectCompletionAvailability(projects.find(project=>project.id===contextMenuProjectId),canComplete,`${userId}:${contextId}`);
  const [mobileDetailsOpen, setMobileDetailsOpen] = React.useState(false);
  const { favorites, toggle } = useNavigationFavorites(userId, contextId, projects.map(project => project.id));
  const disclosure = useNavigationDisclosure(userId, contextId);
  const contextProjects = projects.filter((project) => project.status !== "archived");
  const archivedProjects = projects.filter((project) => project.status === "archived");
  const renderProjects = (items: Project[]) => items.map((project) => (
            <m.div
              layout="position"
              transition={motionTransition.navigation}
              className={`eflow-project-context__project ${activeProjectId === project.id ? "eflow-project-context__project--active" : ""}`}
              key={project.id}
            >
              {activeProjectId === project.id && (
                <m.span
                  aria-hidden="true"
                  className="eflow-project-context__active-surface"
                  layoutId="eflow-project-context-active-project"
                  transition={motionTransition.navigation}
                />
              )}
              <button
                aria-current={activeProjectId === project.id ? "page" : undefined}
                className="eflow-project-context__project-select"
                onClick={() => onOpenProject(project.id)}
                type="button"
              >
                <span className="eflow-project-context__project-mark" aria-hidden="true">
                  <Work size={16} />
                </span>
                <span className="eflow-project-context__project-name">{project.title}</span>
              </button>
              {userId && <button type="button" className="eflow-project-context__favorite" aria-label={`${favorites.has(project.id) ? 'Remove' : 'Add'} ${project.title} ${favorites.has(project.id) ? 'from' : 'to'} favorites`} aria-pressed={favorites.has(project.id)} onClick={() => toggle(project.id)}><Star size={15} fill={favorites.has(project.id) ? 'currentColor' : 'none'} /></button>}
              {(canComplete || canArchive || canDelete) && (
                <Dialog
                  aria-label={`${project.title} actions`}
                  content={(
                    <DialogContentContainer>
                      {canComplete && !['completed','archived'].includes(project.status) && !completion.enabled && <p role="status" className="eflow-project-completion-reason">{completion.reason}</p>}
                      <Menu id={`project-context-menu-${project.id}`}>
                        {canComplete && !["completed", "archived"].includes(project.status) && <MenuItem title="View completion requirements" onClick={()=>{setContextMenuProjectId(null);onCompleteProject?.(project.id,project.title);}} />}
                        {canComplete && !["completed", "archived"].includes(project.status) && (
                          <MenuItem title="Mark project complete" disabled={!completion.enabled} disableReason={completion.reason} icon={Check} onClick={() => { if(completion.enabled){setContextMenuProjectId(null); onCompleteProject?.(project.id, project.title);} }} />
                        )}
                        {canArchive && (project.status === "archived" ? (
                          <MenuItem
                            title="Restore project"
                            icon={Archive}
                            onClick={() => {
                              setContextMenuProjectId(null);
                              onRestoreProject?.(project.id, project.title);
                            }}
                          />
                        ) : (
                          <MenuItem
                            title={project.status === "completed" ? "Archive project" : "Archive (complete first)"}
                            disabled={project.status !== "completed"}
                            disableReason="Complete this project before archiving it."
                            icon={Archive}
                            onClick={() => {
                              setContextMenuProjectId(null);
                              if (project.status === "completed") onArchiveProject?.(project.id, project.title);
                            }}
                          />
                        ))}
                        {canDelete && (
                          <MenuItem
                            title="Delete project"
                            icon={Delete}
                            onClick={() => {
                              setContextMenuProjectId(null);
                              onDeleteProject?.(project.id, project.title);
                            }}
                          />
                        )}
                      </Menu>
                    </DialogContentContainer>
                  )}
                  hideTrigger={["clickoutside", "esckey"]}
                  onClickOutside={() => setContextMenuProjectId(null)}
                  onDialogDidHide={() => setContextMenuProjectId(null)}
                  open={contextMenuProjectId === project.id}
                  position="bottom-end"
                  showTrigger={[]}
                >
                  <span className="eflow-project-context__project-menu">
                    <IconButton
                      aria-expanded={contextMenuProjectId === project.id}
                      aria-label={`Open ${project.title} actions`}
                      icon={MoreActions}
                      kind="tertiary"
                      onClick={(event: React.MouseEvent) => {
                        event.stopPropagation();
                        setContextMenuProjectId((current) => current === project.id ? null : project.id);
                      }}
                      size="small"
                    />
                  </span>
                </Dialog>
              )}
            </m.div>
          ));

  return (
    <aside className={`eflow-project-context ${mobileDetailsOpen ? 'eflow-project-context--details-open' : ''}`} aria-label="Projects context">
      <button type="button" className="pt-context-details-toggle" aria-expanded={mobileDetailsOpen} onClick={()=>setMobileDetailsOpen(!mobileDetailsOpen)}>{mobileDetailsOpen ? 'Hide project context' : 'Show project context'}</button>
      <details className="eflow-project-context__favorites" open={disclosure.isOpen('favorites')} onToggle={event => disclosure.setOpen('favorites', event.currentTarget.open)}><summary>Favorites <small>On this device</small></summary><div className="eflow-project-context__list">{favorites.size ? renderProjects(projects.filter(project => favorites.has(project.id))) : <p className="eflow-project-context__empty">Star a project for quick access.</p>}</div></details>
      <details className="eflow-project-context__section" open={disclosure.isOpen('projects')} onToggle={event => disclosure.setOpen('projects', event.currentTarget.open)}><summary>Projects</summary>
        <button
          className="eflow-project-context__title"
          onClick={onOpenPortfolio}
          type="button"
        >
          <span>Open projects</span>
        </button>
        {departmentFilter && (
          <label className="eflow-project-context__department-filter">
            <span>Lead office</span>
            <select
              aria-label="Filter plans and projects by office"
              value={departmentFilter.value}
              onChange={(event) => departmentFilter.onChange(event.target.value)}
            >
              {departmentFilter.options.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        )}
        <div className="eflow-project-context__list">
          {renderProjects(contextProjects)}
          {contextProjects.length === 0 && (
            <p className="eflow-project-context__empty">No active projects.</p>
          )}
        </div>
        {archivedProjects.length > 0 && <details className="mt-3 text-xs text-neutral-500"><summary className="cursor-pointer px-2 py-2">Archived projects ({archivedProjects.length})</summary><div className="eflow-project-context__list">{renderProjects(archivedProjects)}</div></details>}
        {canAdd && onCreateProject && (
          <div className="eflow-project-context__create">
            <Button className="eflow-project-context__add" kind="primary" leftIcon={Add} onClick={onCreateProject} size="small">Create project</Button>
            <ActionMenu trigger={<button type="button" className="eflow-project-context__add-menu" aria-label="Add to workspace">+</button>} actions={[{ id: 'project', label: 'Project', onSelect: onCreateProject }, ...(onImportProposal ? [{ id: 'import', label: 'Import proposal', onSelect: onImportProposal }] : [])]} />
          </div>
        )}
      </details>

    </aside>
  );
}
