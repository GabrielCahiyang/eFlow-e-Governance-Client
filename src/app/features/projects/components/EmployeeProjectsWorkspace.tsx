import { ProjectsWorkspace } from "./ProjectsWorkspace";

/**
 * Employees use the same operational project workspace as management. Supabase
 * RLS limits the query to projects they own, belong to, lead, or work on.
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
