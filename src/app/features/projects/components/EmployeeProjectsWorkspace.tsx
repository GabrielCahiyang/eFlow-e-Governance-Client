import { ProjectsWorkspace } from "./ProjectsWorkspace";

/**
 * Employees and custom member roles use the same operational project workspace
 * as management. Supabase RLS limits visible projects, and Roles & Access
 * (`projects.create`, `projects.archive`, `projects.delete`, `tasks.verify`,
 * `reports.export`) controls every create/manage/lifecycle action.
 */
export function EmployeeProjectsWorkspace() {
  return (
    <ProjectsWorkspace
      scope={{ includeAllAccessibleWork: false, scopedOrgIds: [] }}
      eyebrow="My Workspace · Projects"
      proposalGrouping={false}
    />
  );
}
