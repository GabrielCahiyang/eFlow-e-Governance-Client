import * as React from "react";
import {
  Avatar,
  AvatarGroup,
  Button,
  EmptyState,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "@vibe/core";
import { Description, Folder, MoreActions, Open, TextCopy } from "@vibe/icons";
import type { Organization, UserProfile } from "../../../types";
import type { Task } from "../../tasks";
import type { Project } from "../services/types";
import { buildProjectPortfolioSummary } from "../selectors/projectCommandSelectors";
import {
  ProjectLifecycleLabel,
  ProjectScheduleLabel,
} from "../presentation/projectPresentation";
import { useToast } from "../../../components/ui/Toast";

export function ProjectsPortfolioTable({
  projects,
  tasks,
  organizations,
  profiles,
  onOpen,
  onOpenProposal,
}: {
  projects: Project[];
  tasks: Task[];
  organizations: Organization[];
  profiles: UserProfile[];
  onOpen: (id: string) => void;
  onOpenProposal?: (draftId: string) => void;
}) {
  const { toast } = useToast();
  const [activeMenuId, setActiveMenuId] = React.useState<string | null>(null);

  // Close menu on click outside or escape
  React.useEffect(() => {
    if (!activeMenuId) return;
    const handlePointer = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest(".eflow-project-actions-cell")) {
        setActiveMenuId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveMenuId(null);
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeMenuId]);

  const columns = [
    "project",
    "department",
    "lead",
    "lifecycle",
    "schedule",
    "progress",
    "target",
    "actions",
  ].map((id) => ({ id, title: id }));

  if (!projects.length)
    return (
      <EmptyState
        title="No projects yet"
        description="Add an approved project to start planning execution."
      />
    );

  return (
    <TableContainer className="eflow-project-table">
      <Table
        columns={columns}
        emptyState={
          <EmptyState
            title="No projects yet"
            description="Add an approved project to start planning execution."
          />
        }
        errorState={
          <EmptyState
            title="Projects could not load"
            description="Try again in a moment."
          />
        }
      >
        <TableHeader>
          <TableHeaderCell title="Project" />
          <TableHeaderCell title="Lead office" />
          <TableHeaderCell title="Project lead" />
          <TableHeaderCell title="Lifecycle" />
          <TableHeaderCell title="Schedule" />
          <TableHeaderCell title="Progress" />
          <TableHeaderCell title="Target date" />
          <TableHeaderCell title="Actions" />
        </TableHeader>
        <TableBody>
          {projects.map((project) => {
            const summary = buildProjectPortfolioSummary(project, tasks);
            const organization = organizations.find(
              (org) => org.id === project.orgId,
            );
            const owner = profiles.find(
              (profile) => profile.id === project.ownerId,
            );
            const leads = summary.leadIds
              .map((id) => profiles.find((profile) => profile.id === id))
              .filter((profile): profile is UserProfile => Boolean(profile));
            const isMenuOpen = activeMenuId === project.id;

            return (
              <TableRow key={project.id} className="eflow-project-row group">
                {/* 1. Project Title & Description (Direct Clickable Entry) */}
                <TableCell>
                  <button
                    type="button"
                    onClick={() => onOpen(project.id)}
                    className="block text-left font-semibold text-xs text-neutral-900 hover:text-blue-600 transition"
                  >
                    {project.title}
                  </button>
                  <span className="eflow-project-row-description line-clamp-1 text-[11px] text-neutral-400">
                    {project.description || "No project description"}
                  </span>
                </TableCell>

                {/* 2. Department */}
                <TableCell>
                  <span className="text-xs text-neutral-700">
                    {organization?.name || "No office"}
                  </span>
                </TableCell>

                {/* 3. Project Lead */}
                <TableCell>
                  {owner ? (
                    <span className="eflow-person-cell flex items-center gap-1.5 text-xs text-neutral-800">
                      <Avatar text={initials(owner.full_name)} size="small" />
                      <span className="truncate">{owner.full_name}</span>
                    </span>
                  ) : leads.length ? (
                    <AvatarGroup size="small">
                      {leads.slice(0, 3).map((lead) => (
                        <Avatar
                          key={lead.id}
                          text={initials(lead.full_name)}
                          aria-label={lead.full_name}
                        />
                      ))}
                    </AvatarGroup>
                  ) : (
                    <span className="text-xs text-neutral-400">Unassigned</span>
                  )}
                </TableCell>

                {/* 4. Lifecycle Status */}
                <TableCell>
                  <ProjectLifecycleLabel status={project.status} />
                </TableCell>

                {/* 5. Schedule Health */}
                <TableCell>
                  <ProjectScheduleLabel
                    health={summary.health}
                    empty={summary.isEmpty}
                  />
                </TableCell>

                {/* 6. Progress */}
                <TableCell>
                  <div className="eflow-progress-cell">
                    <span className="font-semibold text-xs text-neutral-800">
                      {summary.progress}%
                    </span>
                    <span className="eflow-progress-track">
                      <span style={{ width: `${summary.progress}%` }} />
                    </span>
                    <small className="text-[11px] text-neutral-500">
                      {summary.completed}/{summary.total} tasks
                    </small>
                  </div>
                </TableCell>

                {/* 7. Target Date */}
                <TableCell>
                  <span className="text-xs text-neutral-600">
                    {project.targetDate || summary.nextDeadline || "Unscheduled"}
                  </span>
                </TableCell>

                {/* 8. ONE Primary Action + ONE Overflow Menu */}
                <TableCell className="eflow-project-actions-cell relative">
                  <div className="flex items-center gap-1.5 justify-end">
                    {/* Clear Primary Action */}
                    <Button
                      kind="secondary"
                      size="small"
                      rightIcon={Open}
                      onClick={() => onOpen(project.id)}
                    >
                      Open project
                    </Button>

                    {/* Single Overflow Menu (...) */}
                    <div className="relative">
                      <IconButton
                        aria-label={`More actions for ${project.title}`}
                        icon={MoreActions}
                        kind="tertiary"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(isMenuOpen ? null : project.id);
                        }}
                      />

                      {/* Dropdown Menu */}
                      {isMenuOpen && (
                        <div
                          role="menu"
                          aria-label="Project actions"
                          className="absolute right-0 top-full z-50 mt-1 w-52 rounded-xl border border-neutral-200 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setActiveMenuId(null);
                              onOpen(project.id);
                            }}
                            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition"
                          >
                            <Folder size={14} className="text-neutral-500" />
                            Open project workspace
                          </button>

                          {project.sourceCollaborationDraftId && onOpenProposal && (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setActiveMenuId(null);
                                onOpenProposal(project.sourceCollaborationDraftId!);
                              }}
                              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition"
                            >
                              <Description size={14} className="text-blue-600" />
                              View proposal context
                            </button>
                          )}

                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setActiveMenuId(null);
                              void navigator.clipboard.writeText(project.title);
                              toast("Project title copied to clipboard.", "success");
                            }}
                            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition"
                          >
                            <TextCopy size={14} className="text-neutral-400" />
                            Copy project title
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
