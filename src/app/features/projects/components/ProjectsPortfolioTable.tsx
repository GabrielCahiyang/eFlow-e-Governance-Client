import {formatDate} from '../../../components/workflow/primitives';
import { Ellipsis } from 'lucide-react';
import { EmptyState as IllustratedEmptyState } from '../../../components/ui/EmptyState';
import { EmptyStateIllustration } from '../../../components/ui/EmptyStateIllustration';
import {
  Avatar,
  AvatarGroup,
  Button,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "@vibe/core";
import { Description, Folder, Open, TextCopy } from "@vibe/icons";
import type { Organization, UserProfile } from "../../../types";
import type { Task } from "../../tasks";
import type { Project } from "../services/types";
import { buildProjectPortfolioSummary } from "../selectors/projectCommandSelectors";
import {
  ProjectLifecycleLabel,
  ProjectScheduleLabel,
} from "../presentation/projectPresentation";
import { ActionMenu } from "../../../components/ui/workspace";
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


  const columns = [
    { id: "project", title: "Project", width: { min: 240, max: "2fr" as const } },
    { id: "department", title: "Lead office", width: { min: 100, max: "0.85fr" as const } },
    { id: "lead", title: "Project lead", width: { min: 150, max: "1.1fr" as const } },
    { id: "lifecycle", title: "Status", width: { min: 105, max: "0.8fr" as const } },
    { id: "schedule", title: "Schedule", width: { min: 155, max: "1fr" as const } },
    { id: "progress", title: "Progress", width: { min: 145, max: "1fr" as const } },
    { id: "target", title: "Target date", width: { min: 120, max: "0.85fr" as const } },
    { id: "actions", title: "Actions", width: 182 },
  ];

  if (!projects.length)
    return (
      <IllustratedEmptyState illustration="projects" size="page"
        title="No projects yet"
        description="Add an approved project to start planning execution."
      />
    );

  return (
    <TableContainer className="eflow-project-table eflow-portfolio-table">
      <Table
        className="eflow-portfolio-grid"
        columns={columns}
        size="large"
        withoutBorder
        emptyState={
          <EmptyState visual={<EmptyStateIllustration kind="projects"/>}
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
          {columns.map(column => <TableHeaderCell key={column.id} title={column.title} />)}
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

            return (
              <TableRow key={project.id} className="eflow-project-row">
                {/* 1. Project Title & Description (Direct Clickable Entry) */}
                <TableCell>
                  <div className="eflow-portfolio-title-cell">
                  <button
                    type="button"
                    onClick={() => onOpen(project.id)}
                    className="eflow-project-row-title"
                  >
                    {project.title}
                  </button>
                  <span className="eflow-project-row-description" title={project.description || undefined}>
                    {project.description || "No description yet"}
                  </span>
                  </div>
                </TableCell>

                {/* 2. Department */}
                <TableCell>
                  <span className="eflow-portfolio-office">
                    {organization?.name || "No office"}
                  </span>
                </TableCell>

                {/* 3. Project Lead */}
                <TableCell>
                  {owner ? (
                    <span className="eflow-person-cell">
                      <Avatar text={initials(owner.full_name)} size="small" />
                      <span>{owner.full_name}</span>
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
                    <span className="eflow-portfolio-muted">Unassigned</span>
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
                    <span className="eflow-portfolio-progress-value">
                      {summary.progress}%
                    </span>
                    <span className="eflow-progress-track" role="progressbar" aria-label={`${project.title} progress`} aria-valuenow={summary.progress} aria-valuemin={0} aria-valuemax={100}>
                      <span style={{ width: `${summary.progress}%` }} />
                    </span>
                    <small className="eflow-portfolio-progress-detail">
                      {summary.completed}/{summary.total} tasks
                    </small>
                  </div>
                </TableCell>

                {/* 7. Target Date */}
                <TableCell>
                  <span className="eflow-portfolio-date">
                    {formatDate(project.targetDate || summary.nextDeadline)}
                  </span>
                </TableCell>

                <TableCell className="eflow-project-actions-cell">
                  <div className="eflow-portfolio-actions">
                    <Button kind="secondary" size="small" rightIcon={Open} onClick={() => onOpen(project.id)}>Open project</Button>
                    <ActionMenu
                      trigger={<button type="button" className="eflow-portfolio-more" aria-label={`More actions for ${project.title}`}><Ellipsis size={18} aria-hidden="true"/></button>}
                      actions={[
                        { id: "open", label: "Open project workspace", icon: <Folder size={16}/>, onSelect: () => onOpen(project.id) },
                        ...(project.sourceCollaborationDraftId && onOpenProposal ? [{ id: "proposal", label: "View proposal context", icon: <Description size={16}/>, onSelect: () => onOpenProposal(project.sourceCollaborationDraftId!) }] : []),
                        { id: "copy", label: "Copy project title", icon: <TextCopy size={16}/>, onSelect: () => {
                          void navigator.clipboard.writeText(project.title).then(() => toast("Project title copied to clipboard.", "success"), () => toast("Could not copy the project title.", "error"));
                        } },
                      ]}
                    />
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
