import { useAuth } from "../../../contexts/AuthContext";
import { ProjectsWorkspace } from "./ProjectsWorkspace";

/** Heads and Assistant Heads see only proposals owned by their exact organization. */
export function HeadProjectsWorkspace() {
  const { userProfile } = useAuth();
  const organizationId = userProfile?.org_id || userProfile?.departmentId || "";
  return (
    <ProjectsWorkspace
      scope={{ includeAllAccessibleWork: false, scopedOrgIds: organizationId ? [organizationId] : [], enforceOrgScope: true }}
      eyebrow="Office · Planning Portfolio"
    />
  );
}
