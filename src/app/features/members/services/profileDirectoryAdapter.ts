import type { UserProfile } from "../../../types";
import type { Employee } from "../../../services/employeeService";

type DirectoryProfile = Partial<UserProfile>;

function formatRole(role?: string) {
  if (!role) return "Member";
  return role
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function initialsFor(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function getDirectoryProfileId(profile: DirectoryProfile) {
  return profile.id || profile.uid || "";
}

export function getDirectoryProfileName(profile: DirectoryProfile) {
  return profile.full_name || profile.fullName || profile.email || "Unnamed User";
}

export function getDirectoryProfileOrgId(profile: DirectoryProfile) {
  return profile.org_id || profile.departmentId || "";
}

export function profileToDirectoryEmployee(
  profile: DirectoryProfile,
  departmentNameById: ReadonlyMap<string, string>,
): Employee | null {
  const id = getDirectoryProfileId(profile);
  if (!id) return null;

  const name = getDirectoryProfileName(profile);
  const departmentId = getDirectoryProfileOrgId(profile);
  const skills = profile.skills || {};
  const skillList = Object.keys(skills).filter((skill) => skills[skill]).join(", ");
  const jobTitle = formatRole(profile.role);

  return {
    id,
    name,
    jobTitle,
    jobDescription: skillList || jobTitle,
    currentWorkload: typeof profile.workload === "number" ? profile.workload : 0,
    department: departmentId || undefined,
    departmentName: departmentId
      ? departmentNameById.get(departmentId) || departmentId
      : undefined,
    initials: initialsFor(name),
    email: profile.email || undefined,
  };
}
