import * as React from "react";
import { Button, Dialog, DialogContentContainer, IconButton, Menu, MenuItem } from "@vibe/core";
import { Add, Archive, Check, Delete, MoreActions } from "@vibe/icons";
import * as m from "motion/react-m";
import { motionTransition } from "../../../shared/motion";
import { tasksForProject } from "../../tasks";
import type { Project, ProjectMember } from "../services/types";

/**
 * The project context keeps project switching and the people responsible for
 * delivery visible without duplicating any project or task state. It is a
 * presentation-only companion to the existing portfolio and command tabs.
 */
export function ProjectContextSidebar({
  activeProjectId,
  canAdd,
  canArchive = false,
  canComplete = false,
  canDelete = true,
  onCreateWorkPlan,
  onOpenPortfolio,
  onOpenProject,
  onArchiveProject,
  onCompleteProject,
  onRestoreProject,
  onDeleteProject,
  profiles,
  projects,
  summaries,
  tasks,
  projectMembers,
  planningCounts,
  planningView,
  onOpenPlanning,
  departmentFilter,
}: {
  activeProjectId?: string;
  canAdd: boolean;
  canArchive?: boolean;
  canComplete?: boolean;
  canDelete?: boolean;
  onCreateWorkPlan: () => void;
  onOpenPortfolio: () => void;
  onOpenProject: (projectId: string) => void;
  onCompleteProject?: (projectId: string, projectTitle: string) => void;
  onArchiveProject?: (projectId: string, projectTitle: string) => void;
  onRestoreProject?: (projectId: string, projectTitle: string) => void;
  onDeleteProject?: (projectId: string, projectTitle: string) => void;
  profiles: any[];
  projects: Project[];
  summaries: Map<string, any>;
  tasks: any[];
  projectMembers: ProjectMember[];
  planningCounts: { workplans: number; signoff: number; actionable: number };
  planningView: "portfolio" | "drafts" | "signoff";
  onOpenPlanning: (view: "drafts" | "signoff") => void;
  departmentFilter?: {
    value: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
  };
}) {
  const [contextMenuProjectId, setContextMenuProjectId] = React.useState<string | null>(null);
  const contextProjects = projects.filter((project) => project.status !== "archived");
  const archivedProjects = projects.filter((project) => project.status === "archived");
  const selectedProject = projects.find((project) => project.id === activeProjectId);
  const selectedTasks = selectedProject ? tasksForProject(tasks, selectedProject.id) : [];
  const selectedSummary = selectedProject ? summaries.get(selectedProject.id) : undefined;
  const contributorIds = new Set(
    selectedProject
      ? [
          ...projectMembers.map((member) => member.userId),
          selectedProject.ownerId,
          ...(selectedSummary?.leadIds || []),
          ...selectedTasks.flatMap((task: any) => [task.assigneeId, ...(task.teamMemberIds || [])]),
        ]
      : contextProjects.flatMap((project) => [project.ownerId, ...(summaries.get(project.id)?.leadIds || [])]),
  );
  const members = profiles.filter((profile) => contributorIds.has(profile.id));

  const renderProjects = (items: Project[]) => items.map((project, index) => (
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
                <span className={`eflow-project-context__project-mark eflow-project-context__project-mark--${index % 4}`} aria-hidden="true">
                  {project.title?.slice(0, 1)?.toUpperCase() || "P"}
                </span>
                <span className="eflow-project-context__project-name">{project.title}</span>
              </button>
              {(canComplete || canArchive || canDelete) && (
                <Dialog
                  aria-label={`${project.title} actions`}
                  content={(
                    <DialogContentContainer>
                      <Menu id={`project-context-menu-${project.id}`}>
                        {canComplete && !["completed", "archived"].includes(project.status) && (
                          <MenuItem title="Mark project complete" icon={Check} onClick={() => { setContextMenuProjectId(null); onCompleteProject?.(project.id, project.title); }} />
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
    <aside className="eflow-project-context" aria-label="Projects context">
      <div className="eflow-project-context__section">
        <button
          className="eflow-project-context__title"
          onClick={onOpenPortfolio}
          type="button"
        >
          <span>Projects</span>
        </button>
        {departmentFilter && (
          <label className="eflow-project-context__department-filter">
            <span>Lead department</span>
            <select
              aria-label="Filter plans and projects by department"
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
        {canAdd && (
          <div className="eflow-project-context__create">
            <Button
              className="eflow-project-context__add"
              kind="primary"
              leftIcon={Add}
              onClick={onCreateWorkPlan}
              size="small"
            >
              Create work plan
            </Button>
          </div>
        )}
      </div>

      <div className="eflow-project-context__planning">
        <h2>Planning</h2>
        <m.button
          className={planningView === "drafts" ? "eflow-project-context__planning-item--active" : ""}
          type="button"
          onClick={() => onOpenPlanning("drafts")}
          whileTap={{ scale: 0.98 }}
        >
          {planningView === "drafts" && (
            <m.span
              aria-hidden="true"
              className="eflow-project-context__planning-active-surface"
              layoutId="eflow-project-context-active-planning"
              transition={motionTransition.navigation}
            />
          )}
          <span>Drafts</span>
          {planningCounts.actionable > 0 && <span className="relative inline-flex h-2 w-2" title="Drafts need your action"><span className="absolute inset-0 animate-ping rounded-full bg-amber-400 opacity-70 motion-reduce:animate-none" /><span className="relative h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.75)]" /></span>}
          <strong>{planningCounts.workplans}</strong>
        </m.button>
        <m.button
          className={planningView === "signoff" ? "eflow-project-context__planning-item--active" : ""}
          type="button"
          onClick={() => onOpenPlanning("signoff")}
          whileTap={{ scale: 0.98 }}
        >
          {planningView === "signoff" && (
            <m.span
              aria-hidden="true"
              className="eflow-project-context__planning-active-surface"
              layoutId="eflow-project-context-active-planning"
              transition={motionTransition.navigation}
            />
          )}
          <span>Waiting for sign-off</span>
          {planningCounts.signoff > 0 && <span className="relative inline-flex h-2 w-2" title="Work plans awaiting sign-off"><span className="absolute inset-0 animate-ping rounded-full bg-amber-400 opacity-70 motion-reduce:animate-none" /><span className="relative h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.75)]" /></span>}
          <strong>{planningCounts.signoff}</strong>
        </m.button>
      </div>

      <div className="eflow-project-context__members">
        <h2>Team Members</h2>
        {members.length ? members.map((member) => (
          <div className="eflow-project-context__member" key={member.id}>
            <span className="eflow-project-context__avatar" aria-hidden="true">
              {(member.full_name || member.fullName || member.email || "?").split(/\s+/).map((name: string) => name[0]).join("").slice(0, 2).toUpperCase()}
            </span>
            <span className="eflow-project-context__member-copy">
              <strong>{member.full_name || member.fullName || member.email}</strong>
            <small>{selectedProject && projectMembers.find((projectMember) => projectMember.userId === member.id)?.role || (contextProjects.some((project) => project.ownerId === member.id) ? "Project owner" : contextProjects.some((project) => (summaries.get(project.id)?.leadIds || []).includes(member.id)) ? "Delivery lead" : "Project contributor")}</small>
            </span>
          </div>
        )) : <p className="eflow-project-context__empty">Project members will appear here.</p>}
      </div>
    </aside>
  );
}
